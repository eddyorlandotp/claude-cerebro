// principal.js — arranque y bucle. Orden: fuentes → rejilla → módulos → fuente de eventos.
//
// Parámetros de la URL:
//   ?demo=1         reproduce ../demo/sesion-demo.json en bucle, sin servidor
//   ?velocidad=2    acelera el demo
//   ?t=5000         salta a ese ms del guion (avanza la simulación en seco, sin dibujar)
//   ?pausa=1        congela el guion tras el salto (para capturas)
//   ?min=a,b        arranca con esas zonas minimizadas (no se guarda)
//   ?vuelta=2       (con ?t=) deja pasar antes N vueltas completas del guion
//   ?reposo=1       acelera 20× los tiempos de reposo (dormirse, despertar) y el demo no se repite
//   ?camara=fija    la cámara de la biblioteca no orbita ni se acerca
//   ?fps=0          quita el tope de 60 cuadros por segundo

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
  flujo.avanzar(dt);
  barra.avanzar();
}

// Medición de costo por cuadro (para depurar rendimiento): window.__telarana.stats
const stats = { cuadros: 0, msTotal: 0, msMax: 0, reiniciar() { this.cuadros = 0; this.msTotal = 0; this.msMax = 0; }, get promedio() { return this.cuadros ? this.msTotal / this.cuadros : 0; } };

let anterior = 0;
const medir = params.has('medir');
const topeFps = params.has('fps') ? Math.max(0, Number(params.get('fps')) || 0) : 60;
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (document.hidden) { anterior = ahora; return; }
  // Tope de 60 fps (dormida más de un minuto: 30). En monitores de 144/165 Hz dibujar cada refresco
  // casi triplica el uso de CPU sin que se note en un panel que se mira de reojo. ?fps=0 quita el tope.
  const tope = pensamiento.cara.estado === 'dormida' && reloj.t - pensamiento.cara.desde > 60000 ? 30 : topeFps;
  if (tope > 0 && ahora - anterior < (1000 / tope) * 0.8) return;
  const dtReal = Math.min(100, ahora - anterior || 16.7);
  anterior = ahora;
  const t0 = performance.now();
  distribucion.cuadro();
  if (!reloj.pausado) paso(dtReal * (demo ? velocidad : 1));
  else { pensamiento.avanzar(dtReal / 1000); flujo.avanzar(dtReal / 1000); barra.avanzar(); }
  reloj.cuadro += 1;
  dibujar(reloj.t);
  if (medir) lienzo.ctx.getImageData(0, 0, 1, 1);      // ?medir=1: obliga a rasterizar ya, para que el tiempo medido incluya el dibujo real
  const ms = performance.now() - t0;
  stats.cuadros += 1; stats.msTotal += ms; if (ms > stats.msMax) stats.msMax = ms;
  lienzo.carga += (ms - lienzo.carga) * 0.05;
  lienzo.intervalo += (dtReal - lienzo.intervalo) * 0.05;      // ms reales entre cuadros (si sube, se están perdiendo cuadros)
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
      // ?vuelta=N: además deja pasar N vueltas completas del guion antes (para ver la historia del Flujo llena)
      const vueltas = Math.max(0, Math.floor(Number(params.get('vuelta')) || 0));
      const hasta = Math.min(salto, demo.fin - 1);
      while (demo.vueltas < vueltas || demo.t < hasta) paso(Math.min(16, demo.vueltas < vueltas ? 16 : hasta - demo.t));
      reloj.rapido = false;
      actividad.asentar(); hilo.asentar(); pensamiento.asentar(); biblioteca.asentar(); flujo.asentar(); flujo.remedir();
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
