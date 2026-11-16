// Lo que hace cada hook del plugin. Cada función recibe el JSON que Claude Code manda por stdin
// y devuelve el texto que se imprime (contexto adicional para Claude) o '' para no agregar nada.
// Quien llama (arana.mjs) garantiza el fail-open: aquí se puede lanzar sin miedo.
import fs from 'node:fs';
import path from 'node:path';
import { rutas, dirDatos, leerJSON, escribirAtomico, escribirJSON, agregarEvento, idSeguro, leerConfig, asegurarDir } from './rutas.mjs';
import { recortar, descCorta } from './texto.mjs';

const MAX_COMPLETO = 230; // caracteres del aviso en modo completo (≈ 60 tokens)
const MAX_LIGERO = 450; // caracteres del aviso en modo ligero (≈ 120 tokens)

const rutaSesion = (sesion) => path.join(dirDatos(), 'sesiones', `${idSeguro(sesion)}.json`);

function yaSugeridas(sesion) {
  const j = leerJSON(rutaSesion(sesion), null);
  return new Set(Array.isArray(j?.sugeridas) ? j.sugeridas : []);
}

function guardarSugeridas(sesion, conjunto) {
  try {
    escribirJSON(rutaSesion(sesion), { sugeridas: [...conjunto].slice(-200) });
  } catch {
    // no pasa nada: solo se repetirá una sugerencia
  }
}

function olvidarSugeridas(sesion) {
  try {
    fs.rmSync(rutaSesion(sesion), { force: true });
  } catch {
    // nada
  }
}

/** Borra archivos de sesiones viejas (más de 30 días) para que la carpeta de datos no crezca sin fin. */
function limpiar() {
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const dir of [path.join(dirDatos(), 'sesiones'), rutas.hilos()]) {
    let nombres = [];
    try {
      nombres = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of nombres) {
      const r = path.join(dir, n);
      try {
        if (fs.statSync(r).mtimeMs < limite) fs.rmSync(r, { force: true });
      } catch {
        // nada
      }
    }
  }
}

const cwdDe = (entrada) => process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();

// ---------------------------------------------------------------- UserPromptSubmit

/** Arma el aviso de skills para un mensaje. Exportada aparte para poder probarla y medirla. */
export function avisoDeSkills(recomendadas, { modo, vistas = new Set() }) {
  const nuevas = recomendadas.filter((r) => !vistas.has(r.id));
  if (!nuevas.length) return { texto: '', ids: [] };
  if (modo === 'ligero') {
    // Las de plugins prendidos ya están en el contexto de Claude: basta el nombre.
    const locales = nuevas.filter((r) => !r.activo);
    const activas = nuevas.filter((r) => r.activo);
    const armar = (lista, largoDesc) => {
      const partes = [];
      if (lista.length) {
        const items = lista.map((r) => `${r.id} — ${descCorta(r.desc, largoDesc)}`);
        let frase = `[araña] Skills locales que encajan (cárgalas solo si aplican: corre \`arana leer <id>\`): ${items.join('; ')}`;
        // Un solo aviso por plugin apagado que además trae MCP o agentes (eso no se carga leyendo la skill).
        const conExtras = [...new Set(lista.filter((r) => r.extras && (r.extras.mcp || r.extras.agentes)).map((r) => r.clavePlugin))];
        for (const plugin of conExtras) {
          frase += ` (plugin ${plugin.split('@')[0]} apagado: su MCP/agentes no están disponibles; préndelo con \`claude plugin enable ${plugin} --scope local\` si los necesitas)`;
        }
        partes.push(frase);
      }
      if (activas.length) partes.push(`${lista.length ? 'Ya activas' : '[araña] Skills que encajan'}: ${activas.map((r) => r.id).join(', ')}.`);
      return partes.join('. ').replace(/\.\.$/, '.');
    };
    let lista = locales.slice();
    let texto = armar(lista, 48);
    if (texto.length > MAX_LIGERO) texto = armar(lista, 32);
    while (texto.length > MAX_LIGERO && lista.length > 1) {
      lista = lista.slice(0, -1);
      texto = armar(lista, 32);
    }
    return { texto, ids: [...lista, ...activas].map((r) => r.id) };
  }
  let activas = nuevas.filter((r) => r.activo);
  const apagadas = nuevas.filter((r) => !r.activo);
  const armar = () => {
    const partes = [];
    if (activas.length) partes.push(`[araña] Skills que encajan: ${activas.map((r) => r.id).join(', ')}.`);
    if (apagadas.length) partes.push(`${activas.length ? '' : '[araña] '}Apagadas que servirían: ${apagadas.map((r) => r.id).join(', ')}.`);
    return partes.join(' ');
  };
  let texto = armar();
  while (texto.length > MAX_COMPLETO && activas.length > 1) {
    activas = activas.slice(0, -1);
    texto = armar();
  }
  return { texto, ids: [...activas, ...apagadas].map((r) => r.id) };
}

export async function alEnviarPrompt(entrada) {
  const prompt = typeof entrada.prompt === 'string' ? entrada.prompt.trim() : '';
  if (prompt.length < 6 || prompt.startsWith('/') || prompt.startsWith('!')) return '';
  if (leerConfig().arana?.sugerir === false) return '';
  const [{ obtenerIndice }, { recomendar }, { leerModo }] = await Promise.all([
    import('./indice.mjs'),
    import('./recomendar.mjs'),
    import('./modo.mjs'),
  ]);
  const modo = leerModo();
  const indice = obtenerIndice({ cwd: cwdDe(entrada) });
  const recomendadas = recomendar(indice, prompt.slice(0, 2000), { k: 3, modo });
  if (!recomendadas.length) return '';
  const sesion = entrada.session_id;
  const vistas = sesion ? yaSugeridas(sesion) : new Set();
  const { texto, ids } = avisoDeSkills(recomendadas, { modo, vistas });
  if (texto && sesion) {
    for (const id of ids) vistas.add(id);
    guardarSugeridas(sesion, vistas);
  }
  return texto;
}

// ---------------------------------------------------------------- hilo (Stop, PreCompact, SessionStart)

/**
 * Pone al día hilos/<sesion>.md leyendo solo lo nuevo del transcript (guarda el punto donde se quedó).
 * Devuelve el markdown.
 */
export async function actualizarHilo({ sesion, transcript }) {
  if (!sesion || !transcript) return '';
  const [{ Hilo }, { Interprete }] = await Promise.all([import('./hilo.mjs'), import('../../servidor/lib/transcript.mjs')]);
  let tamano;
  try {
    tamano = fs.statSync(transcript).size;
  } catch {
    return '';
  }
  let estado = leerJSON(rutas.hiloEstado(sesion), null);
  if (!estado || estado.v !== 1 || estado.transcript !== transcript || estado.offset > tamano) estado = null;
  const hilo = estado ? Hilo.desdeJSON(estado.hilo) : new Hilo();
  const interprete = new Interprete({ sesion });
  if (estado?.cwd) interprete.info.cwd = estado.cwd;
  if (estado?.tareas) interprete.tareasCreadas = estado.tareas;
  let offset = estado ? estado.offset : 0;

  const fd = fs.openSync(transcript, 'r');
  try {
    const TROZO = 4 * 1024 * 1024;
    let resto = Buffer.alloc(0);
    while (offset < tamano) {
      const buf = Buffer.alloc(Math.min(TROZO, tamano - offset));
      const leidos = fs.readSync(fd, buf, 0, buf.length, offset);
      if (leidos <= 0) break;
      const datos = Buffer.concat([resto, buf.subarray(0, leidos)]);
      const corte = datos.lastIndexOf(10);
      if (corte < 0) {
        resto = datos;
        offset += leidos;
        continue;
      }
      for (const l of datos.subarray(0, corte).toString('utf8').split('\n')) {
        for (const e of interprete.linea(l)) hilo.ingerir(e);
      }
      resto = datos.subarray(corte + 1);
      offset += leidos;
    }
    offset -= resto.length; // la última línea a medias se lee la próxima vez
  } finally {
    fs.closeSync(fd);
  }
  const md = hilo.aMarkdown();
  asegurarDir(rutas.hilos());
  escribirJSON(rutas.hiloEstado(sesion), {
    v: 1, transcript, offset, cwd: interprete.info.cwd, tareas: interprete.tareasCreadas, hilo: hilo.aJSON(),
  });
  if (md) escribirAtomico(rutas.hiloMd(sesion), md + '\n');
  return md;
}

export async function alDetenerse(entrada) {
  await actualizarHilo({ sesion: entrada.session_id, transcript: entrada.transcript_path });
  agregarEvento({ ts: Date.now(), evento: 'Stop', sesion: entrada.session_id ?? null });
  return '';
}

export async function antesDeCompactar(entrada) {
  await actualizarHilo({ sesion: entrada.session_id, transcript: entrada.transcript_path });
  agregarEvento({ ts: Date.now(), evento: 'PreCompact', sesion: entrada.session_id ?? null, disparo: entrada.trigger ?? null });
  limpiar();
  return '';
}

/** Nota de arranque del modo ligero (≤ ~120 tokens). */
export function notaLigera({ skillsApagadas, siempre }) {
  let t = `[araña] Modo ligero: hay ${skillsApagadas} skills locales apagadas para ahorrar contexto; en cada mensaje te sugiero las que encajan. ` +
    'Si una tarea podría tener skill y no sugerí nada, corre `arana buscar "<tema>"`. Carga una skill con `arana leer <id>`.';
  if (siempre.length) t += ` Ten presentes: ${siempre.join(', ')}.`;
  return t;
}

export async function alIniciarSesion(entrada) {
  const origen = entrada.source ?? 'startup';
  const sesion = entrada.session_id;
  agregarEvento({ ts: Date.now(), evento: 'SessionStart', sesion: sesion ?? null, origen });
  // Tras compactar o limpiar, Claude ya no recuerda qué se le sugirió.
  if (sesion && origen !== 'resume') olvidarSugeridas(sesion);

  if (origen === 'compact' || origen === 'resume') {
    if (leerConfig().arana?.hilo === false || !sesion) return '';
    let md = '';
    try {
      md = fs.readFileSync(rutas.hiloMd(sesion), 'utf8').trim();
    } catch {
      md = await actualizarHilo({ sesion, transcript: entrada.transcript_path });
    }
    return md ? md.slice(0, 1800) : '';
  }

  // startup | clear: solo se dice algo en modo ligero.
  const { leerModo, configLigero } = await import('./modo.mjs');
  if (leerModo() !== 'ligero') return '';
  const { obtenerIndice } = await import('./indice.mjs');
  const indice = obtenerIndice({ cwd: cwdDe(entrada) });
  let skillsApagadas = 0;
  const existentes = new Set();
  for (const p of indice.plugins) {
    for (const s of p.skills) existentes.add(s.id);
    if (!p.activo) skillsApagadas += p.skills.length;
  }
  if (!skillsApagadas) return '';
  const siempre = configLigero().siempre.filter((id) => existentes.has(id));
  return notaLigera({ skillsApagadas, siempre });
}

export async function alNotificar(entrada) {
  agregarEvento({
    ts: Date.now(),
    evento: 'Notification',
    sesion: entrada.session_id ?? null,
    clase: entrada.notification_type ?? null,
    mensaje: recortar(entrada.message ?? '', 120),
  });
  return '';
}

export const GANCHOS = {
  UserPromptSubmit: alEnviarPrompt,
  SessionStart: alIniciarSesion,
  PreCompact: antesDeCompactar,
  Stop: alDetenerse,
  Notification: alNotificar,
};
