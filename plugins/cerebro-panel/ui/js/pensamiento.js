// pensamiento.js — la zona central: decide el estado de la cara a partir de los eventos,
// escribe el pie ("leyendo  src/detector.ts" con su monito), las fichas de skills sugeridas,
// las burbujas y las caritas de subagentes.

import { estado, en, emitir, nombreSkill } from './estado.js';
import { reloj, despues } from './reloj.js';
import { dist, alCambiar } from './distribucion.js';
import { capa, lienzo } from './lienzo.js';
import { Cara } from './cara.js';
import * as burbujas from './burbujas.js';
import { MONITO } from './iconos.js';
import { el, primeraOracion, truncar, truncarMedio, entraSale, limitar, COLOR, rgba, TAU } from './util.js';

export const cara = new Cara({ semilla: 3 });
const zona = document.querySelector('#z-pensamiento .zona-int');
const pieEstado = document.getElementById('pie-estado');
const pieVerbo = document.getElementById('pie-verbo');
const pieObjeto = document.getElementById('pie-objeto');
const pieVacio = document.getElementById('pie-vacio');
const monito = document.getElementById('monito');
const fichas = document.getElementById('fichas');
const cajaSub = document.getElementById('subagentes');
const meta = document.getElementById('pen-meta');

// ----- lo que sabe la zona -----
const activas = new Map();      // herramientas en curso del hilo principal: id -> evento de inicio
const subs = new Map();         // subagentes: id -> { cara, etq, x, y, fase, ... }
const luces = [];               // puntos de luz que un subagente entrega a la cara
let espera = null;              // motivo de espera o null
let tropiezoHasta = 0, hablandoHasta = 0, pensandoHasta = 0;
let estadoActual = '';

const VERBO = {
  dormida: 'dormida', atenta: 'lista', pensando: 'pensando', leyendo: 'leyendo', escribiendo: 'escribiendo',
  ejecutando: 'ejecutando', delegando: 'delegando', hablando: 'respondiendo', esperando: 'esperándote', tropezo: 'tropezó',
};
const POR_CLASE = {
  leer: ['leyendo', 'leyendo', 'leer'], buscar: ['leyendo', 'buscando', 'buscar'], web: ['leyendo', 'consultando', 'web'],
  editar: ['escribiendo', 'escribiendo', 'editar'], comando: ['ejecutando', 'ejecutando', 'comando'],
  agente: ['delegando', 'delegando', 'agente'], skill: ['leyendo', 'cargando skill', 'skill'], mcp: ['ejecutando', 'llamando', 'comando'],
  tarea: ['escribiendo', 'anotando tareas', 'tarea'], pregunta: ['esperando', 'preguntándote', 'esperando'], otro: ['ejecutando', 'trabajando', 'otro'],
};

/** Geometría de la cara dentro de la zona: diámetro ≈ 18 % del alto, un poco por debajo del centro. */
function geometria() {
  const r = dist.rects.pensamiento;
  // escala del centro: 1 en una zona de ~780×720; crece con la zona (lo que más se lee de lejos es el pensamiento)
  const esc = limitar(Math.min(r.w / 780, r.h / 720), 1, 1.8);
  const d = Math.round(limitar(Math.min(r.h * 0.21, r.w * 0.3), 64, 280));
  const cx = r.w / 2, cy = Math.round(r.h * 0.56);
  zona.style.setProperty('--esc', esc.toFixed(3));
  burbujas.escalar(esc);
  cara.x = r.x + cx; cara.y = r.y + cy; cara.d = d;
  zona.style.setProperty('--cara-x', cx + 'px');
  zona.style.setProperty('--cara-y', cy + 'px');
  zona.style.setProperty('--cara-d', d + 'px');
  colocarSubs(true);
}

/** Recalcula en qué estado debe estar la cara. Se llama tras cada evento y cuando vence un plazo. */
function recalcular() {
  const t = reloj.t;
  let e, verbo, objeto = '', icono = null, tono = '';
  const ultima = [...activas.values()].pop();
  if (!estado.sesion || espera === 'inactivo') { e = 'dormida'; }
  else if (t < tropiezoHasta) { e = 'tropezo'; icono = 'tropezo'; tono = 'rosa'; objeto = ultimoFallo; }
  else if (espera) {
    e = 'esperando'; icono = 'esperando'; tono = 'ambar';
    objeto = espera === 'permiso' ? 'necesito tu permiso' : espera === 'respuesta' ? 'te toca responder' : 'sin actividad';
  }
  else if (ultima) {
    const [est, v, ic] = POR_CLASE[ultima.clase] || POR_CLASE.otro;
    e = est; verbo = v; icono = ic; objeto = ultima.clase === 'skill' ? nombreSkill(ultima.resumen) : ultima.resumen || ultima.nombre;
  }
  else if (t < hablandoHasta) { e = 'hablando'; icono = 'hablando'; }
  else if ([...subs.values()].some((s) => s.fase === 'vivo') && estado.enTurno && t >= pensandoHasta) {
    e = 'delegando'; icono = 'agente';
    const s = [...subs.values()].filter((x) => x.fase === 'vivo').pop();
    objeto = s.tipo; cara.mirada = s;
  }
  else if (estado.enTurno) { e = 'pensando'; icono = 'pensando'; }
  else if (t - estado.ultimoEvento > 120000) { e = 'dormida'; }
  else { e = 'atenta'; }

  if (e === 'delegando' && ultima) { const s = [...subs.values()].filter((x) => x.fase === 'vivo').pop(); if (s) cara.mirada = s; }
  cara.poner(e);
  if (e === 'dormida') tono = 'apagado';
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
  emitir('cara', { estado: e, verbo: verbo || VERBO[e], tono: tono || (e === 'atenta' ? '' : '') });
}
let ultimoFallo = '';

// ----- fichas de skills sugeridas (aparecen cuando la araña entrega cada paquete) -----
function pintarFichas() {
  fichas.textContent = '';
  const entregadas = estado.sugeridas.filter((s) => s.entregada);
  if (!entregadas.length) return;
  fichas.append(el('span', 'fichas-rotulo', 'skills que trajo la araña'));
  for (const s of entregadas) {
    const f = el('span', 'ficha' + (estado.usadas.has(s.id) ? ' usada' : '') + (s.apagada ? ' apagada' : ''), nombreSkill(s.id));
    f.dataset.id = s.id;
    if (s.vista) f.style.animation = 'none';
    s.vista = true;
    fichas.append(f);
  }
  colocarSubs();
}

// ----- subagentes -----
// Cada subagente tiene un renglón en el pie (DOM) con un hueco; la carita se dibuja en el
// lienzo sobre ese hueco. Nace en la cara principal y viaja a su sitio.
function colocarSubs(yaMismo = false) {
  for (const s of subs.values()) {
    if (s.fase !== 'vivo') continue;
    const r = s.hueco.getBoundingClientRect();
    if (!r.width) continue;
    s.mx = r.left + r.width / 2; s.my = r.top + r.height / 2; s.cara.d = r.width;
    if (yaMismo) { s.x = s.mx; s.y = s.my; }
  }
}
function etiquetaSub(s) {
  s.txt.textContent = '';
  const linea = el('span'); linea.append(el('b', '', s.tipo), document.createTextNode(' · ' + s.descripcion));
  s.txt.append(linea, el('span', 'nota', s.nota || 'empezando…'));
}

// ----- eventos -----
en('reinicio', () => {
  activas.clear(); espera = null; tropiezoHasta = hablandoHasta = pensandoHasta = 0; estadoActual = '';
  for (const s of subs.values()) s.etq.remove();
  subs.clear(); luces.length = 0;
  burbujas.limpiar(true); fichas.textContent = '';
  cara.contexto = estado.uso ? estado.uso.contexto / (estado.uso.ventana || 200000) : 0;
  recalcular();
});
en('sesion', () => { if (espera === 'inactivo') espera = null; recalcular(); });
en('prompt', () => {
  activas.clear(); espera = null; hablandoHasta = 0; tropiezoHasta = 0;
  burbujas.limpiar(); fichas.textContent = '';
  cara.poner('atenta'); cara.parpadear(0.1);
  pensandoHasta = 0;
  recalcular();
});
en('paquete', ({ id }) => {
  const s = estado.sugeridas.find((x) => x.id === id);
  if (s) s.entregada = true;
  cara.recibir('cian');
  pintarFichas();
});
en('skill_usada', (ev) => {
  // puede usar una skill que la araña no sugirió: igual se muestra
  if (!estado.sugeridas.some((s) => s.id === ev.id)) estado.sugeridas.push({ id: ev.id, puntaje: 0, entregada: true });
  pintarFichas();
});
en('pensamiento', (ev) => {
  espera = null;
  if (ev.agente) {
    const s = subs.get(ev.agente);
    if (s) { s.nota = primeraOracion(ev.texto, 60); s.cara.poner('pensando'); etiquetaSub(s); }
    return;
  }
  burbujas.quitarTipo('toca');
  const texto = primeraOracion(ev.texto, 92);
  if (texto) burbujas.agregar('pensamiento', texto);      // puede llegar vacío: piensa sin burbuja
  pensandoHasta = reloj.t + 2500;
  recalcular();
});
en('dicho', (ev) => {
  espera = null;
  if (ev.agente) { const s = subs.get(ev.agente); if (s) { s.nota = primeraOracion(ev.texto, 60); etiquetaSub(s); } return; }
  burbujas.quitarTipo('toca');
  const texto = String(ev.texto || '').trim();
  if (!texto) return;
  burbujas.agregar('dicho', truncar(texto, 170));
  hablandoHasta = reloj.t + limitar(texto.length * 45, 1800, 5000);
  despues(hablandoHasta - reloj.t + 10, recalcular);
  recalcular();
});
en('herramienta', (ev) => {
  if (ev.agente) {
    const s = subs.get(ev.agente);
    if (s) {
      if (ev.fase === 'inicio') { s.nota = (ev.clase || '') + ' ' + truncarMedio(ev.resumen || ev.nombre || '', 40); s.cara.poner((POR_CLASE[ev.clase] || POR_CLASE.otro)[0]); }
      else { s.cara.poner(ev.ok === false ? 'tropezo' : 'pensando'); }
      etiquetaSub(s);
    }
    return;
  }
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
en('subagente', (ev) => {
  if (ev.fase === 'inicio') {
    if (subs.has(ev.id)) return;
    const s = {
      id: ev.id, tipo: ev.tipoAgente || 'agente', descripcion: ev.descripcion || '', nota: '',
      cara: new Cara({ mini: true, semilla: subs.size + 5 }), etq: el('div', 'sub-etq'), hueco: el('i', 'sub-cara'), txt: el('div', 'sub-txt'),
      x: cara.x, y: cara.y, mx: cara.x, my: cara.y, fase: 'vivo', k: 0, nuevo: false, alfa: 0,
    };
    s.cara.poner('atenta');
    s.etq.append(s.hueco, s.txt);
    cajaSub.append(s.etq); etiquetaSub(s);
    subs.set(ev.id, s);
    colocarSubs();
  } else {
    const s = subs.get(ev.id);
    if (s && s.fase === 'vivo') { s.fase = 'vuelve'; s.k = 0; s.x0 = s.x; s.y0 = s.y; s.etq.classList.add('sale'); }
  }
  recalcular();
});
en('espera', (ev) => {
  espera = ev.motivo || 'respuesta';
  burbujas.quitarTipo('toca');
  if (espera !== 'inactivo') burbujas.agregar('toca', espera === 'permiso' ? 'Te toca: necesito tu permiso para seguir.' : 'Te toca.');
  recalcular();
});
en('fin_turno', () => {
  activas.clear();
  for (const s of subs.values()) if (s.fase === 'vivo') { s.fase = 'vuelve'; s.k = 0; s.x0 = s.x; s.y0 = s.y; s.etq.classList.add('sale'); }
  recalcular();
});
en('uso', (ev) => { cara.contexto = ev.ventana ? ev.contexto / ev.ventana : 0; });
en('compactacion', () => { cara.recibir('cian'); });

export function iniciar() {
  alCambiar(() => { geometria(); burbujas.redibujar(); });
  geometria();
  recalcular();

  capa(60, (ctx) => {
    // caritas de subagentes y los puntos de luz que entregan
    for (const s of subs.values()) {
      if (s.fase === 'ido') continue;
      s.cara.x = s.x; s.cara.y = s.y; s.cara.alfa = s.alfa;
      s.cara.dibujar(ctx);
    }
    for (const l of luces) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba('cian', 0.9 * (1 - l.k));
      ctx.beginPath(); ctx.arc(cara.x, cara.y, cara.d / 2 + cara.d * 0.075 + l.k * 26, 0, TAU);
      ctx.strokeStyle = rgba('cian', 0.8 * (1 - l.k)); ctx.lineWidth = 1; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    cara.dibujar(ctx);
  });
}

let ultimaRevision = 0, dormidaPuesta = false;
export function avanzar(dt) {
  cara.avanzar(dt);
  // brillo general: dormida baja a 60 %
  const metaBrillo = cara.estado === 'dormida' ? 0.6 : 1;
  lienzo.brillo += (metaBrillo - lienzo.brillo) * Math.min(1, dt * 2.5);
  if (dormidaPuesta !== (metaBrillo < 1)) { dormidaPuesta = metaBrillo < 1; document.getElementById('panel').classList.toggle('dormida', dormidaPuesta); }
  // plazos que vencen sin evento (hablando, pensando → delegando, inactividad)
  if (reloj.t - ultimaRevision > 400) { ultimaRevision = reloj.t; recalcular(); }

  for (const s of subs.values()) {
    if (s.fase === 'vivo') {
      s.alfa = Math.min(1, s.alfa + dt * 5);
      s.x += (s.mx - s.x) * Math.min(1, dt * 7); s.y += (s.my - s.y) * Math.min(1, dt * 7);
    } else if (s.fase === 'vuelve') {
      // viaja hasta la cara principal, entrega un punto de luz y desaparece
      s.k = Math.min(1, s.k + dt / 0.6);
      const e = entraSale(s.k);
      s.x = s.x0 + (cara.x - s.x0) * e; s.y = s.y0 + (cara.y - s.y0) * e;
      s.cara.d = Math.max(6, cara.d * 0.3 * (1 - e * 0.75));
      s.alfa = 1 - Math.max(0, (s.k - 0.75) * 4);
      if (s.k >= 1) { s.fase = 'ido'; s.etq.remove(); cara.recibir('cian'); luces.push({ k: 0 }); subs.delete(s.id); colocarSubs(); recalcular(); }
      else if (s.k > 0.5 && s.etq.isConnected) { s.etq.remove(); colocarSubs(); }
    }
    s.cara.avanzar(dt);
  }
  for (let i = luces.length - 1; i >= 0; i--) { luces[i].k += dt / 0.5; if (luces[i].k >= 1) luces.splice(i, 1); }
}
/** Tras avanzar en seco (?t=), recolocar lo que depende del DOM. */
export function asentar() {
  colocarSubs(true);
  for (const s of subs.values()) if (s.fase === 'vivo') s.alfa = 1;
  burbujas.redibujar();
}
