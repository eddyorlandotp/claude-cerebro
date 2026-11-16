// contexto.js — cuánta ventana y cuántos tokens lleva: número grande con el %, barra de
// 40 celdas, tres cifras (entrada, salida, caché leída), mini histograma y costo equivalente.

import { estado, en } from './estado.js';
import { el, miles } from './util.js';

const caja = document.getElementById('ctx');
const meta = document.getElementById('ctx-meta');
let muestras = [];     // [{ v: tokens de contexto, turno }]
let armado = false, refs = {};

function armar() {
  caja.innerHTML = `
    <div class="ctx-arriba">
      <div class="ctx-num" id="ctx-num">0<small>%</small></div>
      <div class="ctx-lado"><span><b id="ctx-usado">0</b> / <span id="ctx-ventana">200k</span></span><span>tokens en la ventana</span></div>
      <div class="ctx-costo" id="ctx-costo" hidden><b id="ctx-usd"></b><span>equivalente API</span></div>
    </div>
    <div class="ctx-barra" id="ctx-barra" role="img"></div>
    <dl class="ctx-cifras">
      <div class="ctx-cifra"><dt>Entrada</dt><dd id="ctx-entrada">0</dd></div>
      <div class="ctx-cifra"><dt>Salida total</dt><dd id="ctx-salida">0</dd></div>
      <div class="ctx-cifra"><dt>Caché leída</dt><dd id="ctx-cache">0</dd></div>
      <p class="ctx-nota">la caché cuesta ~10× menos que la entrada nueva</p>
    </dl>
    <div class="ctx-hist" id="ctx-hist"></div>`;
  const barra = caja.querySelector('#ctx-barra');
  for (let i = 0; i < 40; i++) barra.append(el('i'));
  for (const id of ['num', 'usado', 'ventana', 'costo', 'usd', 'barra', 'entrada', 'salida', 'cache', 'hist']) refs[id] = caja.querySelector('#ctx-' + id);
  armado = true;
}

function pintar() {
  if (!armado) armar();
  const u = estado.uso || { contexto: 0, ventana: 200000, entrada: 0, salida: 0, cacheLeida: 0 };
  const ventana = u.ventana || 200000, frac = Math.min(1, (u.contexto || 0) / ventana);
  const pct = Math.round(frac * 100);
  const tono = frac > 0.9 ? 'rosa' : frac > 0.75 ? 'ambar' : '';
  refs.num.firstChild.textContent = String(pct);
  refs.num.dataset.tono = tono;
  refs.usado.textContent = miles(u.contexto || 0);
  refs.ventana.textContent = miles(ventana);
  const llenas = Math.round(frac * 40);
  refs.barra.dataset.tono = tono;
  refs.barra.setAttribute('aria-label', `${pct}% de la ventana usada`);
  [...refs.barra.children].forEach((c, i) => { c.className = i < llenas ? (i === llenas - 1 ? 'on borde' : 'on') : ''; });
  refs.entrada.textContent = miles(u.entrada || 0);
  refs.salida.textContent = miles(u.salida || 0);
  refs.cache.textContent = miles(u.cacheLeida || 0);
  if (typeof u.costoUSD === 'number') { refs.costo.hidden = false; refs.usd.textContent = '$' + u.costoUSD.toFixed(2); } else refs.costo.hidden = true;
  meta.textContent = estado.uso ? `quedan ${miles(Math.max(0, ventana - (u.contexto || 0)))}` : '';
  // mini histograma: una barra por medición, con corte entre turnos
  refs.hist.textContent = '';
  let turno = null;
  const tope = Math.max(1, ...muestras.slice(-36).map((m) => m.v));
  for (const m of muestras.slice(-36)) {
    if (turno !== null && m.turno !== turno) refs.hist.append(el('i', 'corte'));
    turno = m.turno;
    const b = el('i'); b.style.height = Math.max(6, Math.round((m.v / tope) * 100)) + '%';
    refs.hist.append(b);
  }
  refs.hist.append(el('span', 'ctx-eti', muestras.length ? 'cómo crece la ventana' : ''));
}

en('uso', (ev) => { muestras.push({ v: ev.contexto || 0, turno: estado.turno }); if (muestras.length > 120) muestras.shift(); pintar(); });
en('reinicio', (d) => { if (d.total) muestras = []; pintar(); });
en('compactacion', () => { muestras.push({ v: 0, turno: -1 }); });

export function iniciar() { pintar(); }
