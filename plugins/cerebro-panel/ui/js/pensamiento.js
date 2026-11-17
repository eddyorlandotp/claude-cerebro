// pensamiento.js — la zona central: decide el estado de la cara a partir de los eventos, escribe el
// pie ("leyendo  src/detector.ts" con su monito), las fichas de skills sugeridas (del tono de su
// cúmulo) y las burbujas. Alrededor de la cara gira la órbita (orbita.js) con las skills cargadas,
// los archivos del turno y los subagentes.
//
// Vida en reposo: la cara echa vistazos a la araña o a un satélite; bosteza antes de dormirse;
// dormida respira, y cada 3–6 min despierta un momento, suelta una frase (frases.js) y se vuelve
// a dormir. Con ?reposo=1 esos tiempos van 20 veces más rápido (para probar).

import { estado, en, emitir, nombreSkill, lugares } from './estado.js';
import { reloj, despues } from './reloj.js';
import { dist, alCambiar } from './distribucion.js';
import { capa, lienzo } from './lienzo.js';
import { Cara } from './cara.js';
import * as burbujas from './burbujas.js';
import * as orbita from './orbita.js';
import { MONITO } from './iconos.js';
import { tonoSkill } from './tonos.js';
import { frase } from './frases.js';
import { el, primeraOracion, truncar, truncarMedio, limitar, rgba, TAU } from './util.js';

export const cara = new Cara({ semilla: 3 });
lugares.cara = () => ({ x: cara.x, y: cara.y, r: cara.d / 2 + cara.d * 0.075 + 6 });

const zona = document.querySelector('#z-pensamiento .zona-int');
const pieEstado = document.getElementById('pie-estado');
const pieVerbo = document.getElementById('pie-verbo');
const pieObjeto = document.getElementById('pie-objeto');
const pieVacio = document.getElementById('pie-vacio');
const monito = document.getElementById('monito');
const fichas = document.getElementById('fichas');
const meta = document.getElementById('pen-meta');
const panel = document.getElementById('panel');

const RAPIDO = new URLSearchParams(location.search).has('reposo') ? 20 : 1;     // ?reposo=1 acelera el reposo
const INACTIVA = 120000 / RAPIDO;                                               // sin eventos este rato → se duerme
const siesta = () => (180000 + Math.random() * 180000) / RAPIDO;                // dormida, despierta cada 3–6 min

// ----- lo que sabe la zona -----
const activas = new Map();      // herramientas en curso del hilo principal: id -> evento de inicio
const luces = [];               // anillos de luz cuando la cara recibe algo de un subagente
let espera = null;              // motivo de espera o null
let tropiezoHasta = 0, hablandoHasta = 0, pensandoHasta = 0;
let estadoActual = '', ultimoFallo = '';
let sueno = 'no';               // 'no' | 'bostezo' | 'dormida' | 'despierta'
let suenoHasta = 0, despertarEn = 0;
let proximoVistazo = 4000;
let puntos = null;              // burbuja "· · ·" cuando piensa sin texto

const VERBO = {
  dormida: 'dormida', bostezo: 'con sueño', despierta: 'despierta', atenta: 'lista', pensando: 'pensando', leyendo: 'leyendo',
  escribiendo: 'escribiendo', ejecutando: 'ejecutando', delegando: 'delegando', hablando: 'respondiendo', esperando: 'esperándote', tropezo: 'tropezó',
};
const POR_CLASE = {
  leer: ['leyendo', 'leyendo', 'leer'], buscar: ['leyendo', 'buscando', 'buscar'], web: ['leyendo', 'consultando', 'web'],
  editar: ['escribiendo', 'escribiendo', 'editar'], comando: ['ejecutando', 'ejecutando', 'comando'],
  agente: ['delegando', 'delegando', 'agente'], skill: ['leyendo', 'cargando skill', 'skill'], mcp: ['ejecutando', 'llamando', 'comando'],
  tarea: ['escribiendo', 'anotando tareas', 'tarea'], pregunta: ['esperando', 'preguntándote', 'esperando'], otro: ['ejecutando', 'trabajando', 'otro'],
};

/** Geometría: la cara crece con su zona; la órbita ocupa los lados; el pie queda debajo de la órbita. */
function geometria() {
  const r = dist.rects.pensamiento;
  const esc = limitar(Math.min(r.w / 780, r.h / 720), 1, 1.8);
  const d = Math.round(limitar(Math.min(r.h * 0.2, r.w * 0.28), 64, 270));
  const cx = r.w / 2, cy = Math.round(r.h * 0.5);
  cara.x = r.x + cx; cara.y = r.y + cy; cara.d = d;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  orbita.geometria(cara.x, cara.y, d, { x: r.x, y: r.y, w: r.w, h: r.h }, Math.round(base * 0.84 * (0.5 + 0.5 * esc)));
  zona.style.setProperty('--cara-x', cx + 'px');
  zona.style.setProperty('--cara-y', cy + 'px');
  zona.style.setProperty('--cara-d', d + 'px');
  zona.style.setProperty('--orbita', Math.round(orbita.fondo()) + 'px');
  zona.style.setProperty('--esc', esc.toFixed(3));
  burbujas.escalar(esc);
}

/** Recalcula en qué estado debe estar la cara. Se llama tras cada evento y cuando vence un plazo. */
function recalcular() {
  const t = reloj.t;
  let e, verbo, objeto = '', icono = null, tono = '';
  const ultima = [...activas.values()].pop();
  const sub = orbita.subActivo();
  const inactiva = !estado.enTurno && espera !== 'permiso' && t - estado.ultimoEvento > INACTIVA;
  if (!estado.sesion || espera === 'inactivo' || (inactiva && !ultima)) { e = 'dormida'; }
  else if (t < tropiezoHasta) { e = 'tropezo'; icono = 'tropezo'; tono = 'rosa'; objeto = ultimoFallo; }
  else if (espera) {
    e = 'esperando'; icono = 'esperando'; tono = 'ambar';
    objeto = espera === 'permiso' ? 'necesito tu permiso' : 'te toca responder';
  }
  else if (ultima) {
    const [est, v, ic] = POR_CLASE[ultima.clase] || POR_CLASE.otro;
    e = est; verbo = v; icono = ic; objeto = ultima.clase === 'skill' ? nombreSkill(ultima.resumen) : ultima.resumen || ultima.nombre;
  }
  else if (t < hablandoHasta) { e = 'hablando'; icono = 'hablando'; }
  else if (sub && estado.enTurno && t >= pensandoHasta) { e = 'delegando'; icono = 'agente'; objeto = sub.nombre; }
  else if (estado.enTurno) { e = 'pensando'; icono = 'pensando'; }
  else { e = 'atenta'; }
  if (e === 'delegando') cara.mirada = sub;

  // el sueño tiene sus propias fases: bosteza, duerme, y a ratos despierta un momento
  if (e === 'dormida') {
    if (sueno === 'no') {
      burbujas.quitarTipo('toca');      // dormida nunca queda nada en ámbar
      if (cara.estado === 'dormida' || reloj.rapido) { sueno = 'dormida'; despertarEn = t + siesta(); }
      else { sueno = 'bostezo'; suenoHasta = t + 1600; }
    }
    if (sueno === 'bostezo' && t >= suenoHasta) { sueno = 'dormida'; despertarEn = t + siesta(); }
    if (sueno === 'dormida' && t >= despertarEn && !reloj.rapido && !reloj.quieto) {
      // despierta un momento, mira al frente y suelta una frase (nunca en ámbar)
      sueno = 'despierta'; suenoHasta = t + 4200 * (RAPIDO > 1 ? 0.8 : 1);
      burbujas.limpiar();
      burbujas.agregar('frase', frase(estado.sesion ? 'reposo' : 'sinSesion'));
    }
    if (sueno === 'despierta' && t >= suenoHasta) { sueno = 'bostezo'; suenoHasta = t + 1600; burbujas.quitarTipo('frase'); }
    e = sueno;
    tono = 'apagado';
  } else if (sueno !== 'no') { sueno = 'no'; burbujas.quitarTipo('frase'); }

  cara.poner(e);
  if (e !== 'pensando' && puntos) quitarPuntos();
  const clave = e + '|' + (verbo || '') + '|' + objeto + '|' + icono;
  if (clave === estadoActual) return;
  estadoActual = clave;
  const sinSesion = !estado.sesion;
  pieVacio.hidden = !sinSesion;
  pieEstado.hidden = sinSesion;
  pieEstado.dataset.tono = tono;
  pieVerbo.textContent = verbo || VERBO[e];
  pieObjeto.textContent = objeto ? truncarMedio(objeto, 56) : '';
  monito.innerHTML = icono ? MONITO[icono] || '' : '';
  meta.textContent = sinSesion ? '' : estado.enTurno ? 'turno ' + estado.turno : estado.turno ? 'turno ' + estado.turno + ' terminado' : 'esperando tu primer mensaje';
  emitir('cara', { estado: e, verbo: verbo || VERBO[e] });
}
function quitarPuntos() { burbujas.quitarTipo('puntos'); puntos = null; }

// ----- fichas de skills sugeridas (aparecen cuando la araña entrega cada paquete) -----
function pintarFichas() {
  fichas.textContent = '';
  const entregadas = estado.sugeridas.filter((s) => s.entregada && !s.devuelta);
  if (!entregadas.length) return;
  fichas.append(el('span', 'fichas-rotulo', 'skills que trajo la araña'));
  for (const s of entregadas) {
    const f = el('span', 'ficha' + (estado.usadas.has(s.id) ? ' usada' : '') + (s.apagada ? ' apagada' : ''), nombreSkill(s.id));
    f.dataset.id = s.id;
    if (!s.apagada) f.style.setProperty('--tono', tonoSkill(s.id).hex);      // el tono del cúmulo viaja con la skill
    if (s.vista) f.style.animation = 'none';
    s.vista = true;
    fichas.append(f);
  }
}

// ----- eventos -----
en('reinicio', () => {
  activas.clear(); espera = null; tropiezoHasta = hablandoHasta = pensandoHasta = 0; estadoActual = ''; luces.length = 0; puntos = null;
  burbujas.limpiar(true); fichas.textContent = '';
  cara.contexto = estado.uso ? estado.uso.contexto / (estado.uso.ventana || 200000) : 0;
  recalcular();
});
en('sesion', () => { if (espera === 'inactivo') espera = null; recalcular(); });
en('prompt', (ev) => {
  if (ev.enCola) { cara.parpadear(0.1); return; }
  activas.clear(); espera = null; hablandoHasta = 0; tropiezoHasta = 0; pensandoHasta = 0; puntos = null;
  burbujas.limpiar(); fichas.textContent = '';
  cara.poner('atenta'); cara.parpadear(0.1);
  recalcular();
});
en('paquete', ({ id }) => {
  const s = estado.sugeridas.find((x) => x.id === id);
  if (s) s.entregada = true;
  cara.recibir(s && !s.apagada ? tonoSkill(id).hex : 'cian');
  pintarFichas();
});
// fin de turno: la araña recoge las sugerencias que no se usaron
en('devuelta', ({ id }) => {
  const s = estado.sugeridas.find((x) => x.id === id);
  if (s) s.devuelta = true;
  const f = [...fichas.children].find((x) => x.dataset && x.dataset.id === id);
  if (f && !reloj.rapido) { f.classList.add('devuelta'); setTimeout(pintarFichas, 220); } else pintarFichas();
});
en('skill_usada', (ev) => {
  // puede usar una skill que la araña no sugirió: igual se muestra
  if (!estado.sugeridas.some((s) => s.id === ev.id)) estado.sugeridas.push({ id: ev.id, puntaje: 0, entregada: true });
  pintarFichas();
});
en('pensamiento', (ev) => {
  if (ev.agente) return;
  espera = null;
  burbujas.quitarTipo('toca');
  const texto = primeraOracion(ev.texto, 92);
  if (texto) { quitarPuntos(); burbujas.agregar('pensamiento', texto); }
  // casi siempre llega vacío: piensa con una nubecita de puntos en vez de dejar el centro mudo
  else if (!puntos) puntos = burbujas.agregar('puntos', '· · ·');
  pensandoHasta = reloj.t + 2500;
  recalcular();
});
en('dicho', (ev) => {
  if (ev.agente) return;
  espera = null;
  burbujas.quitarTipo('toca');
  const texto = String(ev.texto || '').trim();
  if (!texto) return;
  quitarPuntos();
  burbujas.agregar('dicho', truncar(texto, 170));
  hablandoHasta = reloj.t + limitar(texto.length * 45, 1800, 5000);
  despues(hablandoHasta - reloj.t + 10, recalcular);
  recalcular();
});
en('herramienta', (ev) => {
  if (ev.agente) return;
  if (ev.fase === 'inicio') { espera = null; burbujas.quitarTipo('toca'); activas.set(ev.id, ev); }
  else {
    const ini = activas.get(ev.id);
    activas.delete(ev.id);
    if (espera === 'permiso' || espera === 'inactivo') { espera = null; burbujas.quitarTipo('toca'); }
    if (ev.ok === false) {
      ultimoFallo = truncarMedio(ini?.resumen || ev.resumen || 'falló una herramienta', 48);
      tropiezoHasta = reloj.t + 1300;
      despues(1310, recalcular);
    }
  }
  recalcular();
});
en('subagente', () => recalcular());
// el subagente que termina viaja a la cara y le entrega un punto de luz
en('sub-entrega', () => { cara.recibir('cian'); luces.push({ k: 0 }); recalcular(); });
en('espera', (ev) => {
  espera = ev.motivo || 'respuesta';
  burbujas.quitarTipo('toca');
  if (espera !== 'inactivo') burbujas.agregar('toca', espera === 'permiso' ? 'Te toca: necesito tu permiso para seguir.' : 'Te toca.');
  recalcular();
});
en('fin_turno', () => {
  // Los subagentes no se recogen aquí: los que corren en segundo plano siguen después del turno
  // y el servidor manda su propio `subagente` fin cuando de verdad terminan.
  activas.clear();
  recalcular();
});
en('uso', (ev) => { cara.contexto = ev.ventana ? ev.contexto / ev.ventana : 0; });
en('compactacion', () => { cara.recibir('cian'); });

export function iniciar() {
  alCambiar(() => { geometria(); burbujas.redibujar(); });
  geometria();
  recalcular();
  // la órbita tiene profundidad: su mitad de atrás va antes que la cara y la de adelante, después
  capa(58, (ctx) => orbita.dibujarAtras(ctx));
  capa(60, (ctx) => {
    for (const l of luces) {
      ctx.strokeStyle = rgba('cian', 0.8 * (1 - l.k)); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cara.x, cara.y, cara.d / 2 + cara.d * 0.075 + l.k * 26, 0, TAU); ctx.stroke();
    }
    cara.dibujar(ctx);
  });
  capa(62, (ctx) => orbita.dibujarFrente(ctx));
}

let ultimaRevision = 0, dormidaPuesta = false;
export function avanzar(dt) {
  cara.avanzar(dt);
  orbita.avanzar(dt);
  // brillo general: dormida baja a 60 % (despierta un momento = vuelve la luz)
  const metaBrillo = cara.estado === 'dormida' ? 0.6 : cara.estado === 'bostezo' ? 0.8 : 1;
  lienzo.brillo += (metaBrillo - lienzo.brillo) * Math.min(1, dt * 2.5);
  if (dormidaPuesta !== (metaBrillo < 0.7)) { dormidaPuesta = metaBrillo < 0.7; panel.classList.toggle('dormida', dormidaPuesta); }
  // plazos que vencen sin evento (hablando, pensando → delegando, inactividad, sueño)
  if (reloj.t - ultimaRevision > 250) { ultimaRevision = reloj.t; recalcular(); }
  // vistazos: de vez en cuando mira a la araña que pasa o a un satélite
  if (reloj.t > proximoVistazo && !reloj.rapido) {
    proximoVistazo = reloj.t + (5000 + Math.random() * 5000) / (RAPIDO > 1 ? 3 : 1);
    if (cara.estado === 'atenta' || cara.estado === 'pensando') {
      const p = (Math.random() < 0.5 && orbita.alguno()) || (lugares.aranaBib && lugares.aranaBib());
      if (p) cara.vistazo = { x: p.x, y: p.y, hasta: reloj.t + 1100 + Math.random() * 700 };
    }
  }
  for (let i = luces.length - 1; i >= 0; i--) { luces[i].k += dt / 0.5; if (luces[i].k >= 1) luces.splice(i, 1); }
}
/** Tras avanzar en seco (?t=), recolocar lo que depende del DOM. */
export function asentar() { pintarFichas(); burbujas.redibujar(); estadoActual = ''; recalcular(); }
