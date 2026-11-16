#!/usr/bin/env node
// La araña: utilidad local (sin IA, sin red) que indexa las skills instaladas, recomienda
// las que encajan con un texto, las entrega por ruta y guarda el hilo de la sesión.
//
//   arana indice [--json]              reconstruye y muestra el índice de skills
//   arana recomendar "<texto>" [--json]
//   arana buscar "<texto>" [-k 5]      como recomendar pero sin umbral
//   arana leer <id|nombre>             imprime una skill lista para usarse (aunque su plugin esté apagado)
//   arana hilo <transcript> [--md]     resumen extractivo de una sesión
//   arana modo ligero|completo|estado
//   arana espejo listar|agregar <url>|actualizar [nombre]|ruta [carpeta]
//   arana hook <Evento>                lo llaman los hooks del plugin (JSON por stdin)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const comando = args[0];

function bandera(nombre) {
  const i = args.indexOf(nombre);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
}

function opcion(nombres, defecto) {
  for (const n of nombres) {
    const i = args.indexOf(n);
    if (i >= 0 && i + 1 < args.length) {
      const v = args[i + 1];
      args.splice(i, 2);
      return v;
    }
  }
  return defecto;
}

// Si quien lee cierra la tubería (p. ej. `arana indice | head`), se termina en silencio.
process.stdout.on('error', (e) => {
  if (e && e.code === 'EPIPE') process.exit(0);
});
const decir = (t = '') => process.stdout.write(t + '\n');
const quejarse = (t) => process.stderr.write(t + '\n');

// ---------------------------------------------------------------- hook (camino rápido, fail-open)

async function correrGancho(evento) {
  // Pase lo que pase, un hook de la araña termina en 0 y pronto.
  const salir = () => process.exit(0);
  const reloj = setTimeout(salir, 4000);
  reloj.unref?.();
  process.on('uncaughtException', salir);
  process.on('unhandledRejection', salir);
  try {
    let cruda = '';
    if (!process.stdin.isTTY) {
      try {
        cruda = fs.readFileSync(0, 'utf8');
      } catch {
        cruda = '';
      }
    }
    let entrada = {};
    try {
      entrada = cruda.trim() ? JSON.parse(cruda) : {};
    } catch {
      entrada = {};
    }
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) entrada = {};
    const { GANCHOS } = await import('../lib/ganchos.mjs');
    const funcion = GANCHOS[evento];
    if (!funcion) return;
    const texto = await funcion(entrada);
    if (texto) process.stdout.write(texto + '\n');
  } catch (e) {
    if (process.env.ARANA_DEPURAR) quejarse(`[araña] ${evento}: ${e?.stack ?? e}`);
  }
}

// ---------------------------------------------------------------- comandos

async function cmdIndice() {
  const json = bandera('--json');
  const { obtenerIndice, todasLasSkills } = await import('../lib/indice.mjs');
  const indice = obtenerIndice({ cwd: process.cwd(), forzar: true });
  if (json) {
    // Sin los pesos de búsqueda, que solo le sirven al recomendador.
    const limpio = {
      ...indice,
      plugins: indice.plugins.map((p) => ({ ...p, skills: p.skills.map(({ terminos, ...s }) => s) })),
    };
    decir(JSON.stringify(limpio, null, 2));
    return;
  }
  const todas = todasLasSkills(indice);
  decir(`${indice.plugins.length} plugins, ${todas.length} skills (${todas.filter((s) => !s.activo).length} de plugins apagados)`);
  for (const p of indice.plugins) {
    const extras = Object.entries(p.extras ?? {}).filter(([, v]) => v).map(([k]) => k).join('+');
    decir(`${p.activo ? 'prendido' : 'apagado '}  ${p.nombre.padEnd(30)} ${String(p.skills.length).padStart(3)} skills${extras ? '  [' + extras + ']' : ''}`);
  }
}

async function cmdRecomendar() {
  const json = bandera('--json');
  const k = Number(opcion(['-k', '--k'], 3)) || 3;
  const texto = args.slice(1).join(' ');
  if (!texto) return uso(2);
  const [{ obtenerIndice }, { recomendar }, { leerModo }] = await Promise.all([
    import('../lib/indice.mjs'), import('../lib/recomendar.mjs'), import('../lib/modo.mjs'),
  ]);
  const lista = recomendar(obtenerIndice({ cwd: process.cwd() }), texto, { k, modo: leerModo() });
  if (json) {
    decir(JSON.stringify(lista.map(({ id, puntaje, activo }) => ({ id, puntaje, activo }))));
    return;
  }
  if (!lista.length) return decir('(sin coincidencia clara)');
  for (const r of lista) decir(`${r.puntaje.toFixed(2)}  ${r.id}${r.activo ? '' : '  (plugin apagado)'}`);
}

async function cmdBuscar() {
  const json = bandera('--json');
  const k = Math.max(1, Math.min(20, Number(opcion(['-k', '--k'], 5)) || 5));
  const texto = args.slice(1).join(' ');
  if (!texto) return uso(2);
  const [{ obtenerIndice }, { buscar }, { leerModo }, { descCorta }] = await Promise.all([
    import('../lib/indice.mjs'), import('../lib/recomendar.mjs'), import('../lib/modo.mjs'), import('../lib/texto.mjs'),
  ]);
  const lista = buscar(obtenerIndice({ cwd: process.cwd() }), texto, { k });
  if (json) {
    decir(JSON.stringify(lista.map(({ id, puntaje, activo, ruta }) => ({ id, puntaje, activo, ruta }))));
    return;
  }
  if (!lista.length) return decir('(ninguna skill local se parece a eso)');
  const ligero = leerModo() === 'ligero';
  for (const r of lista) {
    const nota = r.manual ? ' (solo manual)' : !r.activo && !ligero ? ' (plugin apagado)' : '';
    decir(`${r.id} — ${descCorta(r.desc, 90)}${nota}`);
  }
}

async function cmdLeer() {
  const consulta = args[1];
  if (!consulta) return uso(2);
  const { obtenerIndice, buscarSkill, leerFrontmatter } = await import('../lib/indice.mjs');
  const indice = obtenerIndice({ cwd: process.cwd() });
  const { skill, candidatas } = buscarSkill(indice, consulta);
  if (!skill) {
    if (candidatas.length) {
      quejarse(`"${consulta}" no es un id exacto. ¿Cuál de estas?`);
      for (const c of candidatas) quejarse(`  ${c.id}`);
    } else {
      quejarse(`No encontré la skill "${consulta}". Prueba: arana buscar "<tema>"`);
    }
    process.exitCode = 1;
    return;
  }
  let crudo;
  try {
    crudo = fs.readFileSync(skill.ruta, 'utf8');
  } catch (e) {
    quejarse(`No pude leer ${skill.ruta}: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const plugin = indice.plugins.find((p) => (p.clave ?? p.nombre) === skill.clavePlugin);
  const raiz = plugin?.raiz ?? skill.dir;
  const datos = path.join(indice.configDir, 'plugins', 'data', String(skill.clavePlugin).replace(/[^A-Za-z0-9_-]/g, '-'));
  let cuerpo = leerFrontmatter(crudo).cuerpo.replace(/^\s*\n/, '');
  cuerpo = cuerpo
    .replaceAll('${CLAUDE_SKILL_DIR}', skill.dir)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', raiz)
    .replaceAll('${CLAUDE_PLUGIN_DATA}', datos);
  const extra = args.slice(2).join(' ');
  if (extra) cuerpo = cuerpo.replaceAll('$ARGUMENTS', extra);
  decir(`# skill ${skill.id} · carpeta: ${skill.dir}`);
  if (/(^|\s)!`[^`]+`/.test(cuerpo)) decir('(nota: esta skill trae comandos !`...` que aquí no se ejecutan; córrelos tú si hacen falta)');
  decir(cuerpo.trimEnd());
}

async function cmdHilo() {
  const md = bandera('--md');
  const ruta = args[1];
  if (!ruta) return uso(2);
  const [{ Hilo }, { Interprete }] = await Promise.all([import('../lib/hilo.mjs'), import('../../servidor/lib/transcript.mjs')]);
  let contenido;
  try {
    contenido = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    quejarse(`No pude leer ${ruta}: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const interprete = new Interprete();
  const hilo = new Hilo();
  for (const l of contenido.split('\n')) for (const e of interprete.linea(l)) hilo.ingerir(e);
  decir(md ? hilo.aMarkdown() : JSON.stringify(hilo.resumen(), null, 2));
}

async function cmdModo() {
  const sub = args[1] ?? 'estado';
  const json = bandera('--json');
  const m = await import('../lib/modo.mjs');
  if (!['ligero', 'completo', 'estado'].includes(sub)) return uso(2);
  if (!m.existeClaude()) {
    quejarse('No encuentro el comando `claude` en el PATH; lo necesito para medir y para prender/apagar plugins.');
    process.exitCode = 1;
    return;
  }
  const pintar = (e) =>
    `modo ${e.modo}: ${e.prendidos} plugins prendidos, ${e.apagados} apagados · contexto fijo ≈ ${e.tokensFijos.toLocaleString('es-MX')} tokens por sesión` +
    (e.sinMedir.length ? ` (sin medir: ${e.sinMedir.length})` : '');
  if (sub === 'estado') {
    const e = await m.estadoModo({});
    if (json) return decir(JSON.stringify(e, null, 2));
    decir(pintar(e));
    decir(`skills al alcance de la araña en plugins apagados: ${e.skillsApagadas} (≈ ${e.tokensApagados.toLocaleString('es-MX')} tokens que no se cargan)`);
    for (const f of [...e.filas].sort((a, b) => (b.costo ?? 0) - (a.costo ?? 0))) {
      decir(`  ${f.activo ? 'prendido' : 'apagado '}  ${String(f.costo ?? '?').padStart(6)} tok  ${f.clave}${f.nucleo ? '  (núcleo)' : ''}`);
    }
    return;
  }
  const avisar = (t) => quejarse('  ' + t);
  if (sub === 'ligero') {
    const r = await m.aLigero({ avisar });
    if (json) return decir(JSON.stringify(r, null, 2));
    decir(`antes:   ${pintar(r.antes)}`);
    decir(`después: ${pintar(r.despues)}`);
    decir(`apagados ahora: ${r.apagados.length}${r.fallos.length ? ` · fallaron: ${r.fallos.map((f) => f.clave).join(', ')}` : ''}`);
    decir('Los cambios aplican en la próxima sesión de Claude Code (o con /reload-plugins). Para regresar: arana modo completo');
    if (r.fallos.length) process.exitCode = 1;
    return;
  }
  const r = await m.aCompleto({ avisar });
  if (json) return decir(JSON.stringify(r, null, 2));
  if (r.sinFoto) return decir(`No había un modo ligero que deshacer. ${pintar(r.antes)}`);
  decir(`antes:   ${pintar(r.antes)}`);
  decir(`después: ${pintar(r.despues)}`);
  decir(`restaurados: ${r.cambios.length}${r.fallos.length ? ` · fallaron: ${r.fallos.map((f) => f.clave).join(', ')} (la foto se conserva: vuelve a correr el comando)` : ''}`);
  if (r.fallos.length) process.exitCode = 1;
}

async function cmdEspejo() {
  const sub = args[1] ?? 'listar';
  const e = await import('../lib/espejos.mjs');
  const mostrarUnidades = () => {
    decir('Aún no hay carpeta de espejos. Unidades montadas con espacio libre:');
    for (const u of e.unidades()) decir(`  ${u.punto.padEnd(34)} ${e.legible(u.libre).padStart(9)} libres  (${u.tipo})`);
    decir('Pregúntale al usuario en cuál guardarlos y configúrala con: arana espejo ruta <carpeta>');
  };
  if (sub === 'ruta') {
    if (args[2]) return decir(`Carpeta de espejos: ${e.fijarDir(args[2])}`);
    const dir = e.dirEspejos();
    if (dir) return decir(dir);
    mostrarUnidades();
    process.exitCode = 3;
    return;
  }
  if (sub === 'listar') {
    const dir = e.dirEspejos();
    const hay = e.instalados(dir);
    if (dir) {
      decir(`Carpeta: ${dir}`);
      for (const x of hay) decir(`  descargado  ${x.nombre.padEnd(28)} ${x.actualizado ? x.actualizado.toISOString().slice(0, 10) : '?'}  ${x.ruta}`);
      if (!hay.length) decir('  (ninguno descargado todavía)');
    } else {
      mostrarUnidades();
    }
    const nombres = new Set(hay.map((x) => x.nombre));
    decir('Sugeridos (arana espejo agregar <nombre>):');
    for (const s of e.sugeridos()) {
      if (nombres.has(s.nombre)) continue;
      decir(`  ${s.nombre.padEnd(22)} ${String(s.tamano ?? '?').padEnd(9)} ${s.tema}`);
    }
    return;
  }
  if (sub === 'agregar') {
    if (!args[2]) return uso(2);
    if (!e.dirEspejos()) {
      mostrarUnidades();
      process.exitCode = 3;
      return;
    }
    try {
      const r = e.agregar(args[2]);
      decir(r.yaEstaba ? `Ya estaba: ${r.ruta}` : `Descargado en ${r.ruta}`);
      if (r.faltantes?.length) decir(`Ojo: el repo ya no tiene ${r.faltantes.join(', ')}; revisa dónde quedó su documentación.`);
    } catch (err) {
      quejarse(err.message);
      process.exitCode = 1;
    }
    return;
  }
  if (sub === 'actualizar') {
    const lista = e.actualizar(args[2] ?? null);
    if (!lista.length) decir('No hay espejos que actualizar.');
    for (const r of lista) decir(`${r.ok ? 'ok   ' : 'FALLÓ'} ${r.nombre}: ${r.detalle}`);
    if (lista.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }
  uso(2);
}

function uso(codigo = 0) {
  const texto = [
    'arana: la araña de cerebro-panel (local, sin IA)',
    '  arana indice [--json]',
    '  arana recomendar "<texto>" [--json] [-k 3]',
    '  arana buscar "<texto>" [-k 5]',
    '  arana leer <id|nombre>',
    '  arana hilo <transcript.jsonl> [--md]',
    '  arana modo ligero|completo|estado [--json]',
    '  arana espejo listar | agregar <url|nombre> | actualizar [nombre] | ruta [carpeta]',
    '  arana hook <Evento>   (uso interno de los hooks)',
  ].join('\n');
  (codigo ? quejarse : decir)(texto);
  process.exitCode = codigo;
}

const COMANDOS = {
  indice: cmdIndice, recomendar: cmdRecomendar, buscar: cmdBuscar, leer: cmdLeer, hilo: cmdHilo, modo: cmdModo, espejo: cmdEspejo,
};

if (comando === 'hook') {
  await correrGancho(args[1]);
  process.exit(0);
} else if (COMANDOS[comando]) {
  try {
    await COMANDOS[comando]();
  } catch (e) {
    quejarse(`arana ${comando}: ${e?.message ?? e}`);
    process.exitCode = 1;
  }
} else {
  uso(comando && comando !== 'ayuda' && comando !== '--help' && comando !== '-h' ? 2 : 0);
}
