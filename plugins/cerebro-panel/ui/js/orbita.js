// orbita.js — la órbita alrededor de la cara: los satélites de lo que Claude tiene en la cabeza ahora.
// Tres elipses inclinadas, casi de canto, con profundidad real: la mitad de atrás se dibuja ANTES que
// la cara (queda tapada por el disco) y la de adelante DESPUÉS (pasa por delante).
//
//   anillo 0  skills cargadas      cuadro del tono de su cúmulo, con nombre cuando pasa por delante
//   anillo 1  archivos del turno   punto con el nombre corto; más grande cuanto más se tocó; destello al editar
//   anillo 2  subagentes           caritas pequeñas con lo que hacen; y el pedido actual como arco de texto tenue
//
// Es información, no adorno: cada satélite sale de un evento real. Vacía = solo los anillos tenues.
// Fin de turno / compactación: los satélites se recogen hacia la cara.

import { estado, en, emitir, nombreSkill } from './estado.js';
import { reloj } from './reloj.js';
import { fuente } from './lienzo.js';
import { Cara } from './cara.js';
import { tonoSkill, rgbaT } from './tonos.js';
import { TAU, limitar, truncar, truncarMedio, primeraOracion, entraSale, COLOR, rgba } from './util.js';

const ANILLOS = [
  { rx: 0, ry: 0, inc: -0.1, vel: TAU / 52, fase: 0.6 },
  { rx: 0, ry: 0, inc: 0.07, vel: TAU / 74, fase: 2.4 },
  { rx: 0, ry: 0, inc: -0.035, vel: TAU / 96, fase: 4.1 },
];
const ESTADO_SUB = { leer: 'leyendo', buscar: 'leyendo', web: 'leyendo', editar: 'escribiendo', comando: 'ejecutando', skill: 'leyendo', tarea: 'escribiendo' };

let cx = 0, cy = 0, d = 100, zona = { x: 0, y: 0, w: 1, h: 1 }, px = 11;
let sats = [];              // { clave, tipo, anillo, off (ángulo propio), nombre, tono, radio, alfa, fase, ... }
let pedido = '';            // texto del pedido actual (arco en el anillo exterior)
let pedidoAlfa = 0;
let trasCompactar = false;
let tabla = null;           // muestreo del anillo exterior por longitud de arco (para el texto)

/** La zona cambió: centro y diámetro de la cara, y rectángulo de la zona. */
export function geometria(x, y, diam, rect, tamTexto) {
  cx = x; cy = y; d = diam; zona = rect; px = tamTexto;
  const W = Math.min(rect.w, 1500);
  [0.27, 0.37, 0.465].forEach((f, i) => { ANILLOS[i].rx = Math.max(d * (0.95 + i * 0.3), W * f); });
  ANILLOS[0].ry = d * 0.36; ANILLOS[1].ry = d * 0.43; ANILLOS[2].ry = d * 0.66;
  // tabla de longitud de arco del anillo exterior
  const A = ANILLOS[2], n = 360; let largo = 0, ax = A.rx, ay = 0;
  tabla = new Float32Array(n + 1);
  for (let i = 1; i <= n; i++) { const a = (i / n) * TAU, x1 = A.rx * Math.cos(a), y1 = A.ry * Math.sin(a); largo += Math.hypot(x1 - ax, y1 - ay); tabla[i] = largo; ax = x1; ay = y1; }
}
/** Hasta dónde baja la órbita por delante de la cara (para que el pie de la zona quede debajo). */
export const fondo = () => d * 0.66 + d * 0.15;

function punto(anillo, a, radio = 1) {
  const A = ANILLOS[anillo], x0 = A.rx * radio * Math.cos(a), y0 = A.ry * radio * Math.sin(a), c = Math.cos(A.inc), s = Math.sin(A.inc);
  return { x: cx + x0 * c - y0 * s, y: cy + x0 * s + y0 * c, prof: Math.sin(a) };      // prof > 0 = por delante de la cara
}
const anguloDe = (s) => ANILLOS[s.anillo].fase + s.off;
function agregar(s) {
  const mismos = sats.filter((x) => x.anillo === s.anillo);
  // entra por el hueco más grande del anillo
  s.off = mismos.length ? mismos[mismos.length - 1].off + TAU / (mismos.length + 1) : 0.5;
  s.radio = 0.05; s.alfa = 0; s.fase = 'vivo'; s.destello = 1;
  sats.push(s); repartir(s.anillo);
  return s;
}
/** Reparte parejo los satélites de un anillo (cada uno va a su sitio con suavidad). */
function repartir(anillo) {
  const mismos = sats.filter((x) => x.anillo === anillo && x.fase === 'vivo');
  mismos.forEach((s, i) => { s.offMeta = (i / mismos.length) * TAU + (anillo === 2 ? 0.9 : 0.4); });
}
const buscar = (clave) => sats.find((s) => s.clave === clave && s.fase === 'vivo');
function recoger(filtro) { for (const s of sats) if (s.fase === 'vivo' && filtro(s)) { s.fase = 'recoge'; s.k = 0; s.espera = Math.random() * 0.25; } }

// ---------- eventos ----------
en('reinicio', () => { sats = []; pedido = ''; pedidoAlfa = 0; trasCompactar = false; });
en('prompt', (ev) => {
  if (!ev.enCola) recoger((s) => s.tipo !== 'sub');
  pedido = truncar(String(ev.texto || '').replace(/\s+/g, ' ').trim(), 110);
});
en('skill_usada', (ev) => {
  if (buscar('skill:' + ev.id)) return;
  agregar({ clave: 'skill:' + ev.id, tipo: 'skill', anillo: 0, nombre: nombreSkill(ev.id), tono: tonoSkill(ev.id) });
});
en('herramienta', (ev) => {
  if (ev.agente) {
    const s = buscar('sub:' + ev.agente); if (!s) return;
    if (ev.fase === 'inicio') { s.nota = (ev.clase || '') + ' ' + truncarMedio(ev.resumen || ev.nombre || '', 34); s.cara.poner(ESTADO_SUB[ev.clase] || 'ejecutando'); }
    else s.cara.poner(ev.ok === false ? 'tropezo' : 'pensando');
    return;
  }
  if (ev.fase !== 'inicio' || !ev.resumen || (ev.clase !== 'leer' && ev.clase !== 'editar')) return;
  let s = buscar('archivo:' + ev.resumen);
  if (!s) {
    // máximo 7 archivos en órbita: sale el menos tocado
    const arch = sats.filter((x) => x.tipo === 'archivo' && x.fase === 'vivo');
    if (arch.length >= 7) { const menos = arch.sort((a, b) => a.veces - b.veces)[0]; menos.fase = 'recoge'; menos.k = 0; menos.espera = 0; }
    s = agregar({ clave: 'archivo:' + ev.resumen, tipo: 'archivo', anillo: 1, nombre: String(ev.resumen).split('/').pop(), veces: 0, editado: false });
  }
  s.veces += 1;
  if (ev.clase === 'editar') { s.editado = true; s.destello = 1; }
});
en('subagente', (ev) => {
  const clave = 'sub:' + ev.id;
  if (ev.fase === 'inicio') {
    if (buscar(clave)) return;
    const s = agregar({ clave, tipo: 'sub', anillo: 2, id: ev.id, nombre: ev.tipoAgente || 'agente', descripcion: ev.descripcion || '', nota: 'empezando…', cara: new Cara({ mini: true, semilla: sats.length + 5 }) });
    s.cara.poner('atenta');
  } else {
    const s = buscar(clave);
    if (s) { s.fase = 'recoge'; s.k = 0; s.espera = 0; s.entrega = true; }      // viaja a la cara y le entrega un punto de luz
  }
});
en('pensamiento', (ev) => { const s = ev.agente && buscar('sub:' + ev.agente); if (s) { if (ev.texto) s.nota = primeraOracion(ev.texto, 44); s.cara.poner('pensando'); } });
en('dicho', (ev) => { const s = ev.agente && buscar('sub:' + ev.agente); if (s && ev.texto) s.nota = primeraOracion(ev.texto, 44); });
// Momento 4, fin de turno: los satélites se recogen hacia la cara (los subagentes en segundo plano siguen)
en('fin_turno', () => { recoger((s) => s.tipo !== 'sub'); pedido = ''; });
// Momento 5, compactación: todo se recoge y vuelve solo lo que quede en el resumen (`hilo`)
en('compactacion', () => { recoger((s) => s.tipo !== 'sub'); trasCompactar = true; });
en('hilo', (ev) => {
  if (!trasCompactar) return;
  trasCompactar = false;
  for (const a of (ev.archivos || []).slice(0, 7)) agregar({ clave: 'archivo:' + a.ruta, tipo: 'archivo', anillo: 1, nombre: String(a.ruta).split('/').pop(), veces: a.veces || 1, editado: a.accion !== 'leído' });
});

// ---------- consultas ----------
/** Subagente vivo más reciente: { x, y, nombre } o null (la cara lo mira cuando delega). */
export function subActivo() {
  const s = sats.filter((x) => x.tipo === 'sub' && x.fase === 'vivo').pop();
  if (!s) return null;
  const p = punto(2, anguloDe(s), s.radio); return { x: p.x, y: p.y, nombre: s.nombre };
}
/** Un satélite que esté pasando por delante (para que la cara le eche un vistazo). */
export function alguno() {
  const ops = sats.filter((s) => s.fase === 'vivo').map((s) => punto(s.anillo, anguloDe(s), s.radio)).filter((p) => p.prof > 0.2);
  return ops.length ? ops[Math.floor(Math.random() * ops.length)] : null;
}

export function avanzar(dt) {
  const quieto = reloj.quieto, rapido = reloj.rapido;
  if (!quieto) for (const A of ANILLOS) A.fase = (A.fase + A.vel * dt) % TAU;
  pedidoAlfa += ((pedido ? 1 : 0) - pedidoAlfa) * Math.min(1, dt * 3);
  let cambio = -1;
  for (let i = sats.length - 1; i >= 0; i--) {
    const s = sats[i];
    if (s.fase === 'vivo') {
      s.radio += (1 - s.radio) * Math.min(1, dt * (rapido ? 99 : 3.2)); s.alfa = Math.min(1, s.alfa + dt * (rapido ? 99 : 4));
      if (s.offMeta != null) { let dif = (s.offMeta - s.off) % TAU; if (dif > Math.PI) dif -= TAU; if (dif < -Math.PI) dif += TAU; s.off += dif * Math.min(1, dt * (rapido ? 99 : 1.6)); }
    } else {
      if (s.espera > 0 && !rapido) { s.espera -= dt; continue; }
      s.k = Math.min(1, s.k + dt / (rapido ? 0.001 : 0.65));
      s.radio = 1 - entraSale(s.k); s.alfa = 1 - Math.max(0, (s.k - 0.7) / 0.3);
      if (s.k >= 1) { if (s.entrega) emitir('sub-entrega'); sats.splice(i, 1); cambio = s.anillo; }
    }
    if (s.destello > 0) s.destello = Math.max(0, s.destello - dt * 1.3);
    if (s.cara) s.cara.avanzar(dt);
  }
  if (cambio >= 0) repartir(cambio);
}

// ---------- dibujo ----------
function arco(ctx, A, a0, a1) {
  ctx.beginPath(); ctx.ellipse(cx, cy, A.rx, A.ry, A.inc, a0, a1); ctx.stroke();
}
/** Mitad de atrás: anillos y satélites que pasan por detrás de la cara. Se dibuja antes que la cara. */
export function dibujarAtras(ctx) {
  if (zona.w < 60) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba('linea2', 0.75);
  for (const A of ANILLOS) arco(ctx, A, Math.PI, TAU);
  satelites(ctx, false);
}
/** Mitad de adelante: se dibuja después de la cara. Los anillos no cruzan el disco (parecerían una boca). */
export function dibujarFrente(ctx) {
  if (zona.w < 60) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(zona.x, zona.y, zona.w, zona.h); ctx.arc(cx, cy, d * 0.5 + d * 0.075 + 4, 0, TAU); ctx.clip('evenodd');
  ctx.lineWidth = 1; ctx.strokeStyle = COLOR.linea2;
  for (const A of ANILLOS) arco(ctx, A, 0, Math.PI);
  ctx.restore();
  textoPedido(ctx);
  satelites(ctx, true);
}

let nombres = [];      // nombres de satélites del cuadro (los de atrás y los de adelante se pintan juntos, al final)
function satelites(ctx, frente) {
  const rDisco = d * 0.5 + d * 0.075 + 8, etiquetas = nombres;
  if (!frente) etiquetas.length = 0;
  const lista = sats.map((s) => ({ s, p: punto(s.anillo, anguloDe(s), s.radio) })).filter((x) => (x.p.prof >= 0) === frente).sort((a, b) => a.p.prof - b.p.prof);
  for (const { s, p } of lista) {
    const esc = 1 + 0.18 * p.prof, alfa = s.alfa * (0.5 + 0.5 * (p.prof * 0.5 + 0.5));
    const x = Math.round(p.x), y = Math.round(p.y);
    const sobreDisco = Math.hypot(p.x - cx, p.y - cy) < rDisco;
    ctx.globalAlpha = alfa;
    if (s.tipo === 'skill') {
      const t = Math.round(10 * esc * (d > 150 ? 1.15 : 1));
      ctx.fillStyle = s.tono.hex; ctx.fillRect(x - t / 2, y - t / 2, t, t);
      if (sobreDisco && frente) { ctx.strokeStyle = COLOR.fondo; ctx.lineWidth = 1.5; ctx.strokeRect(x - t / 2 - 1, y - t / 2 - 1, t + 2, t + 2); }
      if (s.destello > 0.02) { ctx.strokeStyle = rgbaT(s.tono, s.destello); ctx.lineWidth = 1; const g = t / 2 + 3 + (1 - s.destello) * 12; ctx.strokeRect(x - g, y - g, g * 2, g * 2); }
      if (p.prof > -0.25 && !sobreDisco) etiquetas.push({ x, y: y - t / 2 - px * 0.95, texto: s.nombre, color: s.tono.hex, alfa, prof: p.prof });
    } else if (s.tipo === 'archivo') {
      const r = (2.6 + Math.min(s.veces, 6) * 0.85) * esc * (d > 150 ? 1.15 : 1);
      ctx.fillStyle = s.editado ? COLOR.cian : COLOR.fondo; ctx.strokeStyle = sobreDisco && frente ? COLOR.fondo : COLOR.cian; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      if (s.destello > 0.02) { ctx.strokeStyle = rgba('cian', s.destello); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 3 + (1 - s.destello) * 14, 0, TAU); ctx.stroke(); }
      if (p.prof > -0.25 && !sobreDisco) etiquetas.push({ x, y: y + r + px * 0.75, texto: s.nombre + (s.veces > 1 ? ' ×' + s.veces : ''), color: COLOR.tinta2, alfa, prof: p.prof });
    } else if (s.tipo === 'sub') {
      const dm = Math.max(20, d * 0.27 * esc * limitar(s.radio * 1.4, 0.3, 1));
      s.cara.x = p.x; s.cara.y = p.y; s.cara.d = dm; s.cara.alfa = Math.min(1, alfa * 1.3);
      s.cara.dibujar(ctx);
      if (s.fase === 'vivo') etiquetas.push({ x: p.x + dm / 2 + 8, y: p.y - px * 0.55, texto: s.nombre + ' · ' + truncar(s.descripcion, 34), color: COLOR.tinta, alfa: Math.max(alfa, 0.75), prof: p.prof + 1, izq: true, nota: s.nota, dm });
    }
  }
  if (!frente) { ctx.globalAlpha = 1; return; }
  // nombres: los subagentes primero, luego los de más adelante; ninguno se encima con otro
  ctx.textBaseline = 'middle';
  const puestos = [];
  for (const e of etiquetas.sort((a, b) => b.prof - a.prof)) {
    ctx.font = fuente(px, 500);
    let w = Math.max(ctx.measureText(e.texto).width, e.nota ? e.nota.length * px * 0.58 : 0) + 6;
    const h = e.nota ? px * 2.5 : px * 1.3;
    let x0 = e.izq ? e.x : e.x - w / 2;
    if (e.izq && x0 + w > zona.x + zona.w - 6) {
      // la etiqueta del subagente no cabe a la derecha de su carita: va a la izquierda, recortada si hace falta
      // para no tocar la cara; y si ni así cabe, debajo de la carita
      const der = e.x - e.dm - 16, tope = Math.abs(e.y - cy) < rDisco + px * 2 && der > cx ? cx + rDisco + 8 : zona.x + 6, hueco = der - tope;
      if (hueco >= px * 9) {
        const cabe = Math.floor(hueco / (px * 0.61));
        e.texto = truncar(e.texto, cabe); if (e.nota) e.nota = truncar(e.nota, cabe);
        w = Math.min(w, hueco); x0 = der - w;
      } else { x0 = e.x - e.dm / 2 - 8 - w / 2; e.y += e.dm / 2 + px * 1.2; }
    }
    x0 = limitar(x0, zona.x + 6, zona.x + zona.w - w - 6);
    const r = { x: x0, y: e.y - px * 0.65, w, h };
    if (puestos.some((q) => r.x < q.x + q.w + 4 && r.x + r.w > q.x - 4 && r.y < q.y + q.h + 1 && r.y + r.h > q.y - 1)) continue;
    // ningún nombre se mete sobre la cara ni su anillo
    if (Math.hypot(limitar(cx, r.x, r.x + r.w) - cx, limitar(cy, r.y, r.y + r.h) - cy) < rDisco + 2) continue;
    puestos.push(r);
    ctx.globalAlpha = 1; ctx.fillStyle = COLOR.fondo; ctx.fillRect(Math.round(r.x) - 2, Math.round(r.y), Math.round(w) + 2, Math.round(h));
    ctx.globalAlpha = e.alfa; ctx.fillStyle = e.color;
    ctx.fillText(e.texto, Math.round(x0) + 2, Math.round(e.y));
    if (e.nota) { ctx.font = fuente(px * 0.94, 400); ctx.fillStyle = COLOR.tinta3; ctx.fillText(truncar(e.nota, 46), Math.round(x0) + 2, Math.round(e.y + px * 1.3)); }
  }
  ctx.globalAlpha = 1;
}

/** El pedido actual como arco de texto en el anillo exterior: solo se lee cuando pasa por delante. */
function textoPedido(ctx) {
  if (pedidoAlfa < 0.02 || !pedido || !tabla) return;
  const A = ANILLOS[2], n = tabla.length - 1, total = tabla[n];
  const tam = Math.round(px * 1.02), ancho = tam * 0.62, c = Math.cos(A.inc), s = Math.sin(A.inc);
  // dos copias: cada una ocupa como mucho el 42 % del anillo, para que nunca se pisen
  const texto = truncar(pedido, Math.floor((total * 0.42) / ancho));
  ctx.font = fuente(tam, 400); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.tinta2;
  let j = 0;
  // dos copias del texto, una frente a la otra, para que siempre haya una pasando por delante
  for (let copia = 0; copia < 2; copia++) {
    const inicio = ((A.fase + 1 + copia * Math.PI) / TAU) * total;
    j = 0;
    for (let i = 0; i < texto.length; i++) {
      // el texto se lee de izquierda a derecha por delante: avanza con el ángulo decreciente
      let pos = (inicio - i * ancho) % total; if (pos < 0) pos += total;
      while (j < n && tabla[j + 1] < pos) j++;
      while (j > 0 && tabla[j] > pos) j--;
      const a = ((j + (pos - tabla[j]) / Math.max(0.001, tabla[j + 1] - tabla[j])) / n) * TAU, prof = Math.sin(a);
      if (prof < 0.12 || texto[i] === ' ') continue;
      const x0 = A.rx * Math.cos(a), y0 = A.ry * Math.sin(a);
      // las letras van derechas sobre la curva (la elipse es tan plana que no hace falta girarlas, y así
      // el navegador reutiliza cada glifo en vez de rasterizarlo girado en cada cuadro)
      ctx.globalAlpha = pedidoAlfa * limitar((prof - 0.12) * 2.2, 0, 0.62);
      ctx.fillText(texto[i], Math.round(cx + x0 * c - y0 * s), Math.round(cy + x0 * s + y0 * c));
    }
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';
}
