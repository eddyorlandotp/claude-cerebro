// Ayudas para las pruebas: carpetas temporales y una instalación falsa de Claude Code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARANA = path.join(RAIZ_PLUGIN, 'arana', 'bin', 'arana.mjs');
/** Carpeta `plugins/` del repo claude-cerebro (hermanos de este plugin), si existe. */
export const HERMANOS = path.resolve(RAIZ_PLUGIN, '..');
export const hayHermanos = fs.existsSync(path.join(HERMANOS, 'cerebro-solana', 'skills'));

export function temporal(prefijo = 'cerebro-panel-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
}

export function escribir(ruta, contenido) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2));
}

export function skill(dir, nombre, descripcion, extra = '') {
  escribir(path.join(dir, nombre, 'SKILL.md'), `---\nname: ${nombre}\ndescription: ${descripcion}\n${extra}---\n\n# ${nombre}\n\nCuerpo de ${nombre}.\n`);
}

/**
 * Arma una carpeta de configuración falsa cuyo marketplace "cerebro" apunta a los plugins reales del repo
 * (se cargan en sitio, como hace Claude Code con un marketplace de carpeta local).
 * `apagados`: nombres de plugins que quedan en false a nivel usuario.
 */
export function configConRepo({ apagados = [] } = {}) {
  const base = temporal();
  const configDir = path.join(base, '.claude');
  const nombres = fs.readdirSync(HERMANOS).filter((n) => fs.existsSync(path.join(HERMANOS, n, '.claude-plugin', 'plugin.json')));
  const instalados = { version: 2, plugins: {} };
  const enabled = {};
  for (const n of nombres) {
    instalados.plugins[`${n}@cerebro`] = [{ scope: 'user', installPath: path.join(HERMANOS, n), version: '0.1.0' }];
    enabled[`${n}@cerebro`] = !apagados.includes(n);
  }
  escribir(path.join(configDir, 'plugins', 'installed_plugins.json'), instalados);
  escribir(path.join(configDir, 'settings.json'), { enabledPlugins: enabled });
  return { base, configDir, datos: path.join(base, 'estado') };
}
