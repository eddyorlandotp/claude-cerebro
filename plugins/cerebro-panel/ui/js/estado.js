// estado.js — bus de eventos + estado compartido mínimo.
// eventos.js (SSE o demo) llama a recibir(ev); cada módulo se suscribe con en('tipo', fn)
// y mantiene su propia vista. Aquí solo vive lo que consultan varios módulos.

import { reloj } from './reloj.js';

export const estado = {
  modo: 'vivo',            // 'vivo' (SSE) | 'demo'
  conectado: true,
  sesion: null,            // último evento `sesion`
  plugins: [],             // del evento `biblioteca`
  skills: new Map(),       // id -> { id, nombre, desc, plugin, activo }
  turno: 0,                // número de turno en curso (o último)
  enTurno: false,
  inicioTurno: 0,          // reloj.t cuando llegó el prompt
  pasos: 0,                // herramientas del hilo principal en este turno
  uso: null,               // último evento `uso`
  sugeridas: [],           // [{ id, puntaje, apagada }]
  usadas: new Set(),       // ids de skills usadas en este turno
  firmaBiblioteca: '',     // para saber si un evento `biblioteca` repetido trae lo mismo
  ultimoEvento: 0,         // reloj.t del último evento que no sea latido
};

const oyentes = new Map();

/** Suscribirse: en('prompt', fn). Tipos internos extra: 'reinicio', 'conexion', 'paquete', 'cara'. */
export function en(tipo, fn) {
  if (!oyentes.has(tipo)) oyentes.set(tipo, []);
  oyentes.get(tipo).push(fn);
}
export function emitir(tipo, datos) {
  const lista = oyentes.get(tipo);
  if (!lista) return;
  for (const fn of lista) {
    try { fn(datos); } catch (e) { console.error('[telaraña] oyente de', tipo, e); }
  }
}

/** Entra un evento normalizado del servidor (ver docs/CONTRATO.md). Tipos desconocidos se ignoran. */
export function recibir(ev) {
  if (!ev || typeof ev.tipo !== 'string') return;
  if (ev.tipo === 'latido') return;
  if (!ev.ts) ev.ts = Date.now();
  estado.ultimoEvento = reloj.t;

  switch (ev.tipo) {
    case 'sesion': {
      // Otra sesión distinta: reinicio completo de la vista (flujo, hilo, burbujas, fichas, contexto).
      if (estado.sesion && ev.sesion && estado.sesion.sesion && ev.sesion !== estado.sesion.sesion) reiniciar(true);
      estado.sesion = ev;
      break;
    }
    case 'biblioteca': {
      const firma = JSON.stringify((ev.plugins || []).map((p) => [p.nombre, p.activo !== false, (p.skills || []).map((s) => s.id)]));
      ev.igual = firma === estado.firmaBiblioteca;      // los módulos lo usan para no rehacer la nube
      estado.firmaBiblioteca = firma;
      estado.plugins = Array.isArray(ev.plugins) ? ev.plugins : [];
      estado.skills = new Map();
      for (const p of estado.plugins) for (const s of p.skills || []) {
        estado.skills.set(s.id, { id: s.id, nombre: s.nombre || s.id, desc: s.desc || '', plugin: p.nombre, activo: p.activo !== false });
      }
      break;
    }
    case 'prompt': {
      estado.turno += 1; estado.enTurno = true;
      estado.inicioTurno = reloj.t - (estado.modo === 'vivo' ? Math.min(6 * 3600e3, Math.max(0, Date.now() - ev.ts)) : 0);
      estado.pasos = 0; estado.sugeridas = []; estado.usadas = new Set();
      break;
    }
    case 'sugeridas': {
      const apagadas = new Set(ev.apagadas || []);
      const lista = (ev.skills || []).map((s) => ({ id: s.id, puntaje: s.puntaje, apagada: apagadas.has(s.id) || estado.skills.get(s.id)?.activo === false }));
      for (const id of apagadas) if (!lista.some((s) => s.id === id)) lista.push({ id, puntaje: 0, apagada: true });
      estado.sugeridas = lista;
      break;
    }
    case 'skill_usada': estado.usadas.add(ev.id); break;
    case 'herramienta': if (ev.fase === 'inicio' && !ev.agente) estado.pasos += 1; break;
    case 'uso': estado.uso = ev; break;
    case 'fin_turno': estado.enTurno = false; break;
    case 'hilo': if (ev.turnos && ev.turnos > estado.turno) estado.turno = ev.turnos; break;
  }
  emitir(ev.tipo, ev);
  emitir('*', ev);
}

/** Borra el turno en curso (bucle del demo o reconexión: el servidor reenvía el estado). */
export function reiniciar(total = true) {
  estado.enTurno = false; estado.pasos = 0; estado.sugeridas = []; estado.usadas = new Set();
  if (total) { estado.turno = 0; estado.sesion = null; estado.uso = null; }
  emitir('reinicio', { total });
}

export function nombreSkill(id) { return estado.skills.get(id)?.nombre || String(id).split(':').pop(); }
