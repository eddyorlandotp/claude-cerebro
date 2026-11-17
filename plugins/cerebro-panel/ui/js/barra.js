// barra.js — barra superior: marca, proyecto, rama, modelo, turno, cronómetro, modo de la
// biblioteca, estado en una palabra con su punto de color y la hora.

import { estado, en } from './estado.js';
import { reloj } from './reloj.js';
import { avisar, limpiarAvisos, banda } from './distribucion.js';
import { crono, duracion } from './util.js';
import { ICO } from './iconos.js';

const $ = (id) => document.getElementById(id);
const proyecto = $('b-proyecto'), rama = $('b-rama'), modelo = $('b-modelo'), turno = $('b-turno'), cr = $('b-crono');
const est = $('b-estado'), estTxt = $('b-estado-txt'), horaEl = $('b-hora');
let modoBib = '', duracionFinal = null, ultimoSeg = -1, ultimoMin = -1, ultimoCrono = '';

function pintarSesion() {
  const s = estado.sesion;
  proyecto.innerHTML = s?.proyecto ? `${ICO.carpeta}<b></b>` : '';
  if (s?.proyecto) proyecto.lastChild.textContent = s.proyecto;
  rama.innerHTML = s?.rama ? `${ICO.rama}<span></span>` : '';
  if (s?.rama) rama.lastChild.textContent = s.rama;
  const m = [s?.modelo ? String(s.modelo).replace(/^claude-/, '') : '', modoBib ? 'modo ' + modoBib : ''].filter(Boolean).join(' · ');
  modelo.innerHTML = m ? `${ICO.modelo}<span></span>` : '';
  if (m) modelo.lastChild.textContent = m;
  pintarTurno();
}
function pintarTurno() {
  turno.textContent = estado.turno ? 'turno ' + estado.turno : '';
  if (!estado.turno) cr.textContent = '';
  else if (estado.enTurno) { ultimoCrono = crono(reloj.t - estado.inicioTurno); cr.textContent = ultimoCrono; }
  else cr.textContent = duracionFinal != null ? duracion(duracionFinal) : '';
}

en('sesion', pintarSesion);
en('biblioteca', (ev) => { modoBib = ev.modo === 'ligero' || ev.modo === 'completo' ? ev.modo : ''; pintarSesion(); });
en('prompt', (ev) => { if (ev.enCola) return; duracionFinal = null; limpiarAvisos(); pintarTurno(); });
en('fin_turno', (ev) => { duracionFinal = ev.ms ?? reloj.t - estado.inicioTurno; pintarTurno(); });
en('reinicio', () => { duracionFinal = null; pintarSesion(); });
en('conexion', (ok) => { banda(!ok); });
en('cara', (c) => {
  estTxt.textContent = c.verbo;
  est.dataset.tono = c.estado === 'esperando' ? 'ambar' : c.estado === 'tropezo' ? 'rosa' : c.estado === 'dormida' ? 'apagado' : '';
});

// Puntos de actividad en las pestañas de zonas minimizadas
en('sugeridas', () => avisar('biblioteca'));
en('skill_usada', () => avisar('biblioteca'));
en('uso', () => avisar('contexto'));
en('hilo', () => avisar('hilo'));
en('herramienta', (ev) => {
  const mal = ev.fase === 'fin' && ev.ok === false;
  avisar('flujo', mal ? 'rosa' : 'cian'); avisar('actividad', mal ? 'rosa' : 'cian');
  if (ev.clase === 'editar' || ev.clase === 'leer') avisar('hilo');
});
en('pensamiento', () => avisar('actividad'));
en('dicho', () => avisar('actividad'));

export function iniciar() { pintarSesion(); reloj_(); }
function reloj_() {
  const d = new Date();
  if (d.getMinutes() !== ultimoMin) { ultimoMin = d.getMinutes(); horaEl.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
}
export function avanzar() {
  if (reloj.rapido) return;
  // el cronómetro se compara por texto (no por segundo de reloj) para que también quede bien tras un salto ?t=
  if (estado.enTurno) { const txt = crono(reloj.t - estado.inicioTurno); if (txt !== ultimoCrono) { ultimoCrono = txt; cr.textContent = txt; } }
  const seg = Math.floor(performance.now() / 1000);
  if (seg !== ultimoSeg) { ultimoSeg = seg; reloj_(); }
}
