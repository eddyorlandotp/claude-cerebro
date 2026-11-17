// biblioteca.js — la zona Biblioteca: la nube de cúmulos y el guion de la araña grande.
//
// Guion de la araña (máquina de estados en `modo`):
//   pasear      → camina lento de skill en skill; se detiene a "leer" (ilumina puntos, muestra el nombre)
//   recolectar  → llegó `sugeridas`: corre a cada skill, la marca con etiqueta recuadrada y se la echa al lomo
//   bajar       → con todas en el lomo, baja colgada de un hilo hasta el borde de la zona que da a la cara
//   lanzar      → avienta los paquetes a la cara, uno por uno, en arco (600 ms)
//   volver      → regresa por el hilo y sigue paseando
//
// Si la Biblioteca está minimizada, todo esto pasa en miniatura en un rincón de Pensamiento.

import { estado, en, emitir, nombreSkill } from './estado.js';
import { reloj } from './reloj.js';
import { dist, alCambiar, minimizada } from './distribucion.js';
import { capa, lienzo, fuente } from './lienzo.js';
import { Nube } from './nube.js';
import { Arana } from './arana.js';
import { cara } from './pensamiento.js';
import { azar, entraSale, sale, limitar, COLOR, rgba, TAU } from './util.js';

const nube = new Nube();
const arana = new Arana(11, 2);
const rnd = azar(20261116);
const meta = document.getElementById('bib-meta');
const vacio = document.getElementById('bib-vacio');

let rect = { x: 0, y: 0, w: 1, h: 1 };     // dónde vive la nube (zona o rincón del centro)
let mini = false;
let tamTexto = 11;
let colocada = false;

let modo = 'pasear';
let pausa = 0;                 // s que le quedan detenida
let destino = null;            // { id, i } skill a la que va
let cola = [];                 // ids por recolectar
let lomo = [];                 // ids que ya lleva
let ancla = null;              // de dónde cuelga el hilo
let hiloAlfa = 0;
let lectura = null;            // { id, alfa } etiqueta tenue de lo que lee al pasear
const etiquetas = new Map();   // id -> { id, alfa, estilo, caja }  (las que marca la araña)
const vuelos = [];             // paquetes en el aire: { id, x0, y0, k, espera }
const pulsos = [];             // hilos cara→skill al usar una skill: { id, k }
const hilosUsadas = new Map(); // id -> alfa (hilo tenue que queda durante el turno)

// ---------- acomodo ----------
function reacomodar() {
  const estaMini = minimizada('biblioteca');
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  tamTexto = Math.round(base * 0.8);
  if (estaMini) {
    // rincón inferior izquierdo de Pensamiento
    const p = dist.rects.pensamiento;
    const w = Math.max(150, Math.min(p.w * 0.2, 250)), h = Math.max(130, Math.min(p.h * 0.32, 280));
    rect = { x: p.x + 24, y: p.y + p.h - h - 24, w, h };
  } else {
    const b = dist.rects.biblioteca;
    rect = { x: b.x + 14, y: b.y + 46, w: b.w - 28, h: b.h - 46 - 10 };
  }
  mini = estaMini;
  if (rect.w < 40 || rect.h < 40) return;
  nube.acomodar(rect, mini, tamTexto);
  const lado = Math.min(rect.w, rect.h);
  arana.s = mini ? 5.2 : limitar(lado * 0.027, 9, 18);
  if (!colocada && nube.cumulos.length) {
    const c = nube.cumulos.find((x) => x.activo) || nube.cumulos[0];
    arana.colocar(c.mx, c.my, -0.6);
    colocada = true;
  } else if (colocada) {
    // la zona cambió de tamaño: la araña se muda con su cúmulo más cercano
    arana.x = limitar(arana.x, rect.x + 10, rect.x + rect.w - 10); arana.y = limitar(arana.y, rect.y + 10, rect.y + rect.h - 10);
    if (modo === 'pasear') { destino = null; pausa = 0; }
    arana.plantar();
  }
  layoutEtiquetas();
}

function pintarMeta() {
  const total = estado.skills.size, plugins = estado.plugins.length, activos = estado.plugins.filter((p) => p.activo !== false).length;
  vacio.hidden = total > 0;
  meta.innerHTML = total ? `<b>${total}</b> skills · ${plugins} plugins${activos < plugins ? ` · ${plugins - activos} apagados` : ''}` : '';
}

// ---------- guion ----------
function elegirPaseo() {
  // una skill de un cúmulo encendido cercano (no siempre el mismo)
  const cs = nube.cumulos.filter((c) => c.activo && c.k > 0);
  if (!cs.length) return null;
  const orden = cs.map((c) => ({ c, d: Math.hypot(c.cx - arana.x, c.cy - arana.y) })).sort((a, b) => a.d - b.d);
  // se prueban varios destinos y se descarta el que la dejaría estacionada sobre una etiqueta
  const m = arana.span * 0.42;
  let elegido = null;
  for (let intento = 0; intento < 10; intento++) {
    const c = orden[Math.min(orden.length - 1, Math.floor(rnd() * Math.min(intento < 5 ? 5 : orden.length, orden.length)))].c;
    const j = Math.floor(rnd() * c.k), i = c.ini + j;
    elegido = { id: c.skills[j].id, i };
    const huella = { x: nube.PX[i] - m, y: nube.PY[i] - m, w: m * 2, h: m * 2 };
    if (!etiquetas.has(elegido.id) && !cajasVivas.some((q) => pisa(huella, q, 2))) break;
  }
  return elegido;
}
function ordenarCola(ids) {
  // recorrido corto: siempre la más cercana a la anterior
  const resto = ids.filter((id) => nube.posSkill(id));
  const orden = []; let x = arana.x, y = arana.y;
  while (resto.length) {
    let mejor = 0, dm = Infinity;
    resto.forEach((id, k) => { const p = nube.posSkill(id); const d = Math.hypot(p.x - x, p.y - y); if (d < dm) { dm = d; mejor = k; } });
    const id = resto.splice(mejor, 1)[0]; const p = nube.posSkill(id);
    orden.push(id); x = p.x; y = p.y;
  }
  return orden;
}
function largoRuta(ids) {
  let x = arana.x, y = arana.y, total = 0;
  for (const id of ids) { const p = nube.posSkill(id); total += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; }
  return total;
}
/** Punto del borde de la zona desde donde lanza (el que da a la cara). */
function puntoDeLanzamiento() {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = cara.x - cx, dy = cara.y - cy;
  const kx = dx !== 0 ? (rect.w / 2) / Math.abs(dx) : Infinity, ky = dy !== 0 ? (rect.h / 2) / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky, 1);
  const m = arana.span * 0.55, d = Math.hypot(dx, dy) || 1;
  return { x: limitar(cx + dx * k - (dx / d) * m, rect.x + m, rect.x + rect.w - m), y: limitar(cy + dy * k - (dy / d) * m, rect.y + m, rect.y + rect.h - m) };
}

en('biblioteca', (ev) => {
  pintarMeta();
  if (ev.igual && nube.cumulos.length) return;      // misma biblioteca: la nube y la araña siguen donde estaban
  nube.construir(estado.plugins); colocada = false; reacomodar();
});
en('reinicio', () => {
  etiquetas.clear(); vuelos.length = 0; pulsos.length = 0; hilosUsadas.clear(); cola = []; lomo = []; arana.carga = 0; layoutEtiquetas(); hiloAlfa = 0; ancla = null;
  if (modo !== 'pasear') { modo = 'pasear'; arana.modo = 'andar'; arana.prisa = 0.12; destino = null; pausa = 0; }
  nube.marcarUsadas(new Set());
});
en('prompt', (ev) => { if (ev.enCola) return; etiquetas.clear(); hilosUsadas.clear(); nube.marcarUsadas(new Set()); layoutEtiquetas(); });
en('sugeridas', () => {
  const ids = estado.sugeridas.map((s) => s.id);
  const conocidas = ids.filter((id) => nube.posSkill(id));
  // las que no están en la biblioteca se entregan directo (no hay a dónde ir por ellas)
  for (const id of ids) if (!conocidas.includes(id)) emitir('paquete', { id });
  if (!conocidas.length) return;
  cola = ordenarCola(conocidas); lomo = []; arana.carga = 0;
  modo = 'recolectar'; arana.modo = 'andar'; destino = null; pausa = 0; lectura = null;
  // rapidez para llegar a todas en ~1.5 s, sea cual sea el tamaño de la pantalla
  arana.velMax = limitar(largoRuta(cola) / 1.5, arana.s * 17, arana.s * 27); arana.prisa = 0.45;
});
en('skill_usada', (ev) => {
  nube.marcarUsadas(new Set(estado.usadas));
  const e = etiquetas.get(ev.id);
  if (e) e.estilo = 'usada'; else if (nube.posSkill(ev.id)) { etiquetas.set(ev.id, { id: ev.id, alfa: 0, estilo: 'usada', caja: null }); layoutEtiquetas(); }
  if (nube.posSkill(ev.id)) { pulsos.push({ id: ev.id, k: 0 }); hilosUsadas.set(ev.id, 1); }
});

function avanzarGuion(dt) {
  const s = arana.s;
  if (pausa > 0) { pausa -= dt; }
  switch (modo) {
    case 'pasear': {
      if (pausa > 0) break;
      if (!destino) {
        destino = elegirPaseo();
        if (!destino) break;
        arana.velMax = (mini ? 30 : 46) + rnd() * 26;
        lectura = null;
      }
      const p = { x: nube.PX[destino.i], y: nube.PY[destino.i] };
      arana.irA(p.x, p.y);
      if (arana.distMeta() < s * 0.9) {
        arana.parar();
        pausa = 1.6 + rnd() * 2.2;
        lectura = { id: destino.id, alfa: 0 };
        destino = null;
      }
      break;
    }
    case 'recolectar': {
      if (pausa > 0) break;
      if (!destino) {
        if (!cola.length) {
          // todas en el lomo: baja por el hilo hasta el borde
          ancla = { x: arana.x, y: arana.y }; hiloAlfa = 1;
          modo = 'bajar'; arana.modo = 'colgar';
          const p = puntoDeLanzamiento();
          arana.irA(p.x, p.y, limitar(Math.hypot(p.x - arana.x, p.y - arana.y) / 0.42, 240, 1600));
          break;
        }
        destino = { id: cola.shift() };
      }
      const p = nube.posSkill(destino.id);
      arana.irA(p.x, p.y);
      if (arana.distMeta() < s * 1.1) {
        // marcar con etiqueta y echar el paquete al lomo
        const sug = estado.sugeridas.find((x) => x.id === destino.id);
        etiquetas.set(destino.id, { id: destino.id, alfa: 0, estilo: sug?.apagada ? 'apagada' : 'normal', caja: null });
        layoutEtiquetas();
        lomo.push(destino.id); arana.carga = lomo.length;
        nube.calentar(p.x, p.y, arana.span * 0.7, 1);
        destino = null; pausa = 0.1;
      }
      break;
    }
    case 'bajar': {
      if (arana.distMeta() < 6) {
        arana.parar(); modo = 'lanzar'; arana.modo = 'andar'; arana.plantar();
        // mirar hacia la cara
        arana.rumbo = Math.atan2(cara.y - arana.y, cara.x - arana.x); arana.plantar();
        pausa = 0.16;
      }
      break;
    }
    case 'lanzar': {
      if (pausa > 0) break;
      if (lomo.length) {
        const id = lomo.shift(); arana.carga = lomo.length; arana.lanzar();
        const f = arana.frente();
        vuelos.push({ id, x0: f.x, y0: f.y, k: 0 });
        pausa = 0.15;
      } else if (!vuelos.length) {
        // entregado: regresa a pasear (el hilo se desvanece mientras se aleja)
        modo = 'pasear'; arana.prisa = 0.12; destino = null; pausa = 0.35;
      }
      break;
    }
  }
}

export function avanzar(dt, t) {
  if (!nube.cumulos.length) return;
  nube.avanzar(dt, t);
  avanzarGuion(dt);
  arana.avanzar(dt);
  // a su paso los puntos cercanos se iluminan
  if (!reloj.rapido) nube.calentar(arana.x, arana.y, arana.span * (modo === 'pasear' ? 0.6 : 0.45), modo === 'pasear' && pausa > 0 ? 1 : 0.7);

  if (modo === 'pasear' && hiloAlfa > 0) { hiloAlfa = Math.max(0, hiloAlfa - dt * 0.6); if (hiloAlfa <= 0) ancla = null; }
  for (const e of etiquetas.values()) e.alfa = Math.min(1, e.alfa + dt / 0.2);
  if (lectura) { lectura.alfa = Math.min(1, lectura.alfa + dt / 0.25); }
  for (let i = vuelos.length - 1; i >= 0; i--) {
    const v = vuelos[i];
    v.k += dt / 0.6;
    if (v.k >= 1) { vuelos.splice(i, 1); emitir('paquete', { id: v.id }); }
  }
  for (let i = pulsos.length - 1; i >= 0; i--) { pulsos[i].k += dt / 0.75; if (pulsos[i].k >= 1.25) pulsos.splice(i, 1); }
  for (const [id, a] of hilosUsadas) if (a > 0.28) hilosUsadas.set(id, Math.max(0.28, a - dt * 0.5));
}

// ---------- etiquetas recuadradas ----------
function medirTexto(txt) { return txt.length * tamTexto * 0.6; }
const pisa = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w > b.x - m && a.y < b.y + b.h + m && a.y + a.h > b.y - m;

/**
 * Busca el mejor sitio para una etiqueta alrededor de su punto: prueba 12 direcciones × 4 distancias
 * y se queda con la que menos estorba. Choques duros: salirse de la zona, otra etiqueta, el punto de otra
 * skill marcada. Choques blandos: rótulos de cúmulos, la araña, el centro del propio cúmulo.
 */
function colocarCaja(p, w, h, puestas, marcas, rotulos, conArana, pesoArana = 22) {
  const c = nube.cumuloDe(p.i);
  let fx = p.x - c.cx, fy = p.y - c.cy; const fd = Math.hypot(fx, fy);
  if (fd < 4) { fx = 0.7; fy = -0.7; } else { fx /= fd; fy /= fd; }
  let mejor = null;
  for (const dist of [20, 36, 54, 76]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU, dx = Math.cos(ang), dy = Math.sin(ang);
      // el centro de la caja queda sobre la dirección, lo bastante lejos para no tapar el punto
      const caja = { x: p.x + dx * (dist + w / 2) - w / 2, y: p.y + dy * (dist + h / 2) - h / 2, w, h };
      let costo = dist * 0.75 - (dx * fx + dy * fy) * 9 + Math.abs(dy) * 5;     // cerca, hacia fuera del cúmulo y de lado
      if (caja.x < rect.x + 2 || caja.x + w > rect.x + rect.w - 2 || caja.y < rect.y - 14 || caja.y + h > rect.y + rect.h - 2) costo += 2000;
      for (const q of puestas) if (pisa(caja, q, 4)) costo += 900;
      for (const q of marcas) if (pisa(caja, q, 2)) costo += 400;
      for (const q of rotulos) if (pisa(caja, q.rect, 2)) costo += 70;
      if (conArana && pisa(caja, conArana, 0)) costo += pesoArana;
      if (Math.hypot(caja.x + w / 2 - c.cx, caja.y + h / 2 - c.cy) < c.r * 0.45) costo += 14;
      if (!mejor || costo < mejor.costo) mejor = { caja, costo };
    }
  }
  return { ox: mejor.caja.x - p.x, oy: mejor.caja.y - p.y, w, h };
}
function rotulosDeCumulos() { return nube.cumulos.map((c) => ({ c, rect: nube.rectRotulo(c) })); }

function layoutEtiquetas() {
  const puestas = [], alto = Math.round(tamTexto * 1.7), rotulos = rotulosDeCumulos();
  const lista = [...etiquetas.values()].map((e) => ({ e, p: nube.posSkill(e.id) })).filter((x) => x.p);
  // puntos que ninguna etiqueta debe tapar: los de todas las skills sugeridas (aunque la araña aún no llegue a marcarlas)
  const marcas = [...new Set([...etiquetas.keys(), ...estado.sugeridas.map((x) => x.id)])].map((id) => nube.posSkill(id)).filter(Boolean).map((q) => ({ x: q.x - 6, y: q.y - 6, w: 12, h: 12, i: q.i }));
  const huella = { x: arana.x - arana.span * 0.4, y: arana.y - arana.span * 0.4, w: arana.span * 0.8, h: arana.span * 0.8 };
  for (const { e, p } of lista) {
    const texto = nombreSkill(e.id) + (e.estilo === 'apagada' ? ' · apagada' : '');
    const w = Math.round(medirTexto(texto) + 14);
    // las que ya tenían sitio lo conservan si sigue libre (para que no brinquen al llegar otra)
    let caja = e.caja && e.caja.w === w ? e.caja : null;
    if (caja) { const r = { x: p.x + caja.ox, y: p.y + caja.oy, w, h: alto }; if (puestas.some((q) => pisa(r, q, 4))) caja = null; }
    if (!caja) caja = colocarCaja(p, w, alto, puestas, marcas.filter((m) => m.i !== p.i), rotulos, huella);
    caja.texto = texto;
    e.caja = caja;
    puestas.push({ x: p.x + caja.ox, y: p.y + caja.oy, w, h: alto });
  }
  // si aun así una etiqueta pisa el rótulo de un cúmulo, ese rótulo se atenúa mientras la etiqueta viva
  const tapados = new Set();
  for (const r of rotulos) if (puestas.some((q) => pisa(q, r.rect, 1))) tapados.add(r.c.nombre);
  nube.atenuar(tapados);
  cajasVivas = puestas;
}
let cajasVivas = [];     // rectángulos de las etiquetas visibles (la araña no se estaciona encima)

function dibujarEtiqueta(ctx, px, py, caja, estilo, alfa) {
  const x = Math.round(px + caja.ox) + 0.5, y = Math.round(py + caja.oy) + 0.5, w = caja.w, h = caja.h;
  const color = estilo === 'apagada' ? COLOR.ambar : estilo === 'lectura' ? COLOR.tinta2 : COLOR.cian;
  const k = sale(alfa);
  ctx.globalAlpha = alfa;
  // guía del punto a la caja
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(limitar(px, x, x + w), limitar(py, y, y + h)); ctx.stroke();
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.95 + 0.05 * k, 0.95 + 0.05 * k); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = estilo === 'usada' ? COLOR.cian : COLOR.fondo;
  ctx.fillRect(0, 0, w, h);
  if (estilo !== 'usada') { ctx.strokeStyle = estilo === 'lectura' ? COLOR.linea2 : color; ctx.strokeRect(0, 0, w, h); }
  ctx.font = fuente(tamTexto, estilo === 'usada' ? 500 : 400);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = estilo === 'usada' ? COLOR.fondo : color;
  ctx.fillText(caja.texto, 7, h / 2 + 0.5);
  ctx.restore();
  // marca en el punto
  ctx.strokeStyle = color;
  ctx.strokeRect(Math.round(px) - 3.5, Math.round(py) - 3.5, 7, 7);
  ctx.globalAlpha = 1;
}

/** Punto del arco de un paquete en vuelo (curva cuadrática hacia la cara). */
function puntoVuelo(v, k) {
  const e = entraSale(k);
  const x1 = cara.x, y1 = cara.y;
  const mx = (v.x0 + x1) / 2, my = (v.y0 + y1) / 2, d = Math.hypot(x1 - v.x0, y1 - v.y0);
  // el arco se levanta (o se abre de lado si el tiro es vertical)
  const horizontal = Math.abs(x1 - v.x0) > Math.abs(y1 - v.y0);
  const cx = horizontal ? mx : mx - d * 0.22, cy = horizontal ? my - d * 0.28 : my;
  const u = 1 - e;
  return { x: u * u * v.x0 + 2 * u * e * cx + e * e * x1, y: u * u * v.y0 + 2 * u * e * cy + e * e * y1 };
}

export function iniciar() {
  alCambiar(reacomodar);
  pintarMeta();

  // Capa 10: la nube. Capa 30: hilos, araña, etiquetas y paquetes.
  capa(10, (ctx) => { if (nube.cumulos.length && rect.w > 40) nube.dibujar(ctx, lienzo.dpr); });
  capa(30, (ctx) => {
    if (!nube.cumulos.length || rect.w <= 40) return;
    ctx.lineWidth = 1;
    // hilos de skills usadas: de la cara al punto de la skill, con un pulso que viaja
    const rCara = cara.d / 2 + cara.d * 0.075 + 6;
    for (const [id, a] of hilosUsadas) {
      const p = nube.posSkill(id); if (!p) continue;
      const dx = p.x - cara.x, dy = p.y - cara.y, d = Math.hypot(dx, dy) || 1;
      const x0 = cara.x + (dx / d) * rCara, y0 = cara.y + (dy / d) * rCara;
      ctx.strokeStyle = rgba('cian', a * 0.5);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y); ctx.stroke();
      for (const q of pulsos) {
        if (q.id !== id) continue;
        ctx.globalCompositeOperation = 'lighter';
        for (let n = 0; n < 5; n++) {
          const k = entraSale(limitar(q.k - n * 0.035, 0, 1));
          if (k <= 0 || q.k - n * 0.035 > 1) continue;
          ctx.fillStyle = n === 0 ? COLOR.tinta : rgba('cian', 0.8 - n * 0.16);
          const r = n === 0 ? 2.6 : 2.2 - n * 0.3;
          ctx.beginPath(); ctx.arc(x0 + (p.x - x0) * k, y0 + (p.y - y0) * k, r, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // hilo del que cuelga
    if (ancla && hiloAlfa > 0.01) {
      ctx.strokeStyle = rgba('cian', 0.7 * hiloAlfa);
      ctx.beginPath(); ctx.moveTo(ancla.x, ancla.y); ctx.lineTo(arana.x, arana.y); ctx.stroke();
      ctx.fillStyle = rgba('cian', hiloAlfa);
      ctx.fillRect(ancla.x - 1.5, ancla.y - 1.5, 3, 3);
    }
    arana.dibujar(ctx, COLOR.cian, 1);
    // etiquetas: encima de la araña (la información manda); la araña evita estacionarse sobre ellas
    if (!mini) {
      if (lectura && modo === 'pasear' && !etiquetas.has(lectura.id)) {
        const p = nube.posSkill(lectura.id);
        if (p) {
          if (!lectura.caja) {
            const texto = nombreSkill(lectura.id), w = Math.round(medirTexto(texto) + 14), alto = Math.round(tamTexto * 1.7);
            const huella = { x: arana.x - arana.span * 0.45, y: arana.y - arana.span * 0.45, w: arana.span * 0.9, h: arana.span * 0.9 };
            lectura.caja = colocarCaja(p, w, alto, cajasVivas, [], rotulosDeCumulos(), huella, 300);      // la araña se queda ahí: la etiqueta va a un lado
            lectura.caja.texto = texto;
          }
          dibujarEtiqueta(ctx, p.x, p.y, lectura.caja, 'lectura', lectura.alfa * (pausa > 0 ? 1 : 0.5));
        }
      }
      for (const e of etiquetas.values()) { const p = nube.posSkill(e.id); if (p && e.caja) dibujarEtiqueta(ctx, p.x, p.y, e.caja, e.estilo, e.alfa); }
    }
    // paquetes en el aire: cuadrito cian con estela de puntos
    for (const v of vuelos) {
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 9; n >= 1; n--) {
        const kk = v.k - n * 0.022; if (kk <= 0) continue;
        const q = puntoVuelo(v, kk);
        ctx.fillStyle = rgba('cian', 0.7 - n * 0.07);
        ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      const q = puntoVuelo(v, v.k), t = mini ? 6 : 9;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(v.k * 5);
      ctx.fillStyle = COLOR.cian; ctx.fillRect(-t / 2, -t / 2, t, t);
      ctx.restore();
    }
  });
}

/** Para depurar desde la consola: estado del guion de la araña. */
export function depurar() { return { modo, pausa, cola: cola.length, lomo: lomo.length, vuelos: vuelos.length, x: Math.round(arana.x), y: Math.round(arana.y), vel: Math.round(arana.vel), velMax: Math.round(arana.velMax) }; }
