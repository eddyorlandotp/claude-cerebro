// burbujas.js — burbujas de pensamiento (nube de cómic: contorno festoneado en línea de
// 1 px cian, sin relleno, con circulitos que bajan hacia la cara) y de diálogo (rectángulo
// con pico). Máximo 3 a la vez: la nueva nace junto a la cara, las viejas suben y se atenúan.

import { azar, el } from './util.js';
import { reloj } from './reloj.js';

const caja = document.getElementById('burbujas');
const NS = 'http://www.w3.org/2000/svg';
const MAX = 3;
let lista = [];      // de más vieja a más nueva
let cuenta = 0;
let esc = 1;         // escala de la zona (la fija pensamiento.js): festones y rastro crecen con el texto
export function escalar(v) { if (Math.abs(v - esc) > 0.004) { esc = v; redibujar(); } }

/** Contorno de nube: se recorre un rectángulo redondeado y cada tramo se abomba hacia fuera. */
function contornoNube(w, h, rnd) {
  const r = Math.min(h / 2, 30 * esc), pts = [];
  const per = 2 * (w - 2 * r) + 2 * (h - 2 * r) + Math.PI * 2 * r;
  const n = Math.max(9, Math.round(per / (40 * esc)));
  // punto del perímetro a distancia s (sentido horario empezando arriba a la izquierda)
  const lados = [w - 2 * r, (Math.PI * r) / 2, h - 2 * r, (Math.PI * r) / 2, w - 2 * r, (Math.PI * r) / 2, h - 2 * r, (Math.PI * r) / 2];
  const punto = (s) => {
    s = ((s % per) + per) % per;
    let i = 0; while (s > lados[i]) { s -= lados[i]; i++; }
    const a = s / r;
    switch (i) {
      case 0: return [r + s, 0];
      case 1: return [w - r + Math.sin(a) * r, r - Math.cos(a) * r];
      case 2: return [w, r + s];
      case 3: return [w - r + Math.cos(a) * r, h - r + Math.sin(a) * r];
      case 4: return [w - r - s, h];
      case 5: return [r - Math.sin(a) * r, h - r + Math.cos(a) * r];
      case 6: return [0, h - r - s];
      default: return [r - Math.cos(a) * r, r - Math.sin(a) * r];
    }
  };
  const paso = per / n;
  for (let i = 0; i < n; i++) pts.push(punto(i * paso + (rnd() - 0.5) * paso * 0.42));
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1], b = pts[i % n];
    const cuerda = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const radio = cuerda * (0.58 + rnd() * 0.2);
    d += `A${radio.toFixed(1)} ${radio.toFixed(1)} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  return d + 'Z';
}
function contornoDicho(w, h, picoX) {
  const p = 9 * esc;
  return `M0.5 0.5H${w - 0.5}V${h - 0.5}H${picoX + p}L${picoX} ${h + p + 2}L${picoX - p} ${h - 0.5}H0.5Z`;
}

function dibujarContorno(b) {
  const w = b.el.offsetWidth, h = b.el.offsetHeight;
  if (!w || !h) return;
  b.svg.setAttribute('width', w); b.svg.setAttribute('height', h);
  b.svg.textContent = '';
  const rnd = azar(b.semilla);
  const camino = document.createElementNS(NS, 'path');
  const dx = b.dx;
  if (b.tipo === 'pensamiento') {
    camino.setAttribute('d', contornoNube(w, h, rnd));
    b.svg.append(camino);
    // circulitos que bajan hacia la cara (la cara queda al centro: el rastro se inclina hacia allá)
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'rastro');
    const x0 = w / 2 - dx * 0.35, haciaCentro = -dx * 0.22;
    [[0, 15, 5.5], [0.5, 29, 3.8], [1, 40, 2.4]].forEach(([k, y, r]) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (x0 + haciaCentro * k).toFixed(1)); c.setAttribute('cy', (h + y * esc).toFixed(1)); c.setAttribute('r', (r * esc).toFixed(1));
      g.append(c);
    });
    b.svg.append(g);
  } else {
    camino.setAttribute('d', contornoDicho(w, h, Math.max(24, Math.min(w - 24, w / 2 - dx))));
    b.svg.append(camino);
  }
}

/** Agrega una burbuja. tipo: 'pensamiento' | 'puntos' (piensa sin texto) | 'dicho' | 'toca' (ámbar) | 'frase' (reposo) */
export function agregar(tipo, texto) {
  // FLIP: recordar dónde estaban las viejas para que "suban" con transform
  const antes = new Map(lista.map((b) => [b, b.el.getBoundingClientRect().top]));
  cuenta += 1;
  const b = {
    // forma: nube (pensamiento, puntos) o rectángulo con pico (dicho, toca, frase)
    tipo: tipo === 'pensamiento' || tipo === 'puntos' ? 'pensamiento' : 'dicho', semilla: 31 + cuenta * 7919,
    el: el('div', 'burbuja' + (tipo === 'pensamiento' ? '' : tipo === 'puntos' ? ' puntos' : ' dicho' + (tipo === 'dicho' ? '' : ' ' + tipo))),
    svg: document.createElementNS(NS, 'svg'), dx: 0,
  };
  // las nubes alternan lado para que se lean como cascada; lo dicho va centrado
  const ancho = caja.clientWidth || 600;
  b.dx = b.tipo === 'pensamiento' ? (cuenta % 2 ? 1 : -1) * Math.round(ancho * (0.05 + (cuenta % 3) * 0.018)) : 0;
  b.el.style.setProperty('--dx', b.dx + 'px');
  b.el.append(b.svg, el('span', '', texto));
  caja.append(b.el);
  lista.push(b);
  while (lista.length > MAX) quitar(lista[0], reloj.rapido);
  // si no caben en el alto disponible, se va la más vieja (sin animación: ya no hay sitio)
  const hueco = parseFloat(getComputedStyle(caja).rowGap) || 30;
  const alto = () => lista.reduce((a, x) => a + x.el.offsetHeight, 0) + hueco * (lista.length - 1) + 12;
  while (lista.length > 1 && alto() > caja.clientHeight) quitar(lista[0], true);
  lista.forEach((x, i) => { x.el.dataset.edad = String(lista.length - 1 - i); });
  dibujarContorno(b);

  if (!reloj.rapido && !reloj.quieto && b.el.animate) {
    const curva = 'cubic-bezier(0.23, 1, 0.32, 1)';
    b.el.animate([{ opacity: 0, transform: `translateX(${b.dx}px) scale(0.95)` }, { opacity: 1, transform: `translateX(${b.dx}px) scale(1)` }], { duration: 220, easing: curva });
    lista.forEach((x, i) => {
      if (x === b) return;
      if (!antes.has(x)) return;
      const delta = antes.get(x) - x.el.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) x.el.animate([{ transform: `translate(${x.dx}px, ${delta}px)` }, { transform: `translate(${x.dx}px, 0)` }], { duration: 260, easing: curva });
    });
  }
  return b;
}

function quitar(b, yaMismo) {
  lista = lista.filter((x) => x !== b);
  if (yaMismo) { b.el.remove(); return; }
  // sale más rápido de lo que entra; se saca del flujo para que no empuje a las demás
  const r = b.el.getBoundingClientRect(), rc = caja.getBoundingClientRect();
  b.el.style.position = 'absolute'; b.el.style.left = r.left - rc.left - b.dx + 'px'; b.el.style.top = r.top - rc.top + 'px'; b.el.style.width = r.width + 'px';
  b.el.classList.add('sale');
  setTimeout(() => b.el.remove(), 180);
}

export function quitarTipo(clase) { for (const b of lista.slice()) if (b.el.classList.contains(clase)) quitar(b, reloj.rapido); renumerar(); }
export function limpiar(yaMismo = false) { for (const b of lista.slice()) quitar(b, yaMismo || reloj.rapido); }
function renumerar() { lista.forEach((x, i) => { x.el.dataset.edad = String(lista.length - 1 - i); }); }
/** Al cambiar el tamaño de la zona se rehacen los contornos. */
export function redibujar() { for (const b of lista) dibujarContorno(b); }
