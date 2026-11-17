// eventos.js — de dónde salen los eventos: SSE en /eventos (con reconexión y espera
// creciente) o el guion demo reproducido en el navegador (?demo=1).

import { estado, recibir, reiniciar, emitir } from './estado.js';
import { reloj } from './reloj.js';

// ---------- Modo vivo: EventSource ----------
let fuente = null, intento = 0, vigia = null, ultimoMensaje = 0, reintento = null;

export function conectar(url = 'eventos') {
  cerrar();
  try { fuente = new EventSource(url); } catch { programarReintento(url); return; }
  fuente.onopen = () => {
    // El servidor reenvía sesión, biblioteca, hilo, uso y los eventos del turno en curso:
    // se limpia el turno local para no duplicar bloques.
    if (intento > 0 || !estado.conectado) reiniciar(false);
    intento = 0; ultimoMensaje = Date.now();
    marcarConexion(true);
  };
  fuente.onmessage = (m) => {
    ultimoMensaje = Date.now();
    let ev; try { ev = JSON.parse(m.data); } catch { return; }
    recibir(ev);
  };
  fuente.onerror = () => { marcarConexion(false); programarReintento(url); };
  // Si pasan 40 s sin nada (ni latido, que llega cada 15 s) se da por caída.
  clearInterval(vigia);
  vigia = setInterval(() => {
    if (fuente && estado.conectado && Date.now() - ultimoMensaje > 40000) { marcarConexion(false); programarReintento(url); }
  }, 5000);
}
function cerrar() { if (fuente) { fuente.onopen = fuente.onmessage = fuente.onerror = null; fuente.close(); fuente = null; } clearTimeout(reintento); }
function programarReintento(url) {
  cerrar();
  intento += 1;
  const espera = Math.min(15000, 1000 * Math.pow(2, Math.min(intento - 1, 4)));   // 1, 2, 4, 8, 15 s
  reintento = setTimeout(() => conectar(url), espera);
}
function marcarConexion(ok) {
  if (estado.conectado === ok) return;
  estado.conectado = ok;
  emitir('conexion', ok);
}

// ---------- Modo demo: guion en el navegador ----------
export class Demo {
  constructor(guion) {
    this.biblioteca = guion.biblioteca;
    this.eventos = (guion.eventos || []).slice().sort((a, b) => a.t - b.t);
    this.fin = (this.eventos.length ? this.eventos[this.eventos.length - 1].t : 0) + 9000;   // respiro antes de repetir
    this.t = 0; this.i = 0; this.base = Date.now(); this.vueltas = 0;
    this.enBucle = !new URLSearchParams(location.search).has('reposo');      // con ?reposo=1 el guion corre una vez y luego hay silencio
  }
  static async cargar() {
    // Con `python3 -m http.server` desde la raíz del plugin queda en ../demo/; el servidor real lo sirve en /demo/.
    const rutas = ['../demo/sesion-demo.json', '/demo/sesion-demo.json', 'demo/sesion-demo.json'];
    for (const ruta of rutas) {
      try {
        const r = await fetch(ruta, { cache: 'no-store' });
        if (!r.ok) continue;
        const guion = await r.json();
        if (guion && Array.isArray(guion.eventos)) return new Demo(guion);
      } catch { /* probar la siguiente */ }
    }
    throw new Error('No encontré demo/sesion-demo.json');
  }
  arrancar() {
    this.t = 0; this.i = 0; this.base = Date.now() - reloj.t;
    if (this.biblioteca && !estado.plugins.length) recibir({ ...this.biblioteca, ts: this.base });
  }
  /** Avanza el guion dt ms (tiempo de simulación) y emite lo que toque. */
  avanzar(dt) {
    this.t += dt;
    while (this.i < this.eventos.length && this.eventos[this.i].t <= this.t) {
      const { t, ...ev } = this.eventos[this.i++];
      recibir({ ...ev, ts: this.base + this.vueltas * this.fin + t, sesion: ev.sesion || 'demo' });
    }
    if (this.enBucle && this.t >= this.fin) {
      // otra vuelta: como hace el servidor, sigue la misma sesión (turno 2, 3…) y la historia se acumula
      this.vueltas += 1; this.t = 0; this.i = 0;
    }
  }
}
