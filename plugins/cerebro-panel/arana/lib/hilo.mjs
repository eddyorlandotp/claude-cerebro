// El hilo de la sesión: resumen EXTRACTIVO (sin IA) armado a partir de eventos normalizados.
// Sirve para dos cosas: la zona "Hilo" del panel y el texto que el hook SessionStart
// le devuelve a Claude después de compactar, para que retome sin releer todo.
import { recortar, terminos } from './texto.mjs';

const MAX_MD = 1800;
const ENCABEZADO = '## Hilo de la sesión (guardado por la araña, sin IA)';

// Comandos que no dicen nada del trabajo (explorar, moverse, imprimir).
const TRIVIALES = new Set([
  'ls', 'cd', 'pwd', 'cat', 'echo', 'head', 'tail', 'grep', 'rg', 'find', 'which', 'sleep', 'wc', 'sed', 'awk', 'true',
  'date', 'whoami', 'env', 'printenv', 'tree', 'stat', 'file', 'less', 'sort', 'uniq', 'cut', 'tr', 'test', 'printf',
  'clear', 'history', 'type', 'du', 'df', 'ps', 'id', 'basename', 'dirname', 'realpath', 'export', 'set', 'arana',
]);

const ORDEN_ACCION = { 'leído': 1, editado: 2, creado: 3 };

function esSustantivo(texto) {
  const t = String(texto ?? '').trim();
  if (t.startsWith('/') || t.length < 15) return false;
  return terminos(t).length >= 3;
}

/** Primera palabra "real" de un comando (salta variables VAR=x, sudo, time, etc.). */
function programa(comando) {
  const partes = String(comando).trim().split(/\s+/);
  for (const p of partes) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(p) || p === 'sudo' || p === 'time' || p === 'env' || p === 'command') continue;
    return p.replace(/^.*\//, '');
  }
  return '';
}

export class Hilo {
  constructor() {
    this.objetivo = '';
    this.ultimoPedido = '';
    this.turnos = 0;
    this.archivos = new Map(); // ruta -> { veces, accion, orden }
    this.comandos = []; // más reciente al final, sin repetidos
    this.errores = []; // más reciente al final
    this.pendientes = []; // [{ id?, texto, estado }]
    this.abiertas = new Map(); // id de herramienta -> { nombre, clase, resumen }
    this.reloj = 0;
  }

  /** Recibe un evento normalizado (los del contrato). Ignora lo que no le sirve. */
  ingerir(e) {
    if (!e || typeof e !== 'object') return;
    this.reloj++;
    if (e.tipo === 'prompt') {
      if (!e.enCola) this.turnos++;
      const texto = recortar(e.texto, 240);
      if (texto) this.ultimoPedido = texto;
      if (!this.objetivo && esSustantivo(e.texto)) this.objetivo = texto;
      return;
    }
    if (e.tipo !== 'herramienta') return;
    if (e.fase === 'inicio') {
      this.abiertas.set(e.id, { nombre: e.nombre, clase: e.clase, resumen: e.resumen });
      if (this.abiertas.size > 300) this.abiertas.delete(this.abiertas.keys().next().value);
      if (e.clase === 'editar' || e.clase === 'leer') this.#archivo(e);
      else if (e.clase === 'comando' && e.nombre === 'Bash') this.#comando(e.resumen);
      if (e.tareas) this.#tareas(e.tareas);
    } else if (e.fase === 'fin') {
      const inicio = this.abiertas.get(e.id);
      this.abiertas.delete(e.id);
      if (e.tareas) this.#tareas(e.tareas);
      if (e.ok === false && inicio) {
        const linea = recortar(`${inicio.nombre}: ${inicio.resumen ?? ''}${e.detalle ? ' → ' + e.detalle : ''}`, 160);
        if (this.errores[this.errores.length - 1] !== linea) this.errores.push(linea);
        if (this.errores.length > 12) this.errores.shift();
      }
    }
  }

  #archivo(e) {
    const ruta = String(e.resumen ?? '').trim();
    // Leer una skill no es trabajo sobre el proyecto.
    if (!ruta || /(^|\/)skills\/.*SKILL\.md$/.test(ruta)) return;
    const accion = e.clase === 'leer' ? 'leído' : e.nombre === 'Write' && !this.archivos.has(ruta) ? 'creado' : 'editado';
    const previo = this.archivos.get(ruta);
    if (!previo) {
      this.archivos.set(ruta, { veces: 1, accion, orden: this.reloj });
    } else {
      previo.veces++;
      previo.orden = this.reloj;
      if (ORDEN_ACCION[accion] > ORDEN_ACCION[previo.accion]) previo.accion = accion;
    }
    if (this.archivos.size > 200) {
      // Se olvida el archivo solo leído más viejo.
      let victima = null;
      for (const [k, v] of this.archivos) {
        if (v.accion === 'leído' && (!victima || v.orden < this.archivos.get(victima).orden)) victima = k;
      }
      this.archivos.delete(victima ?? this.archivos.keys().next().value);
    }
  }

  #comando(resumen) {
    const c = String(resumen ?? '').trim();
    if (!c || TRIVIALES.has(programa(c))) return;
    const i = this.comandos.indexOf(c);
    if (i >= 0) this.comandos.splice(i, 1);
    this.comandos.push(c);
    if (this.comandos.length > 30) this.comandos.shift();
  }

  /** `t` = { op: 'lista'|'crear'|'actualizar', items: [{ id?, texto?, estado? }] } */
  #tareas(t) {
    const items = Array.isArray(t.items) ? t.items : [];
    if (t.op === 'lista') {
      this.pendientes = items
        .filter((x) => x && x.texto)
        .map((x) => ({ texto: recortar(x.texto, 120), estado: x.estado || 'pendiente' }));
      return;
    }
    for (const x of items) {
      if (!x) continue;
      if (t.op === 'crear' && x.texto) {
        this.pendientes.push({ id: x.id ?? null, texto: recortar(x.texto, 120), estado: x.estado || 'pendiente' });
      } else if (t.op === 'actualizar') {
        const i = this.pendientes.findIndex((p) => p.id != null && String(p.id) === String(x.id));
        if (i < 0) continue;
        if (x.estado === 'borrada') this.pendientes.splice(i, 1);
        else {
          if (x.estado) this.pendientes[i].estado = x.estado;
          if (x.texto) this.pendientes[i].texto = recortar(x.texto, 120);
        }
      }
    }
    if (this.pendientes.length > 60) this.pendientes = this.pendientes.slice(-60);
  }

  /** Archivos ordenados: primero los editados/creados, luego por veces y por lo reciente. */
  #archivosOrdenados() {
    return [...this.archivos.entries()]
      .map(([ruta, v]) => ({ ruta, veces: v.veces, accion: v.accion, orden: v.orden }))
      .sort((a, b) => (b.accion !== 'leído') - (a.accion !== 'leído') || b.veces - a.veces || b.orden - a.orden);
  }

  /** Objeto del evento `hilo` (sin `tipo`, `ts` ni `sesion`). */
  resumen() {
    return {
      objetivo: this.objetivo,
      ultimoPedido: this.ultimoPedido,
      archivos: this.#archivosOrdenados().slice(0, 8).map(({ ruta, veces, accion }) => ({ ruta, veces, accion })),
      comandos: this.comandos.slice(-5).reverse(),
      errores: this.errores.slice(-3).reverse(),
      pendientes: this.pendientes.map(({ texto, estado }) => ({ texto, estado })),
      turnos: this.turnos,
    };
  }

  /** Texto para inyectar a Claude tras compactar. Nunca pasa de 1800 caracteres. */
  aMarkdown() {
    const r = this.resumen();
    if (!r.turnos && !r.archivos.length && !r.comandos.length && !r.pendientes.length) return '';
    const marca = { hecho: 'x', en_curso: '~', pendiente: ' ' };
    const armar = ({ nArchivos, nComandos, nErrores, nPendientes, largo }) => {
      const l = [ENCABEZADO];
      if (r.objetivo) l.push(`Objetivo: ${recortar(r.objetivo, largo)}`);
      if (r.ultimoPedido && r.ultimoPedido !== r.objetivo) l.push(`Último pedido: ${recortar(r.ultimoPedido, largo)}`);
      l.push(`Turnos: ${r.turnos}`);
      const archivos = r.archivos.slice(0, nArchivos);
      if (archivos.length) {
        l.push('Archivos tocados: ' + archivos.map((a) => `${a.ruta} (${a.accion}${a.veces > 1 ? ' ×' + a.veces : ''})`).join(', '));
      }
      const comandos = r.comandos.slice(0, nComandos);
      if (comandos.length) l.push('Comandos clave: ' + comandos.map((c) => '`' + c + '`').join('; '));
      const errores = r.errores.slice(0, nErrores);
      if (errores.length) l.push('Errores recientes: ' + errores.map((e) => recortar(e, 120)).join(' | '));
      // Primero lo que falta; lo hecho solo se cuenta.
      const faltan = r.pendientes.filter((p) => p.estado !== 'hecho');
      const hechos = r.pendientes.length - faltan.length;
      if (r.pendientes.length) {
        const lista = faltan.slice(0, nPendientes).map((p) => `[${marca[p.estado] ?? ' '}] ${recortar(p.texto, 80)}`);
        const resto = faltan.length - lista.length;
        l.push(`Pendientes: ${lista.join('; ') || 'ninguno abierto'}${resto > 0 ? ` (+${resto} más)` : ''}${hechos ? ` · hechos: ${hechos}` : ''}`);
      }
      return l.join('\n');
    };
    const niveles = [
      { nArchivos: 8, nComandos: 5, nErrores: 3, nPendientes: 8, largo: 240 },
      { nArchivos: 6, nComandos: 3, nErrores: 2, nPendientes: 6, largo: 200 },
      { nArchivos: 4, nComandos: 2, nErrores: 1, nPendientes: 4, largo: 160 },
      { nArchivos: 3, nComandos: 1, nErrores: 1, nPendientes: 2, largo: 120 },
    ];
    for (const n of niveles) {
      const md = armar(n);
      if (md.length <= MAX_MD) return md;
    }
    return armar(niveles[niveles.length - 1]).slice(0, MAX_MD - 1) + '…';
  }

  /** Estado serializable, para que el hook Stop siga desde donde se quedó sin releer todo el transcript. */
  aJSON() {
    return {
      v: 1,
      objetivo: this.objetivo,
      ultimoPedido: this.ultimoPedido,
      turnos: this.turnos,
      archivos: [...this.archivos.entries()],
      comandos: this.comandos,
      errores: this.errores,
      pendientes: this.pendientes,
      abiertas: [...this.abiertas.entries()].slice(-50),
      reloj: this.reloj,
    };
  }

  static desdeJSON(o) {
    const h = new Hilo();
    if (!o || o.v !== 1) return h;
    h.objetivo = String(o.objetivo ?? '');
    h.ultimoPedido = String(o.ultimoPedido ?? '');
    h.turnos = Number(o.turnos) || 0;
    h.archivos = new Map(Array.isArray(o.archivos) ? o.archivos : []);
    h.comandos = Array.isArray(o.comandos) ? o.comandos : [];
    h.errores = Array.isArray(o.errores) ? o.errores : [];
    h.pendientes = Array.isArray(o.pendientes) ? o.pendientes : [];
    h.abiertas = new Map(Array.isArray(o.abiertas) ? o.abiertas : []);
    h.reloj = Number(o.reloj) || 0;
    return h;
  }
}
