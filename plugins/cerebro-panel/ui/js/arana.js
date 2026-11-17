// arana.js — araña procedural vista desde arriba: cuerpo de dos elipses con retícula y
// ocho patas de dos segmentos con cinemática inversa. Las patas se PLANTAN en el suelo y
// el cuerpo avanza; cuando un pie queda muy lejos de su sitio de reposo, da un paso.
// Paso alternado: dos grupos de cuatro patas (I1 D2 I3 D4 / D1 I2 D3 I4) que no pisan a la vez.
//
// La clase no sabe nada de la biblioteca: solo sabe ir a un punto (irA), colgarse de un
// hilo (modo 'colgar': patas recogidas) y hacer el gesto de lanzar. Quien la dirige es
// biblioteca.js (araña grande) o hilo.js (araña chica).

import { TAU, limitar, difAngulo, mezclar, rgba, COLOR } from './util.js';

// Geometría en unidades de `s` (escala). x = hacia delante, y = hacia la izquierda del bicho.
const ANGULOS = [30, 62, 114, 148];          // dirección de reposo de cada pata, grados desde el frente
const ALCANCE = [3.3, 3.0, 2.9, 3.5];        // distancia del pie en reposo
const CADERA = [38, 70, 110, 142];           // dónde nace cada pata en el cefalotórax
const HOLGURA = 1.28;                        // largo de la pata / distancia cadera→pie en reposo (da la zancada)

export class Arana {
  constructor(escala = 10, semilla = 1) {
    this.s = escala;
    this.x = 0; this.y = 0; this.rumbo = -Math.PI / 2;
    this.vel = 0;                 // rapidez actual (px/s)
    this.giro = 0;                // velocidad angular actual (rad/s): el cuerpo gira con inercia
    this.velMax = 60;
    this.prisa = 0.12;            // fracción mínima de velMax al llegar (0.12 = llega suave; 0.5 = llega corriendo)
    this.meta = null;             // { x, y } o null
    this.modo = 'andar';          // 'andar' | 'colgar'
    this.gesto = 0;               // 0..1: patas delanteras lanzando
    this.recogida = 0;            // 0..1: cuánto recoge las patas (colgada)
    this.carga = 0;               // paquetes en el lomo
    this.inquieta = 0;            // reloj interno para mover una pata en reposo
    this.fase = semilla * 1.7;
    this.patas = [];
    for (let lado = -1; lado <= 1; lado += 2) for (let i = 0; i < 4; i++) {
      const a = (ANGULOS[i] * Math.PI) / 180, c = (CADERA[i] * Math.PI) / 180;
      const cad = { x: 0.35 + Math.cos(c) * 0.5, y: lado * Math.sin(c) * 0.42 };
      const rep = { x: Math.cos(a) * ALCANCE[i] + 0.2, y: lado * Math.sin(a) * ALCANCE[i] };
      const largo = Math.hypot(rep.x - cad.x, rep.y - cad.y) * HOLGURA;
      this.patas.push({
        lado, i, femur: largo * 0.47, tibia: largo * 0.53,
        grupo: (i + (lado > 0 ? 0 : 1)) % 2,
        cadera: cad, reposo: rep,
        codo: lado * (i < 2 ? -1 : 1),      // hacia qué lado dobla la rodilla (arco hacia fuera)
        px: 0, py: 0, paso: null, alto: 0,
      });
    }
    this.plantar();
  }

  /** Coloca la araña y planta las ocho patas en reposo (sin animación). */
  colocar(x, y, rumbo = this.rumbo) { this.x = x; this.y = y; this.rumbo = rumbo; this.vel = 0; this.meta = null; this.plantar(); }
  plantar() {
    for (const p of this.patas) {
      // los dos grupos empiezan desfasados media zancada para que el paso arranque alternado
      const d = p.grupo ? -0.45 : 0.45;
      const m = this.aMundo(p.reposo.x + d, p.reposo.y);
      p.px = m.x; p.py = m.y; p.paso = null; p.alto = 0;
    }
  }
  aMundo(lx, ly) {
    const c = Math.cos(this.rumbo), s = Math.sin(this.rumbo), k = this.s;
    // y local = izquierda del bicho; en pantalla (y hacia abajo) la izquierda es (s, -c)
    return { x: this.x + (lx * c + ly * s) * k, y: this.y + (lx * s - ly * c) * k };
  }
  irA(x, y, velMax) { this.meta = { x, y }; if (velMax) this.velMax = velMax; }
  parar() { this.meta = null; }
  distMeta() { return this.meta ? Math.hypot(this.meta.x - this.x, this.meta.y - this.y) : 0; }
  get span() { return this.s * 7; }

  avanzar(dt) {
    const s = this.s;
    // ----- cuerpo: gira hacia la meta y avanza en la dirección en que mira -----
    let velDeseada = 0;
    if (this.meta) {
      const dx = this.meta.x - this.x, dy = this.meta.y - this.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const err = difAngulo(this.rumbo, Math.atan2(dy, dx));
        // gira con inercia: la velocidad angular persigue a la deseada en vez de saltar
        const giroMax = this.modo === 'colgar' ? 5 : 5.5 + this.velMax / 70;
        this.giro += (limitar(err * 9, -giroMax, giroMax) - this.giro) * Math.min(1, dt * 14);
        this.rumbo += this.giro * dt;
        const frenado = Math.max(s * 1.2, this.velMax * 0.16);
        const alineado = Math.max(0, Math.cos(err)) ** 2;
        velDeseada = this.velMax * Math.max(this.prisa, Math.min(1, d / frenado)) * (this.modo === 'colgar' ? 1 : alineado);
        if (this.modo === 'colgar') {
          // colgada del hilo se desliza recto hacia la meta, sin depender del rumbo
          const v = Math.min(velDeseada * dt, d);
          this.x += (dx / d) * v; this.y += (dy / d) * v; this.vel = velDeseada;
        }
      }
    }
    if (this.modo !== 'colgar') {
      this.vel += (velDeseada - this.vel) * Math.min(1, dt * (5 + this.prisa * 5));      // el cuerpo acelera y frena con inercia
      this.x += Math.cos(this.rumbo) * this.vel * dt;
      this.y += Math.sin(this.rumbo) * this.vel * dt;
    }
    this.recogida += ((this.modo === 'colgar' ? 1 : 0) - this.recogida) * Math.min(1, dt * 9);
    this.fase += dt;

    // ----- patas -----
    const rapidez = this.vel / s;                               // en cuerpos por segundo
    const zancada = limitar(1.4 + rapidez * 0.12, 1.4, 3.9);     // al correr, zancada larga y menos pasos
    const durPaso = limitar(0.42 * zancada / Math.max(rapidez, 3.2), 0.075, 0.2);
    const agacha = 1 - 0.14 * Math.min(1, rapidez / 18);          // al correr recoge un poco las patas: le da holgura para la zancada
    const pisando = [0, 0];
    for (const p of this.patas) if (p.paso) pisando[p.grupo]++;

    // en reposo, de vez en cuando levanta una pata y la reacomoda (está viva)
    if (this.modo === 'andar' && this.vel < s * 0.5) {
      this.inquieta -= dt;
      if (this.inquieta <= 0) {
        this.inquieta = 1.1 + ((this.fase * 7.3) % 1.9);
        const p = this.patas[Math.floor((this.fase * 13.7) % 8)];
        if (!p.paso) {
          const j = ((this.fase * 3.1) % 1) - 0.5;
          const m = this.aMundo(p.reposo.x + j * 0.7, p.reposo.y + j * 0.5);
          p.paso = { x0: p.px, y0: p.py, x1: m.x, y1: m.y, k: 0, dur: 0.22 };
        }
      }
    }

    for (const p of this.patas) {
      const rec = this.recogida;
      // sitio ideal del pie: reposo (recogido si cuelga) + gesto de lanzar en el primer par
      let rx = p.reposo.x * (1 - rec * 0.42) * agacha, ry = p.reposo.y * (1 - rec * 0.5) * agacha;
      if (rec > 0.01) { rx += Math.sin(this.fase * 5 + p.i * 1.3) * 0.12 * rec; ry += Math.cos(this.fase * 4 + p.i) * 0.1 * rec * p.lado; }
      if (p.i === 0 && this.gesto > 0) { rx += this.gesto * 1.15; ry -= p.lado * this.gesto * 1.5; }
      const ideal = this.aMundo(rx, ry);

      if (this.modo === 'colgar' || (p.i === 0 && this.gesto > 0.02)) {
        // sin suelo: el pie sigue a su sitio con un retraso suave
        const k = Math.min(1, dt * 16);
        p.px += (ideal.x - p.px) * k; p.py += (ideal.y - p.py) * k; p.paso = null; p.alto = 0.4 * rec;
        continue;
      }
      if (p.paso) {
        const q = p.paso;
        q.k = Math.min(1, q.k + dt / q.dur);
        const e = q.k * q.k * (3 - 2 * q.k);
        p.px = mezclar(q.x0, q.x1, e); p.py = mezclar(q.y0, q.y1, e);
        p.alto = Math.sin(Math.PI * q.k);
        if (q.k >= 1) { p.paso = null; p.alto = 0; }
        continue;
      }
      const error = Math.hypot(ideal.x - p.px, ideal.y - p.py) / s;
      const otro = pisando[1 - p.grupo];
      // urgencia: solo si el pie quedó muy atrás (al correr se permite estirar la pata sin dar pasitos nerviosos)
      const urge = error > zancada * 1.5 || (rapidez < 8 && this.distCadera(p) > (p.femur + p.tibia) * 0.975);
      if ((error > zancada * 0.5 && otro === 0 && this.vel > s * 0.4) || urge || (this.vel <= s * 0.4 && error > 0.5 && otro === 0)) {
        // pisa por delante del sitio ideal, en la dirección en que se mueve
        const ade = Math.min(zancada * 0.55, rapidez * durPaso * 1.6 + (this.vel > s * 0.4 ? zancada * 0.42 : 0));
        const m = this.aMundo(rx + ade, ry);
        p.paso = { x0: p.px, y0: p.py, x1: m.x, y1: m.y, k: 0, dur: durPaso };
        pisando[p.grupo]++;
      }
    }
    if (this.gesto > 0) this.gesto = Math.max(0, this.gesto - dt * 5.5);
  }
  distCadera(p) { const c = this.aMundo(p.cadera.x, p.cadera.y); return Math.hypot(p.px - c.x, p.py - c.y) / this.s; }
  lanzar() { this.gesto = 1; }

  /** Mueve la araña entera (cuerpo y pies plantados) sin que dé pasos: lo usa la cámara 3D. */
  trasladar(dx, dy) {
    if (!dx && !dy) return;
    this.x += dx; this.y += dy;
    for (const p of this.patas) { p.px += dx; p.py += dy; if (p.paso) { p.paso.x0 += dx; p.paso.y0 += dy; p.paso.x1 += dx; p.paso.y1 += dy; } }
  }
  /** Cambia el tamaño conservando la postura (los pies se acercan o alejan del cuerpo): profundidad. */
  escalar(s) {
    const k = s / this.s;
    if (Math.abs(k - 1) < 1e-4) return;
    const ex = (v) => this.x + (v - this.x) * k, ey = (v) => this.y + (v - this.y) * k;
    for (const p of this.patas) { p.px = ex(p.px); p.py = ey(p.py); if (p.paso) { p.paso.x0 = ex(p.paso.x0); p.paso.y0 = ey(p.paso.y0); p.paso.x1 = ex(p.paso.x1); p.paso.y1 = ey(p.paso.y1); } }
    this.s = s;
  }

  /** Posición de la boca (de donde salen los paquetes) */
  frente() { return this.aMundo(1.2, 0); }

  dibujar(ctx, color = COLOR.cian, alfa = 1) {
    const s = this.s, fino = s < 6;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // ----- patas (IK de dos segmentos) -----
    ctx.beginPath();
    const puntas = [];
    for (const p of this.patas) {
      const c = this.aMundo(p.cadera.x, p.cadera.y), a = p.femur * s, b = p.tibia * s;
      let dx = p.px - c.x, dy = p.py - c.y, d = Math.hypot(dx, dy) || 0.001;
      const dMax = (a + b) * 0.995;
      if (d > dMax) { dx *= dMax / d; dy *= dMax / d; d = dMax; }
      // ley de cosenos: ángulo en la cadera entre el fémur y la línea cadera→pie
      const cosA = limitar((a * a + d * d - b * b) / (2 * a * d), -1, 1);
      const ang = Math.atan2(dy, dx) + Math.acos(cosA) * p.codo;
      const kx = c.x + Math.cos(ang) * a, ky = c.y + Math.sin(ang) * a;
      const fx = c.x + dx, fy = c.y + dy;
      ctx.moveTo(c.x, c.y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
      puntas.push(kx, ky, 0, fx, fy, 1 + p.alto);
    }
    if (!fino) { ctx.strokeStyle = COLOR.fondo; ctx.lineWidth = 4; ctx.stroke(); ctx.lineWidth = 1; }
    ctx.strokeStyle = color; ctx.stroke();
    // rodillas y puntas con un punto (la punta levantada se ve más chica)
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < puntas.length; i += 3) {
      const tipo = puntas[i + 2];
      const r = tipo === 0 ? (fino ? 0 : 0.9) : (fino ? 1.1 : 1.9) / (tipo > 1 ? 1 + (tipo - 1) * 0.6 : 1);
      if (r > 0) { ctx.moveTo(puntas[i] + r, puntas[i + 1]); ctx.arc(puntas[i], puntas[i + 1], r, 0, TAU); }
    }
    ctx.fill();

    // ----- cuerpo: abdomen (atrás, con retícula) y cefalotórax (delante) -----
    ctx.translate(this.x, this.y); ctx.rotate(this.rumbo);
    const ax = -0.98 * s, arx = 0.95 * s, ary = 0.74 * s;
    ctx.fillStyle = COLOR.fondo;
    ctx.beginPath(); ctx.ellipse(ax, 0, arx, ary, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!fino) {
      ctx.globalAlpha = alfa * 0.5;
      ctx.beginPath();
      for (const k of [0.36, 0.7]) {
        ctx.moveTo(ax + arx, 0); ctx.ellipse(ax, 0, arx, ary * k, 0, 0, TAU);       // meridianos
        ctx.moveTo(ax, ary); ctx.ellipse(ax, 0, arx * k, ary, 0, Math.PI / 2, Math.PI / 2 + TAU);   // paralelos
      }
      ctx.moveTo(ax - arx, 0); ctx.lineTo(ax + arx, 0);
      ctx.stroke();
      ctx.globalAlpha = alfa;
    }
    ctx.beginPath(); ctx.ellipse(0.35 * s, 0, 0.56 * s, 0.47 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!fino) {
      // pedipalpos y ojos
      ctx.beginPath();
      ctx.moveTo(0.82 * s, -0.2 * s); ctx.lineTo(1.25 * s, -0.3 * s); ctx.lineTo(1.42 * s, -0.12 * s);
      ctx.moveTo(0.82 * s, 0.2 * s); ctx.lineTo(1.25 * s, 0.3 * s); ctx.lineTo(1.42 * s, 0.12 * s);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0.62 * s, -0.14 * s, 1, 0, TAU); ctx.arc(0.62 * s, 0.14 * s, 1, 0, TAU);
      ctx.fill();
    }
    // paquetes en el lomo: cuadritos cian
    if (this.carga > 0) {
      const t = Math.max(3, s * 0.34), n = Math.min(this.carga, 4);
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const col = i % 2, fil = Math.floor(i / 2);
        ctx.fillRect(ax - t * 0.1 + (fil - 0.5) * (t + 2) - t / 2, (col - 0.5) * (t + 2) - t / 2, t, t);
      }
    }
    ctx.restore();
  }
}
