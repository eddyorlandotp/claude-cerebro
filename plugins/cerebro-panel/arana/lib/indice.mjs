// Índice de skills instaladas en la máquina (plugins prendidos y apagados, personales y del proyecto).
// Solo lee del disco: installed_plugins.json, la caché de plugins, los settings y los SKILL.md.
//
// Dónde vive cada cosa (doc oficial de Claude Code, "Plugin loading reference" y "Skills"):
//   <config>/plugins/installed_plugins.json        registro de instalaciones (installPath, scope, version)
//   <config>/plugins/known_marketplaces.json       marketplaces; los de carpeta local cargan el plugin "en sitio"
//   <config>/plugins/cache/<mkt>/<plugin>/<ver>/   copia de cada plugin
//   <config>/settings.json                         enabledPlugins a nivel usuario
//   <cwd>/.claude/settings.json y settings.local.json   enabledPlugins de proyecto y local (ganan al de usuario)
//   <config>/skills/<x>/SKILL.md                   skills personales
//   <cwd>/.claude/skills/<x>/SKILL.md              skills del proyecto (y carpetas padre hasta la raíz del repo)
import fs from 'node:fs';
import path from 'node:path';
import { dirConfig, rutas, leerJSON, escribirJSON } from './rutas.mjs';
import { terminos } from './texto.mjs';

const VERSION_INDICE = 4;
const UN_DIA = 24 * 60 * 60 * 1000;
const MAX_DESC = 1536; // tope que usa Claude Code para descripción + when_to_use

// ---------------------------------------------------------------- frontmatter

/**
 * Lee el frontmatter YAML de un SKILL.md (solo claves de primer nivel con valor de texto).
 * Soporta comillas, bloques `>` y `|`, y valores que continúan en líneas con sangría.
 */
export function leerFrontmatter(texto) {
  const datos = {};
  const limpio = String(texto ?? '').replace(/^﻿/, '');
  if (!/^---[ \t]*\r?\n/.test(limpio)) return { datos, cuerpo: limpio };
  const lineas = limpio.split(/\r?\n/);
  let fin = -1;
  for (let i = 1; i < lineas.length; i++) {
    if (/^(---|\.\.\.)[ \t]*$/.test(lineas[i])) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return { datos, cuerpo: limpio };
  let clave = null;
  let partes = [];
  let bloque = null; // '>' o '|'
  const cerrar = () => {
    if (clave === null) return;
    let valor = bloque === '|' ? partes.join('\n') : partes.join(' ');
    valor = valor.trim();
    if (!bloque && valor.length >= 2) {
      const c = valor[0];
      if ((c === '"' || c === "'") && valor.endsWith(c)) {
        valor = valor.slice(1, -1);
        valor = c === '"' ? valor.replace(/\\"/g, '"').replace(/\\n/g, ' ') : valor.replace(/''/g, "'");
      }
    }
    datos[clave] = valor;
    clave = null;
    partes = [];
    bloque = null;
  };
  for (let i = 1; i < fin; i++) {
    const l = lineas[i];
    const m = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/.exec(l);
    if (m && !/^\s/.test(l)) {
      cerrar();
      clave = m[1];
      const resto = (m[2] ?? '').trim();
      if (/^[>|][+-]?\d*$/.test(resto)) bloque = resto[0];
      else if (resto && !resto.startsWith('#')) partes.push(resto);
    } else if (clave !== null && (/^\s+\S/.test(l) || l.trim() === '')) {
      if (l.trim()) partes.push(l.trim());
    } else {
      cerrar();
    }
  }
  cerrar();
  return { datos, cuerpo: lineas.slice(fin + 1).join('\n') };
}

const esVerdadero = (v) => /^(true|yes|on|1)$/i.test(String(v ?? '').trim());

// ---------------------------------------------------------------- utilidades de disco

function existe(ruta) {
  try {
    fs.accessSync(ruta);
    return true;
  } catch {
    return false;
  }
}

function esDir(ruta) {
  try {
    return fs.statSync(ruta).isDirectory();
  } catch {
    return false;
  }
}

function listar(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function mtime(ruta) {
  try {
    return Math.floor(fs.statSync(ruta).mtimeMs);
  } catch {
    return 0;
  }
}

/** true si `hija` está dentro de `raiz` (evita rutas que se salen del plugin). */
function dentro(raiz, hija) {
  const rel = path.relative(raiz, hija);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// ---------------------------------------------------------------- lectura de skills

function pesos(nombre, plugin, desc) {
  const t = {};
  const sumar = (texto, peso) => {
    for (const r of terminos(texto)) t[r] = (t[r] ?? 0) + peso;
  };
  sumar(nombre, 3);
  if (plugin) sumar(plugin, 1);
  sumar(desc, 1);
  return t;
}

/** Lee una skill (carpeta con SKILL.md) o un comando (.md suelto) y devuelve su ficha, o null. */
function leerSkill({ archivo, nombrePorDefecto, plugin, prefijo, tipo, firmas }) {
  let texto;
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch {
    return null;
  }
  if (firmas) firmas[archivo] = mtime(archivo);
  const { datos, cuerpo } = leerFrontmatter(texto);
  // En comandos el frontmatter no admite `name`: el nombre sale del archivo.
  const nombre = String((tipo === 'skill' && datos.name) || nombrePorDefecto).trim().replace(/\s+/g, '-');
  if (!nombre) return null;
  let desc = [datos.description, datos.when_to_use].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!desc) {
    const primera = cuerpo.split(/\r?\n/).find((l) => l.trim() && !/^#*\s*$/.test(l)) ?? '';
    desc = primera.replace(/^#+\s*/, '').trim();
  }
  if (desc.length > MAX_DESC) desc = desc.slice(0, MAX_DESC);
  const ficha = {
    id: prefijo ? `${prefijo}:${nombre}` : nombre,
    nombre,
    desc,
    plugin,
    ruta: archivo,
    dir: path.dirname(archivo),
    tipo,
  };
  if (esVerdadero(datos['disable-model-invocation'])) ficha.manual = true;
  ficha.terminos = pesos(nombre, prefijo, desc);
  return ficha;
}

/** Skills dentro de una carpeta: si la carpeta misma trae SKILL.md es una sola; si no, una por subcarpeta. */
function skillsEnCarpeta(dir, ctx) {
  const salida = [];
  if (!esDir(dir)) return salida;
  ctx.firmas[dir] = mtime(dir);
  const propio = path.join(dir, 'SKILL.md');
  if (existe(propio)) {
    const s = leerSkill({ ...ctx, archivo: propio, nombrePorDefecto: path.basename(dir), tipo: 'skill' });
    if (s) salida.push(s);
    return salida;
  }
  for (const e of listar(dir)) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const archivo = path.join(dir, e.name, 'SKILL.md');
    if (!existe(archivo)) continue;
    const s = leerSkill({ ...ctx, archivo, nombrePorDefecto: e.name, tipo: 'skill' });
    if (s) salida.push(s);
  }
  return salida;
}

/** Comandos (.md) de una carpeta; las subcarpetas agregan un segmento al nombre (db/migrate.md -> db:migrate). */
function comandosEnCarpeta(dir, ctx, segmentos = [], nivel = 0) {
  const salida = [];
  if (!esDir(dir) || nivel > 3) return salida;
  ctx.firmas[dir] = mtime(dir);
  for (const e of listar(dir)) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) {
      salida.push(...comandosEnCarpeta(ruta, ctx, [...segmentos, e.name], nivel + 1));
    } else if (e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md') {
      const base = e.name.slice(0, -3);
      const s = leerSkill({ ...ctx, archivo: ruta, nombrePorDefecto: [...segmentos, base].join(':'), tipo: 'comando' });
      if (s) salida.push(s);
    }
  }
  return salida;
}

const aLista = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]).filter((x) => typeof x === 'string');

/** Lee todas las skills y comandos de un plugin instalado. */
function leerPlugin({ nombre, raiz, entradaMkt, firmas }) {
  const manifiesto = leerJSON(path.join(raiz, '.claude-plugin', 'plugin.json'), null);
  firmas[raiz] = mtime(raiz);
  // El prefijo de las skills es el `name` del manifiesto; si no hay manifiesto, el nombre de la entrada del marketplace.
  const prefijo = (manifiesto && typeof manifiesto.name === 'string' && manifiesto.name) || nombre;
  const ctx = { plugin: nombre, prefijo, firmas };
  const vistas = new Set();
  const skills = [];
  const ids = new Set();
  const agregar = (lista) => {
    for (const s of lista) {
      // Si un comando se llama igual que una skill, la skill manda (se leen primero).
      if (vistas.has(s.ruta) || ids.has(s.id)) continue;
      vistas.add(s.ruta);
      ids.add(s.id);
      skills.push(s);
    }
  };
  const resolver = (rel) => {
    const abs = path.resolve(raiz, rel);
    return dentro(raiz, abs) ? abs : null;
  };

  const skillsMkt = !manifiesto && entradaMkt ? aLista(entradaMkt.skills) : [];
  if (skillsMkt.length) {
    // Marketplace "strict: false": la entrada del marketplace dice exactamente qué skills trae el plugin.
    for (const rel of skillsMkt) {
      const abs = resolver(rel);
      if (abs) agregar(skillsEnCarpeta(abs, ctx));
    }
  } else {
    const extra = [...aLista(manifiesto?.skills), ...aLista(entradaMkt?.skills)];
    const porDefecto = path.join(raiz, 'skills');
    if (esDir(porDefecto)) agregar(skillsEnCarpeta(porDefecto, ctx));
    else if (!extra.length && existe(path.join(raiz, 'SKILL.md'))) {
      // Plugin de una sola skill en la raíz.
      const s = leerSkill({ ...ctx, archivo: path.join(raiz, 'SKILL.md'), nombrePorDefecto: prefijo, tipo: 'skill' });
      if (s) agregar([s]);
    }
    for (const rel of extra) {
      const abs = resolver(rel);
      if (abs) agregar(skillsEnCarpeta(abs, ctx));
    }
  }

  // Comandos: la clave `commands` del manifiesto reemplaza a la carpeta commands/.
  const cmds = manifiesto?.commands ?? entradaMkt?.commands;
  if (cmds && typeof cmds === 'object' && !Array.isArray(cmds)) {
    for (const [nombreCmd, def] of Object.entries(cmds)) {
      const abs = def && typeof def.source === 'string' ? resolver(def.source) : null;
      if (!abs) continue;
      const s = leerSkill({ ...ctx, archivo: abs, nombrePorDefecto: nombreCmd, tipo: 'comando' });
      if (s) agregar([s]);
    }
  } else if (aLista(cmds).length) {
    for (const rel of aLista(cmds)) {
      const abs = resolver(rel);
      if (!abs) continue;
      if (esDir(abs)) agregar(comandosEnCarpeta(abs, ctx));
      else if (abs.endsWith('.md')) {
        const s = leerSkill({ ...ctx, archivo: abs, nombrePorDefecto: path.basename(abs, '.md'), tipo: 'comando' });
        if (s) agregar([s]);
      }
    }
  } else {
    agregar(comandosEnCarpeta(path.join(raiz, 'commands'), ctx));
  }

  const tieneMd = (dir) => listar(dir).some((e) => e.name.endsWith('.md') || e.isDirectory());
  const extras = {
    hooks: existe(path.join(raiz, 'hooks', 'hooks.json')) || Boolean(manifiesto?.hooks),
    mcp: existe(path.join(raiz, '.mcp.json')) || Boolean(manifiesto?.mcpServers) || Boolean(entradaMkt?.mcpServers),
    agentes: tieneMd(path.join(raiz, 'agents')) || Boolean(manifiesto?.agents),
  };
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return { skills, extras };
}

// ---------------------------------------------------------------- settings y estado de plugins

function leerEnabled(ruta) {
  const s = leerJSON(ruta, null);
  const e = s && typeof s === 'object' ? s.enabledPlugins : null;
  return e && typeof e === 'object' && !Array.isArray(e) ? e : {};
}

const RUTA_ADMINISTRADA = '/etc/claude-code/managed-settings.json';

/** Carpetas del proyecto donde buscar .claude/ : el cwd y sus padres hasta la raíz del repo (donde está .git). */
function carpetasProyecto(cwd, configDir) {
  if (!cwd) return [];
  const salida = [];
  let actual = path.resolve(cwd);
  for (let i = 0; i < 12; i++) {
    // La carpeta de config del usuario no cuenta como proyecto.
    if (path.join(actual, '.claude') !== configDir) salida.push(actual);
    if (existe(path.join(actual, '.git'))) break;
    const padre = path.dirname(actual);
    if (padre === actual) break;
    actual = padre;
  }
  // Sin repo, solo cuenta el cwd.
  return existe(path.join(actual, '.git')) ? salida : salida.slice(0, 1);
}

// ---------------------------------------------------------------- construcción

/** Parte que no depende del proyecto: plugins instalados y skills personales. Es lo que se guarda en disco. */
function construirBase(configDir) {
  const firmas = {};
  const raizPlugins = process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
    ? path.resolve(process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR)
    : path.join(configDir, 'plugins');
  const rutaInstalados = path.join(raizPlugins, 'installed_plugins.json');
  const rutaMkts = path.join(raizPlugins, 'known_marketplaces.json');
  const rutaSettings = path.join(configDir, 'settings.json');
  for (const r of [rutaInstalados, rutaMkts, rutaSettings, RUTA_ADMINISTRADA]) firmas[r] = mtime(r);

  const instalados = leerJSON(rutaInstalados, null);
  const mkts = leerJSON(rutaMkts, {}) ?? {};
  const cacheEntradas = new Map();
  const entradasDe = (mkt) => {
    if (cacheEntradas.has(mkt)) return cacheEntradas.get(mkt);
    const info = mkts[mkt];
    let resultado = { lugar: null, enSitio: false, json: null };
    if (info && typeof info.installLocation === 'string') {
      let lugar = info.installLocation;
      let archivo = path.join(lugar, '.claude-plugin', 'marketplace.json');
      if (!esDir(lugar) && lugar.endsWith('.json')) {
        archivo = lugar;
        lugar = path.dirname(path.dirname(lugar));
      }
      firmas[archivo] = mtime(archivo);
      const tipo = info.source && info.source.source;
      resultado = { lugar, enSitio: tipo === 'directory' || tipo === 'file', json: leerJSON(archivo, null) };
    }
    cacheEntradas.set(mkt, resultado);
    return resultado;
  };

  const registros = new Map(); // clave -> { installPath, version }
  const lista = instalados && typeof instalados.plugins === 'object' && instalados.plugins ? instalados.plugins : {};
  for (const [clave, valor] of Object.entries(lista)) {
    const entradas = Array.isArray(valor) ? valor : valor ? [valor] : [];
    const e = entradas.find((x) => x && x.scope === 'user') ?? entradas.find((x) => x && x.installPath);
    if (e && typeof e.installPath === 'string') registros.set(clave, { installPath: e.installPath, version: e.version ?? null });
  }
  if (!instalados) {
    // Sin registro (versión vieja o archivo ilegible): se recorre la caché y se toma la versión más reciente.
    const cache = path.join(raizPlugins, 'cache');
    for (const m of listar(cache)) {
      if (!m.isDirectory()) continue;
      for (const p of listar(path.join(cache, m.name))) {
        if (!p.isDirectory()) continue;
        const versiones = listar(path.join(cache, m.name, p.name))
          .filter((v) => v.isDirectory())
          .map((v) => path.join(cache, m.name, p.name, v.name))
          .sort((a, b) => mtime(b) - mtime(a));
        if (versiones[0]) registros.set(`${p.name}@${m.name}`, { installPath: versiones[0], version: path.basename(versiones[0]) });
      }
    }
  }

  const plugins = [];
  for (const [clave, reg] of registros) {
    const arroba = clave.lastIndexOf('@');
    const nombre = arroba > 0 ? clave.slice(0, arroba) : clave;
    const marketplace = arroba > 0 ? clave.slice(arroba + 1) : null;
    const mkt = marketplace ? entradasDe(marketplace) : { lugar: null, enSitio: false, json: null };
    const entradaMkt = (Array.isArray(mkt.json?.plugins) ? mkt.json.plugins : []).find((p) => p && p.name === nombre) ?? null;
    let raiz = reg.installPath;
    // Marketplace de carpeta local + plugin de ruta relativa: Claude Code lo carga en sitio, no desde la caché.
    if (mkt.enSitio && entradaMkt && typeof entradaMkt.source === 'string') {
      const base = path.resolve(mkt.lugar, mkt.json?.metadata?.pluginRoot ?? '.');
      const enSitio = path.resolve(base, entradaMkt.source);
      if (esDir(enSitio)) raiz = enSitio;
    }
    if (!esDir(raiz)) continue;
    const { skills, extras } = leerPlugin({ nombre, raiz, entradaMkt, firmas });
    plugins.push({ clave, nombre, marketplace, version: reg.version, raiz, extras, skills });
  }
  plugins.sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Skills y comandos personales. Una carpeta con .claude-plugin/plugin.json dentro de skills/ es un plugin "@skills-dir".
  const personales = [];
  const dirSkills = path.join(configDir, 'skills');
  firmas[dirSkills] = mtime(dirSkills);
  const ctxPersonal = { plugin: 'personales', prefijo: '', firmas };
  for (const e of listar(dirSkills)) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const dir = path.join(dirSkills, e.name);
    const manifiesto = leerJSON(path.join(dir, '.claude-plugin', 'plugin.json'), null);
    if (manifiesto) {
      const nombre = typeof manifiesto.name === 'string' && manifiesto.name ? manifiesto.name : e.name;
      const { skills, extras } = leerPlugin({ nombre, raiz: dir, entradaMkt: null, firmas });
      plugins.push({
        clave: `${nombre}@skills-dir`, nombre, marketplace: 'skills-dir', version: manifiesto.version ?? null, raiz: dir,
        extras, skills, porDefecto: manifiesto.defaultEnabled !== false,
      });
      continue;
    }
    const archivo = path.join(dir, 'SKILL.md');
    if (!existe(archivo)) continue;
    const s = leerSkill({ ...ctxPersonal, archivo, nombrePorDefecto: e.name, tipo: 'skill' });
    if (s) personales.push(s);
  }
  personales.push(...comandosEnCarpeta(path.join(configDir, 'commands'), ctxPersonal));
  personales.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: VERSION_INDICE,
    generado: Date.now(),
    configDir,
    firmas,
    usuario: leerEnabled(rutaSettings),
    administrado: leerEnabled(RUTA_ADMINISTRADA),
    plugins,
    personales,
  };
}

function baseVigente(base, configDir) {
  if (!base || base.version !== VERSION_INDICE || base.configDir !== configDir) return false;
  if (!base.generado || Date.now() - base.generado > UN_DIA) return false;
  for (const [ruta, antes] of Object.entries(base.firmas ?? {})) {
    if (mtime(ruta) !== antes) return false;
  }
  return true;
}

/** Aplica lo que depende del proyecto: settings de proyecto/local y skills de <cwd>/.claude. */
function aplicarProyecto(base, cwd) {
  const carpetas = carpetasProyecto(cwd, base.configDir);
  // Los settings de proyecto son los de la carpeta donde arrancó la sesión; si ahí no hay, el padre más cercano que tenga.
  const conSettings = carpetas.find(
    (c) => existe(path.join(c, '.claude', 'settings.json')) || existe(path.join(c, '.claude', 'settings.local.json')),
  );
  const raizProyecto = carpetas.length ? carpetas[0] : null;
  const delProyecto = conSettings ? leerEnabled(path.join(conSettings, '.claude', 'settings.json')) : {};
  const local = conSettings ? leerEnabled(path.join(conSettings, '.claude', 'settings.local.json')) : {};
  // Precedencia de menor a mayor: usuario, proyecto, local, administrado. Gana la fuente más alta que mencione el id.
  const fuentes = [base.usuario ?? {}, delProyecto, local, base.administrado ?? {}];
  const estaActivo = (plugin) => {
    let valor;
    for (const f of fuentes) if (Object.hasOwn(f, plugin.clave)) valor = f[plugin.clave];
    if (valor === undefined) return plugin.marketplace === 'skills-dir' ? plugin.porDefecto !== false : false;
    return valor !== false && valor !== null;
  };

  const plugins = base.plugins.map((p) => ({
    nombre: p.nombre,
    marketplace: p.marketplace,
    activo: estaActivo(p),
    clave: p.clave,
    version: p.version,
    raiz: p.raiz,
    extras: p.extras,
    skills: p.skills,
  }));

  if (base.personales?.length) {
    plugins.push({
      nombre: 'personales', marketplace: null, activo: true, clave: 'personales', version: null,
      raiz: path.join(base.configDir, 'skills'), extras: { hooks: false, mcp: false, agentes: false }, skills: base.personales,
    });
  }

  const proyecto = [];
  const firmas = {};
  const ctx = { plugin: 'proyecto', prefijo: '', firmas };
  const vistos = new Set(base.personales?.map((s) => s.id) ?? []);
  for (const carpeta of carpetas) {
    const dir = path.join(carpeta, '.claude', 'skills');
    const nuevas = [];
    for (const e of listar(dir)) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const archivo = path.join(dir, e.name, 'SKILL.md');
      if (!existe(archivo) || existe(path.join(dir, e.name, '.claude-plugin', 'plugin.json'))) continue;
      const s = leerSkill({ ...ctx, archivo, nombrePorDefecto: e.name, tipo: 'skill' });
      if (s) nuevas.push(s);
    }
    nuevas.push(...comandosEnCarpeta(path.join(carpeta, '.claude', 'commands'), ctx));
    for (const s of nuevas) {
      if (vistos.has(s.id)) continue; // la más cercana al cwd (o la personal) gana
      vistos.add(s.id);
      proyecto.push(s);
    }
  }
  if (proyecto.length) {
    proyecto.sort((a, b) => a.id.localeCompare(b.id));
    plugins.push({
      nombre: 'proyecto', marketplace: null, activo: true, clave: 'proyecto', version: null,
      raiz: raizProyecto, extras: { hooks: false, mcp: false, agentes: false }, skills: proyecto,
    });
  }
  return { generado: base.generado, configDir: base.configDir, cwd: cwd ? path.resolve(cwd) : null, plugins };
}

/** Construye el índice completo leyendo el disco (sin usar ni tocar la copia guardada). */
export function construirIndice({ configDir, cwd } = {}) {
  return aplicarProyecto(construirBase(dirConfig(configDir)), cwd);
}

/**
 * Devuelve el índice usando la copia guardada en la carpeta de datos; la reconstruye si
 * algo cambió en disco (mtime), si tiene más de un día, o si `forzar` es true.
 */
export function obtenerIndice({ configDir, cwd, forzar = false } = {}) {
  const dir = dirConfig(configDir);
  let base = forzar ? null : leerJSON(rutas.indice(), null);
  if (!baseVigente(base, dir)) {
    base = construirBase(dir);
    try {
      escribirJSON(rutas.indice(), base);
    } catch {
      // sin permiso de escritura: se usa en memoria y ya
    }
  }
  return aplicarProyecto(base, cwd);
}

// ---------------------------------------------------------------- consultas

/** Lista plana de skills con el estado de su plugin. */
export function todasLasSkills(indice) {
  const salida = [];
  for (const p of indice?.plugins ?? []) {
    for (const s of p.skills ?? []) salida.push({ ...s, activo: p.activo !== false, extras: p.extras, clavePlugin: p.clave ?? p.nombre });
  }
  return salida;
}

/**
 * Busca una skill por id (`plugin:skill`), por nombre suelto o por `/comando`.
 * Devuelve { skill } si hay una sola, o { candidatas } si el nombre es ambiguo o no existe.
 */
export function buscarSkill(indice, consulta) {
  const q = String(consulta ?? '').trim().replace(/^\//, '');
  if (!q) return { skill: null, candidatas: [] };
  const todas = todasLasSkills(indice);
  const exacta = todas.filter((s) => s.id === q);
  if (exacta.length) return { skill: exacta.find((s) => s.activo) ?? exacta[0], candidatas: exacta };
  const nombre = q.includes(':') ? q.slice(q.lastIndexOf(':') + 1) : q;
  // También vale el nombre de la carpeta, que puede diferir del `name` del frontmatter.
  let porNombre = todas.filter((s) => s.nombre === nombre || (s.tipo === 'skill' && path.basename(s.dir) === nombre));
  if (q.includes(':')) {
    const plugin = q.slice(0, q.indexOf(':'));
    const delPlugin = porNombre.filter((s) => s.plugin === plugin || s.id.startsWith(plugin + ':'));
    if (delPlugin.length) porNombre = delPlugin;
  }
  if (porNombre.length === 1) return { skill: porNombre[0], candidatas: porNombre };
  if (porNombre.length > 1) {
    const activas = porNombre.filter((s) => s.activo);
    return { skill: activas.length === 1 ? activas[0] : null, candidatas: porNombre };
  }
  const parecidas = todas.filter((s) => s.id.includes(nombre) || s.nombre.includes(nombre)).slice(0, 8);
  return { skill: null, candidatas: parecidas };
}

/** Convierte el índice en el evento `biblioteca` para la interfaz (sin plugins vacíos). */
export function aBiblioteca(indice, { modo = 'completo' } = {}) {
  const plugins = [];
  for (const p of indice?.plugins ?? []) {
    if (!p.skills?.length) continue;
    plugins.push({
      nombre: p.nombre,
      // En modo ligero todo lo instalado está "al alcance de la araña".
      activo: modo === 'ligero' ? true : p.activo !== false,
      skills: p.skills.map((s) => ({ id: s.id, nombre: s.nombre, desc: s.desc.length > 160 ? s.desc.slice(0, 159) + '…' : s.desc })),
    });
  }
  return { tipo: 'biblioteca', modo, plugins };
}
