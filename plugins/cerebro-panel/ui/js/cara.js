// cara.js — la cara de Claude: un disco claro con dos ojos (pastillas verticales oscuras),
// sin boca, y un anillo fino que muestra la ventana de contexto usada.
// Toda la expresión sale de tres números por ojo: hacia dónde mira (mx, my) y cuánto abre (ab),
// movidos con resortes sin rebote exagerado. La misma clase sirve para las caritas de subagentes.

import { TAU, Resorte, limitar, COLOR, rgba } from './util.js';
import { reloj } from './reloj.js';

export class Cara {
  constructor({ mini = false, semilla = 1 } = {}) {
    this.mini = mini;
    this.x = 0; this.y = 0; this.d = 100;
    this.estado = 'dormida';
    this.desde = 0;                         // reloj.t en que entró al estado
    this.mx = new Resorte(0, 150, 0.9); this.my = new Resorte(0, 150, 0.9);
    this.ab = new Resorte(0.1, 240, 0.85);  // apertura de los ojos (1 = abiertos)
    this.latido = new Resorte(1, 200, 0.6); // pequeño "pop" al recibir algo
    this.parpadeo = 0;                      // s restantes del parpadeo en curso
    this.proximo = 2 + semilla * 1.3;       // s para el siguiente parpadeo
    this.sacudida = 0;                      // s restantes de sacudida (tropezó)
    this.destello = 0;                      // 0..1 destello del anillo
    this.tonoDestello = 'rosa';
    this.mirada = null;                     // { x, y } punto al que mira cuando delega
    this.lado = semilla % 2 ? 1 : -1;       // hacia qué lado piensa
    this.contexto = 0;                      // 0..1 ventana usada
    this.alfa = 1;
    this.azar = semilla * 97.13;
  }

  poner(estado) {
    if (estado === this.estado) return;
    const antes = this.estado;
    this.estado = estado; this.desde = reloj.t;
    if (estado === 'tropezo') { this.sacudida = 0.3; this.destello = 1; this.tonoDestello = 'rosa'; }
    if (estado === 'pensando') this.lado = -this.lado;
    if ((antes === 'dormida' || estado === 'atenta') && estado !== 'dormida') this.parpadear(0.12);
  }
  parpadear(retraso = 0) { if (this.parpadeo <= 0) this.parpadeo = 0.17 + retraso; }
  /** Recibió un paquete o un punto de luz: parpadea y da un latido. */
  recibir(tono = 'cian') { this.parpadear(); this.latido.v += 0.9; this.destello = Math.max(this.destello, 0.8); this.tonoDestello = tono; }

  /** Pose objetivo de los ojos según el estado: [mx, my, apertura] en fracciones del diámetro. */
  pose() {
    const t = (reloj.t - this.desde) / 1000, quieto = reloj.quieto;
    switch (this.estado) {
      case 'dormida': return [0, 0.035, 0.07];
      case 'pensando': return quieto ? [0.07 * this.lado, -0.085, 0.95]
        : [0.07 * this.lado + 0.018 * Math.sin(t * 0.9), -0.085 + 0.014 * Math.sin(t * 0.63 + 1), 0.95];
      case 'leyendo': {
        if (quieto) return [0, 0.02, 0.85];
        // barre de izquierda a derecha, baja un renglón, vuelve
        const ciclo = t % 2.7, renglon = Math.floor(ciclo / 0.9), k = (ciclo % 0.9) / 0.9;
        return [-0.085 + 0.17 * Math.min(1, k * 1.15), -0.03 + renglon * 0.034, 0.82];
      }
      case 'escribiendo': {
        if (quieto) return [0, 0.085, 0.85];
        const salto = Math.floor(t / 0.17) % 6;
        return [-0.06 + salto * 0.024, 0.088, 0.85];
      }
      case 'ejecutando': return [0, 0.01, 0.3];
      case 'delegando': {
        if (!this.mirada) return [0, 0.07, 1];
        const dx = this.mirada.x - this.x, dy = this.mirada.y - this.y, d = Math.hypot(dx, dy) || 1;
        return [(dx / d) * 0.085, (dy / d) * 0.085, 1];
      }
      case 'hablando': return [0, quieto ? 0 : 0.008 * Math.sin(t * 7), 1];
      case 'esperando': return [0, 0, 1.12];
      case 'tropezo': return [0, 0.01, t < 0.3 ? 0.05 : 0.8];
      default: return [0, 0, 1];   // atenta
    }
  }

  avanzar(dt) {
    const [mx, my, ab] = this.pose();
    this.mx.meta = mx; this.my.meta = my; this.ab.meta = ab;
    this.mx.avanzar(dt); this.my.avanzar(dt); this.ab.avanzar(dt);
    this.latido.meta = 1; this.latido.avanzar(dt);
    if (this.parpadeo > 0) this.parpadeo -= dt;
    else if (this.estado !== 'dormida' && this.estado !== 'tropezo' && !reloj.pausado) {
      this.proximo -= dt;
      if (this.proximo <= 0) {
        this.parpadeo = 0.17;
        this.azar = (this.azar * 16807 + 11) % 2147483647;
        this.proximo = 3 + ((this.azar % 1000) / 1000) * 4;     // cada 3–7 s
      }
    }
    if (this.sacudida > 0) this.sacudida -= dt;
    if (this.destello > 0) this.destello = Math.max(0, this.destello - dt * 1.8);
  }

  dibujar(ctx) {
    if (this.alfa <= 0.01) return;
    const t = reloj.t / 1000, d = this.d, r = d / 2, quieto = reloj.quieto;
    let x = this.x, y = this.y;
    if (this.sacudida > 0 && !quieto) x += Math.sin(this.sacudida * 70) * 4 * (this.sacudida / 0.3) * (this.mini ? 0.4 : 1);
    // respiración: lenta dormida, apenas perceptible despierta
    const resp = quieto ? 1 : this.estado === 'dormida' ? 1 + 0.014 * Math.sin(t * 1.1) : 1 + 0.004 * Math.sin(t * 1.9);
    const esc = resp * limitar(this.latido.x, 0.9, 1.12);

    ctx.save();
    ctx.globalAlpha = this.alfa;
    ctx.globalCompositeOperation = 'source-over';

    // ----- anillo de contexto -----
    if (!this.mini) {
      const ra = r + Math.max(7, d * 0.075);
      ctx.lineWidth = 1; ctx.strokeStyle = COLOR.linea2;
      ctx.beginPath(); ctx.arc(x, y, ra, 0, TAU); ctx.stroke();
      const frac = limitar(this.contexto, 0, 1);
      const tono = this.estado === 'esperando' ? 'ambar' : frac > 0.9 ? 'rosa' : frac > 0.75 ? 'ambar' : 'cian';
      if (this.estado === 'esperando') {
        // anillo ámbar completo, pulsando lento
        ctx.globalAlpha = this.alfa * (quieto ? 0.9 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.1)));
        ctx.strokeStyle = COLOR.ambar; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, ra, 0, TAU); ctx.stroke();
        ctx.globalAlpha = this.alfa;
      }
      if (frac > 0.001) {
        ctx.strokeStyle = COLOR[tono]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, ra, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
        // marca al final del arco
        const af = -Math.PI / 2 + TAU * frac;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(af) * (ra - 4), y + Math.sin(af) * (ra - 4)); ctx.lineTo(x + Math.cos(af) * (ra + 5), y + Math.sin(af) * (ra + 5)); ctx.stroke();
      }
      if (this.estado === 'ejecutando' && !quieto) {
        // un segmento gira por fuera mientras corre el comando
        const a0 = t * 2.6;
        ctx.strokeStyle = COLOR.cian; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, ra + 6, a0, a0 + 0.7); ctx.stroke();
      }
      if (this.destello > 0.02) {
        ctx.globalAlpha = this.alfa * Math.min(1, this.destello);
        ctx.strokeStyle = COLOR[this.tonoDestello] || COLOR.cian; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, ra, 0, TAU); ctx.stroke();
        ctx.globalAlpha = this.alfa;
      }
    }

    // ----- disco -----
    ctx.fillStyle = COLOR.cara;
    ctx.beginPath(); ctx.arc(x, y, r * esc, 0, TAU); ctx.fill();

    // ----- ojos: dos pastillas -----
    let ab = this.ab.x;
    if (this.parpadeo > 0 && this.parpadeo < 0.17) ab *= Math.abs(Math.cos((this.parpadeo / 0.17) * Math.PI));   // cierra y abre
    ab = limitar(ab, 0.05, 1.2);
    const ojoW = d * 0.105, ojoH = Math.max(d * 0.03, d * 0.27 * ab), sep = d * 0.165;
    const ox = x + this.mx.x * d, oy = y - d * 0.02 + this.my.x * d;
    ctx.fillStyle = COLOR.fondo;
    for (const lado of [-1, 1]) {
      const cx = ox + lado * sep;
      // cerrado = raya un poco más ancha
      const w = ojoW * (1 + Math.max(0, 0.75 - ab) * 0.75);
      pastilla(ctx, cx - w / 2, oy - ojoH / 2, w, ojoH);
    }
    ctx.restore();
  }
}

function pastilla(ctx, x, y, w, h) {
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.fill();
}
