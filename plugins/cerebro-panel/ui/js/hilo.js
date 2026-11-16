// hilo.js — la zona Hilo: lo que la araña guarda para que Claude retome tras compactar.
// A la izquierda, texto: objetivo, último pedido, archivos tocados, pendientes, errores.
// A la derecha, en el lienzo, la araña chica teje una telaraña radial: cada archivo es un
// nudo (más veces tocado = más cerca del centro) y la cantidad de anillos refleja cuánta
// ventana de contexto se ha llenado. En `compactacion` la tela se recoge y vuelve a empezar.

import { estado, en } from './estado.js';
import { reloj } from './reloj.js';
import { alCambiar, minimizada } from './distribucion.js';
import { capa, fuente } from './lienzo.js';
import { Arana } from './arana.js';
import { el, azar, primeraOracion, truncar, truncarMedio, limitar, COLOR, rgba, TAU } from './util.js';

const cajaTexto = document.getElementById('hilo-texto');
const cajaTela = document.getElementById('hilo-tela');
const meta = document.getElementById('hilo-meta');

let datos = vacio();
let oficial = false;          // true cuando ya llegó un evento `hilo` del servidor en este turno
function vacio() { return { objetivo: '', ultimoPedido: '', archivos: [], pendientes: [], errores: [], comandos: [] }; }

// ----- telaraña -----
const RADIOS = 13;
const rnd = azar(4317);
const angulos = Array.from({ length: RADIOS }, (_, i) => (i / RADIOS) * TAU + (rnd() - 0.5) * 0.22 - Math.PI / 2);
const largos = angulos.map(() => 0.8 + rnd() * 0.2);   // cada rayo llega a distinta distancia
const nudos = new Map();      // ruta -> { ruta, radio (0..1 actual), meta, rayo, nace }
const arana = new Arana(4.2, 5);
let tela = { x: 0, y: 0, w: 0, h: 0 }, colocada = false;
let anillos = 2;              // anillos tejidos (número real; la parte decimal es el anillo a medias)
let tension = 1;              // 1 = tensa; baja a 0 al recogerse (compactación)
let recogiendo = 0;           // s restantes de recogida
let descanso = 0;             // s para volver al centro

function medirTela() {
  const r = cajaTela.getBoundingClientRect();
  tela = { x: r.left, y: r.top, w: r.width, h: r.height };
  const c = centro();
  arana.s = limitar(c.R * 0.105, 4.8, 10);
  if (!colocada && c.R > 10) { arana.colocar(c.x, c.y, -1.1); colocada = true; }
  else if (colocada) { arana.colocar(c.x, c.y, arana.rumbo); }
}
function centro() { return { x: tela.x + tela.w / 2, y: tela.y + tela.h / 2 - 2, R: Math.max(8, Math.min(tela.w, tela.h) / 2 - 8) }; }
function posNudo(n) { const c = centro(), a = angulos[n.rayo], r = c.R * n.radio * largos[n.rayo] * tension; return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; }

/** La araña va al nudo tocado, pero se queda a un lado (hacia el centro) para no tapar su nombre. */
function irJuntoA(n) {
  const p = posNudo({ ...n, radio: n.meta }), c = centro();
  const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1, sep = Math.min(d, arana.s * 3.2);
  arana.irA(p.x + (dx / d) * sep, p.y + (dy / d) * sep, 70);
}

function sincronizarNudos(irAlUltimo) {
  const vistos = new Set();
  datos.archivos.forEach((a, i) => {
    vistos.add(a.ruta);
    let n = nudos.get(a.ruta);
    if (!n) {
      // cada archivo nuevo ocupa un rayo distinto, saltando de 4 en 4 para repartirlos
      n = { ruta: a.ruta, radio: 1, meta: 1, rayo: (nudos.size * 4 + 1) % RADIOS, veces: 0, accion: a.accion };
      nudos.set(a.ruta, n);
    }
    n.accion = a.accion;
    if (n.veces !== a.veces) { n.veces = a.veces; if (irAlUltimo) { n.toque = 1; irJuntoA(n); descanso = 5; } }
    n.meta = limitar(0.95 - Math.min(a.veces, 6) * 0.13, 0.2, 0.95);
  });
  for (const ruta of [...nudos.keys()]) if (!vistos.has(ruta)) nudos.delete(ruta);
}

// ----- texto -----
function pintar() {
  if (reloj.rapido) { pendiente = true; return; }
  pendiente = false;
  cajaTexto.textContent = '';
  const dl = el('dl');
  const fila = (titulo, contenido, clase = '') => { const f = el('div', 'hilo-fila ' + clase); const dd = el('dd'); dd.append(contenido); f.append(el('dt', '', titulo), dd); dl.append(f); };
  const una = (txt, c = 'una') => el('span', c, txt);
  if (!estado.sesion && !datos.objetivo) {
    fila('Objetivo', una('Sin sesión. Aquí se guarda el hilo de lo que haga Claude.', 'dos tenue'));
  } else {
    fila('Objetivo', una(datos.objetivo || 'Aún no hay pedido en esta sesión.', datos.objetivo ? 'dos' : 'dos tenue'));
    if (datos.ultimoPedido) fila('Pedido', una(datos.ultimoPedido, 'una tenue'));
    if (datos.archivos.length) {
      const ul = el('ul', 'hilo-lista');
      for (const a of datos.archivos.slice(0, 4)) {
        const li = el('li');
        li.append(el('span', '', truncarMedio(a.ruta, 34)), el('span', 'veces', '×' + a.veces), el('span', 'accion', a.accion || ''));
        ul.append(li);
      }
      if (datos.archivos.length > 4) ul.append(el('li', 'tenue', `y ${datos.archivos.length - 4} más`));
      fila('Archivos', ul);
    }
    if (datos.pendientes.length) {
      const ul = el('ul', 'hilo-lista');
      for (const p of datos.pendientes.slice(0, 4)) {
        const li = el('li', p.estado === 'hecho' ? 'hecho' : p.estado === 'en_curso' ? 'en-curso' : '');
        li.append(el('span', 'caja'), el('span', '', p.texto));
        ul.append(li);
      }
      fila('Pendientes', ul);
    }
    if (datos.errores.length) fila('Errores', una(datos.errores[datos.errores.length - 1], 'una'), 'error');
  }
  cajaTexto.append(dl);
  const n = datos.archivos.length;
  meta.textContent = n ? `${n} archivo${n === 1 ? '' : 's'} · ${Math.floor(anillos)} vueltas de tela` : '';
}
let pendiente = false;
export function asentar() { if (pendiente) pintar(); for (const n of nudos.values()) n.radio = n.meta; anillos = anillosMeta(); const c = centro(); if (!arana.meta) arana.colocar(c.x, c.y, arana.rumbo); }

function anillosMeta() { const u = estado.uso; return 3 + (u && u.ventana ? Math.min(1, u.contexto / u.ventana) : 0) * 15; }

// ----- eventos -----
en('reinicio', (d) => { if (d.total) { datos = vacio(); nudos.clear(); } oficial = false; pintar(); });
en('sesion', () => pintar());
en('prompt', (ev) => {
  oficial = false;
  datos.ultimoPedido = truncar((ev.texto || '').replace(/\s+/g, ' '), 140);
  if (!datos.objetivo) datos.objetivo = primeraOracion(ev.texto, 110);
  pintar();
});
const resumenes = new Map();   // id de herramienta -> resumen (el `fin` no lo trae)
en('herramienta', (ev) => {
  if (ev.fase === 'inicio') resumenes.set(ev.id, ev.resumen || ev.nombre || '');
  if (oficial) return;
  if (ev.fase === 'inicio' && (ev.clase === 'leer' || ev.clase === 'editar') && ev.resumen) {
    let a = datos.archivos.find((x) => x.ruta === ev.resumen);
    const accion = ev.clase === 'leer' ? 'leído' : ev.nombre === 'Write' ? 'creado' : 'editado';
    if (!a) { a = { ruta: ev.resumen, veces: 0, accion }; datos.archivos.push(a); }
    a.veces += 1;
    if (ev.clase === 'editar' && a.accion === 'leído') a.accion = accion;
    datos.archivos.sort((x, y) => y.veces - x.veces);
    datos.archivos = datos.archivos.slice(0, 8);
    sincronizarNudos(true); pintar();
  } else if (ev.fase === 'fin' && ev.ok === false) {
    datos.errores.push(ev.detalle ? String(ev.detalle) : 'falló: ' + (resumenes.get(ev.id) || 'una herramienta')); datos.errores = datos.errores.slice(-3);
    pintar();
  }
});
en('hilo', (ev) => {
  // el servidor manda uno vacío al conectar: ese no sustituye a lo que se va deduciendo de los eventos
  if (!ev.objetivo && !(ev.archivos || []).length && !(ev.pendientes || []).length) return;
  oficial = true;
  datos = {
    objetivo: ev.objetivo || datos.objetivo, ultimoPedido: ev.ultimoPedido || datos.ultimoPedido,
    archivos: (ev.archivos || []).slice(0, 8), pendientes: ev.pendientes || [], errores: ev.errores || [], comandos: ev.comandos || [],
  };
  sincronizarNudos(false); pintar();
});
en('compactacion', () => { recogiendo = 0.5; });

export function iniciar() {
  alCambiar(medirTela);
  medirTela(); pintar();

  capa(15, (ctx) => {
    if (minimizada('hilo') || tela.w < 40 || tela.h < 40) return;
    const c = centro(), R = c.R * tension;
    if (R < 4) return;
    ctx.lineWidth = 1;
    // rayos
    ctx.beginPath();
    angulos.forEach((a, i) => { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * R * largos[i], c.y + Math.sin(a) * R * largos[i]); });
    ctx.strokeStyle = rgba('cian', 0.2); ctx.stroke();
    // anillos: tramos entre rayos, combados hacia el centro como hilo colgado
    const enteros = Math.floor(anillos), parte = anillos - enteros;
    ctx.beginPath();
    for (let k = 0; k <= enteros; k++) {
      const hasta = k < enteros ? RADIOS : Math.floor(parte * RADIOS);
      const rr = R * (0.1 + 0.9 * ((k + 1) / 18));
      for (let i = 0; i < hasta; i++) {
        const j = (i + 1) % RADIOS, a0 = angulos[i], a1 = angulos[j];
        const r0 = Math.min(rr, R * largos[i]), r1 = Math.min(rr, R * largos[j]);
        const x0 = c.x + Math.cos(a0) * r0, y0 = c.y + Math.sin(a0) * r0, x1 = c.x + Math.cos(a1) * r1, y1 = c.y + Math.sin(a1) * r1;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx + (c.x - mx) * 0.12, my + (c.y - my) * 0.12, x1, y1);
      }
    }
    ctx.strokeStyle = rgba('cian', 0.34); ctx.stroke();
    // centro de la tela: un nudo pequeño
    ctx.fillStyle = COLOR.cianTenue; ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, TAU); ctx.fill();
    arana.dibujar(ctx, COLOR.cian, 1);
    // nudos: un archivo cada uno (encima de la araña, para que el nombre siempre se lea)
    const px = Math.max(9, Math.round((parseFloat(getComputedStyle(document.documentElement).fontSize) || 14) * 0.74));
    ctx.font = fuente(px); ctx.textBaseline = 'middle';
    for (const n of nudos.values()) {
      const p = posNudo(n), editado = n.accion !== 'leído';
      const x = Math.round(p.x), y = Math.round(p.y);
      if (n.toque > 0.02) { ctx.strokeStyle = rgba('cian', n.toque); ctx.beginPath(); ctx.arc(x, y, 4 + (1 - n.toque) * 12, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = editado ? COLOR.cian : COLOR.fondo; ctx.strokeStyle = COLOR.cian;
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7); ctx.strokeRect(x - 3, y - 3, 6, 6);
      const nombre = n.ruta.split('/').pop() + (n.veces > 1 ? ' ×' + n.veces : '');
      const w = ctx.measureText(nombre).width, derecha = Math.cos(angulos[n.rayo]) >= 0;
      let tx = derecha ? x + 10 : x - 10 - w;
      tx = limitar(tx, tela.x, tela.x + tela.w - w);
      ctx.fillStyle = COLOR.fondo; ctx.fillRect(tx - 2, y - px * 0.7, w + 4, px * 1.4);
      ctx.fillStyle = COLOR.tinta2; ctx.fillText(nombre, tx, y + 0.5);
    }
  });
}

export function avanzar(dt) {
  if (tela.w < 40) return;
  // la tela crece con el contexto (un anillo cada ~8 % de ventana), se recoge al compactar
  const metaA = anillosMeta();
  if (recogiendo > 0) {
    recogiendo -= dt; tension = Math.max(0, recogiendo / 0.5);
    if (recogiendo <= 0) { anillos = 0; tension = 1; }
  } else {
    tension = Math.min(1, tension + dt * 3);
    anillos += limitar(metaA - anillos, -dt * 6, dt * 1.6);
  }
  for (const n of nudos.values()) { n.radio += (n.meta - n.radio) * Math.min(1, dt * 3); if (n.toque > 0) n.toque = Math.max(0, n.toque - dt * 1.2); }
  if (descanso > 0) { descanso -= dt; if (descanso <= 0) { const c = centro(); arana.irA(c.x, c.y, 40); } }
  if (arana.meta && arana.distMeta() < arana.s) arana.parar();
  arana.avanzar(dt);
}
