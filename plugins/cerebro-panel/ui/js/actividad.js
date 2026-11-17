// actividad.js — registro de una línea por evento: hora, verbo de ancho fijo, detalle.
// Lo nuevo entra arriba; máximo 200 líneas.

import { en, nombreSkill } from './estado.js';
import { reloj } from './reloj.js';
import { el, hora, duracion, truncar } from './util.js';
import { tonoSkill } from './tonos.js';

const lista = document.getElementById('registro');
const meta = document.getElementById('act-meta');
const MAX = 200;
const VERBO = { leer: 'Leer', buscar: 'Buscar', comando: 'Correr', editar: 'Editar', web: 'Web', agente: 'Agente', skill: 'Skill', mcp: 'MCP', tarea: 'Tarea', pregunta: 'Pregunta', otro: 'Otro' };
const abiertas = new Map();   // id de herramienta -> <li>
let total = 0;
let pendientes = [];          // líneas acumuladas mientras se avanza en seco

function linea(ev, verbo, detalle, clase = '') {
  const li = el('li', clase);
  const t = el('time', '', hora(ev.ts || Date.now()));
  li.append(t, el('span', 'verbo', verbo), el('span', 'detalle', detalle), el('span', 'cola', ''));
  total += 1;
  if (reloj.rapido) pendientes.push(li); else { lista.prepend(li); recortar(); }
  meta.textContent = total + ' eventos';
  return li;
}
function recortar() { while (lista.children.length > MAX) lista.lastChild.remove(); }
/** Vuelca lo acumulado durante el avance en seco. */
export function asentar() { for (const li of pendientes) lista.prepend(li); pendientes = []; recortar(); }

en('reinicio', () => { abiertas.clear(); });
en('sesion', (ev) => linea(ev, 'Sesión', `${ev.proyecto || ''}${ev.rama ? ' · ' + ev.rama : ''}${ev.modelo ? ' · ' + ev.modelo : ''}`, 'tenue'));
en('prompt', (ev) => linea(ev, 'Prompt', ev.texto || ''));
en('sugeridas', (ev) => { const n = (ev.skills || []).length; if (n) linea(ev, 'Araña', 'sugiere ' + ev.skills.map((s) => nombreSkill(s.id)).join(', '), 'tenue'); });
en('pensamiento', (ev) => { if ((ev.texto || '').trim()) linea(ev, 'Piensa', ev.texto, 'tenue' + (ev.agente ? ' sub' : '')); });
en('dicho', (ev) => { if ((ev.texto || '').trim()) linea(ev, 'Dice', ev.texto, ev.agente ? 'sub' : ''); });
en('herramienta', (ev) => {
  if (ev.fase === 'inicio') {
    const detalle = ev.clase === 'skill' ? nombreSkill(ev.resumen) : ev.resumen || ev.nombre || '';
    const li = linea(ev, VERBO[ev.clase] || 'Otro', detalle, 'curso' + (ev.agente ? ' sub' : ''));
    if (ev.clase === 'skill') li.style.setProperty('--tono', tonoSkill(ev.resumen).hex);      // el tono del cúmulo viaja con la skill
    abiertas.set(ev.id, li);
  } else {
    const li = abiertas.get(ev.id); abiertas.delete(ev.id);
    if (!li) return;
    li.classList.remove('curso');
    li.children[3].textContent = ev.ms ? duracion(ev.ms) : '';
    if (ev.ok === false) {
      li.classList.add('error'); li.children[1].textContent = 'Error';
      if (ev.detalle) { li.children[2].textContent += ' — ' + ev.detalle; li.title = ev.detalle; }
    }
  }
});
en('subagente', (ev) => linea(ev, 'Agente', (ev.fase === 'inicio' ? 'sale ' : 'vuelve ') + (ev.tipoAgente || '') + ' · ' + truncar(ev.descripcion || '', 60), 'tenue'));
en('espera', (ev) => linea(ev, 'Espera', ev.motivo === 'permiso' ? 'necesita tu permiso' : ev.motivo === 'respuesta' ? 'te toca responder' : 'sin actividad', 'espera'));
en('fin_turno', (ev) => linea(ev, 'Fin', `turno terminado · ${ev.pasos ?? '?'} pasos · ${duracion(ev.ms || 0)}`, 'tenue'));
en('compactacion', (ev) => linea(ev, 'Compacta', 'se resumió la conversación para liberar ventana', 'tenue'));
