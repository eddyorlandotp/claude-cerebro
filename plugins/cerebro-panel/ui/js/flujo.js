// flujo.js — los pasos del turno como bloques conectados de izquierda a derecha:
// PROMPT → ARAÑA → pasos… → RESPUESTA. Los bloques son DOM; las líneas que los unen y los
// pulsos que corren por ellas se dibujan en el lienzo (capa 20) usando las medidas reales.
//
// Reglas: pasos consecutivos de la misma clase se agrupan (LEER ×3); en curso = borde cian;
// fallido = rosa; esperando permiso = ámbar; los subagentes van en una fila secundaria que
// se bifurca hacia abajo y regresa; si no caben, los más viejos se apilan a la izquierda (+N).

import { estado, en, nombreSkill } from './estado.js';
import { reloj } from './reloj.js';
import { dist, alCambiar, minimizada } from './distribucion.js';
import { capa } from './lienzo.js';
import { el, truncarMedio, truncar, duracion, miles, crono, COLOR, rgba, TAU } from './util.js';

const caja = document.getElementById('flujo');
const meta = document.getElementById('flujo-meta');
const previos = document.getElementById('flujo-previos');

const CLASE = { leer: 'Leer', buscar: 'Buscar', comando: 'Comando', editar: 'Editar', web: 'Web', agente: 'Agente', skill: 'Skill', mcp: 'MCP', tarea: 'Tarea', pregunta: 'Pregunta', otro: 'Otro', prompt: 'Prompt', arana: 'Araña', respuesta: 'Respuesta' };
const SIN_GRUPO = new Set(['prompt', 'arana', 'respuesta', 'agente', 'pregunta']);

let pasos = [];          // fila principal
let porId = new Map();   // id de herramienta -> paso
let agentes = new Map(); // id de subagente -> { paso (bloque AGENTE), subs: [paso], fin: pasoRetorno|null }
let historial = [];      // resúmenes de turnos anteriores
let finTurno = null;     // { ms, pasos } del turno recién terminado
let sucio = true, medidas = [], medirHasta = 0, ultimoTic = 0;

function nuevoPaso(clase, nombre, resumen, extra = {}) {
  return { clase, nombre, resumen, estado: 'ok', cuenta: 1, ms: 0, tamano: 0, inicio: reloj.t, el: null, visto: false, sub: false, ...extra };
}
function ultimo() { return pasos[pasos.length - 1]; }

// ---------- eventos ----------
en('reinicio', () => { pasos = []; porId.clear(); agentes.clear(); historial = []; finTurno = null; sucio = true; pintar(); });
en('prompt', (ev) => {
  if (ev.enCola) { pasos.push(nuevoPaso('prompt', 'tú', ev.texto || '')); pintar(); return; }
  if (finTurno && estado.turno > 1) historial.push(`turno ${estado.turno - 1} · ${finTurno.pasos} pasos · ${duracion(finTurno.ms)}`);
  if (historial.length > 3) historial.shift();
  pasos = [nuevoPaso('prompt', 'tú', ev.texto || '')]; porId.clear(); agentes.clear(); finTurno = null;
  pintar();
});
en('sugeridas', () => {
  const n = estado.sugeridas.length; if (!n) return;
  const nombres = estado.sugeridas.map((s) => nombreSkill(s.id));
  pasos.push(nuevoPaso('arana', 'araña', `${n} skill${n === 1 ? '' : 's'} sugerida${n === 1 ? '' : 's'}`, { dato: nombres[0] + (n > 1 ? ` +${n - 1}` : '') }));
  pintar();
});
en('herramienta', (ev) => {
  if (ev.fase === 'inicio') {
    const resumen = ev.clase === 'skill' ? nombreSkill(ev.resumen) : ev.resumen || '';
    if (ev.agente) {
      // paso de un subagente: va en la fila secundaria, debajo del bloque principal que estaba en curso
      const a = agentes.get(ev.agente); if (!a) return;
      const p = nuevoPaso(ev.clase || 'otro', ev.nombre || '', resumen, { estado: 'curso', sub: true, ancla: ultimo(), agente: ev.agente });
      const previo = a.subs[a.subs.length - 1];
      if (previo && previo.ancla === p.ancla) { previo.cuenta += 1; previo.nombre = p.nombre; previo.clase = p.clase; previo.resumen = p.resumen; previo.estado = 'curso'; previo.inicio = reloj.t; porId.set(ev.id, previo); }
      else { a.subs.push(p); porId.set(ev.id, p); }
    } else {
      const u = ultimo();
      if (u && u.clase === ev.clase && u.estado === 'ok' && !SIN_GRUPO.has(u.clase)) {
        u.cuenta += 1; u.nombre = ev.nombre || u.nombre; u.resumen = resumen; u.estado = 'curso'; u.inicio = reloj.t;
        porId.set(ev.id, u);
      } else {
        const p = nuevoPaso(ev.clase || 'otro', ev.nombre || '', resumen, { estado: 'curso' });
        pasos.push(p); porId.set(ev.id, p);
      }
    }
  } else {
    const p = porId.get(ev.id); if (!p) return;
    p.estado = ev.ok === false ? 'fallo' : 'ok';
    p.ms += ev.ms || 0; p.tamano += ev.tamano || 0;
    if (ev.ok === false && ev.detalle) p.detalle = String(ev.detalle);
  }
  pintar();
});
en('subagente', (ev) => {
  if (ev.fase === 'inicio') {
    // un subagente que ya tenía bloque y vuelve a trabajar (lo reanudaron): se reusa su bloque
    const ya = agentes.get(ev.id);
    if (ya) { ya.fin = null; if (ya.paso.propio) ya.paso.estado = 'curso'; pintar(); return; }
    // si la herramienta Task/Agent ya abrió un bloque AGENTE en curso sin dueño, se usa ese
    let p = pasos.find((x) => x.clase === 'agente' && x.estado === 'curso' && !x.agenteId);
    if (!p) { p = nuevoPaso('agente', ev.tipoAgente || 'agente', ev.descripcion || '', { estado: 'curso' }); pasos.push(p); }
    p.agenteId = ev.id; p.nombre = ev.tipoAgente || p.nombre; p.resumen = ev.descripcion || p.resumen; p.propio = !porIdTiene(p);
    agentes.set(ev.id, { paso: p, subs: [], fin: null });
  } else {
    const a = agentes.get(ev.id); if (!a) return;
    a.fin = ultimo();
    if (a.paso.propio) { a.paso.estado = 'ok'; a.paso.ms = reloj.t - a.paso.inicio; }
    for (const s of a.subs) if (s.estado === 'curso') s.estado = 'ok';
  }
  pintar();
});
function porIdTiene(p) { for (const v of porId.values()) if (v === p) return true; return false; }
en('espera', (ev) => {
  if (ev.motivo !== 'permiso') return;
  for (const p of pasos) if (p.estado === 'curso' && p.clase !== 'agente') p.estado = 'espera';
  pintar();
});
en('dicho', (ev) => {
  if (ev.agente) return;
  // lo último que dice en el turno se vuelve el bloque RESPUESTA al cerrar; mientras, se guarda
  ultimoDicho = ev.texto || '';
});
let ultimoDicho = '';
en('fin_turno', (ev) => {
  finTurno = { ms: ev.ms || reloj.t - estado.inicioTurno, pasos: ev.pasos ?? estado.pasos };
  for (const p of pasos) if (p.estado === 'curso' || p.estado === 'espera') p.estado = 'ok';
  pasos.push(nuevoPaso('respuesta', 'Claude', ultimoDicho || 'Turno terminado.'));
  ultimoDicho = '';
  pintar();
});
// cualquier señal de vida después de una espera de permiso la quita
en('*', (ev) => {
  if (ev.tipo === 'espera' || ev.tipo === 'uso' || ev.tipo === 'hilo') return;
  let cambio = false;
  for (const p of pasos) if (p.estado === 'espera') { p.estado = 'curso'; cambio = true; }
  if (cambio) pintar();
});

// ---------- DOM ----------
function hacerBloque(p) {
  const b = el('div', 'bloque');
  const cab = el('div', 'bloque-cab');
  cab.append(el('span', 'bloque-nombre'), el('span', 'bloque-clase'));
  b.append(cab, el('div', 'bloque-res'), el('div', 'bloque-dat'));
  p.el = b;
  return b;
}
function llenarBloque(p, caracteres) {
  const b = p.el || hacerBloque(p);
  b.className = 'bloque' + (p.sub ? ' sub' : '') + (p.estado !== 'ok' ? ' ' + p.estado : '');
  if (p.visto) b.style.animation = 'none';
  p.visto = true;
  const [cab, res, dat] = b.children;
  cab.children[0].textContent = p.nombre;
  cab.children[1].textContent = (CLASE[p.clase] || p.clase) + (p.cuenta > 1 ? ' ×' + p.cuenta : '');
  const largo = p.clase === 'prompt' || p.clase === 'respuesta';
  res.className = 'bloque-res' + (largo ? ' dos' : '');
  res.textContent = largo ? truncar(p.resumen, caracteres * 2 - 2) : truncarMedio(p.resumen, caracteres);
  dat.hidden = largo;
  if (!largo) dat.textContent = textoDato(p);
  return b;
}
function textoDato(p) {
  if (p.clase === 'arana') return p.dato || '';
  if (p.estado === 'curso') return 'en curso · ' + duracion(Math.max(0, reloj.t - p.inicio));
  if (p.estado === 'espera') return 'espera tu permiso';
  const partes = [];
  if (p.estado === 'fallo') partes.push('falló');
  if (p.ms) partes.push(duracion(p.ms));
  if (p.estado === 'fallo' && p.detalle) partes.push(p.detalle);      // primera línea del error
  else if (p.tamano) partes.push(miles(p.tamano));
  return partes.join(' · ');
}

function pintar() {
  sucio = true;
  if (reloj.rapido) return;       // avanzando en seco: se pinta una sola vez al final
  pintarYa();
}
function pintarYa() {
  sucio = false;
  pintarMeta();
  const r = dist.rects.flujo;
  if (minimizada('flujo') || r.w < 80) return;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  const ancho = caja.clientWidth, hueco = 30, minimo = base * 12.4;
  const cols = Math.max(2, Math.floor((ancho + hueco) / (minimo + hueco)));
  const renglones = dist.vertical ? 2 : 1;
  const cap = cols * renglones;
  const anchoBloque = (ancho - (cols - 1) * hueco) / cols;
  const caracteres = Math.max(8, Math.floor((anchoBloque - 18) / (base * 0.85 * 0.6)));

  caja.textContent = '';
  if (!pasos.length) { caja.append(el('p', 'flujo-vacio', estado.sesion ? 'Aquí aparecen los pasos del turno en cuanto escribas algo en Claude Code.' : '')); medidas = []; return; }

  // visibles: si no caben, los más viejos se comprimen en una pila a la izquierda
  let visibles = pasos, ocultos = 0;
  if (pasos.length > cap) { ocultos = pasos.length - (cap - 1); visibles = pasos.slice(ocultos); }
  const celdas = [];
  if (ocultos) {
    const pila = el('div', 'bloque pila');
    pila.append(el('span', 'pila-n', '+' + ocultos), el('span', 'pila-t', 'pasos antes'));
    celdas.push({ el: pila, paso: null });
  }
  for (const p of visibles) celdas.push({ el: llenarBloque(p, caracteres), paso: p });

  const filas = [];
  for (let i = 0; i < renglones; i++) {
    const parte = celdas.slice(i * cols, (i + 1) * cols);
    if (!parte.length && i > 0) break;
    const fila = el('div', 'renglon'); fila.style.setProperty('--cols', cols);
    parte.forEach((c, k) => { c.el.style.gridColumn = String(k + 1); c.fila = fila; c.col = k + 1; fila.append(c.el); });
    filas.push(fila); caja.append(fila);
  }
  // fila secundaria: pasos de subagentes bajo su bloque ancla
  for (const a of agentes.values()) for (const s of a.subs) {
    const c = celdas.find((x) => x.paso === s.ancla) || (celdas[0] && !celdas[0].paso ? null : null);
    if (!c) continue;
    const b = llenarBloque(s, caracteres);
    b.style.gridColumn = String(c.col);
    c.fila.append(b);
  }
  medirHasta = performance.now() + 500;
  medir();
}
function pintarMeta() {
  if (!estado.turno) { meta.textContent = ''; previos.textContent = ''; return; }
  const n = estado.pasos;
  meta.innerHTML = finTurno
    ? `turno ${estado.turno} · <b>${finTurno.pasos}</b> pasos · <b>${duracion(finTurno.ms)}</b>`
    : `turno ${estado.turno} · <b>${n}</b> paso${n === 1 ? '' : 's'} · <b>${crono(reloj.t - estado.inicioTurno)}</b>`;
  previos.textContent = historial.join('   ');
}

// ---------- medidas para el lienzo ----------
function medir() {
  medidas = [];
  const lista = [];
  for (const b of caja.querySelectorAll('.bloque')) { const r = b.getBoundingClientRect(); lista.push({ el: b, x: r.left, y: r.top, w: r.width, h: r.height }); }
  const de = (p) => (p && p.el ? lista.find((m) => m.el === p.el) : null);
  const principales = lista.filter((m) => !m.el.classList.contains('sub'));
  medidas = { principales: principales.map((m) => ({ ...m, paso: pasos.find((p) => p.el === m.el) || null })), subs: [] };
  for (const a of agentes.values()) {
    const origen = de(a.paso), subs = a.subs.map((s) => ({ m: de(s), paso: s })).filter((x) => x.m);
    if (!subs.length) continue;
    medidas.subs.push({ origen, subs, fin: a.fin ? de(a.fin) : null, vivo: a.paso.estado === 'curso' || subs.some((s) => s.paso.estado === 'curso') });
  }
}

function trazar(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
function largoDe(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function puntoEn(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= l) { const k = l ? d / l : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    d -= l;
  }
  return pts[pts.length - 1];
}
/** Pulsos: puntos que corren por la línea mientras el paso está en curso. */
function pulsos(ctx, pts, t, tono) {
  if (reloj.quieto) return;
  const L = largoDe(pts); if (L < 4) return;
  const vel = 70, sepa = 26;     // px/s y distancia entre pulsos
  ctx.globalCompositeOperation = 'lighter';
  for (let d = ((t / 1000) * vel) % sepa; d < L; d += sepa) {
    const [x, y] = puntoEn(pts, d);
    ctx.fillStyle = tono === 'ambar' ? COLOR.ambar : COLOR.cian;
    ctx.fillRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 3, 3);
    const [x2, y2] = puntoEn(pts, Math.max(0, d - 5));
    ctx.fillStyle = rgba(tono === 'ambar' ? 'ambar' : 'cian', 0.4);
    ctx.fillRect(Math.round(x2) - 1, Math.round(y2) - 1, 2, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function iniciar() {
  alCambiar(() => { sucio = true; });
  pintarYa();
  capa(20, (ctx, t) => {
    if (!medidas.principales || minimizada('flujo')) return;
    ctx.lineWidth = 1;
    const P = medidas.principales;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      const ya = Math.round(a.y + a.h / 2) + 0.5, yb = Math.round(b.y + b.h / 2) + 0.5;
      let pts;
      if (Math.abs(ya - yb) < 6) pts = [[a.x + a.w, ya], [b.x, yb]];
      else {
        // salto de renglón: sale por la derecha, baja por el pasillo entre renglones y entra por la izquierda
        const pasillo = Math.round(b.y - 9) + 0.5;
        pts = [[a.x + a.w, ya], [a.x + a.w + 10.5, ya], [a.x + a.w + 10.5, pasillo], [b.x - 10.5, pasillo], [b.x - 10.5, yb], [b.x, yb]];
      }
      const est = b.paso ? b.paso.estado : 'ok';
      const vivo = est === 'curso' || est === 'espera';
      ctx.strokeStyle = est === 'curso' ? COLOR.cianTenue : est === 'espera' ? rgba('ambar', 0.5) : est === 'fallo' ? rgba('rosa', 0.6) : COLOR.linea2;
      trazar(ctx, pts);
      // punta: cuadrito donde entra al bloque
      ctx.fillStyle = est === 'curso' ? COLOR.cian : est === 'espera' ? COLOR.ambar : est === 'fallo' ? COLOR.rosa : COLOR.tinta3;
      ctx.fillRect(Math.round(b.x) - 4, Math.round(yb) - 2, 3, 3);
      if (vivo) pulsos(ctx, pts, est === 'espera' ? t * 0.35 : t, est === 'espera' ? 'ambar' : 'cian');
    }
    // subagentes: bifurcación hacia abajo y regreso
    ctx.setLineDash([3, 3]);
    for (const g of medidas.subs) {
      const s0 = g.subs[0].m, o = g.origen;
      const tramos = [];
      if (o) {
        const xo = Math.round(o.x + Math.min(o.w / 2, 28)) + 0.5;
        const ys = Math.round(s0.y + s0.h / 2) + 0.5;
        tramos.push(Math.abs(o.x - s0.x) < 4 ? [[xo, o.y + o.h], [xo, s0.y]] : [[xo, o.y + o.h], [xo, ys], [s0.x, ys]]);
      }
      for (let i = 1; i < g.subs.length; i++) { const a = g.subs[i - 1].m, b = g.subs[i].m, y = Math.round(a.y + a.h / 2) + 0.5; tramos.push([[a.x + a.w, y], [b.x, y]]); }
      const u = g.subs[g.subs.length - 1].m;
      if (g.fin && Math.abs(g.fin.y - (o ? o.y : g.fin.y)) < 6) {
        // regresa a la línea principal después del bloque que estaba en curso cuando terminó
        const y = Math.round(u.y + u.h / 2) + 0.5, xr = Math.round(Math.max(g.fin.x + g.fin.w, u.x + u.w) + 15) + 0.5, ym = Math.round(g.fin.y + g.fin.h / 2) + 0.5;
        tramos.push([[u.x + u.w, y], [xr, y], [xr, ym]]);
      }
      ctx.strokeStyle = g.vivo ? COLOR.cianTenue : COLOR.linea2;
      for (const pts of tramos) trazar(ctx, pts);
      if (g.vivo) { ctx.setLineDash([]); for (const pts of tramos.slice(0, 1)) pulsos(ctx, pts, t, 'cian'); ctx.setLineDash([3, 3]); }
    }
    ctx.setLineDash([]);
  });
}

export function avanzar() {
  if (reloj.rapido) return;
  if (sucio) pintarYa();
  else if (performance.now() < medirHasta) medir();
  // cronómetro y duración del paso en curso: 4 veces por segundo, sin tocar nada más
  if (reloj.t - ultimoTic > 250) {
    ultimoTic = reloj.t;
    if (estado.enTurno) pintarMeta();
    for (const p of pasos) if (p.estado === 'curso' && p.el && p.clase !== 'prompt') p.el.children[2].textContent = textoDato(p);
    for (const a of agentes.values()) for (const s of a.subs) if (s.estado === 'curso' && s.el) s.el.children[2].textContent = textoDato(s);
  }
}
export function remedir() { medirHasta = performance.now() + 700; sucio = true; }
