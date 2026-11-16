// Espejos locales: copias de repos de documentación para consultar sin internet.
// Es lo único del plugin que usa la red, y solo cuando el usuario lo pide (`arana espejo agregar|actualizar`).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { leerConfig, guardarConfig, leerJSON, raizPlugin, asegurarDir } from './rutas.mjs';

const PSEUDO = new Set([
  'tmpfs', 'devtmpfs', 'proc', 'sysfs', 'cgroup', 'cgroup2', 'overlay', 'squashfs', 'efivarfs', 'devpts', 'securityfs',
  'debugfs', 'tracefs', 'configfs', 'fusectl', 'pstore', 'bpf', 'autofs', 'mqueue', 'hugetlbfs', 'ramfs', 'binfmt_misc',
  'nsfs', 'rpc_pipefs', 'fuse.portal', 'fuse.gvfsd-fuse', 'iso9660', 'udf', 'none', 'shm',
]);

/** Convierte la salida de `df -B1 --output=target,avail,fstype` en unidades reales con espacio libre. */
export function leerDf(salida) {
  const unidades = [];
  const vistas = new Set();
  for (const linea of String(salida ?? '').split('\n').slice(1)) {
    const m = /^(.+?)\s+(\d+)\s+(\S+)\s*$/.exec(linea);
    if (!m) continue;
    const [, punto, libre, tipo] = m;
    if (PSEUDO.has(tipo) || tipo.startsWith('fuse.snap')) continue;
    if (/^\/(proc|sys|dev|run|snap|boot\/efi|var\/lib\/docker)(\/|$)/.test(punto) && !/^\/run\/media\//.test(punto)) continue;
    if (vistas.has(punto)) continue;
    vistas.add(punto);
    if (Number(libre) < 1024 ** 3) continue; // con menos de 1 GB libre no sirve para espejos
    unidades.push({ punto, libre: Number(libre), tipo });
  }
  return unidades.sort((a, b) => b.libre - a.libre);
}

export function unidades() {
  const r = spawnSync('df', ['-B1', '--output=target,avail,fstype'], { encoding: 'utf8', timeout: 10000 });
  return r.status === 0 ? leerDf(r.stdout) : [];
}

export function legible(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
}

export function dirEspejos() {
  const d = leerConfig().espejos?.dir;
  return typeof d === 'string' && d ? d : null;
}

export function fijarDir(dir) {
  const abs = path.resolve(dir);
  asegurarDir(abs);
  const c = leerConfig();
  c.espejos = { ...(c.espejos ?? {}), dir: abs };
  guardarConfig(c);
  return abs;
}

export function sugeridos() {
  const j = leerJSON(path.join(raizPlugin(), 'arana', 'espejos-sugeridos.json'), null);
  return Array.isArray(j?.espejos) ? j.espejos : [];
}

/** Valida una URL de repo y devuelve { url, nombre } o lanza un error con mensaje claro. */
export function validarUrl(entrada) {
  const url = String(entrada ?? '').trim();
  if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._~/-]+$/.test(url) || url.includes('..')) {
    throw new Error('La URL debe ser https://servidor/dueño/repo (sin espacios ni caracteres raros).');
  }
  const partes = new URL(url).pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  if (partes.length < 2) throw new Error('La URL debe incluir dueño y repo.');
  const nombre = partes.slice(-2).join('--').replace(/[^A-Za-z0-9._-]/g, '-');
  return { url, nombre };
}

function git(args, opciones = {}) {
  return spawnSync('git', args, { encoding: 'utf8', timeout: 20 * 60 * 1000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, ...opciones });
}

/** Espejos ya descargados en la carpeta configurada. */
export function instalados(dir = dirEspejos()) {
  if (!dir) return [];
  let entradas = [];
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const salida = [];
  for (const e of entradas) {
    if (!e.isDirectory()) continue;
    const ruta = path.join(dir, e.name);
    if (!fs.existsSync(path.join(ruta, '.git'))) continue;
    const url = git(['-C', ruta, 'config', '--get', 'remote.origin.url']).stdout?.trim() ?? '';
    let actualizado = null;
    try {
      actualizado = fs.statSync(path.join(ruta, '.git', 'FETCH_HEAD')).mtime;
    } catch {
      try {
        actualizado = fs.statSync(path.join(ruta, '.git', 'HEAD')).mtime;
      } catch {
        // sin fecha
      }
    }
    salida.push({ nombre: e.name, ruta, url, actualizado });
  }
  return salida.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Descarga un espejo (clon superficial). `solo` limita la copia a ciertas carpetas del repo
 * (útil en monorepos enormes donde la documentación vive en /docs).
 */
export function agregar(entrada, { dir = dirEspejos(), solo = null } = {}) {
  if (!dir) throw new Error('Falta configurar la carpeta de espejos: arana espejo ruta <carpeta>');
  const sugerido = sugeridos().find((s) => s.nombre === entrada || s.url === entrada);
  const { url, nombre } = validarUrl(sugerido ? sugerido.url : entrada);
  const carpetas = solo ?? sugerido?.solo ?? null;
  const destino = path.join(dir, sugerido?.nombre ?? nombre);
  if (fs.existsSync(destino)) return { nombre: path.basename(destino), ruta: destino, yaEstaba: true };
  asegurarDir(dir);
  const args = ['clone', '--depth', '1', '--single-branch'];
  if (Array.isArray(carpetas) && carpetas.length) args.push('--filter=blob:none', '--sparse');
  args.push('--', url, destino);
  const r = git(args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    fs.rmSync(destino, { recursive: true, force: true });
    throw new Error(`git clone falló: ${(r.stderr || r.error?.message || '').trim().split('\n').pop()}`);
  }
  if (Array.isArray(carpetas) && carpetas.length) {
    const s = git(['-C', destino, 'sparse-checkout', 'set', '--', ...carpetas]);
    if (s.status !== 0) throw new Error(`No pude limitar el espejo a ${carpetas.join(', ')}: ${(s.stderr ?? '').trim()}`);
  }
  // Si el repo movió su documentación, la carpeta pedida ya no existe: se avisa en vez de dejar un espejo vacío.
  const faltantes = (Array.isArray(carpetas) ? carpetas : []).filter((c) => !fs.existsSync(path.join(destino, c)));
  return { nombre: path.basename(destino), ruta: destino, yaEstaba: false, faltantes };
}

/** Actualiza uno o todos los espejos con `git pull --ff-only`. */
export function actualizar(nombre = null, { dir = dirEspejos() } = {}) {
  const lista = instalados(dir).filter((e) => !nombre || e.nombre === nombre);
  return lista.map((e) => {
    const r = git(['-C', e.ruta, 'pull', '--ff-only']);
    const ultima = ((r.stdout ?? '') + (r.stderr ?? '')).trim().split('\n').pop() ?? '';
    return { nombre: e.nombre, ok: r.status === 0, detalle: ultima };
  });
}
