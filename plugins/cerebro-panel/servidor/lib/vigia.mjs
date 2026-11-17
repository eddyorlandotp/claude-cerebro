// El vigía: encuentra la sesión activa de Claude Code (el .jsonl más reciente bajo
// <config>/projects/**) y la sigue leyendo solo lo nuevo (tail por offset).
// Nunca escribe en los transcripts: abre todo en solo lectura.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const TROZO = 1024 * 1024;

/** Lee un archivo que crece: cada llamada devuelve las líneas completas nuevas. */
export class Seguidor {
  constructor(ruta, { desdeElFinal = false } = {}) {
    this.ruta = ruta;
    this.offset = 0;
    this.resto = Buffer.alloc(0);
    if (desdeElFinal) {
      try {
        this.offset = fs.statSync(ruta).size;
      } catch {
        this.offset = 0;
      }
    }
  }

  /** Devuelve { lineas, pendiente } donde `pendiente` indica que quedó más por leer (archivo grande). */
  leer(maxBytes = 8 * TROZO) {
    let tamano;
    try {
      tamano = fs.statSync(this.ruta).size;
    } catch {
      return { lineas: [], pendiente: false };
    }
    if (tamano < this.offset) {
      // El archivo se truncó o se reemplazó: se empieza de nuevo.
      this.offset = 0;
      this.resto = Buffer.alloc(0);
    }
    if (tamano === this.offset) return { lineas: [], pendiente: false };
    const lineas = [];
    let fd;
    try {
      fd = fs.openSync(this.ruta, 'r');
    } catch {
      return { lineas, pendiente: false };
    }
    let leidoTotal = 0;
    try {
      while (this.offset < tamano && leidoTotal < maxBytes) {
        const buf = Buffer.alloc(Math.min(TROZO, tamano - this.offset));
        const n = fs.readSync(fd, buf, 0, buf.length, this.offset);
        if (n <= 0) break;
        this.offset += n;
        leidoTotal += n;
        const datos = this.resto.length ? Buffer.concat([this.resto, buf.subarray(0, n)]) : buf.subarray(0, n);
        const corte = datos.lastIndexOf(10);
        if (corte < 0) {
          this.resto = Buffer.from(datos);
          continue;
        }
        for (const l of datos.subarray(0, corte).toString('utf8').split('\n')) if (l.trim()) lineas.push(l);
        this.resto = Buffer.from(datos.subarray(corte + 1));
      }
    } finally {
      fs.closeSync(fd);
    }
    return { lineas, pendiente: this.offset < tamano };
  }
}

/** Todas las sesiones (archivos .jsonl directos de cada proyecto) con su fecha de modificación. */
export function listarSesiones(configDir) {
  const raiz = path.join(configDir, 'projects');
  const salida = [];
  let proyectos = [];
  try {
    proyectos = fs.readdirSync(raiz, { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const p of proyectos) {
    if (!p.isDirectory()) continue;
    const dir = path.join(raiz, p.name);
    let archivos = [];
    try {
      archivos = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const a of archivos) {
      if (!a.isFile() || !a.name.endsWith('.jsonl')) continue;
      const ruta = path.join(dir, a.name);
      try {
        salida.push({ ruta, id: a.name.slice(0, -6), dirProyecto: dir, mtime: fs.statSync(ruta).mtimeMs });
      } catch {
        // desapareció entre el listado y el stat
      }
    }
  }
  return salida;
}

/** La sesión modificada más recientemente, o null. */
export function sesionMasReciente(configDir) {
  let mejor = null;
  for (const s of listarSesiones(configDir)) if (!mejor || s.mtime > mejor.mtime) mejor = s;
  return mejor;
}

/**
 * Lee `agent-<id>.meta.json`, el archivo que Claude Code escribe junto al transcript de cada subagente.
 * Devuelve { toolUseId, tipoAgente, descripcion, padre, terminado } o null si no existe o no se entiende.
 */
export function leerMeta(rutaJsonl) {
  try {
    const m = JSON.parse(fs.readFileSync(rutaJsonl.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
    if (!m || typeof m !== 'object') return null;
    return {
      toolUseId: typeof m.toolUseId === 'string' ? m.toolUseId : null,
      tipoAgente: typeof m.agentType === 'string' ? m.agentType : null,
      descripcion: typeof m.description === 'string' ? m.description : '',
      padre: typeof m.parentAgentId === 'string' ? m.parentAgentId : null,
      terminado: m.finished === true || m.stoppedByUser === true,
    };
  } catch {
    return null;
  }
}

const RE_FECHA = /"timestamp":"([^"]+)"/;

/**
 * Emite:
 *   'sesion'     ({ id, ruta })                       cuando empieza a seguir una sesión (antes de sus líneas)
 *   'linea'      ({ texto, agente, meta, historico }) cada línea nueva; `agente` = id del archivo de subagente
 *                                                     o null; `meta` = lo que dice su meta.json (o null)
 *   'agente-fin' ({ agente, historico })              el meta.json de ese subagente quedó marcado como terminado
 *   'al-dia'     ()                                   cuando terminó de leer lo que ya existía de esa sesión
 *
 * Lo que ya existía al engancharse se entrega ordenado por fecha (principal y subagentes mezclados),
 * para que la historia se reconstruya igual que si se hubiera visto en vivo.
 */
export class Vigia extends EventEmitter {
  constructor({ configDir, intervalo = 250, intervaloBusqueda = 2000, histeresis = 3000 } = {}) {
    super();
    this.configDir = configDir;
    this.intervalo = intervalo;
    this.intervaloBusqueda = intervaloBusqueda;
    this.histeresis = histeresis;
    this.actual = null; // { id, ruta, dirProyecto, principal: Seguidor, subagentes: Map, alDia, actividad }
    this.reloj = null;
    this.ultimaBusqueda = 0;
    this.ocupado = false;
  }

  iniciar() {
    if (this.reloj) return;
    this.reloj = setInterval(() => this.tic(), this.intervalo);
    this.tic();
  }

  detener() {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  #seguir(s) {
    this.actual = {
      id: s.id,
      ruta: s.ruta,
      dirProyecto: s.dirProyecto,
      principal: new Seguidor(s.ruta),
      subagentes: new Map(),
      alDia: false,
      actividad: s.mtime,
      historia: [], // líneas acumuladas mientras se pone al día
      orden: 0,
    };
    this.emit('sesion', { id: s.id, ruta: s.ruta });
  }

  #buscar() {
    const reciente = sesionMasReciente(this.configDir);
    if (!reciente) return;
    if (!this.actual) return this.#seguir(reciente);
    if (reciente.ruta === this.actual.ruta) {
      this.actual.actividad = Math.max(this.actual.actividad, reciente.mtime);
      return;
    }
    // Solo se cambia si la otra sesión es claramente más nueva que lo último que vimos en la actual.
    if (reciente.mtime > this.actual.actividad + this.histeresis) this.#seguir(reciente);
  }

  #archivosDeSubagentes() {
    const dir = path.join(this.actual.dirProyecto, this.actual.id, 'subagents');
    let nombres = [];
    try {
      nombres = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const n of nombres) {
      if (!n.endsWith('.jsonl') || this.actual.subagentes.has(n)) continue;
      const agente = n.slice(0, -6).replace(/^agent-/, '');
      const ruta = path.join(dir, n);
      this.actual.subagentes.set(n, { agente, ruta, seguidor: new Seguidor(ruta), meta: leerMeta(ruta), finAvisado: false, revisado: 0 });
    }
  }

  /** Relee el meta de un subagente que aún no termina (como mucho una vez por segundo). */
  #refrescarMeta(sub, ahora, forzar = false) {
    if (sub.meta && sub.meta.terminado) return;
    if (!forzar && ahora - sub.revisado < 1000) return;
    sub.revisado = ahora;
    const m = leerMeta(sub.ruta);
    if (m) sub.meta = m;
  }

  #ponerAlDia(a) {
    // Orden por fecha; las líneas sin fecha heredan la de la anterior de su mismo archivo.
    const lineas = a.historia;
    a.historia = [];
    const ultima = new Map();
    for (const l of lineas) {
      const m = RE_FECHA.exec(l.texto);
      const t = m ? Date.parse(m[1]) : NaN;
      l.t = Number.isFinite(t) ? t : ultima.get(l.agente) ?? 0;
      ultima.set(l.agente, l.t);
    }
    lineas.sort((x, y) => x.t - y.t || x.orden - y.orden);
    for (const l of lineas) this.emit('linea', { texto: l.texto, agente: l.agente, meta: l.meta, historico: true });
    for (const sub of a.subagentes.values()) {
      if (sub.meta && sub.meta.terminado && !sub.finAvisado) {
        sub.finAvisado = true;
        this.emit('agente-fin', { agente: sub.agente, historico: true });
      }
    }
    a.alDia = true;
    this.emit('al-dia');
  }

  /** Un paso de lectura. Público para poder probarlo sin relojes. */
  tic() {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      const ahora = Date.now();
      if (!this.actual || ahora - this.ultimaBusqueda >= this.intervaloBusqueda) {
        this.ultimaBusqueda = ahora;
        this.#buscar();
      }
      const a = this.actual;
      if (!a) return;
      let pendiente = false;
      let hubo = false;
      if (!a.alDia) {
        // Poniéndose al día: se junta todo (principal y subagentes) y se entrega ordenado al terminar.
        const r = a.principal.leer();
        pendiente ||= r.pendiente;
        for (const texto of r.lineas) a.historia.push({ texto, agente: null, meta: null, orden: a.orden++ });
        if (!r.pendiente) {
          this.#archivosDeSubagentes();
          for (const sub of a.subagentes.values()) {
            const rs = sub.seguidor.leer();
            pendiente ||= rs.pendiente;
            for (const texto of rs.lineas) a.historia.push({ texto, agente: sub.agente, meta: sub.meta, orden: a.orden++ });
          }
        }
        if (!pendiente) this.#ponerAlDia(a);
        return;
      }
      // En vivo: primero los subagentes, para que sus últimas líneas salgan antes que el
      // resultado del Agent en el archivo principal (que es lo que los da por terminados).
      this.#archivosDeSubagentes();
      for (const sub of a.subagentes.values()) {
        const rs = sub.seguidor.leer();
        if (rs.lineas.length) {
          hubo = true;
          if (!sub.meta) this.#refrescarMeta(sub, ahora, true);
          for (const texto of rs.lineas) this.emit('linea', { texto, agente: sub.agente, meta: sub.meta, historico: false });
        }
        if (!sub.finAvisado && !rs.pendiente) {
          this.#refrescarMeta(sub, ahora);
          if (sub.meta && sub.meta.terminado) {
            sub.finAvisado = true;
            this.emit('agente-fin', { agente: sub.agente, historico: false });
          }
        }
      }
      const r = a.principal.leer();
      for (const texto of r.lineas) {
        hubo = true;
        this.emit('linea', { texto, agente: null, meta: null, historico: false });
      }
      if (hubo) a.actividad = Math.max(a.actividad, ahora);
    } catch (e) {
      this.emit('aviso', e);
    } finally {
      this.ocupado = false;
    }
  }
}
