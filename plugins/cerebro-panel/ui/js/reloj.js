// reloj.js — reloj de simulación. TODO lo que se anima por código usa este tiempo
// (no performance.now), para poder: acelerar el demo (?velocidad=2), saltar a un
// momento (?t=5000) avanzando la simulación en seco, y congelarla (?pausa=1).

export const reloj = {
  t: 0,            // ms de simulación
  cuadro: 0,       // contador de cuadros dibujados
  pausado: false,
  rapido: false,   // true mientras se avanza en seco (sin dibujar): los módulos evitan trabajo visual
  quieto: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

let tareas = [];   // [{ cuando, fn }]

/** Ejecuta fn dentro de `ms` de tiempo de simulación. Devuelve un objeto para cancelar. */
export function despues(ms, fn) {
  const tarea = { cuando: reloj.t + ms, fn };
  tareas.push(tarea);
  return tarea;
}
export function cancelar(tarea) { if (tarea) tarea.fn = null; }

/** Avanza el reloj y dispara las tareas vencidas. */
export function avanzarReloj(dtMs) {
  reloj.t += dtMs;
  if (!tareas.length) return;
  const vencidas = [];
  tareas = tareas.filter((x) => { if (!x.fn) return false; if (x.cuando <= reloj.t) { vencidas.push(x); return false; } return true; });
  vencidas.sort((a, b) => a.cuando - b.cuando);
  for (const x of vencidas) if (x.fn) x.fn();
}
export function limpiarTareas() { tareas = []; }
