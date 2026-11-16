// distribucion.js — la rejilla: calcula columnas y filas en px según orientación y zonas
// minimizadas, maneja las pestañas de la barra, las teclas (1–5, 0, F) y recuerda el acomodo.
// También mide los rectángulos reales de cada zona para que el lienzo dibuje en su lugar.

import { el } from './util.js';

export const ZONAS = ['biblioteca', 'flujo', 'contexto', 'hilo', 'actividad'];   // orden de las teclas 1–5
const TODAS = ['biblioteca', 'pensamiento', 'contexto', 'hilo', 'actividad', 'flujo'];
const NOMBRE = { biblioteca: 'Biblioteca', flujo: 'Flujo', contexto: 'Contexto', hilo: 'Hilo', actividad: 'Actividad' };
const CLAVE = 'telarana.minimizadas.v1';
const BARRA = 36;

const panel = document.getElementById('panel');
const pestanas = document.getElementById('b-pestanas');
const nodo = Object.fromEntries(TODAS.map((z) => [z, document.getElementById('z-' + z)]));

export const dist = {
  vertical: false,
  ancho: 0, alto: 0,
  rects: Object.fromEntries(TODAS.map((z) => [z, { x: 0, y: 0, w: 0, h: 0 }])),
  version: 0,          // sube cada vez que cambia algún rectángulo: el lienzo lo usa para recolocar
};
const min = new Set();
const avisos = {};     // zona -> 'cian' | 'rosa'
const oyentes = [];
let midiendoHasta = 0;
let recordar = true;
let franja = 0;         // alto de la banda de conexión perdida (0 o 24 px)

export const minimizada = (zona) => min.has(zona);
export const alCambiar = (fn) => oyentes.push(fn);

export function iniciar() {
  const forzadas = new URLSearchParams(location.search).get('min');
  if (forzadas != null) {
    // ?min=biblioteca,actividad — para capturas; no toca lo guardado.
    recordar = false;
    for (const z of forzadas.split(',')) if (ZONAS.includes(z.trim())) min.add(z.trim());
  } else {
    let guardadas = null;
    try { guardadas = JSON.parse(localStorage.getItem(CLAVE)); } catch { /* sin almacenamiento */ }
    if (Array.isArray(guardadas)) { for (const z of guardadas) if (ZONAS.includes(z)) min.add(z); }
    else if (innerWidth < 1200) { min.add('hilo'); min.add('actividad'); }   // pantallas chicas
  }
  panel.classList.add('sin-animar');
  aplicar();
  requestAnimationFrame(() => panel.classList.remove('sin-animar'));

  addEventListener('resize', () => { sinAnimar(); aplicar(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-min]');
    if (b) alternar(b.dataset.min, true);
  });
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= '1' && e.key <= '5') { alternar(ZONAS[Number(e.key) - 1], false); }
    else if (e.key === '0') { min.clear(); sinAnimar(); guardar(); aplicar(); }
    else if (e.key === 'f' || e.key === 'F') {
      try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* no disponible */ }
    }
  });
}

/** Minimiza o restaura una zona. Con ratón se anima; con teclado no. */
export function alternar(zona, animar) {
  if (!ZONAS.includes(zona)) return;
  if (min.has(zona)) { min.delete(zona); delete avisos[zona]; } else min.add(zona);
  if (!animar) sinAnimar();
  guardar();
  aplicar();
}
function sinAnimar() {
  panel.classList.add('sin-animar');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('sin-animar')));
}
function guardar() {
  if (!recordar) return;
  try { localStorage.setItem(CLAVE, JSON.stringify([...min])); } catch { /* sin almacenamiento */ }
}

/** Reparte `total` px entre pesos (los de peso 0 quedan en 0) con suma exacta. */
function repartir(total, pesos) {
  const suma = pesos.reduce((a, b) => a + b, 0) || 1;
  let acumulado = 0, usado = 0;
  return pesos.map((p) => { acumulado += p; const hasta = Math.round((total * acumulado) / suma); const v = hasta - usado; usado = hasta; return v; });
}

function aplicar() {
  const W = innerWidth, H = innerHeight;
  dist.ancho = W; dist.alto = H;
  dist.vertical = H > W;
  panel.classList.toggle('vertical', dist.vertical);
  panel.classList.toggle('horizontal', !dist.vertical);
  const m = (z) => min.has(z);
  let cols, filas;

  if (!dist.vertical) {
    // Columnas: biblioteca 26 · pensamiento 44 · derecha 30. En ultrawide el centro no pasa de 1100 px.
    const derechaFuera = m('contexto') && m('hilo') && m('actividad');
    let bib = 0.26 * W, cen = 0.44 * W, der = 0.30 * W;
    if (W / H >= 2.1) { cen = Math.min(1100, cen); bib = (W - cen) * (26 / 56); der = W - cen - bib; }
    if (m('biblioteca')) { der += bib * 0.3; bib = 0; }
    if (derechaFuera) { bib += bib ? der * 0.35 : 0; der = 0; }
    cen = W - bib - der;
    cols = [Math.round(bib), 0, Math.round(der)];
    cols[1] = W - cols[0] - cols[2];
    // Filas: barra · contexto · hilo · actividad · flujo (26 % del alto útil).
    const util = H - BARRA - franja;
    const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
    const flujo = m('flujo') ? 0 : Math.round(Math.min(util * 0.26, base * 13.2 + 84));
    const cuerpo = repartir(util - flujo, derechaFuera ? [1, 1, 1] : [m('contexto') ? 0 : 28, m('hilo') ? 0 : 36, m('actividad') ? 0 : 36]);
    filas = [BARRA, franja, ...cuerpo, flujo];
  } else {
    // Vertical: pensamiento 34 · biblioteca 24 · flujo 16 · contexto+hilo 14 · actividad el resto.
    const util = H - BARRA - franja;
    const pesos = [34, m('biblioteca') ? 0 : 24, m('flujo') ? 0 : 16, m('contexto') && m('hilo') ? 0 : 14, m('actividad') ? 0 : 12];
    filas = [BARRA, franja, ...repartir(util, pesos)];
    const mitad = Math.round(W / 2);
    cols = m('contexto') && !m('hilo') ? [0, W] : m('hilo') && !m('contexto') ? [W, 0] : [mitad, W - mitad];
  }
  panel.style.gridTemplateColumns = cols.map((v) => v + 'px').join(' ');
  panel.style.gridTemplateRows = filas.map((v) => v + 'px').join(' ');
  for (const z of ZONAS) nodo[z].classList.toggle('plegada', m(z));
  pintarPestanas();
  midiendoHasta = performance.now() + 700;   // seguir midiendo mientras dura la transición
  medir();
}

function pintarPestanas() {
  pestanas.textContent = '';
  ZONAS.forEach((z, i) => {
    if (!min.has(z)) return;
    const b = el('button', 'pestana');
    b.type = 'button'; b.dataset.min = z; b.title = `Restaurar ${NOMBRE[z]} (${i + 1})`;
    if (avisos[z]) b.dataset.aviso = avisos[z];
    b.append(el('i', 'punto'), el('span', '', NOMBRE[z]), el('span', 'tecla', String(i + 1)));
    pestanas.append(b);
  });
}

/** Muestra u oculta la banda de conexión perdida (es una fila de la rejilla). */
export function banda(visible) { const v = visible ? 24 : 0; if (v === franja) return; franja = v; aplicar(); }

/** Marca actividad en una zona: si está minimizada, su pestaña parpadea (cian) o queda en rosa (error). */
export function avisar(zona, tono = 'cian') {
  if (!min.has(zona)) return;
  if (avisos[zona] === 'rosa' && tono !== 'rosa') return;
  avisos[zona] = tono;
  const b = pestanas.querySelector(`[data-min="${zona}"]`);
  if (!b) return;
  // reiniciar la animación del punto
  b.removeAttribute('data-aviso'); void b.offsetWidth; b.dataset.aviso = tono;
}
export function limpiarAvisos() { for (const z of ZONAS) delete avisos[z]; pintarPestanas(); }

function medir() {
  let cambio = false;
  for (const z of TODAS) {
    const r = nodo[z].getBoundingClientRect();
    const a = dist.rects[z];
    if (Math.abs(a.x - r.left) > 0.25 || Math.abs(a.y - r.top) > 0.25 || Math.abs(a.w - r.width) > 0.25 || Math.abs(a.h - r.height) > 0.25) {
      a.x = r.left; a.y = r.top; a.w = r.width; a.h = r.height; cambio = true;
    }
  }
  if (cambio) { dist.version += 1; for (const fn of oyentes) fn(dist); }
}

/** Se llama en cada cuadro: vuelve a medir solo mientras hay una transición de rejilla en curso. */
export function cuadro() { if (performance.now() < midiendoHasta) medir(); }
