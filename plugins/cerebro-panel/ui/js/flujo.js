// flujo.js — los pasos del turno como bloques conectados: PROMPT → ARAÑA → pasos… → RESPUESTA.
// Los bloques son DOM; las líneas que los unen, los pulsos y la araña del Flujo van en el lienzo
// (capa 20) usando las medidas reales. Debajo de los bloques:
//   · la regla de tiempo: cada paso a escala sobre la duración del turno (se ve dónde se fue el tiempo);
//   · la historia: una tira de celdas por turno terminado (una celda por paso; rosa donde falló).
//
// Reglas de los bloques: pasos consecutivos de la misma clase se agrupan (LEER ×3); en curso = borde
// cian; fallido = rosa; esperando permiso = ámbar; los de skill llevan el filo del tono de su cúmulo;
// los subagentes van en una fila secundaria que se bifurca hacia abajo y regresa; si no caben, los
// más viejos se apilan a la izquierda (+N); si hay pocos, crecen en vez de dejar hueco.
//
// La araña del Flujo (pequeña) espera sobre el bloque en curso y, cuando un paso termina, baja al
// hueco entre ese bloque y el siguiente y lo cose (la línea queda con puntadas).

import { estado, en, nombreSkill, lugares } from './estado.js';
import { reloj, despues } from './reloj.js';
import { dist, alCambiar, minimizada } from './distribucion.js';
import { capa } from './lienzo.js';
import { Arana } from './arana.js';
import { tonoSkill } from './tonos.js';
import { el, truncarMedio, truncar, duracion, miles, crono, COLOR, rgba } from './util.js';

const caja = document.getElementById('flujo');
const meta = document.getElementById('flujo-meta');
const previos = document.getElementById('flujo-previos');
const pasosEl = el('div', 'flujo-pasos'), reglaEl = el('div', 'regla'), histEl = el('div', 'historia');
caja.append(pasosEl, reglaEl, histEl);
previos.hidden = true;      // la historia ahora va en tiras debajo de los bloques

const CLASE = { leer: 'Leer', buscar: 'Buscar', comando: 'Comando', editar: 'Editar', web: 'Web', agente: 'Agente', skill: 'Skill', mcp: 'MCP', tarea: 'Tarea', pregunta: 'Pregunta', otro: 'Otro', prompt: 'Prompt', arana: 'Araña', respuesta: 'Respuesta' };
const SIN_GRUPO = new Set(['prompt', 'arana', 'respuesta', 'agente', 'pregunta']);

let pasos = [];          // fila principal
let porId = new Map();   // id de herramienta -> paso
let agentes = new Map(); // id de subagente -> { paso (bloque AGENTE), subs: [paso], fin: pasoRetorno|null }
let historia = [];       // turnos terminados, el más reciente primero: { turno, celdas, n, ms, texto, nueva }
let finTurno = null;     // { ms, pasos } del turno recién terminado
let pendienteCoser = null;  // turno terminado que la araña grande aún no cose a la historia
let ultimoDicho = '', pedido = '';
let t0 = 0;              // ts del prompt del turno (origen de la regla de tiempo)
let sucio = true, medidas = {}, medirHasta = 0, ultimoTic = 0;

function nuevoPaso(clase, nombre, resumen, extra = {}) {
  return { clase, nombre, resumen, estado: 'ok', cuenta: 1, ms: 0, tamano: 0, inicio: reloj.t, ts: 0, tramos: [], cosido: 0, el: null, visto: false, sub: false, ...extra };
}
const ultimo = () => pasos[pasos.length - 1];
/** ms transcurridos del turno según el reloj de la interfaz. */
const transcurrido = () => Math.max(0, reloj.t - estado.inicioTurno);

// ---------- eventos ----------
en('reinicio', (d) => { pasos = []; porId.clear(); agentes.clear(); finTurno = null; pendienteCoser = null; if (d.total && !d.conservarHistoria) historia = []; sucio = true; pintar(); pintarHistoria(); });
en('prompt', (ev) => {
  if (ev.enCola) { pasos.push(nuevoPaso('prompt', 'tú', ev.texto || '', { ts: ev.ts })); pintar(); return; }
  if (pendienteCoser) coser();      // llegó otro mensaje antes de que la araña cosiera el anterior
  pedido = ev.texto || ''; t0 = ev.ts || Date.now();
  pasos = [nuevoPaso('prompt', 'tú', pedido, { ts: t0, cosido: 1 })]; porId.clear(); agentes.clear(); finTurno = null;
  pintar();
});
en('sesion', () => { if (!historia.length) pintarHistoria(); });
en('sugeridas', () => {
  const n = estado.sugeridas.length; if (!n) return;
  const nombres = estado.sugeridas.map((s) => nombreSkill(s.id));
  pasos.push(nuevoPaso('arana', 'araña', `${n} skill${n === 1 ? '' : 's'} sugerida${n === 1 ? '' : 's'}`, { dato: nombres[0] + (n > 1 ? ` +${n - 1}` : '') }));
  pintar();
});
en('herramienta', (ev) => {
  if (ev.fase === 'inicio') {
    const resumen = ev.clase === 'skill' ? nombreSkill(ev.resumen) : ev.resumen || '';
    const tono = ev.clase === 'skill' ? tonoSkill(ev.resumen).hex : null;      // el tono del cúmulo viaja con la skill
    const tramo = { a: (ev.ts || 0) - t0, b: null };
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
        u.cuenta += 1; u.nombre = ev.nombre || u.nombre; u.resumen = resumen; u.estado = 'curso'; u.inicio = reloj.t; if (tono) u.tono = tono;
        u.tramos.push(tramo); u.tramo = tramo;
        porId.set(ev.id, u);
      } else {
        const p = nuevoPaso(ev.clase || 'otro', ev.nombre || '', resumen, { estado: 'curso', tono, ts: ev.ts, tramos: [tramo], tramo });
        pasos.push(p); porId.set(ev.id, p);
      }
    }
  } else {
    const p = porId.get(ev.id); if (!p) return;
    p.estado = ev.ok === false ? 'fallo' : 'ok';
    p.ms += ev.ms || 0; p.tamano += ev.tamano || 0;
    if (p.tramo && p.tramo.b == null) p.tramo.b = p.tramo.a + (ev.ms || Math.max(0, (ev.ts || 0) - t0 - p.tramo.a));
    if (ev.ok === false) { p.fallo = true; if (ev.detalle) p.detalle = String(ev.detalle); }
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
    if (!p) { p = nuevoPaso('agente', ev.tipoAgente || 'agente', ev.descripcion || '', { estado: 'curso', ts: ev.ts }); pasos.push(p); }
    p.agenteId = ev.id; p.nombre = ev.tipoAgente || p.nombre; p.resumen = ev.descripcion || p.resumen; p.propio = ![...porId.values()].includes(p);
    agentes.set(ev.id, { paso: p, subs: [], fin: null });
  } else {
    const a = agentes.get(ev.id); if (!a) return;
    a.fin = ultimo();
    if (a.paso.propio) { a.paso.estado = 'ok'; a.paso.ms = reloj.t - a.paso.inicio; }
    for (const s of a.subs) if (s.estado === 'curso') s.estado = 'ok';
  }
  pintar();
});
en('espera', (ev) => {
  if (ev.motivo !== 'permiso') return;
  for (const p of pasos) if (p.estado === 'curso' && p.clase !== 'agente') p.estado = 'espera';
  pintar();
});
en('dicho', (ev) => { if (!ev.agente) ultimoDicho = ev.texto || ''; });
en('fin_turno', (ev) => {
  finTurno = { ms: ev.ms || transcurrido(), pasos: ev.pasos ?? estado.pasos, real: transcurrido() };
  for (const p of pasos) if (p.estado === 'curso' || p.estado === 'espera') p.estado = 'ok';
  pasos.push(nuevoPaso('respuesta', 'Claude', ultimoDicho || 'Turno terminado.', { ts: ev.ts }));
  ultimoDicho = '';
  // el turno queda listo para coserse a la historia: lo hace la araña de la biblioteca con su hilo
  // (evento 'cosido'); si no llega (no hay biblioteca), se cose solo a los 4.5 s
  pendienteCoser = {
    turno: estado.turno, n: finTurno.pasos, ms: finTurno.ms, texto: pedido,
    celdas: pasos.filter((p) => p.clase !== 'prompt' && p.clase !== 'respuesta').map((p) => ({ clase: p.clase, fallo: !!p.fallo, tono: p.tono || null, ms: p.ms, cuenta: p.cuenta })),
  };
  if (reloj.rapido) coser(); else despues(4500, () => { if (pendienteCoser) coser(); });
  pintar();
});
// Momento 4: la araña cose el turno terminado a la historia
en('cosido', () => { if (pendienteCoser) coser(); });
function coser() {
  const fila = pendienteCoser; pendienteCoser = null;
  fila.nueva = !reloj.rapido;
  historia.unshift(fila);
  if (historia.length > 14) historia.pop();
  pintarHistoria();
}
// cualquier señal de vida después de una espera de permiso la quita
en('*', (ev) => {
  if (ev.tipo === 'espera' || ev.tipo === 'uso' || ev.tipo === 'hilo') return;
  let cambio = false;
  for (const p of pasos) if (p.estado === 'espera') { p.estado = 'curso'; cambio = true; }
  if (cambio) pintar();
});

// ---------- bloques (DOM) ----------
function hacerBloque(p) {
  const b = el('div', 'bloque');
  const cab = el('div', 'bloque-cab');
  cab.append(el('span', 'bloque-nombre'), el('span', 'bloque-clase'));
  b.append(cab, el('div', 'bloque-res'), el('div', 'bloque-dat'));
  p.el = b;
  return b;
}
function llenarBloque(p, caracteres, grande) {
  const b = p.el || hacerBloque(p);
  b.className = 'bloque' + (p.sub ? ' sub' : '') + (p.estado !== 'ok' ? ' ' + p.estado : '') + (p.tono ? ' con-tono' : '');
  if (p.tono) b.style.setProperty('--tono', p.tono); else b.style.removeProperty('--tono');
  if (p.visto) b.style.animation = 'none';
  p.visto = true;
  const [cab, res, dat] = b.children;
  cab.children[0].textContent = p.nombre;
  cab.children[1].textContent = (CLASE[p.clase] || p.clase) + (p.cuenta > 1 ? ' ×' + p.cuenta : '');
  const largo = p.clase === 'prompt' || p.clase === 'respuesta';
  res.className = 'bloque-res' + (largo ? ' dos' : '');
  // con pocos bloques hay sitio: el resumen va completo (hasta 3 renglones) en vez de truncado al medio
  res.textContent = largo ? truncar(p.resumen, caracteres * (grande ? 4 : 2) - 2) : grande ? truncar(p.resumen, caracteres * 2 - 2) : truncarMedio(p.resumen, caracteres);
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
  let cols = Math.max(2, Math.floor((ancho + hueco) / (minimo + hueco)));
  const renglones = dist.vertical ? 2 : 1;
  // pocos bloques: crecen (más anchos, con el resumen completo) en vez de dejar hueco
  // pocos bloques: crecen en vez de dejar hueco. Se usan tantas columnas como bloques haya (más una, para el
  // que viene), con un mínimo de la mitad; y con muy pocos, además, letra mayor y el resumen completo.
  const caben = cols;
  cols = Math.max(Math.min(caben, 3), Math.ceil(caben * 0.5), Math.min(caben, pasos.length + 1));
  const grande = pasos.length > 0 && pasos.length <= Math.ceil(caben * 0.3) && !agentes.size;
  if (grande) cols = Math.max(Math.min(caben, 3), Math.min(caben, pasos.length + 1));
  const cap = cols * renglones;
  const anchoBloque = (ancho - (cols - 1) * hueco) / cols;
  const caracteres = Math.max(8, Math.floor((anchoBloque - 18) / (base * (grande ? 0.95 : 0.85) * 0.6)));
  caja.classList.toggle('grande', grande);

  pasosEl.textContent = '';
  if (!pasos.length) { pasosEl.append(el('p', 'flujo-vacio', estado.sesion ? 'Aquí aparecen los pasos del turno en cuanto escribas algo en Claude Code.' : '')); medidas = {}; pintarRegla(); return; }

  // visibles: si no caben, los más viejos se comprimen en una pila a la izquierda
  let visibles = pasos, ocultos = 0;
  if (pasos.length > cap) { ocultos = pasos.length - (cap - 1); visibles = pasos.slice(ocultos); }
  const celdas = [];
  if (ocultos) {
    const pila = el('div', 'bloque pila');
    pila.append(el('span', 'pila-n', '+' + ocultos), el('span', 'pila-t', 'pasos antes'));
    celdas.push({ el: pila, paso: null });
  }
  for (const p of visibles) celdas.push({ el: llenarBloque(p, caracteres, grande), paso: p });

  for (let i = 0; i < renglones; i++) {
    const parte = celdas.slice(i * cols, (i + 1) * cols);
    if (!parte.length && i > 0) break;
    const fila = el('div', 'renglon'); fila.style.setProperty('--cols', cols);
    parte.forEach((c, k) => { c.el.style.gridColumn = String(k + 1); c.fila = fila; c.col = k + 1; fila.append(c.el); });
    pasosEl.append(fila);
  }
  // fila secundaria: pasos de subagentes bajo su bloque ancla
  for (const a of agentes.values()) for (const s of a.subs) {
    const c = celdas.find((x) => x.paso === s.ancla);
    if (!c) continue;
    const b = llenarBloque(s, caracteres, false);
    b.style.gridColumn = String(c.col);
    c.fila.append(b);
  }
  pintarRegla();
  medirHasta = performance.now() + 500;
  medir();
}
function pintarMeta() {
  if (!estado.turno) { meta.textContent = ''; return; }
  const n = estado.pasos;
  meta.innerHTML = finTurno
    ? `turno ${estado.turno} · <b>${finTurno.pasos}</b> pasos · <b>${duracion(finTurno.ms)}</b>`
    : `turno ${estado.turno} · <b>${n}</b> paso${n === 1 ? '' : 's'} · <b>${crono(transcurrido())}</b>`;
}

// ---------- regla de tiempo ----------
/** Eje fino bajo los bloques: cada paso a escala sobre lo que lleva el turno. Los huecos son tiempo pensando. */
function pintarRegla() {
  reglaEl.textContent = '';
  if (pasos.length < 2 || minimizada('flujo')) { reglaEl.hidden = true; return; }
  reglaEl.hidden = false;
  const T = Math.max(1000, finTurno ? finTurno.real : transcurrido(), ...pasos.flatMap((p) => p.tramos.map((t) => t.b ?? t.a)));
  const barra = el('div', 'regla-barra');
  let mayor = null;
  for (const p of pasos) for (const t of p.tramos) {
    const b = t.b ?? Math.max(t.a, transcurrido());
    const s = el('i', p.fallo ? 'fallo' : t.b == null ? (p.estado === 'espera' ? 'espera' : 'curso') : p.clase === 'editar' ? 'cambio' : '');
    s.style.left = ((Math.max(0, t.a) / T) * 100).toFixed(2) + '%';
    s.style.width = Math.max(0.15, ((b - t.a) / T) * 100).toFixed(2) + '%';
    if (p.tono) s.style.background = p.tono;
    barra.append(s);
    if (!mayor || b - t.a > mayor.d) mayor = { d: b - t.a, a: t.a, b, p };
  }
  const pie = el('div', 'regla-pie');
  pie.append(el('span', '', '0 s'));
  if (mayor && mayor.d > 800) {
    // se nombra el paso que más tiempo se llevó
    const m = el('span', 'regla-mayor' + (mayor.p.fallo ? ' fallo' : ''), `${truncarMedio(mayor.p.resumen || mayor.p.nombre, 30)} · ${duracion(mayor.d)}`);
    m.style.left = limitarPct(((mayor.a + mayor.b) / 2 / T) * 100) + '%';
    pie.append(m);
  }
  pie.append(el('span', 'regla-total', duracion(T)));
  reglaEl.append(barra, pie);
}
const limitarPct = (v) => Math.min(86, Math.max(14, v)).toFixed(1);

// ---------- historia de turnos ----------
function pintarHistoria() {
  histEl.textContent = '';
  // sin turnos terminados todavía: se dice qué va a aparecer aquí
  if (!historia.length) { if (estado.sesion) histEl.append(el('p', 'hist-vacia', 'Historia de la sesión: cada turno terminado queda aquí como una tira, una celda por paso.')); return; }
  for (const h of historia) {
    const fila = el('div', 'hist-fila' + (h.nueva ? ' nueva' : ''));
    h.nueva = false;
    const tira = el('span', 'hist-celdas');
    for (const c of h.celdas) {
      const i = el('i', 'c-' + c.clase + (c.fallo ? ' fallo' : ''));
      i.style.width = Math.round(7 + Math.min(22, (c.ms || 0) / 260)) + 'px';      // más ancha cuanto más tardó
      if (c.tono && !c.fallo) i.style.background = c.tono;
      tira.append(i);
    }
    fila.append(el('span', 'hist-turno', 'turno ' + h.turno), tira, el('span', 'hist-dato', `${h.n} pasos · ${duracion(h.ms)}`), el('span', 'hist-texto', h.texto));
    histEl.append(fila);
  }
}
/** Dónde aterriza el hilo de la araña al coser un turno: el principio de la primera tira. */
lugares.flujoHistoria = () => {
  const r = histEl.getBoundingClientRect(), f = dist.rects.flujo;
  if (minimizada('flujo') || r.width < 10) return { x: f.x + 60, y: Math.min(innerHeight - 8, f.y + 20) };
  return { x: r.left + 70, y: Math.min(innerHeight - 10, r.top + 9) };
};

// ---------- medidas para el lienzo ----------
function medir() {
  const lista = [];
  for (const b of pasosEl.querySelectorAll('.bloque')) { const r = b.getBoundingClientRect(); lista.push({ el: b, x: r.left, y: r.top, w: r.width, h: r.height }); }
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
  const vel = 70, sepa = 26;
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
/** Puntadas: la costura que deja la araña sobre un conector ya terminado. */
function puntadas(ctx, pts, k) {
  const L = largoDe(pts) * k;
  ctx.beginPath();
  for (let d = 5; d < L - 2; d += 6) { const [x, y] = puntoEn(pts, d); ctx.moveTo(x - 1.5, y - 3); ctx.lineTo(x + 1.5, y + 3); }
  ctx.stroke();
}
function conector(a, b) {
  const ya = Math.round(a.y + a.h / 2) + 0.5, yb = Math.round(b.y + b.h / 2) + 0.5;
  if (Math.abs(ya - yb) < 6) return [[a.x + a.w, ya], [b.x, yb]];
  // salto de renglón: sale por la derecha, baja por el pasillo entre renglones y entra por la izquierda
  const pasillo = Math.round(b.y - 9) + 0.5;
  return [[a.x + a.w, ya], [a.x + a.w + 10.5, ya], [a.x + a.w + 10.5, pasillo], [b.x - 10.5, pasillo], [b.x - 10.5, yb], [b.x, yb]];
}

// ---------- la araña del Flujo ----------
const arana = new Arana(3.6, 9);
let aranaLista = false, cosiendo = null;      // cosiendo = { paso, fase: 'ir'|'coser'|'volver', k }
function avanzarArana(dt) {
  const P = medidas.principales;
  if (!P || !P.length || minimizada('flujo')) { aranaLista = false; return; }
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  arana.s = Math.max(3.2, base * 0.27);
  const ult = P[P.length - 1];
  // su sitio: encima del bloque en curso (o del último), cerca de la esquina por donde entra el conector
  const casa = { x: ult.x + Math.min(26, ult.w * 0.2), y: ult.y - arana.s * 1.5 };
  if (!aranaLista) { arana.colocar(casa.x, casa.y, 0); aranaLista = true; cosiendo = null; }
  // ¿hay un conector terminado sin coser? (el paso al que llega ya no está en curso)
  if (!cosiendo) {
    const i = P.findIndex((m, k) => k > 0 && m.paso && m.paso.cosido < 1 && m.paso.estado !== 'curso' && m.paso.estado !== 'espera');
    if (i > 0) {
      const sinCoser = P.filter((m, k) => k > 0 && m.paso && m.paso.cosido < 1 && m.paso.estado !== 'curso' && m.paso.estado !== 'espera').length;
      // si se le juntan, los más viejos quedan cosidos de una vez y atiende el último
      if (sinCoser > 2) { for (const m of P.slice(1, -1)) if (m.paso && m.paso.estado !== 'curso') m.paso.cosido = 1; }
      else cosiendo = { paso: P[i].paso, fase: 'ir', k: 0 };
    }
  }
  if (cosiendo) {
    const i = P.findIndex((m) => m.paso === cosiendo.paso);
    if (i < 1) { cosiendo.paso.cosido = 1; cosiendo = null; }
    else {
      const pts = conector(P[i - 1], P[i]), ini = pts[0], fin = pts[pts.length - 1];
      if (cosiendo.fase === 'ir') {
        arana.irA(ini[0] + 4, ini[1] - arana.s * 0.4, arana.s * 46);
        if (arana.distMeta() < arana.s * 1.2) cosiendo.fase = 'coser';
      } else {
        // avanza sobre el conector dejando puntadas
        cosiendo.k = Math.min(1, cosiendo.k + dt / 0.32);
        cosiendo.paso.cosido = cosiendo.k;
        const [x, y] = puntoEn(pts, largoDe(pts) * cosiendo.k);
        arana.irA(x, y - arana.s * 0.4, arana.s * 40);
        if (cosiendo.k >= 1) cosiendo = null;
      }
    }
  } else {
    arana.irA(casa.x, casa.y, arana.s * 30);
    if (arana.distMeta() < arana.s * 0.8) arana.parar();
  }
  arana.avanzar(dt);
}

export function iniciar() {
  alCambiar(() => { sucio = true; aranaLista = false; });
  pintarYa();
  capa(20, (ctx, t) => {
    if (!medidas.principales || minimizada('flujo')) return;
    ctx.lineWidth = 1;
    const P = medidas.principales;
    for (let i = 1; i < P.length; i++) {
      const b = P[i], pts = conector(P[i - 1], b);
      const est = b.paso ? b.paso.estado : 'ok';
      const vivo = est === 'curso' || est === 'espera';
      ctx.strokeStyle = est === 'curso' ? COLOR.cianTenue : est === 'espera' ? rgba('ambar', 0.5) : est === 'fallo' ? rgba('rosa', 0.6) : COLOR.linea2;
      trazar(ctx, pts);
      const fin = pts[pts.length - 1];
      ctx.fillStyle = est === 'curso' ? COLOR.cian : est === 'espera' ? COLOR.ambar : est === 'fallo' ? COLOR.rosa : COLOR.tinta3;
      ctx.fillRect(Math.round(fin[0]) - 4, Math.round(fin[1]) - 2, 3, 3);
      if (vivo) pulsos(ctx, pts, est === 'espera' ? t * 0.35 : t, est === 'espera' ? 'ambar' : 'cian');
      else if (b.paso ? b.paso.cosido > 0 : true) { ctx.strokeStyle = est === 'fallo' ? rgba('rosa', 0.8) : COLOR.cianTenue; puntadas(ctx, pts, b.paso ? b.paso.cosido : 1); }
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
        const y = Math.round(u.y + u.h / 2) + 0.5, xr = Math.round(Math.max(g.fin.x + g.fin.w, u.x + u.w) + 15) + 0.5, ym = Math.round(g.fin.y + g.fin.h / 2) + 0.5;
        tramos.push([[u.x + u.w, y], [xr, y], [xr, ym]]);
      }
      ctx.strokeStyle = g.vivo ? COLOR.cianTenue : COLOR.linea2;
      for (const pts of tramos) trazar(ctx, pts);
      if (g.vivo) { ctx.setLineDash([]); for (const pts of tramos.slice(0, 1)) pulsos(ctx, pts, t, 'cian'); ctx.setLineDash([3, 3]); }
    }
    ctx.setLineDash([]);
    if (aranaLista) arana.dibujar(ctx, COLOR.cian, 1);
  });
}

export function avanzar(dt = 0) {
  if (reloj.rapido) return;
  if (sucio) pintarYa();
  else if (performance.now() < medirHasta) medir();
  if (dt > 0) avanzarArana(dt);
  // cronómetro, duración del paso en curso y regla: 4 veces por segundo, sin tocar nada más
  if (reloj.t - ultimoTic > 250) {
    ultimoTic = reloj.t;
    if (estado.enTurno) { pintarMeta(); pintarRegla(); }
    for (const p of pasos) if (p.estado === 'curso' && p.el && p.clase !== 'prompt') p.el.children[2].textContent = textoDato(p);
    for (const a of agentes.values()) for (const s of a.subs) if (s.estado === 'curso' && s.el) s.el.children[2].textContent = textoDato(s);
  }
}
/** Tras avanzar en seco (?t=): lo ya terminado queda cosido. */
export function asentar() { for (const p of pasos) if (p.estado !== 'curso' && p.estado !== 'espera') p.cosido = 1; pintarHistoria(); }
export function remedir() { medirHasta = performance.now() + 700; sucio = true; }
