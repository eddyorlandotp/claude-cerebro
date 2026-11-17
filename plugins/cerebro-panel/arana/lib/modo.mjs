// Modo ligero / completo.
// Ligero: casi todos los plugins quedan apagados a nivel usuario (sus descripciones no entran al
// contexto de Claude) y la araña entrega las skills por ruta. Completo: se restaura lo que había.
// Solo se usa `claude plugin enable|disable --scope user`: nunca se tocan settings de proyecto.
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { dirConfig, dirDatos, leerJSON, escribirAtomico, leerConfig } from './rutas.mjs';
import { construirIndice } from './indice.mjs';

export const NUCLEO_POR_DEFECTO = [
  'cerebro-panel', 'cerebro-guardia', 'superpowers', 'context7', 'security-guidance', 'playwright', 'typescript-lsp', 'pyright-lsp',
];
export const SIEMPRE_POR_DEFECTO = ['cerebro-base:modo-mentor', 'cerebro-base:investigar-antes-de-codear', 'cerebro-base:ahorrar-tokens'];

const rutaModo = () => path.join(dirDatos(), 'modo.json');
const rutaCostos = () => path.join(dirDatos(), 'costos.json');

/** 'ligero' o 'completo' (por defecto), según modo.json en la carpeta de datos. */
export function leerModo() {
  const m = leerJSON(rutaModo(), null);
  return m && m.modo === 'ligero' ? 'ligero' : 'completo';
}

export function configLigero() {
  const c = leerConfig().ligero ?? {};
  const lista = (v, defecto) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : defecto);
  return { nucleo: lista(c.nucleo, NUCLEO_POR_DEFECTO), siempre: lista(c.siempre, SIEMPRE_POR_DEFECTO) };
}

/** Saca el número de la línea `Always-on: ~1,169 tok` (admite coma de miles y sufijo k). */
export function leerCostoFijo(salida) {
  const m = /Always-on:\s*~?\s*([\d.,]+)\s*(k)?\s*tok/i.exec(String(salida ?? ''));
  if (!m) return null;
  if (m[2]) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 1000);
  const n = parseInt(m[1].replace(/[.,](?=\d{3}\b)/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function entorno(configDir) {
  return { ...process.env, CLAUDE_CONFIG_DIR: configDir };
}

function correr(args, configDir, espera = 60000) {
  return new Promise((resolver) => {
    let salida = '';
    let hijo;
    try {
      hijo = spawn('claude', args, { env: entorno(configDir), stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolver({ codigo: 127, salida: String(e.message) });
      return;
    }
    const reloj = setTimeout(() => hijo.kill('SIGKILL'), espera);
    hijo.stdout.on('data', (d) => (salida += d));
    hijo.stderr.on('data', (d) => (salida += d));
    hijo.on('error', (e) => {
      clearTimeout(reloj);
      resolver({ codigo: 127, salida: String(e.message) });
    });
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      resolver({ codigo: codigo ?? 1, salida });
    });
  });
}

/**
 * Costo fijo (tokens que cada plugin agrega a toda sesión), con `claude plugin details`.
 * Se guarda por plugin@versión en costos.json para no volver a preguntar.
 */
export async function costosFijos(plugins, { configDir, forzar = false, enParalelo = 6 } = {}) {
  const guardados = forzar ? {} : leerJSON(rutaCostos(), {}) ?? {};
  const resultado = {};
  const faltan = [];
  for (const p of plugins) {
    const llave = `${p.clave}#${p.version ?? ''}`;
    if (typeof guardados[llave] === 'number') resultado[p.clave] = guardados[llave];
    else faltan.push({ p, llave });
  }
  let i = 0;
  const trabajador = async () => {
    while (i < faltan.length) {
      const { p, llave } = faltan[i++];
      const r = await correr(['plugin', 'details', p.clave], configDir);
      const costo = r.codigo === 0 ? leerCostoFijo(r.salida) : null;
      resultado[p.clave] = costo;
      if (costo != null) guardados[llave] = costo;
    }
  };
  await Promise.all(Array.from({ length: Math.min(enParalelo, faltan.length) }, trabajador));
  if (faltan.length) {
    try {
      escribirAtomico(rutaCostos(), JSON.stringify(guardados));
    } catch {
      // sin caché: se vuelve a medir la próxima vez
    }
  }
  return resultado;
}

/** Plugins instalados desde un marketplace (los únicos que se pueden prender y apagar con el CLI). */
function instalados(configDir) {
  const indice = construirIndice({ configDir, cwd: null });
  return indice.plugins.filter((p) => p.marketplace && p.marketplace !== 'skills-dir');
}

function activosDeUsuario(configDir) {
  const s = leerJSON(path.join(configDir, 'settings.json'), {}) ?? {};
  return s.enabledPlugins && typeof s.enabledPlugins === 'object' ? s.enabledPlugins : {};
}

/** Foto del estado actual: modo, prendidos, apagados y tokens fijos. */
export async function estadoModo({ configDir, conCostos = true } = {}) {
  const dir = dirConfig(configDir);
  const plugins = instalados(dir);
  const costos = conCostos ? await costosFijos(plugins, { configDir: dir }) : {};
  const { nucleo } = configLigero();
  const filas = plugins.map((p) => ({
    clave: p.clave,
    nombre: p.nombre,
    activo: p.activo,
    costo: costos[p.clave] ?? null,
    nucleo: nucleo.includes(p.nombre) || nucleo.includes(p.clave),
    skills: p.skills.length,
  }));
  const suma = (lista) => lista.reduce((a, f) => a + (f.costo ?? 0), 0);
  const prendidos = filas.filter((f) => f.activo);
  const apagados = filas.filter((f) => !f.activo);
  const modo = leerModo();
  // Desfase: modo.json dice "ligero" pero hay plugins con costo, fuera del núcleo, otra vez prendidos
  // (pasa cuando `claude plugin install` reinstala encima: vuelve a prender lo apagado).
  const desfase = modo === 'ligero' ? prendidos.filter((f) => !f.nucleo && f.costo !== 0).map((f) => f.clave) : [];
  return {
    modo,
    desfase,
    prendidos: prendidos.length,
    apagados: apagados.length,
    tokensFijos: suma(prendidos),
    tokensApagados: suma(apagados),
    sinMedir: filas.filter((f) => f.costo == null).map((f) => f.clave),
    skillsApagadas: apagados.reduce((a, f) => a + f.skills, 0),
    filas,
  };
}

function cambiar(accion, clave, configDir) {
  const r = spawnSync('claude', ['plugin', accion, clave, '--scope', 'user'], { env: entorno(configDir), encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0, salida: ((r.stdout ?? '') + (r.stderr ?? '')).trim() || (r.error ? r.error.message : '') };
}

/**
 * Pasa a modo ligero: guarda el estado previo en modo.json y apaga (nivel usuario) todo plugin
 * prendido que no sea del núcleo y que tenga costo fijo mayor que cero.
 */
export async function aLigero({ configDir, avisar = () => {} } = {}) {
  const dir = dirConfig(configDir);
  const antes = await estadoModo({ configDir: dir });
  const previoGuardado = leerJSON(rutaModo(), null);
  const usuario = activosDeUsuario(dir);
  // Si ya estaba en ligero se conserva la foto original: es la que `completo` debe restaurar.
  const previo = previoGuardado && previoGuardado.modo === 'ligero' && previoGuardado.previo
    ? previoGuardado.previo
    : Object.fromEntries(antes.filas.map((f) => [f.clave, Object.hasOwn(usuario, f.clave) ? usuario[f.clave] !== false : null]));
  const porApagar = antes.filas.filter((f) => Object.hasOwn(usuario, f.clave) && usuario[f.clave] !== false && !f.nucleo && f.costo !== 0);
  // Se escribe antes de tocar nada, para poder restaurar aunque el proceso se corte a la mitad.
  escribirAtomico(rutaModo(), JSON.stringify({ modo: 'ligero', desde: new Date().toISOString(), configDir: dir, previo }, null, 2) + '\n');
  const apagados = [];
  const fallos = [];
  for (const f of porApagar) {
    const r = cambiar('disable', f.clave, dir);
    if (r.ok) apagados.push(f.clave);
    else fallos.push({ clave: f.clave, error: r.salida.split('\n')[0] });
    avisar(`${r.ok ? 'apagado' : 'FALLÓ '} ${f.clave}`);
  }
  const despues = await estadoModo({ configDir: dir });
  return { antes, despues, apagados, fallos };
}

/** Vuelve a modo completo: deja cada plugin como estaba en la foto guardada. */
export async function aCompleto({ configDir, avisar = () => {} } = {}) {
  const dir = dirConfig(configDir);
  const guardado = leerJSON(rutaModo(), null);
  const antes = await estadoModo({ configDir: dir });
  if (!guardado || guardado.modo !== 'ligero' || !guardado.previo) {
    return { antes, despues: antes, cambios: [], fallos: [], sinFoto: true };
  }
  const usuario = activosDeUsuario(dir);
  const cambios = [];
  const fallos = [];
  for (const f of antes.filas) {
    if (!Object.hasOwn(guardado.previo, f.clave)) continue; // instalado después: no se toca
    const debe = guardado.previo[f.clave];
    const esta = Object.hasOwn(usuario, f.clave) ? usuario[f.clave] !== false : null;
    if (debe === esta || debe === null) continue;
    const accion = debe ? 'enable' : 'disable';
    const r = cambiar(accion, f.clave, dir);
    if (r.ok) cambios.push(`${accion} ${f.clave}`);
    else fallos.push({ clave: f.clave, error: r.salida.split('\n')[0] });
    avisar(`${r.ok ? (debe ? 'prendido' : 'apagado') : 'FALLÓ '} ${f.clave}`);
  }
  if (!fallos.length) {
    escribirAtomico(rutaModo(), JSON.stringify({ modo: 'completo', desde: new Date().toISOString(), configDir: dir }, null, 2) + '\n');
  }
  const despues = await estadoModo({ configDir: dir });
  return { antes, despues, cambios, fallos };
}

export function existeClaude() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 });
  return r.status === 0;
}
