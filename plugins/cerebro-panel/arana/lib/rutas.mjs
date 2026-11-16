// Carpetas de configuración y de datos de cerebro-panel.
// Todo lo que el panel escribe vive en la carpeta de datos; nunca en el repo ni en los transcripts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta de configuración de Claude Code (respeta CLAUDE_CONFIG_DIR). */
export function dirConfig(explicita) {
  return path.resolve(explicita || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));
}

/** Carpeta de datos del panel: ${XDG_STATE_HOME:-~/.local/state}/cerebro-panel */
export function dirDatos() {
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'cerebro-panel');
}

/** Raíz del plugin (dos niveles arriba de arana/lib). */
export function raizPlugin() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function asegurarDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convierte un id de sesión en un nombre de archivo seguro. */
export function idSeguro(id) {
  const limpio = String(id ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return limpio || 'sin-sesion';
}

export const rutas = {
  indice: () => path.join(dirDatos(), 'indice.json'),
  eventos: () => path.join(dirDatos(), 'eventos.jsonl'),
  config: () => path.join(dirDatos(), 'config.json'),
  pid: () => path.join(dirDatos(), 'servidor.pid'),
  hilos: () => path.join(dirDatos(), 'hilos'),
  hiloMd: (sesion) => path.join(dirDatos(), 'hilos', `${idSeguro(sesion)}.md`),
  hiloEstado: (sesion) => path.join(dirDatos(), 'hilos', `${idSeguro(sesion)}.json`),
};

export function leerJSON(ruta, defecto = null) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return defecto;
  }
}

/** Escribe a un temporal y renombra, para que nadie lea un archivo a medias. */
export function escribirAtomico(ruta, texto) {
  asegurarDir(path.dirname(ruta));
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, ruta);
}

export function escribirJSON(ruta, objeto) {
  escribirAtomico(ruta, JSON.stringify(objeto));
}

export function leerConfig() {
  const c = leerJSON(rutas.config(), {});
  return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
}

export function guardarConfig(config) {
  escribirAtomico(rutas.config(), JSON.stringify(config, null, 2) + '\n');
}

/** Agrega una línea a eventos.jsonl; si el archivo pasa de ~1 MB conserva solo la última mitad. */
export function agregarEvento(objeto) {
  const ruta = rutas.eventos();
  asegurarDir(path.dirname(ruta));
  try {
    const st = fs.statSync(ruta);
    if (st.size > 1_000_000) {
      const todo = fs.readFileSync(ruta, 'utf8');
      const corte = todo.indexOf('\n', Math.floor(todo.length / 2));
      escribirAtomico(ruta, corte >= 0 ? todo.slice(corte + 1) : '');
    }
  } catch {
    // aún no existe: se crea abajo
  }
  fs.appendFileSync(ruta, JSON.stringify(objeto) + '\n');
}
