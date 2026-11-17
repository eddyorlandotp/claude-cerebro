// biblioteca.js — la zona Biblioteca: la nube 3D de cúmulos (nube.js) y el guion de la araña grande.
//
// La araña vive en el MUNDO 3D (W). Camina en pantalla con su cinemática de siempre (arana.js) y su
// posición del mundo se deduce desproyectando; cuando la cámara gira, se la traslada entera (pies
// incluidos) para que no "patine". Entre cúmulos SALTA: arco en el mundo, patas recogidas y un hilo
// que queda unos segundos.
//
// Guion (`modo`):
//   pasear      camina y salta de skill en skill; se detiene a leer (los puntos cercanos laten)
//   recolectar  llegó `sugeridas`: la cámara se acerca, ella corre/salta a cada skill, la marca con su
//               etiqueta (del tono del cúmulo) y se la echa al lomo
//   lanzar      avienta los paquetes a la cara, uno por uno, en arco; la cámara regresa a la órbita
//   devolver    fin de turno: recoge las sugerencias que no se usaron y las regresa a su cúmulo
// Además atiende una cola de `tareas` cuando pasea: lanzar el hilo guardado a la araña del Hilo y
// coser el turno terminado a la historia del Flujo.
//
// Si la Biblioteca está minimizada, todo esto pasa en miniatura en un rincón de Pensamiento.

import { estado, en, emitir, nombreSkill, lugares } from './estado.js';
import { reloj } from './reloj.js';
import { dist, alCambiar, minimizada } from './distribucion.js';
import { capa, lienzo, fuente } from './lienzo.js';
import { Nube } from './nube.js';
import { Arana } from './arana.js';
import { tonoSkill, rgbaT, TONO_CIAN } from './tonos.js';
import { azar, entraSale, sale, limitar, difAngulo, COLOR, rgba, TAU } from './util.js';

const nube = new Nube();
const arana = new Arana(11, 2);
const rnd = azar(20261116);
const meta = document.getElementById('bib-meta');
const vacio = document.getElementById('bib-vacio');
const params = new URLSearchParams(location.search);
nube.cam.fija = params.get('camara') === 'fija';

let rect = { x: 0, y: 0, w: 1, h: 1 };     // dónde vive la nube (zona o rincón del centro)
let mini = false, tamTexto = 11, colocada = false, baseS = 11;
let W = { x: 0, y: 0, z: 0 };  // posición de la araña en el mundo
let zcAhora = 0;               // su profundidad de cámara en este cuadro
let aqui = null;               // id de la skill sobre la que está parada (null si va de camino)

let modo = 'pasear';
let pausa = 0;                 // s que le quedan detenida
let viaje = null;              // { id, tipo: 'andar'|'salto', A, k, dur, prep, d0, alLlegar }
let cola = [], lomo = [];      // ids por recolectar / que ya lleva
let tareas = [];               // [{ tipo: 'hilo' | 'coser' | 'devolver', ids }]
let lectura = null;            // { id, alfa, caja } etiqueta tenue de lo que lee al pasear
let mirar = null;              // { id, hasta } skill que voltea a ver cuando Claude la usa
let ultimaOnda = -1e9, proximoPulso = 0, ultimoLayout = 0;
const etiquetas = new Map();   // id -> { id, alfa, estilo, tono, caja, sale }
const vuelos = [];             // paquetes en el aire
const pulsos = [];             // pulsos cara→skill al usar una skill: { id, k }
const hilosUsadas = new Map(); // id -> alfa (hilo tenue que queda durante el turno)
const hilosSalto = [];         // hilos que deja al saltar: { A, B, edad }
let costura = null;            // hilo al Flujo al terminar el turno: { k, edad }

const lugarCara = () => (lugares.cara ? lugares.cara() : { x: innerWidth / 2, y: innerHeight / 2, r: 60 });
lugares.aranaBib = () => ({ x: arana.x, y: arana.y });

// ---------- acomodo ----------
function reacomodar() {
  const estaMini = minimizada('biblioteca');
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  tamTexto = Math.round(base * 0.8);
  if (estaMini) {
    const p = dist.rects.pensamiento;
    const w = Math.max(150, Math.min(p.w * 0.2, 250)), h = Math.max(130, Math.min(p.h * 0.3, 260));
    rect = { x: p.x + 16, y: p.y + p.h - h - 16, w, h };
  } else {
    const b = dist.rects.biblioteca;
    rect = { x: b.x + 1, y: b.y + 40, w: b.w - 2, h: b.h - 41 };
  }
  mini = estaMini;
  if (rect.w < 40 || rect.h < 40) return;
  nube.acomodar(rect, mini, tamTexto);
  baseS = mini ? 4.4 : limitar(Math.min(rect.w, rect.h) * 0.026, 9, 17);
  if (!colocada && nube.cumulos.length) {
    const c = nube.cumulos.find((x) => x.activo && x.k) || nube.cumulos.find((x) => x.k);
    if (!c) return;
    aqui = c.skills[0].id;
    const q = nube.posSkill(aqui); W = { x: q.x, y: q.y, z: q.z };
    const p = nube.proyectar(W.x, W.y, W.z);
    arana.s = baseS * p.e; arana.colocar(p.x, p.y, -0.6);
    colocada = true;
  }
  layoutEtiquetas();
}

function pintarMeta() {
  const total = estado.skills.size, plugins = estado.plugins.length, activos = estado.plugins.filter((p) => p.activo !== false).length;
  vacio.hidden = total > 0;
  meta.innerHTML = total ? `<b>${total}</b> skills · ${plugins} plugins${activos < plugins ? ` · ${plugins - activos} apagados` : ''}` : '';
}

// ---------- moverse por el mundo ----------
/** Va a una skill: camina si está en el mismo cúmulo y cerca; si no, salta dejando hilo. */
function viajar(id, { rapido = false } = {}, alLlegar) {
  const B = nube.posSkill(id); if (!B) { if (alLlegar) alLlegar(); return; }
  const pa = nube.proyectar(W.x, W.y, W.z), pb = nube.proyectar(B.x, B.y, B.z);
  const dPant = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const deAqui = aqui ? nube.posSkill(aqui) : null;
  const salto = !deAqui || deAqui.c !== B.c || dPant > arana.span * 3;
  viaje = {
    id, tipo: salto ? 'salto' : 'andar', A: { ...W }, k: 0, alLlegar, d0: dPant,
    dur: salto ? (rapido ? limitar(dPant / 1500, 0.24, 0.4) : limitar(dPant / 380, 0.6, 1.05)) : 0,
    prep: salto ? (rapido ? 0.06 : 0.26) : 0,
  };
  if (!salto) { arana.modo = 'andar'; arana.velMax = rapido ? arana.s * 22 : arana.s * (3.4 + rnd() * 2.2); arana.prisa = rapido ? 0.45 : 0.12; }
  aqui = null; lectura = null;
}
function llegar() {
  const v = viaje; viaje = null; aqui = v.id;
  arana.parar();
  if (v.alLlegar) v.alLlegar();
}
function girarHacia(x, y, dt, vel = 7) {
  const err = difAngulo(arana.rumbo, Math.atan2(y - arana.y, x - arana.x));
  arana.rumbo += limitar(err, -vel * dt, vel * dt);
  return Math.abs(err);
}
function avanzarViaje(dt) {
  const v = viaje, B = nube.posSkill(v.id);
  if (!B) { viaje = null; return; }
  const pb = nube.proyectar(B.x, B.y, B.z);
  if (v.tipo === 'andar') { v.d0 = Math.hypot(pb.x - arana.x, pb.y - arana.y); arana.irA(pb.x, pb.y); return; }
  // salto: se agacha mirando al destino, y vuela en arco por el mundo con las patas recogidas
  if (v.prep > 0) { v.prep -= dt; girarHacia(pb.x, pb.y, dt, 10); if (v.prep <= 0) { arana.modo = 'colgar'; arana.parar(); v.A = { ...W }; } return; }
  v.k = Math.min(1, v.k + dt / v.dur);
  const e = v.k * v.k * (3 - 2 * v.k), up = nube.arriba();
  const largo = Math.hypot(B.x - v.A.x, B.y - v.A.y, B.z - v.A.z), h = (largo * 0.3 + 12) * Math.sin(Math.PI * v.k);
  W = { x: v.A.x + (B.x - v.A.x) * e + up.x * h, y: v.A.y + (B.y - v.A.y) * e + up.y * h, z: v.A.z + (B.z - v.A.z) * e + up.z * h };
  const p = nube.proyectar(W.x, W.y, W.z);
  if (Math.hypot(p.x - arana.x, p.y - arana.y) > 0.6) arana.rumbo += difAngulo(arana.rumbo, Math.atan2(p.y - arana.y, p.x - arana.x)) * Math.min(1, dt * 14);
  arana.x = p.x; arana.y = p.y; arana.escalar(baseS * p.e * (1 + 0.14 * Math.sin(Math.PI * v.k)));
  zcAhora = p.z;
  if (v.k >= 1) {
    W = { x: B.x, y: B.y, z: B.z };
    arana.modo = 'andar'; arana.escalar(baseS * pb.e); arana.plantar();
    hilosSalto.push({ A: v.A, B: { ...W }, edad: 0 });
    if (hilosSalto.length > 6) hilosSalto.shift();
    llegar();
  }
}

// ---------- guion ----------
function elegirPaseo() {
  const act = nube.cumulos.filter((c) => c.activo && c.k > 0);
  if (!act.length) return null;
  const deAqui = aqui ? nube.posSkill(aqui) : null;
  const libre = (id) => id !== aqui && !etiquetas.has(id);
  // 6 de cada 10 veces sigue en su cúmulo; si no, salta a uno de los cuatro más cercanos
  if (deAqui && deAqui.c.activo && deAqui.c.k > 1 && rnd() < 0.6) {
    const ops = deAqui.c.skills.map((s) => s.id).filter(libre);
    if (ops.length) return ops[Math.floor(rnd() * ops.length)];
  }
  const cerca = act.filter((c) => !deAqui || c !== deAqui.c).map((c) => ({ c, d: Math.hypot(c.x - W.x, c.y - W.y, c.z - W.z) })).sort((a, b) => a.d - b.d).slice(0, 4);
  for (let n = 0; n < 6 && cerca.length; n++) {
    const c = cerca[Math.floor(rnd() * cerca.length)].c, id = c.skills[Math.floor(rnd() * c.k)].id;
    if (libre(id)) return id;
  }
  return null;
}
/** Recorrido corto por el mundo: siempre la más cercana a la anterior. */
function ordenar(ids) {
  const resto = ids.filter((id) => nube.posSkill(id)), orden = []; let p = W;
  while (resto.length) {
    let mejor = 0, dm = Infinity;
    resto.forEach((id, k) => { const q = nube.posSkill(id), d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z); if (d < dm) { dm = d; mejor = k; } });
    const id = resto.splice(mejor, 1)[0]; orden.push(id); p = nube.posSkill(id);
  }
  return orden;
}
function marcar(id) {
  const sug = estado.sugeridas.find((x) => x.id === id);
  etiquetas.set(id, { id, alfa: 0, estilo: sug?.apagada ? 'apagada' : 'normal', tono: tonoSkill(id), caja: null });
  layoutEtiquetas();
  lomo.push(id); arana.carga = lomo.length;
  nube.calentar(arana.x, arana.y, arana.span * 0.7, 1);
  pausa = 0.12;
}
/** Lanza un paquete desde la boca de la araña (o desde otro punto) hacia un lugar que puede moverse. */
function paquete({ id = null, tono = TONO_CIAN, desde = null, hasta, dur = 0.6, retraso = 0, alLlegar }) {
  vuelos.push({ id, tono, desde, hasta, dur, k: -retraso / dur, alLlegar });
}
function alFrente() { const f = arana.frente(); return { x: f.x, y: f.y }; }

function hacerTarea() {
  const tarea = tareas.shift();
  if (tarea.tipo === 'hilo') {
    // el hilo guardado: un paquete para la araña del Hilo, que lo atrapa y lo teje
    if (!lugares.aranaHilo) return;
    arana.lanzar();
    paquete({ desde: alFrente(), hasta: lugares.aranaHilo, dur: 0.75, alLlegar: () => emitir('hilo-atrapado') });
    mirar = { lugar: lugares.aranaHilo, hasta: reloj.t + 900 }; pausa = 0.9;
  } else if (tarea.tipo === 'coser') {
    // fin de turno: lanza un hilo al Flujo que cose el turno terminado a la historia
    if (!lugares.flujoHistoria) return;
    arana.lanzar();
    costura = { k: 0, edad: 0, llego: false };
    mirar = { lugar: lugares.flujoHistoria, hasta: reloj.t + 900 }; pausa = 1;
  } else if (tarea.tipo === 'devolver') {
    // las sugerencias que no se usaron vuelven de la cara a la araña, y ella las regresa a su cúmulo
    const ids = tarea.ids.filter((id) => etiquetas.has(id) && !estado.usadas.has(id));
    if (!ids.length) return;
    const c = lugarCara();
    ids.forEach((id, n) => paquete({ id, tono: tonoSkill(id), desde: { x: c.x, y: c.y + c.r }, hasta: () => ({ x: arana.x, y: arana.y }), dur: 0.55, retraso: n * 0.16, alLlegar: () => { arana.carga += 1; emitir('devuelta', { id }); } }));
    mirar = { lugar: lugarCara, hasta: reloj.t + 700 + ids.length * 160 };
    cola = ordenar(ids); modo = 'devolver'; pausa = 0.7 + ids.length * 0.16;
  }
}

en('biblioteca', (ev) => {
  pintarMeta();
  if (ev.igual && nube.cumulos.length) return;      // misma biblioteca: la nube y la araña siguen donde estaban
  nube.construir(estado.plugins); colocada = false; viaje = null; aqui = null; reacomodar();
});
function limpiarTurno() {
  etiquetas.clear(); hilosUsadas.clear(); pulsos.length = 0; cola = []; lomo = []; tareas = []; arana.carga = 0; costura = null;
  for (let i = vuelos.length - 1; i >= 0; i--) vuelos.splice(i, 1);
  nube.marcarUsadas(new Set()); nube.atenuar(new Set());
  if (modo !== 'pasear') { modo = 'pasear'; arana.prisa = 0.12; pausa = 0; nube.soltar(); }
}
en('reinicio', () => { limpiarTurno(); hilosSalto.length = 0; });
en('prompt', (ev) => {
  if (ev.enCola) return;
  limpiarTurno();
  // Momento 1: llega un mensaje → una onda recorre la biblioteca desde la araña
  if (colocada && !reloj.rapido) { nube.onda(arana.x, arana.y); ultimaOnda = reloj.t; }
});
en('sugeridas', () => {
  const ids = estado.sugeridas.map((s) => s.id);
  const conocidas = ids.filter((id) => nube.posSkill(id));
  // las que no están en la biblioteca se entregan directo (no hay a dónde ir por ellas)
  for (const id of ids) if (!conocidas.includes(id)) emitir('paquete', { id });
  if (!conocidas.length || !colocada) return;
  if (viaje && viaje.tipo === 'salto' && arana.modo === 'colgar') { arana.modo = 'andar'; arana.plantar(); }
  viaje = null; lectura = null; mirar = null;
  cola = ordenar(conocidas); lomo = []; arana.carga = 0; modo = 'recolectar';
  // los cúmulos que coinciden se encienden un instante antes de que ella salga hacia ellos
  if (!reloj.rapido) {
    if (reloj.t - ultimaOnda > 1200) nube.onda(arana.x, arana.y);
    for (const c of new Set(conocidas.map((id) => nube.posSkill(id).c))) nube.encender(c, 0.9);
  }
  pausa = 0.45;
  nube.enfocar(W, 1.55);      // la cámara se acerca y la encuadra
});
en('skill_usada', (ev) => {
  nube.marcarUsadas(new Set(estado.usadas));
  if (!nube.posSkill(ev.id)) return;
  const e = etiquetas.get(ev.id);
  if (e) e.estilo = 'usada'; else { etiquetas.set(ev.id, { id: ev.id, alfa: 0, estilo: 'usada', tono: tonoSkill(ev.id), caja: null }); layoutEtiquetas(); }
  pulsos.push({ id: ev.id, k: 0 }); hilosUsadas.set(ev.id, 1);
  mirar = { id: ev.id, hasta: reloj.t + 1500 };      // la araña voltea a ver
});
en('hilo', (ev) => {
  if (!ev.objetivo && !(ev.archivos || []).length) return;
  if (!tareas.some((x) => x.tipo === 'hilo')) tareas.push({ tipo: 'hilo' });
  atender();
});
/** Hay algo que hacer: si está paseando, deja lo que hacía (termina el salto, pero no una caminata ni una lectura). */
function atender() {
  if (modo !== 'pasear') return;
  pausa = Math.min(pausa, 0.25);
  if (viaje && viaje.tipo === 'andar') { viaje = null; arana.parar(); }
}
en('fin_turno', () => {
  tareas = tareas.filter((x) => x.tipo === 'hilo');
  tareas.push({ tipo: 'coser' });
  const sobran = estado.sugeridas.filter((s) => !estado.usadas.has(s.id) && etiquetas.has(s.id)).map((s) => s.id);
  if (sobran.length) tareas.push({ tipo: 'devolver', ids: sobran });
  atender();
});

function avanzarGuion(dt) {
  if (pausa > 0) pausa -= dt;
  if (viaje) { avanzarViaje(dt); return; }
  // voltear a ver algo (la skill que Claude usó, o a quien le lanza)
  if (mirar) {
    if (reloj.t > mirar.hasta) mirar = null;
    else if (modo === 'pasear' || modo === 'devolver') { const q = mirar.lugar ? mirar.lugar() : nube.pantallaSkill(mirar.id); if (q) girarHacia(q.x, q.y, dt, 6); }
  }
  switch (modo) {
    case 'pasear': {
      if (pausa > 0) {
        // leyendo: los puntos cercanos laten
        if (lectura && !reloj.rapido && !reloj.quieto && reloj.t > proximoPulso) { proximoPulso = reloj.t + 1100; nube.ondas.push({ x: arana.x, y: arana.y, r: 2, vel: arana.span * 1.3, max: arana.span * 1.1, ancho: 9 }); }
        break;
      }
      if (tareas.length) { hacerTarea(); break; }
      const id = elegirPaseo();
      if (id) viajar(id, {}, () => { pausa = rnd() < 0.3 ? 5 + rnd() * 4 : 1.8 + rnd() * 2.4; lectura = { id, alfa: 0, caja: null }; });
      else pausa = 1;
      break;
    }
    case 'recolectar': {
      if (pausa > 0) break;
      if (!cola.length) { modo = 'lanzar'; pausa = 0.22; break; }
      const id = cola.shift();
      viajar(id, { rapido: true }, () => marcar(id));
      break;
    }
    case 'lanzar': {
      const c = lugarCara();
      girarHacia(c.x, c.y, dt, 12);
      if (pausa > 0) break;
      if (lomo.length) {
        const id = lomo.shift(); arana.carga = lomo.length; arana.lanzar();
        paquete({ id, tono: tonoSkill(id), desde: alFrente(), hasta: lugarCara, alLlegar: () => emitir('paquete', { id }) });
        pausa = 0.17;
      } else if (!vuelos.some((v) => v.id && v.k < 0.75)) { nube.soltar(); modo = 'pasear'; pausa = 0.5; }
      break;
    }
    case 'devolver': {
      if (pausa > 0) break;
      if (!cola.length) { modo = 'pasear'; arana.carga = 0; pausa = 0.6; break; }
      const id = cola.shift();
      viajar(id, {}, () => { const e = etiquetas.get(id); if (e) e.sale = true; arana.carga = Math.max(0, arana.carga - 1); nube.calentar(arana.x, arana.y, arana.span * 0.7, 0.9); pausa = 0.35; });
      break;
    }
  }
}

export function avanzar(dt, t) {
  if (!nube.cumulos.length) return;
  nube.avanzar(dt, t);
  if (!colocada) return;
  // 1) lo que movió la cámara (o la respiración del cúmulo) se le aplica entera, sin que dé pasos
  const saltando = viaje && viaje.tipo === 'salto' && viaje.prep <= 0;
  if (!saltando) {
    if (!viaje && aqui) { const q = nube.posSkill(aqui); if (q) { W.x = q.x; W.y = q.y; W.z = q.z; } }
    const p = nube.proyectar(W.x, W.y, W.z);
    arana.trasladar(p.x - arana.x, p.y - arana.y); arana.escalar(baseS * p.e);
    zcAhora = p.z;
  }
  // 2) guion y 3) cinemática
  avanzarGuion(dt);
  arana.avanzar(dt);
  // 4) si camina, su posición del mundo sale de dónde quedó en pantalla (la profundidad se va acercando a la del destino)
  if (viaje && viaje.tipo === 'andar') {
    const B = nube.posSkill(viaje.id), pb = nube.proyectar(B.x, B.y, B.z);
    const d1 = Math.hypot(pb.x - arana.x, pb.y - arana.y);
    const zc = viaje.d0 > 1 ? pb.z + (zcAhora - pb.z) * Math.min(1, d1 / viaje.d0) : pb.z;
    W = nube.desproyectar(arana.x, arana.y, zc);
    if (d1 < arana.s * 1.05) { W = { x: B.x, y: B.y, z: B.z }; llegar(); }
  }
  // 5) la cámara la sigue mientras está encuadrada
  if (nube.cam.enfocada) nube.seguir(W);
  if (reloj.rapido) { for (const e of etiquetas.values()) { e.alfa = 1; if (e.caja && e.caja.mx != null) { e.caja.ox = e.caja.mx; e.caja.oy = e.caja.my; } } hilosSalto.length = 0; costura = null;
    for (let i = vuelos.length - 1; i >= 0; i--) { const v = vuelos[i]; v.k += dt / v.dur; if (v.k >= 1) { vuelos.splice(i, 1); if (v.alLlegar) v.alLlegar(); } } return; }

  // a su paso los puntos cercanos se iluminan
  nube.calentar(arana.x, arana.y, arana.span * (modo === 'pasear' ? 0.55 : 0.42), modo === 'pasear' && pausa > 0 ? 0.55 : 0.7);
  for (const [id, e] of etiquetas) {
    if (e.sale) { e.alfa -= dt / 0.25; if (e.alfa <= 0) { etiquetas.delete(id); layoutEtiquetas(); } }
    else e.alfa = Math.min(1, e.alfa + dt / 0.2);
    if (e.caja && e.caja.mx != null) { e.caja.ox += (e.caja.mx - e.caja.ox) * Math.min(1, dt * 6); e.caja.oy += (e.caja.my - e.caja.oy) * Math.min(1, dt * 6); }
  }
  if (etiquetas.size && reloj.t - ultimoLayout > (nube.cam.k < 1 ? 140 : 450)) layoutEtiquetas();      // más seguido mientras la cámara se mueve
  if (lectura) lectura.alfa = Math.min(1, lectura.alfa + dt / 0.25);
  for (let i = vuelos.length - 1; i >= 0; i--) {
    const v = vuelos[i]; v.k += dt / v.dur;
    if (v.k >= 1) { vuelos.splice(i, 1); if (v.alLlegar) v.alLlegar(); }
  }
  for (let i = pulsos.length - 1; i >= 0; i--) { pulsos[i].k += dt / 0.75; if (pulsos[i].k >= 1.25) pulsos.splice(i, 1); }
  for (const [id, a] of hilosUsadas) if (a > 0.3) hilosUsadas.set(id, Math.max(0.3, a - dt * 0.5));
  for (let i = hilosSalto.length - 1; i >= 0; i--) { hilosSalto[i].edad += dt; if (hilosSalto[i].edad > 4.5) hilosSalto.splice(i, 1); }
  if (costura) {
    if (!costura.llego) { costura.k = Math.min(1, costura.k + dt / 0.45); if (costura.k >= 1) { costura.llego = true; emitir('cosido'); } }
    else { costura.edad += dt; if (costura.edad > 1.3) costura = null; }
  }
}

// ---------- etiquetas recuadradas ----------
const medirTexto = (txt) => txt.length * tamTexto * 0.6;
const pisa = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w > b.x - m && a.y < b.y + b.h + m && a.y + a.h > b.y - m;

/**
 * Busca el mejor sitio para una etiqueta alrededor de su punto (en pantalla): prueba 12 direcciones × 4
 * distancias y se queda con la que menos estorba. Choques duros: salirse de la zona, otra etiqueta, el punto
 * de otra skill marcada. Blandos: rótulos de cúmulos, la araña, el centro del propio cúmulo.
 */
function colocarCaja(p, w, h, puestas, marcas, conArana, pesoArana = 22) {
  const c = p.c;
  let fx = p.x - c.sx, fy = p.y - c.sy; const fd = Math.hypot(fx, fy);
  if (fd < 4) { fx = 0.7; fy = -0.7; } else { fx /= fd; fy /= fd; }
  let mejor = null;
  for (const d of [20, 36, 54, 76]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU, dx = Math.cos(ang), dy = Math.sin(ang);
      const caja = { x: p.x + dx * (d + w / 2) - w / 2, y: p.y + dy * (d + h / 2) - h / 2, w, h };
      let costo = d * 0.75 - (dx * fx + dy * fy) * 9 + Math.abs(dy) * 5;
      if (caja.x < rect.x + 2 || caja.x + w > rect.x + rect.w - 2 || caja.y < rect.y + 2 || caja.y + h > rect.y + rect.h - 2) costo += 2000;
      for (const q of puestas) if (pisa(caja, q, 4)) costo += 900;
      for (const q of marcas) if (pisa(caja, q, 2)) costo += 400;
      for (const q of nube.rotulos) if (pisa(caja, q.rect, 2)) costo += 70;
      if (conArana && pisa(caja, conArana, 0)) costo += pesoArana;
      if (Math.hypot(caja.x + w / 2 - c.sx, caja.y + h / 2 - c.sy) < c.r * c.se * 0.45) costo += 14;
      if (!mejor || costo < mejor.costo) mejor = { caja, costo };
    }
  }
  return { ox: mejor.caja.x - p.x, oy: mejor.caja.y - p.y, w, h };
}
let cajasVivas = [];     // rectángulos de las etiquetas visibles
function layoutEtiquetas() {
  ultimoLayout = reloj.t;
  if (!nube.rect || mini) return;
  const puestas = [], alto = Math.round(tamTexto * 1.7);
  const lista = [...etiquetas.values()].filter((e) => !e.sale).map((e) => ({ e, p: nube.pantallaSkill(e.id) })).filter((x) => x.p);
  const marcas = [...new Set([...etiquetas.keys(), ...estado.sugeridas.map((x) => x.id)])].map((id) => nube.pantallaSkill(id)).filter(Boolean).map((q) => ({ x: q.x - 6, y: q.y - 6, w: 12, h: 12, i: q.i }));
  const huella = { x: arana.x - arana.span * 0.4, y: arana.y - arana.span * 0.4, w: arana.span * 0.8, h: arana.span * 0.8 };
  for (const { e, p } of lista) {
    const texto = nombreSkill(e.id) + (e.estilo === 'apagada' ? ' · apagada' : '');
    const w = Math.round(medirTexto(texto) + 14);
    // la que ya tenía sitio lo conserva si sigue libre y dentro de la zona (para que no brinque)
    let caja = e.caja && e.caja.w === w ? e.caja : null;
    if (caja) {
      const r = { x: p.x + caja.mx, y: p.y + caja.my, w, h: alto };
      if (puestas.some((q) => pisa(r, q, 4)) || r.x < rect.x || r.x + w > rect.x + rect.w || r.y < rect.y || r.y + alto > rect.y + rect.h) caja = null;
    }
    if (!caja) {
      const nueva = colocarCaja(p, w, alto, puestas, marcas.filter((m) => m.i !== p.i), huella);
      caja = e.caja ? { ...e.caja, w, h: alto, mx: nueva.ox, my: nueva.oy } : { ...nueva, mx: nueva.ox, my: nueva.oy };
    }
    caja.texto = texto; e.caja = caja;
    puestas.push({ x: p.x + caja.mx, y: p.y + caja.my, w, h: alto });
  }
  const tapados = new Set();
  for (const r of nube.rotulos) if (puestas.some((q) => pisa(q, r.rect, 1))) tapados.add(r.c.nombre);
  nube.atenuar(tapados);
  cajasVivas = puestas;
}
function dibujarEtiqueta(ctx, px, py, caja, estilo, alfa, tono) {
  const x = Math.round(px + caja.ox) + 0.5, y = Math.round(py + caja.oy) + 0.5, w = caja.w, h = caja.h;
  const color = estilo === 'apagada' ? COLOR.ambar : estilo === 'lectura' ? COLOR.tinta2 : tono.hex;
  const k = sale(alfa);
  ctx.globalAlpha = limitar(alfa, 0, 1);
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(limitar(px, x, x + w), limitar(py, y, y + h)); ctx.stroke();
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.95 + 0.05 * k, 0.95 + 0.05 * k); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = estilo === 'usada' ? color : COLOR.fondo;
  ctx.fillRect(0, 0, w, h);
  if (estilo !== 'usada') { ctx.strokeStyle = estilo === 'lectura' ? COLOR.linea2 : color; ctx.strokeRect(0, 0, w, h); }
  ctx.font = fuente(tamTexto, estilo === 'usada' ? 500 : 400);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = estilo === 'usada' ? COLOR.fondo : color;
  ctx.fillText(caja.texto, 7, h / 2 + 0.5);
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.strokeRect(Math.round(px) - 3.5, Math.round(py) - 3.5, 7, 7);
  ctx.globalAlpha = 1;
}

/** Punto del arco de un paquete en vuelo (curva cuadrática de `a` a `b`). */
function puntoArco(a, b, k) {
  const e = entraSale(k), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(b.x - a.x, b.y - a.y);
  // el arco se levanta (o se abre de lado si el tiro es casi vertical)
  const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
  const cx = horizontal ? mx : mx - d * 0.24, cy = horizontal ? my - d * 0.3 : my, u = 1 - e;
  return { x: u * u * a.x + 2 * u * e * cx + e * e * b.x, y: u * u * a.y + 2 * u * e * cy + e * e * b.y };
}

export function iniciar() {
  alCambiar(reacomodar);
  pintarMeta();

  // Capa 10: la nube. Capa 30: hilos, araña, etiquetas y paquetes.
  capa(10, (ctx) => { if (nube.cumulos.length && rect.w > 40) nube.dibujar(ctx, lienzo.dpr); });
  capa(30, (ctx) => {
    if (!nube.cumulos.length || rect.w <= 40 || !colocada) return;
    ctx.lineWidth = 1;
    const cara = lugarCara();
    // hilos de skills usadas: de la cara al punto de la skill, con un pulso del tono del cúmulo
    for (const [id, a] of hilosUsadas) {
      const p = nube.pantallaSkill(id); if (!p) continue;
      const tono = tonoSkill(id);
      const px = limitar(p.x, rect.x, rect.x + rect.w), py = limitar(p.y, rect.y, rect.y + rect.h);
      const dx = px - cara.x, dy = py - cara.y, d = Math.hypot(dx, dy) || 1;
      const x0 = cara.x + (dx / d) * cara.r, y0 = cara.y + (dy / d) * cara.r;
      ctx.strokeStyle = rgbaT(tono, a * 0.55);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(px, py); ctx.stroke();
      for (const q of pulsos) {
        if (q.id !== id) continue;
        ctx.globalCompositeOperation = 'lighter';
        for (let n = 0; n < 6; n++) {
          const kk = q.k - n * 0.035; if (kk <= 0 || kk > 1) continue;
          const k = entraSale(kk);
          ctx.fillStyle = rgbaT(tono, 1 - n * 0.15);
          const r = n === 0 ? 3 : 2.4 - n * 0.3;
          ctx.beginPath(); ctx.arc(x0 + (px - x0) * k, y0 + (py - y0) * k, r, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    // hilos que dejó al saltar: se cuelgan un poco y se desvanecen
    for (const h of hilosSalto) {
      const a = nube.proyectar(h.A.x, h.A.y, h.A.z), b = nube.proyectar(h.B.x, h.B.y, h.B.z);
      const alfa = 0.6 * (1 - h.edad / 4.5), cuelga = Math.min(1, h.edad * 2) * Math.hypot(b.x - a.x, b.y - a.y) * 0.07;
      ctx.strokeStyle = rgba('cian', alfa);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + cuelga, b.x, b.y); ctx.stroke();
      ctx.fillStyle = rgba('cian', alfa); ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    }
    if (viaje && viaje.tipo === 'salto' && viaje.prep <= 0) {
      const a = nube.proyectar(viaje.A.x, viaje.A.y, viaje.A.z);
      ctx.strokeStyle = rgba('cian', 0.75);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(arana.x, arana.y); ctx.stroke();
      ctx.fillStyle = COLOR.cian; ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    }
    arana.dibujar(ctx, COLOR.cian, 1);
    // etiquetas: encima de la araña (la información manda)
    if (!mini) {
      if (lectura && modo === 'pasear' && !viaje && !etiquetas.has(lectura.id)) {
        const p = nube.pantallaSkill(lectura.id);
        if (p) {
          if (!lectura.caja) {
            const texto = nombreSkill(lectura.id), w = Math.round(medirTexto(texto) + 14), alto = Math.round(tamTexto * 1.7);
            const huella = { x: arana.x - arana.span * 0.45, y: arana.y - arana.span * 0.45, w: arana.span * 0.9, h: arana.span * 0.9 };
            lectura.caja = colocarCaja(p, w, alto, cajasVivas, [], huella, 300);      // la araña se queda ahí: la etiqueta va a un lado
            lectura.caja.texto = texto;
          }
          dibujarEtiqueta(ctx, p.x, p.y, lectura.caja, 'lectura', lectura.alfa * (pausa > 0 ? 1 : 0.5), TONO_CIAN);
        }
      }
      for (const e of etiquetas.values()) {
        const p = nube.pantallaSkill(e.id);
        // con la cámara cerca, la skill puede quedar fuera de la zona: su etiqueta no se dibuja a medias
        if (p && e.caja && p.x > rect.x + 4 && p.x < rect.x + rect.w - 4 && p.y > rect.y + 4 && p.y < rect.y + rect.h - 4) dibujarEtiqueta(ctx, p.x, p.y, e.caja, e.estilo, e.alfa, e.tono);
      }
    }
    ctx.restore();

    // hilo al Flujo (fin de turno): sale de la araña, llega a la historia y se desvanece
    if (costura && lugares.flujoHistoria) {
      const a = alFrente(), b = lugares.flujoHistoria(), k = entraSale(costura.k);
      const alfa = costura.llego ? Math.max(0, 1 - costura.edad / 1.3) : 1;
      ctx.strokeStyle = rgba('cian', 0.8 * alfa);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke();
      ctx.fillStyle = rgba('cian', alfa);
      ctx.fillRect(a.x + (b.x - a.x) * k - 2, a.y + (b.y - a.y) * k - 2, 4, 4);
    }
    // paquetes en el aire: cuadrito del tono de su cúmulo con estela de puntos
    for (const v of vuelos) {
      if (v.k <= 0) continue;
      const a = v.desde, b = v.hasta();
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 10; n >= 1; n--) {
        const kk = v.k - n * 0.022; if (kk <= 0) continue;
        const q = puntoArco(a, b, kk);
        ctx.fillStyle = rgbaT(v.tono, 0.75 - n * 0.07);
        ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      const q = puntoArco(a, b, v.k), t = mini ? 6 : 9;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(v.k * 5);
      ctx.fillStyle = v.tono.hex; ctx.fillRect(-t / 2, -t / 2, t, t);
      ctx.restore();
    }
  });
}

/** Tras avanzar en seco (?t=): las etiquetas se acomodan con la cámara donde quedó. */
export function asentar() { if (!colocada) return; nube.proyectarTodo(reloj.t); nube.sucio = true; for (const e of etiquetas.values()) e.caja = null; layoutEtiquetas(); for (const e of etiquetas.values()) if (e.caja) { e.caja.ox = e.caja.mx; e.caja.oy = e.caja.my; } }

/** Para depurar desde la consola: estado del guion de la araña. */
export function depurar() { return { modo, pausa, viaje: viaje ? viaje.tipo : null, cola: cola.length, lomo: lomo.length, vuelos: vuelos.length, tareas: tareas.map((x) => x.tipo), x: Math.round(arana.x), y: Math.round(arana.y), s: +arana.s.toFixed(1), zoom: +nube.cam.zoom.toFixed(2), paso: nube.paso, medida: nube.medida }; }
