// util.js — utilidades sin estado: matemáticas, azar con semilla, resortes y formato de texto.

export const TAU = Math.PI * 2;
export const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mezclar = (a, b, k) => a + (b - a) * k;
export const suave = (k) => { k = limitar(k, 0, 1); return k * k * (3 - 2 * k); };
export const entraSale = (k) => { k = limitar(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const sale = (k) => 1 - Math.pow(1 - limitar(k, 0, 1), 3);

// Paleta (los mismos valores que css/base.css) para dibujar en el lienzo.
export const COLOR = {
  fondo: '#06090b', fondo2: '#0b1013', linea: '#18222a', linea2: '#263540',
  tinta: '#dfe8ea', tinta2: '#8a9aa1', tinta3: '#4d5c64',
  cian: '#86d5ea', cianTenue: '#2f5d6b', rosa: '#ff4f72', ambar: '#f0b54a', cara: '#e9f0ef',
};
const RGB = { cian: '134,213,234', tinta: '223,232,234', tinta2: '138,154,161', tinta3: '77,92,100', rosa: '255,79,114', ambar: '240,181,74', cianTenue: '47,93,107', fondo: '6,9,11', linea2: '38,53,64' };
/** Color de la paleta con alfa: rgba('cian', 0.4) */
export const rgba = (nombre, a) => `rgba(${RGB[nombre]},${a})`;

/** Generador pseudoaleatorio con semilla (mulberry32): mismo resultado en cada carga. */
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Normal estándar (Box–Muller) a partir de un generador uniforme. */
export function gauss(rnd) {
  let u = 0; while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd());
}
export function semillaDe(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Resorte amortiguado (casi crítico: llega sin rebote exagerado). */
export class Resorte {
  constructor(x = 0, rigidez = 170, amort = 0.86) { this.x = x; this.v = 0; this.meta = x; this.k = rigidez; this.c = 2 * amort * Math.sqrt(rigidez); }
  avanzar(dt) {
    // integración en subpasos para que no explote con dt grandes
    let resto = Math.min(dt, 0.1);
    while (resto > 0) {
      const h = Math.min(resto, 0.008);
      this.v += (-this.k * (this.x - this.meta) - this.c * this.v) * h;
      this.x += this.v * h;
      resto -= h;
    }
    return this.x;
  }
  fijar(x) { this.x = x; this.meta = x; this.v = 0; }
}

/** Diferencia angular más corta, en (-PI, PI]. */
export function difAngulo(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d <= -Math.PI) d += TAU; return d; }

// ---------- Texto ----------
export function truncarMedio(txt, n) {
  txt = String(txt ?? '');
  if (txt.length <= n) return txt;
  const a = Math.ceil((n - 1) * 0.55), b = n - 1 - a;
  return txt.slice(0, a) + '…' + txt.slice(txt.length - b);
}
export function truncar(txt, n) { txt = String(txt ?? ''); return txt.length <= n ? txt : txt.slice(0, n - 1).trimEnd() + '…'; }
/** Primera oración de un texto, recortada a n caracteres. */
export function primeraOracion(txt, n = 90) {
  txt = String(txt ?? '').replace(/\s+/g, ' ').trim();
  const m = txt.match(/^(.{12,}?[.!?…])(\s|$)/);
  return truncar(m ? m[1] : txt, n);
}
/** 92700 -> "92.7k", 1200000 -> "1.2M" */
export function miles(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) { const k = n / 1000; return (k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')) + 'k'; }
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
}
/** 240 -> "240 ms", 3380 -> "3.4 s", 58000 -> "58 s", 125000 -> "2 min 05 s" */
export function duracion(ms) {
  ms = Number(ms) || 0;
  if (ms < 1000) return Math.round(ms) + ' ms';
  if (ms < 10000) return (ms / 1000).toFixed(1) + ' s';
  if (ms < 60000) return Math.round(ms / 1000) + ' s';
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
}
export function crono(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
export function hora(ts) {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
}
/** Crea un elemento: el('span', 'clase', 'texto') */
export function el(etq, clase, texto) {
  const e = document.createElement(etq);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}
