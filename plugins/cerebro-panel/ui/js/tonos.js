// tonos.js — una familia de color por cúmulo (DISENO.md, versión 2).
// El tono es del PLUGIN y viaja con sus skills: etiqueta, paquete, ficha, satélite, filo del
// bloque en el Flujo y verbo en Actividad. Todo lo demás de la interfaz sigue en tinta + cian.
// Misma claridad y saturación en los ocho: se suman en aditivo sin que ninguno grite.

import { estado } from './estado.js';

export const PALETA = ['#86d5ea', '#7aa8ff', '#b79cf5', '#e58ad0', '#f29b7e', '#e6cf8a', '#b9e07a', '#7fe0b0'];
//                      c1 cian    c2 azul    c3 lila    c4 orquídea c5 coral  c6 arena   c7 lima    c8 menta

// Tonos fijos para los plugins del cerebro (edítalo si cambian; los demás salen por hash del nombre).
const FIJOS = {
  'cerebro-base': 0, 'cerebro-codigo': 1, 'cerebro-solana': 2, 'cerebro-ia': 3, 'cerebro-diseno': 4,
  'cerebro-cripto': 5, 'cerebro-juegos': 6, 'cerebro-web': 7, 'cerebro-linux': 3, 'cerebro-negocio': 4,
  'cerebro-apps': 1, 'cerebro-casa': 5, 'cerebro-vida': 6, 'cerebro-panel': 0, 'cerebro-guardia': 7,
};
const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
const TONOS = PALETA.map((hex, i) => ({ i, hex, rgb: aRgb(hex) }));
export const SIN_TONO = { i: -1, hex: '#4d5c64', rgb: '77,92,100' };      // plugins apagados (--tinta-3)
export const TONO_CIAN = TONOS[0];

function hash(txt) { let h = 2166136261; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Tono de un plugin: { i, hex, rgb }. Apagado = sin tono. */
export function tonoPlugin(nombre, activo = true) {
  if (!activo) return SIN_TONO;
  const fijo = FIJOS[nombre];
  return TONOS[fijo != null ? fijo : hash(String(nombre)) % TONOS.length];
}
/** Tono de una skill (el de su plugin). Si no se conoce la skill, cian. */
export function tonoSkill(id) {
  const s = estado.skills.get(id);
  if (s) return tonoPlugin(s.plugin, s.activo);
  const plugin = String(id).includes(':') ? String(id).split(':')[0] : '';
  return plugin ? tonoPlugin(plugin) : TONO_CIAN;
}
export const rgbaT = (tono, a) => `rgba(${tono.rgb},${a})`;
