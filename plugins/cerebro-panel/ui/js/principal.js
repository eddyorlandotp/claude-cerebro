// principal.js — arranque y bucle. Orden: fuentes → rejilla → módulos → fuente de eventos.
//
// Parámetros de la URL:
//   ?demo=1         reproduce ../demo/sesion-demo.json en bucle, sin servidor
//   ?velocidad=2    acelera el demo
//   ?t=5000         salta a ese ms del guion (avanza la simulación en seco, sin dibujar)
//   ?pausa=1        congela el guion tras el salto (para capturas)
//   ?min=a,b        arranca con esas zonas minimizadas (no se guarda)

import { reloj, avanzarReloj } from './reloj.js';
import { estado } from './estado.js';
import { conectar, Demo } from './eventos.js';
import * as distribucion from './distribucion.js';
import { ajustar, dibujar, lienzo } from './lienzo.js';
import * as pensamiento from './pensamiento.js';
import * as biblioteca from './biblioteca.js';
import * as flujo from './flujo.js';
import * as contexto from './contexto.js';
import * as hilo from './hilo.js';
import * as actividad from './actividad.js';
import * as barra from './barra.js';

const params = new URLSearchParams(location.search);
const velocidad = Math.max(0.1, Number(params.get('velocidad')) || 1);
let demo = null;

/** Un paso de simulación: reloj, guion y todos los módulos. dt en ms. */
function paso(dtMs) {
  avanzarReloj(dtMs);
  if (demo) demo.avanzar(dtMs);
  const dt = dtMs / 1000;
  pensamiento.avanzar(dt);
  biblioteca.avanzar(dt, reloj.t);
  hilo.avanzar(dt);
  flujo.avanzar();
  barra.avanzar();
}

// Medición de costo por cuadro (para depurar rendimiento): window.__telarana.stats
const stats = { cuadros: 0, msTotal: 0, msMax: 0, reiniciar() { this.cuadros = 0; this.msTotal = 0; this.msMax = 0; }, get promedio() { return this.cuadros ? this.msTotal / this.cuadros : 0; } };

let anterior = 0, saltar = false;
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (document.hidden) { anterior = ahora; return; }
  // dormida más de un minuto: 30 fps
  if (pensamiento.cara.estado === 'dormida' && reloj.t - pensamiento.cara.desde > 60000) { saltar = !saltar; if (saltar) return; }
  const dtReal = Math.min(100, ahora - anterior || 16.7);
  anterior = ahora;
  const t0 = performance.now();
  distribucion.cuadro();
  if (!reloj.pausado) paso(dtReal * (demo ? velocidad : 1));
  else { pensamiento.avanzar(dtReal / 1000); flujo.avanzar(); barra.avanzar(); }
  reloj.cuadro += 1;
  dibujar(reloj.t);
  const ms = performance.now() - t0;
  stats.cuadros += 1; stats.msTotal += ms; if (ms > stats.msMax) stats.msMax = ms;
}

async function arrancar() {
  // Las fuentes van primero: el lienzo escribe texto con ellas.
  try {
    await Promise.race([
      Promise.all(['400 12px "IBM Plex Mono"', '500 12px "IBM Plex Mono"', '600 12px "IBM Plex Sans Condensed"', '500 12px "IBM Plex Sans Condensed"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* se dibuja con la de respaldo */ }

  ajustar();
  distribucion.iniciar();
  addEventListener('resize', ajustar);
  pensamiento.iniciar(); biblioteca.iniciar(); flujo.iniciar(); contexto.iniciar(); hilo.iniciar(); barra.iniciar();
  distribucion.alCambiar(() => flujo.remedir());

  if (params.get('demo')) {
    estado.modo = 'demo';
    try { demo = await Demo.cargar(); demo.arrancar(); }
    catch (e) { console.warn('[telaraña]', e.message); }
    const salto = Number(params.get('t')) || 0;
    if (demo && salto > 0) {
      // avanzar en seco hasta el momento pedido, a pasos fijos de 16 ms
      reloj.rapido = true;
      const hasta = Math.min(salto, demo.fin - 1);
      while (demo.t < hasta) paso(Math.min(16, hasta - demo.t));
      reloj.rapido = false;
      actividad.asentar(); hilo.asentar(); pensamiento.asentar(); flujo.remedir();
    }
    if (params.get('pausa')) reloj.pausado = true;
  } else {
    conectar('eventos');
  }
  window.__telarana = { reloj, estado, stats, lienzo, demo };
  document.documentElement.dataset.listo = '1';
  requestAnimationFrame(cuadro);
}
arrancar();
