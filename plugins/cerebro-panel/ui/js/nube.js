// nube.js — la nube de puntos de la Biblioteca: un cúmulo por plugin.
// Cada cúmulo es una mezcla de gaussianas alrededor de sus skills (los primeros k puntos
// del cúmulo SON las skills), con líneas tenues entre vecinos. La luz sale de sumar muchos
// puntos pequeños (mezcla aditiva), no de filtros.
//
// Rendimiento: la capa base (puntos y líneas en reposo) se pinta en un canvas aparte cada
// 4 cuadros y se copia al lienzo; lo "caliente" (lo que ilumina la araña) se pinta en vivo.
// Son ~12,700 puntos con la biblioteca del demo (tope 14,000): el polvo de 1 px es barato porque
// no tiembla (solo respira con su cúmulo) y va en un solo relleno por nivel.

import { azar, gauss, semillaDe, TAU, entraSale, limitar, rgba, COLOR } from './util.js';
import { reloj } from './reloj.js';
import { fuente } from './lienzo.js';

const ORO = 2.399963;          // ángulo áureo: reparte las skills dentro del cúmulo
const UNIDAD = 0.80;           // qué fracción del radio de empaque ocupa una desviación "1.0"

export class Nube {
  constructor() {
    this.cumulos = [];
    this.n = 0;
    this.indiceSkill = new Map();    // id de skill -> índice global del punto
    this.rect = null;
    this.mini = false;
    this.anim = 1;                   // 0..1 de la interpolación de acomodo (400 ms)
    this.base = document.createElement('canvas');
    this.bctx = this.base.getContext('2d');
    this.baseRect = { x: 0, y: 0, w: 0, h: 0 };
    this.sucio = true;
    this.tamTexto = 11;
    this.usadas = new Set();
  }

  /** Genera los puntos a partir del evento `biblioteca`. */
  construir(plugins) {
    this.cumulos = []; this.indiceSkill.clear();
    let total = 0;
    const defs = plugins.map((p) => {
      const k = (p.skills || []).length;
      const n = Math.round(300 + 60 * k);
      total += n;
      return { p, k, n };
    });
    // Tope de puntos: si hay muchísimos plugins se adelgazan todos por igual.
    const TOPE = 14000;
    const factor = total > TOPE ? TOPE / total : 1;
    this.n = 0;
    for (const d of defs) { d.n = Math.max(d.k + 40, Math.round(d.n * factor)); this.n += d.n; }
    const N = this.n;
    this.OX = new Float32Array(N); this.OY = new Float32Array(N);
    this.PX = new Float32Array(N); this.PY = new Float32Array(N);
    this.FAS = new Float32Array(N); this.CAL = new Float32Array(N);
    this.NIV = new Uint8Array(N);
    const aristas = [], esqueleto = [];

    let ini = 0;
    for (const { p, k, n } of defs) {
      const rnd = azar(semillaDe(p.nombre));
      // Orden dentro del cúmulo: [skills][estructura: puntos medianos que llevan las líneas][polvo: puntos de 1 px]
      const m = Math.round((n - k) * 0.2);
      const c = {
        nombre: p.nombre, activo: p.activo !== false, skills: p.skills || [], k, n, ini, e: k + m,
        cx: 0, cy: 0, r: 10, ax: 0, ay: 0, ar: 10, mx: 0, my: 0, mr: 10,
        fase: rnd() * TAU, tibio: 0, aIni: 0, aFin: 0, eIni: 0, eFin: 0, tenue: false,
      };
      const giro = rnd() * TAU, estira = 1 + rnd() * 0.4, cg = Math.cos(giro), sg = Math.sin(giro);
      // 1) skills en espiral áurea
      const fase0 = rnd() * TAU;
      for (let j = 0; j < k; j++) {
        const rad = k === 1 ? 0 : 0.6 * Math.sqrt((j + 0.5) / k);
        const ang = j * ORO + fase0;
        this.OX[ini + j] = Math.cos(ang) * rad; this.OY[ini + j] = Math.sin(ang) * rad;
        this.NIV[ini + j] = 3;
        if (p.skills[j]) this.indiceSkill.set(p.skills[j].id, ini + j);
      }
      // 2) estructura: pegada a las skills. 3) polvo: halo gaussiano elíptico (la mayoría) y bruma alrededor de cada skill
      for (let i = k; i < n; i++) {
        const estructura = i < k + m;
        let x, y, guardia = 0;
        do {
          if (k > 0 && rnd() < (estructura ? 0.72 : 0.38)) {
            const j = Math.floor(rnd() * k), sgm = estructura ? 0.1 + rnd() * 0.1 : 0.14 + rnd() * 0.16;
            x = this.OX[ini + j] + gauss(rnd) * sgm; y = this.OY[ini + j] + gauss(rnd) * sgm;
          } else {
            const gx = gauss(rnd) * 0.43 * estira, gy = gauss(rnd) * 0.43 / estira;
            x = gx * cg - gy * sg; y = gx * sg + gy * cg;
          }
        } while (x * x + y * y > (estructura ? 1.2 : 1.9) && ++guardia < 8);
        this.OX[ini + i] = x; this.OY[ini + i] = y;
        // nivel: 0 y 4 = polvo (dos brillos), 1 y 2 = estructura
        this.NIV[ini + i] = estructura ? (rnd() < 0.25 ? 2 : 1) : (rnd() < 0.4 ? 4 : 0);
      }
      for (let i = 0; i < n; i++) this.FAS[ini + i] = rnd() * TAU;
      // 4) líneas finas: cada punto de estructura con sus 2 vecinos más cercanos + algunos tirantes largos
      c.aIni = aristas.length / 2;
      if (c.activo) {
        const visto = new Set(), ne = c.e;
        for (let i = 0; i < ne; i++) {
          let d1 = 9, d2 = 9, j1 = -1, j2 = -1;
          const xi = this.OX[ini + i], yi = this.OY[ini + i];
          for (let j = 0; j < ne; j++) {
            if (j === i) continue;
            const dx = this.OX[ini + j] - xi, dy = this.OY[ini + j] - yi, d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; j2 = j1; d1 = d; j1 = j; } else if (d < d2) { d2 = d; j2 = j; }
          }
          for (const [j, d] of [[j1, d1], [j2, d2]]) {
            if (j < 0 || d > 0.06) continue;
            const a = Math.min(i, j), b = Math.max(i, j), clave = a * 4096 + b;
            if (visto.has(clave)) continue;
            visto.add(clave); aristas.push(ini + a, ini + b);
          }
          if (rnd() < 0.07) {   // tirante largo: da la sensación de malla
            const j = Math.floor(rnd() * ne);
            const dx = this.OX[ini + j] - xi, dy = this.OY[ini + j] - yi, d = dx * dx + dy * dy;
            if (j !== i && d > 0.06 && d < 0.6) aristas.push(ini + i, ini + j);
          }
        }
      }
      c.aFin = aristas.length / 2;
      // 5) esqueleto: cada skill con su skill más cercana
      c.eIni = esqueleto.length / 2;
      for (let i = 0; i < k; i++) {
        let mejor = -1, dm = 9;
        for (let j = 0; j < k; j++) {
          if (j === i) continue;
          const dx = this.OX[ini + j] - this.OX[ini + i], dy = this.OY[ini + j] - this.OY[ini + i], d = dx * dx + dy * dy;
          if (d < dm) { dm = d; mejor = j; }
        }
        if (mejor >= 0) esqueleto.push(ini + i, ini + mejor);
      }
      c.eFin = esqueleto.length / 2;
      this.cumulos.push(c);
      ini += n;
    }
    this.ARI = Int32Array.from(aristas);
    this.ESQ = Int32Array.from(esqueleto);
    this.rect = null; this.sucio = true;
  }

  /** Empaca los cúmulos en un rectángulo (círculos que se repelen). Interpola 400 ms si ya había acomodo. */
  acomodar(rect, mini = false, tamTexto = 11) {
    const primero = !this.rect;
    this.rect = { ...rect }; this.mini = mini; this.tamTexto = tamTexto;
    const cs = this.cumulos; if (!cs.length || rect.w < 8 || rect.h < 8) return;
    const sep = mini ? 2 : 4 + tamTexto * 0.9;         // aire entre cúmulos (cabe el rótulo)
    const W = rect.w, H = rect.h;
    const pesoTotal = cs.reduce((a, c) => a + c.n, 0);
    let dens = mini ? 0.5 : 0.6, pos = null, radios = null;
    const medio = cs.map((c) => (mini ? 0 : (c.nombre.length + (c.activo ? 3 : 9)) * tamTexto * 0.31));   // medio ancho del rótulo
    for (let intento = 0; intento < 10; intento++) {
      const rnd = azar(977);
      const kr = Math.sqrt((dens * W * H) / (Math.PI * pesoTotal));
      radios = cs.map((c) => kr * Math.sqrt(c.n));
      pos = cs.map((c, i) => ({ x: radios[i] + rnd() * Math.max(1, W - 2 * radios[i]), y: radios[i] + rnd() * Math.max(1, H - 2 * radios[i]) }));
      let peor = 0;
      for (let it = 0; it < 420; it++) {
        peor = 0;
        for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
          const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
          const d = Math.hypot(dx, dy) || 0.01, falta = radios[i] + radios[j] + sep - d;
          if (falta > 0) {
            const ux = dx / d, uy = dy / d, m = falta * 0.5;
            pos[i].x -= ux * m; pos[i].y -= uy * m; pos[j].x += ux * m; pos[j].y += uy * m;
            if (falta > peor) peor = falta;
          }
          if (!mini) {
            // rótulos (van bajo cada cúmulo): si dos se pisan, se separan por el eje más corto
            const dyL = (pos[j].y + radios[j] * 0.86) - (pos[i].y + radios[i] * 0.86), dxL = pos[j].x - pos[i].x;
            const fx = medio[i] + medio[j] + 10 - Math.abs(dxL), fy = tamTexto * 1.6 - Math.abs(dyL);
            if (fx > 0 && fy > 0) {
              if (fy < fx) { const m = fy * 0.5 * (dyL < 0 ? -1 : 1); pos[i].y -= m; pos[j].y += m; }
              else { const m = fx * 0.5 * (dxL < 0 ? -1 : 1); pos[i].x -= m; pos[j].x += m; }
              if (Math.min(fx, fy) > peor) peor = Math.min(fx, fy);
            }
          }
        }
        for (let i = 0; i < cs.length; i++) {
          const r = radios[i], p = pos[i];
          const mx = Math.max(r * 0.92, medio[i]);
          p.x = limitar(p.x, mx, Math.max(mx, W - mx));
          p.y = limitar(p.y, r * 0.92, Math.max(r * 0.92, H - r * 0.92 - (mini ? 0 : tamTexto * 1.6)));
        }
      }
      if (peor < 3) break;
      dens *= 0.9;
    }
    cs.forEach((c, i) => {
      c.ax = c.cx; c.ay = c.cy; c.ar = c.r;
      c.mx = rect.x + pos[i].x; c.my = rect.y + pos[i].y; c.mr = radios[i];
      if (primero) { c.cx = c.ax = c.mx; c.cy = c.ay = c.my; c.r = c.ar = c.mr; }
    });
    this.anim = primero ? 1 : 0;
    this.sucio = true;
    this.posicionar(reloj.t);
  }

  /** Calcula la posición en pantalla de todos los puntos (respiración incluida). */
  posicionar(t) {
    const quieto = reloj.quieto;
    for (const c of this.cumulos) {
      const u = c.r * UNIDAD * (quieto ? 1 : 1 + 0.02 * Math.sin(t / 4200 + c.fase));
      const amp = quieto ? 0 : Math.min(1.1, c.r * 0.02), fin = c.ini + c.n, w = t / 2600;
      const finE = c.ini + c.e;
      for (let i = c.ini; i < finE; i++) {
        this.PX[i] = c.cx + this.OX[i] * u + amp * Math.sin(w + this.FAS[i]);
        this.PY[i] = c.cy + this.OY[i] * u + amp * Math.cos(w * 0.9 + this.FAS[i]);
      }
      for (let i = finE; i < fin; i++) { this.PX[i] = c.cx + this.OX[i] * u; this.PY[i] = c.cy + this.OY[i] * u; }
    }
  }

  avanzar(dt, t) {
    if (!this.rect) return;
    if (this.anim < 1) {
      this.anim = Math.min(1, this.anim + dt / 0.4);
      const k = entraSale(this.anim);
      for (const c of this.cumulos) { c.cx = c.ax + (c.mx - c.ax) * k; c.cy = c.ay + (c.my - c.ay) * k; c.r = c.ar + (c.mr - c.ar) * k; }
      this.sucio = true;
    }
    // la respiración es lenta: basta recalcular posiciones cada 4 cuadros (los mismos en que se repinta la base)
    if (this.sucio || reloj.rapido || (reloj.cuadro + 1) % 4 === 0) this.posicionar(t);
    // enfriar lo que calentó la araña
    const f = Math.exp(-dt / 1.5);
    for (const c of this.cumulos) {
      if (c.tibio <= 0.02) continue;
      let max = 0;
      for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) { const v = (this.CAL[i] *= f); if (v > max) max = v; }
      c.tibio = max;
    }
  }

  /** La araña pasa por (x, y): los puntos a menos de `radio` se iluminan. */
  calentar(x, y, radio, fuerza = 1) {
    const r2 = radio * radio;
    for (const c of this.cumulos) {
      if (!c.activo && fuerza < 2) { /* los apagados también se encienden, pero poco */ }
      const dc = Math.hypot(c.cx - x, c.cy - y);
      if (dc > c.r * 1.3 + radio) continue;
      const tope = c.activo ? 1 : 0.35;
      for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) {
        const dx = this.PX[i] - x, dy = this.PY[i] - y, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const k = 1 - Math.sqrt(d2) / radio, v = Math.min(tope, fuerza * k * (2 - k));
        if (v > this.CAL[i]) this.CAL[i] = v;
      }
      c.tibio = Math.max(c.tibio, 0.5);
    }
  }

  posSkill(id) {
    const i = this.indiceSkill.get(id);
    return i == null ? null : { x: this.PX[i], y: this.PY[i], i };
  }
  cumuloDe(i) { return this.cumulos.find((c) => i >= c.ini && i < c.ini + c.n); }
  /** Rectángulo aproximado del rótulo de un cúmulo (para que las etiquetas de skills lo esquiven). */
  rectRotulo(c) {
    const px = this.tamTexto, w = (c.nombre.length + (c.activo ? 3 : 9)) * px * 0.61;
    return { x: c.cx - w / 2, y: c.cy + c.r * 0.86 + 4, w, h: px * 1.35 };
  }
  /** Atenúa los rótulos de los cúmulos indicados (mientras una etiqueta de skill los pisa). */
  atenuar(nombres) {
    let cambio = false;
    for (const c of this.cumulos) { const v = nombres.has(c.nombre); if (v !== c.tenue) { c.tenue = v; cambio = true; } }
    if (cambio) this.sucio = true;
  }
  marcarUsadas(conjunto) { this.usadas = conjunto; this.sucio = true; }

  // ---------- dibujo ----------
  dibujar(ctx, dpr) {
    if (!this.rect || !this.cumulos.length) return;
    if (this.sucio || reloj.cuadro % 4 === 0) { this.pintarBase(dpr); this.sucio = false; }
    const b = this.baseRect;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.base, b.x, b.y, b.w, b.h);
    this.pintarCalor(ctx);
    ctx.globalCompositeOperation = 'source-over';
  }

  pintarBase(dpr) {
    // El canvas base cubre el rectángulo de los cúmulos con margen.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cumulos) {
      const m = c.r * 1.25 + 24;
      x0 = Math.min(x0, c.cx - m); y0 = Math.min(y0, c.cy - m); x1 = Math.max(x1, c.cx + m); y1 = Math.max(y1, c.cy + m);
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(innerWidth, Math.ceil(x1)); y1 = Math.min(innerHeight, Math.ceil(y1));
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.base.width !== pw || this.base.height !== ph) { this.base.width = pw; this.base.height = ph; }
    this.baseRect = { x: x0, y: y0, w, h };
    const g = this.bctx, PX = this.PX, PY = this.PY, NIV = this.NIV;
    g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(x0, y0, w, h);
    g.globalCompositeOperation = 'lighter';
    const mini = this.mini;

    // Líneas entre vecinos (solo plugins encendidos)
    if (!mini) {
      g.lineWidth = 1;
      g.beginPath();
      for (const c of this.cumulos) {
        if (!c.activo) continue;
        for (let e = c.aIni; e < c.aFin; e++) { const a = this.ARI[e * 2], b = this.ARI[e * 2 + 1]; g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); }
      }
      g.strokeStyle = rgba('cian', 0.075); g.stroke();
      g.beginPath();
      for (const c of this.cumulos) {
        if (!c.activo) continue;
        for (let e = c.eIni; e < c.eFin; e++) { const a = this.ESQ[e * 2], b = this.ESQ[e * 2 + 1]; g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); }
      }
      g.strokeStyle = rgba('cian', 0.14); g.stroke();
    }

    // Puntos por nivel (un solo relleno por nivel). Polvo: 1 px en dos brillos. Estructura: algo mayores.
    const niveles = mini
      ? [[0, rgba('cianTenue', 0.55), 1], [4, rgba('cianTenue', 0.9), 1], [1, rgba('cian', 0.3), 1], [2, rgba('cian', 0.55), 1]]
      : [[0, rgba('cianTenue', 0.6), 1], [4, rgba('cianTenue', 1), 1.1], [1, rgba('cian', 0.34), 1.3], [2, rgba('cian', 0.7), 1.6]];
    for (const [niv, color, tam] of niveles) {
      g.beginPath();
      for (const c of this.cumulos) {
        if (!c.activo) continue;
        for (let i = c.ini + c.k, fin = c.ini + c.n; i < fin; i++) if (NIV[i] === niv) g.rect(PX[i] - tam / 2, PY[i] - tam / 2, tam, tam);
      }
      g.fillStyle = color; g.fill();
    }
    // Plugins apagados: solo polvo gris tintado, sin líneas
    g.beginPath();
    for (const c of this.cumulos) {
      if (c.activo) continue;
      for (let i = c.ini + c.k, fin = c.ini + c.n; i < fin; i++) g.rect(PX[i] - 0.5, PY[i] - 0.5, 1, 1);
    }
    g.fillStyle = rgba('tinta3', mini ? 0.5 : 0.85); g.fill();

    // Skills: punto más brillante
    g.globalCompositeOperation = 'source-over';
    for (const activo of [true, false]) {
      g.beginPath();
      for (const c of this.cumulos) {
        if (c.activo !== activo) continue;
        const rp = mini ? 1 : activo ? 1.9 : 1.5;
        for (let i = c.ini, fin = c.ini + c.k; i < fin; i++) { g.moveTo(PX[i] + rp, PY[i]); g.arc(PX[i], PY[i], rp, 0, TAU); }
      }
      g.fillStyle = activo ? COLOR.cian : COLOR.tinta3; g.fill();
    }
    if (!mini && this.usadas.size) {
      g.beginPath();
      for (const id of this.usadas) { const i = this.indiceSkill.get(id); if (i != null) { g.moveTo(PX[i] + 5.5, PY[i]); g.arc(PX[i], PY[i], 5.5, 0, TAU); } }
      g.strokeStyle = COLOR.cian; g.lineWidth = 1; g.stroke();
    }

    // Rótulos flotantes: nombre del plugin y cuántas skills
    if (!mini) {
      const px = this.tamTexto;
      g.textBaseline = 'top';
      for (const c of this.cumulos) {
        const y = Math.round(c.cy + c.r * 0.86 + 5);
        g.font = fuente(px, 500);
        const wn = g.measureText(c.nombre).width;
        g.font = fuente(px * 0.92, 400);
        const cola = c.activo ? String(c.k) : 'apagado';
        const wc = g.measureText(cola).width;
        const x = Math.round(c.cx - (wn + 7 + wc) / 2);
        g.globalAlpha = c.tenue ? 0.22 : 1;
        g.font = fuente(px, 500);
        g.fillStyle = c.activo ? COLOR.tinta2 : COLOR.tinta3;
        g.fillText(c.nombre, x, y);
        g.font = fuente(px * 0.92, 400);
        g.fillStyle = COLOR.tinta3;
        g.fillText(cola, x + wn + 7, y + px * 0.06);
        g.globalAlpha = 1;
      }
    }
  }

  /** Lo que la araña iluminó: puntos y líneas en vivo, por tramos de calor. */
  pintarCalor(ctx) {
    const PX = this.PX, PY = this.PY, CAL = this.CAL;
    const tramos = [[0.05, 0.4, rgba('cian', 0.2), 1.2], [0.4, 0.8, rgba('cian', 0.42), 1.5], [0.8, 9, rgba('cian', 0.75), 1.8]];
    let hay = false;
    for (const c of this.cumulos) if (c.tibio > 0.04) { hay = true; break; }
    if (!hay) return;
    if (!this.mini) {
      ctx.beginPath();
      for (const c of this.cumulos) {
        if (c.tibio <= 0.15 || !c.activo) continue;
        for (let e = c.aIni; e < c.aFin; e++) {
          const a = this.ARI[e * 2], b = this.ARI[e * 2 + 1];
          if (CAL[a] > 0.18 && CAL[b] > 0.18) { ctx.moveTo(PX[a], PY[a]); ctx.lineTo(PX[b], PY[b]); }
        }
      }
      ctx.strokeStyle = rgba('cian', 0.22); ctx.lineWidth = 1; ctx.stroke();
    }
    for (const [a, b, color, tam] of tramos) {
      ctx.beginPath();
      for (const c of this.cumulos) {
        if (c.tibio <= a) continue;
        for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) { const v = CAL[i]; if (v > a && v <= b) ctx.rect(PX[i] - tam / 2, PY[i] - tam / 2, tam, tam); }
      }
      ctx.fillStyle = color; ctx.fill();
    }
  }
}
