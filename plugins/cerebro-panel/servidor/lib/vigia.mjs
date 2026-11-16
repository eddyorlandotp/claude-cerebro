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
 * Emite:
 *   'sesion'  ({ id, ruta })                 cuando empieza a seguir una sesión (antes de sus líneas)
 *   'linea'   ({ texto, agente, historico }) cada línea nueva; `agente` = id del archivo de subagente o null
 *   'al-dia'  ()                             cuando terminó de leer lo que ya existía de esa sesión
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
      this.actual.subagentes.set(n, { agente, seguidor: new Seguidor(path.join(dir, n)) });
    }
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
      const historico = !a.alDia;
      let pendiente = false;
      let hubo = false;
      const r = a.principal.leer();
      pendiente ||= r.pendiente;
      for (const texto of r.lineas) {
        hubo = true;
        this.emit('linea', { texto, agente: null, historico });
      }
      // Mientras se pone al día con el archivo principal no se mezclan los subagentes.
      if (!r.pendiente) {
        this.#archivosDeSubagentes();
        for (const { agente, seguidor } of a.subagentes.values()) {
          const rs = seguidor.leer();
          pendiente ||= rs.pendiente;
          for (const texto of rs.lineas) {
            hubo = true;
            this.emit('linea', { texto, agente, historico });
          }
        }
      }
      if (hubo) a.actividad = Math.max(a.actividad, ahora);
      if (!a.alDia && !pendiente) {
        a.alDia = true;
        this.emit('al-dia');
      }
    } catch (e) {
      this.emit('aviso', e);
    } finally {
      this.ocupado = false;
    }
  }
}
