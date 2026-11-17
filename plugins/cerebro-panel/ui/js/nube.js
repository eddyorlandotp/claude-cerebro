// nube.js — la Biblioteca en 3D: un cúmulo VOLUMÉTRICO de puntos por plugin (x, y, z con
// caída gaussiana en las tres), repartidos en un espacio con profundidad y vistos con una
// cámara en perspectiva que orbita despacio. Todo se proyecta a mano en el canvas 2D.
//
// Coordenadas:
//   mundo    px alrededor del origen (0,0,0) = centro del volumen de cúmulos.
//   cámara   p_c = M · (p − foco). z_c > 0 = lejos. M es la rotación de la órbita.
//   pantalla (ox, oy) + (x_c, y_c) · e,  con  e = zoom · D / (D + z_c)   (perspectiva).
// El volumen es un cilindro acostado sobre el lado LARGO de la zona y la cámara gira alrededor
// de ese eje: así los cúmulos llenan la zona en cualquier momento del giro, sea alta o ancha.
//
// Cada cúmulo tiene el tono de su plugin (tonos.js). Lo lejano es más chico y tenue.
// Rendimiento: todo se pinta directo en el lienzo cada cuadro (un relleno por nivel y por cúmulo).
// Si el costo por cuadro sube, se dibuja menos polvo (this.paso) antes que perder cuadros.

import { azar, gauss, semillaDe, TAU, entraSale, limitar, rgba, COLOR } from './util.js';
import { reloj } from './reloj.js';
import { fuente, lienzo } from './lienzo.js';
import { tonoPlugin, rgbaT } from './tonos.js';

const ORO = 2.399963;          // ángulo áureo
const UNIDAD = 0.8;            // fracción del radio del cúmulo que ocupa una desviación "1.0"
const VUELTA = 150;            // segundos por giro completo de la cámara

export class Nube {
  constructor() {
    this.cumulos = [];
    this.n = 0;
    this.indiceSkill = new Map();    // id de skill -> índice global del punto
    this.rect = null;
    this.mini = false;
    this.anim = 1;                   // 0..1 de la interpolación de acomodo (400 ms)
    this.sucio = true;
    this.tamTexto = 11;
    this.usadas = new Set();
    this.R = 100; this.D = 420; this.eje = 'y'; this.ox = 0; this.oy = 0;
    // cámara: giro (órbita), cabeceo, zoom y foco (punto del mundo que queda al centro de la zona)
    this.cam = { giro: 0.7, cabeceo: 0, fija: false, zoom: 1, z0: 1, z1: 1, f: [0, 0, 0], f0: [0, 0, 0], f1: [0, 0, 0], k: 1, dur: 0.6, enfocada: false };
    this.m = new Float64Array(9);    // matriz de rotación mundo → cámara
    this.ondas = [];                 // ondas que recorren la biblioteca al llegar un mensaje
    this.paso = 1;                   // 1 = todo el polvo; 2, 3… = uno de cada N (degradación por carga)
    this.grano = 1;                  // tamaño relativo de los puntos según el tamaño de la zona
    this.racha = 0;                  // revisiones seguidas con el equipo lento (+) u holgado (−)
    this.ultimoAjuste = 0;
    this.rotulos = [];               // [{ c, rect }] rótulos visibles, para que las etiquetas los esquiven
    this.medida = { base: 0, calor: 0, n: 0 };      // ms acumulados por parte (para afinar rendimiento)
  }

  /** Genera los puntos (en unidades del cúmulo, alrededor de su centro) a partir del evento `biblioteca`. */
  construir(plugins) {
    this.cumulos = []; this.indiceSkill.clear();
    let total = 0;
    const defs = plugins.map((p) => { const k = (p.skills || []).length, n = Math.round(300 + 60 * k); total += n; return { p, k, n }; });
    const TOPE = 14000, factor = total > TOPE ? TOPE / total : 1;
    this.n = 0;
    for (const d of defs) { d.n = Math.max(d.k + 40, Math.round(d.n * factor)); this.n += d.n; }
    const N = this.n;
    this.OX = new Float32Array(N); this.OY = new Float32Array(N); this.OZ = new Float32Array(N);
    this.PX = new Float32Array(N); this.PY = new Float32Array(N);
    this.CAL = new Float32Array(N);
    this.NIV = new Uint8Array(N);
    const aristas = [], esqueleto = [];
    const { OX, OY, OZ } = this;

    let ini = 0;
    for (const { p, k, n } of defs) {
      const rnd = azar(semillaDe(p.nombre));
      // Orden dentro del cúmulo: [skills][estructura: puntos medianos que llevan las líneas][polvo de 1 px]
      const m = Math.round((n - k) * 0.18);
      const activo = p.activo !== false;
      const c = {
        nombre: p.nombre, activo, skills: p.skills || [], k, n, ini, e: k + m, tono: tonoPlugin(p.nombre, activo),
        x: 0, y: 0, z: 0, r: 10, ax: 0, ay: 0, az: 0, ar: 10, mx: 0, my: 0, mz: 0, mr: 10,
        sx: 0, sy: 0, se: 1, sz: 0, cerca: 0.5, visible: true,
        fase: rnd() * TAU, tibio: 0, aIni: 0, aFin: 0, eIni: 0, eFin: 0, tenue: false, rot: null, rotAlfa: 1, rotLado: 1,
      };
      // 1) skills repartidas en una esfera (espiral de Fibonacci), a distintos radios
      const fase0 = rnd() * TAU;
      for (let j = 0; j < k; j++) {
        const v = 1 - (2 * (j + 0.5)) / k, rr = Math.sqrt(Math.max(0, 1 - v * v)), fi = j * ORO + fase0;
        const rad = k === 1 ? 0 : 0.3 + 0.36 * ((j * 0.618 + 0.3) % 1);
        OX[ini + j] = Math.cos(fi) * rr * rad; OY[ini + j] = v * rad; OZ[ini + j] = Math.sin(fi) * rr * rad;
        this.NIV[ini + j] = 3;
        if (p.skills[j]) this.indiceSkill.set(p.skills[j].id, ini + j);
      }
      // 2) estructura (pegada a las skills) y 3) polvo: halo gaussiano elipsoidal + bruma alrededor de cada skill
      const sx = 0.43 * (0.82 + rnd() * 0.42), sy = 0.43 * (0.82 + rnd() * 0.42), sz = 0.43 * (0.82 + rnd() * 0.42);
      for (let i = k; i < n; i++) {
        const estructura = i < k + m;
        let x, y, z, guardia = 0;
        do {
          if (k > 0 && rnd() < (estructura ? 0.75 : 0.36)) {
            const j = ini + Math.floor(rnd() * k), s = estructura ? 0.1 + rnd() * 0.1 : 0.14 + rnd() * 0.16;
            x = OX[j] + gauss(rnd) * s; y = OY[j] + gauss(rnd) * s; z = OZ[j] + gauss(rnd) * s;
          } else { x = gauss(rnd) * sx; y = gauss(rnd) * sy; z = gauss(rnd) * sz; }
        } while (x * x + y * y + z * z > (estructura ? 1.25 : 2.1) && ++guardia < 8);
        OX[ini + i] = x; OY[ini + i] = y; OZ[ini + i] = z;
        // nivel: 0 y 4 = polvo (dos brillos), 1 y 2 = estructura
        this.NIV[ini + i] = estructura ? (rnd() < 0.25 ? 2 : 1) : (rnd() < 0.4 ? 4 : 0);
      }
      // 4) líneas finas entre puntos de estructura vecinos (en 3D) + algunos tirantes largos
      c.aIni = aristas.length / 2;
      if (activo) {
        const visto = new Set(), ne = c.e;
        for (let i = 0; i < ne; i++) {
          let d1 = 9, d2 = 9, j1 = -1, j2 = -1;
          const xi = OX[ini + i], yi = OY[ini + i], zi = OZ[ini + i];
          for (let j = 0; j < ne; j++) {
            if (j === i) continue;
            const dx = OX[ini + j] - xi, dy = OY[ini + j] - yi, dz = OZ[ini + j] - zi, d = dx * dx + dy * dy + dz * dz;
            if (d < d1) { d2 = d1; j2 = j1; d1 = d; j1 = j; } else if (d < d2) { d2 = d; j2 = j; }
          }
          for (const [j, d] of [[j1, d1], [j2, d2]]) {
            if (j < 0 || d > 0.09) continue;
            const a = Math.min(i, j), b = Math.max(i, j), clave = a * 4096 + b;
            if (visto.has(clave)) continue;
            visto.add(clave); aristas.push(ini + a, ini + b);
          }
          if (rnd() < 0.06) { const j = Math.floor(rnd() * ne); if (j !== i) aristas.push(ini + i, ini + j); }
        }
      }
      c.aFin = aristas.length / 2;
      // 5) esqueleto: cada skill con su skill más cercana
      c.eIni = esqueleto.length / 2;
      for (let i = 0; i < k; i++) {
        let mejor = -1, dm = 9;
        for (let j = 0; j < k; j++) {
          if (j === i) continue;
          const dx = OX[ini + j] - OX[ini + i], dy = OY[ini + j] - OY[ini + i], dz = OZ[ini + j] - OZ[ini + i], d = dx * dx + dy * dy + dz * dz;
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

  /** Reparte los cúmulos en un cilindro acostado sobre el lado largo de la zona. Interpola 400 ms si ya había acomodo. */
  acomodar(rect, mini = false, tamTexto = 11) {
    const primero = !this.rect;
    this.rect = { ...rect }; this.mini = mini; this.tamTexto = tamTexto;
    this.ox = rect.x + rect.w / 2; this.oy = rect.y + rect.h / 2 - (mini ? 0 : tamTexto * 0.5);
    const cs = this.cumulos; if (!cs.length || rect.w < 8 || rect.h < 8) return;
    const W = rect.w, H = rect.h;
    this.eje = W > H * 1.1 ? 'x' : 'y';
    const largo = this.eje === 'x' ? W : H, corto = this.eje === 'x' ? H : W;
    // radio de cada cúmulo: su disco proyectado ocupa un área proporcional a n^0.8
    const pesos = cs.map((c) => Math.pow(c.n, 0.8)), suma = pesos.reduce((a, b) => a + b, 0);
    const dens = mini ? 0.5 : 0.56;
    const radios = pesos.map((p) => Math.sqrt((dens * W * H * p) / suma / Math.PI));
    const rmax = Math.max(...radios);
    const R = Math.max(12, corto / 2 - rmax * 0.95 - (mini ? 2 : tamTexto * 1.3));
    const Lh = Math.max(12, (largo / 2 - rmax * 0.9) / 1.1);
    this.R = R; this.D = Math.max(R, corto * 0.3) * 4.4;
    this.grano = mini ? 1 : limitar(Math.pow(Math.min(W, H) / 480, 0.75), 1, 2.1);
    // posiciones iniciales en hélice (reparto parejo a lo largo del eje y alrededor de él) y relajación en 3D
    const rnd = azar(977), N = cs.length;
    const orden = cs.map((_, i) => i).sort(() => rnd() - 0.5);
    const pos = new Array(N);
    orden.forEach((ci, i) => {
      const a = -Lh + ((i + 0.5) / N) * 2 * Lh, ang = i * ORO + 1.1, rad = R * (0.45 + 0.55 * rnd());
      pos[ci] = { a, u: Math.cos(ang) * rad, v: Math.sin(ang) * rad };
    });
    const sep = mini ? 1 : 6;
    for (let it = 0; it < 240; it++) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const da = pos[j].a - pos[i].a, du = pos[j].u - pos[i].u, dv = pos[j].v - pos[i].v;
        const d = Math.hypot(da, du, dv) || 0.01, falta = (radios[i] + radios[j]) * 0.92 + sep - d;
        if (falta > 0) {
          const k = (falta * 0.5) / d;
          pos[i].a -= da * k; pos[i].u -= du * k; pos[i].v -= dv * k; pos[j].a += da * k; pos[j].u += du * k; pos[j].v += dv * k;
        }
      }
      for (const p of pos) {
        p.a = limitar(p.a, -Lh, Lh);
        const rr = Math.hypot(p.u, p.v);
        if (rr > R) { p.u *= R / rr; p.v *= R / rr; }
      }
    }
    cs.forEach((c, i) => {
      c.ax = c.x; c.ay = c.y; c.az = c.z; c.ar = c.r;
      const p = pos[i];
      if (this.eje === 'x') { c.mx = p.a; c.my = p.u; c.mz = p.v; } else { c.mx = p.u; c.my = p.a; c.mz = p.v; }
      c.mr = radios[i];
      if (primero) { c.x = c.ax = c.mx; c.y = c.ay = c.my; c.z = c.az = c.mz; c.r = c.ar = c.mr; }
    });
    this.anim = primero ? 1 : 0;
    this.sucio = true;
    this.matriz();
    this.proyectarTodo(reloj.t);
  }

  // ---------- cámara ----------
  matriz() {
    const g = this.cam.giro, c = this.cam.cabeceo, cg = Math.cos(g), sg = Math.sin(g), cc = Math.cos(c), sc = Math.sin(c), m = this.m;
    if (this.eje === 'y') {
      // giro alrededor de Y (tornamesa) y luego cabeceo alrededor de X
      m[0] = cg; m[1] = 0; m[2] = sg;
      m[3] = sc * sg; m[4] = cc; m[5] = -sc * cg;
      m[6] = -cc * sg; m[7] = sc; m[8] = cc * cg;
    } else {
      // zona ancha: giro alrededor de X (rodillo) y luego cabeceo alrededor de Y
      m[0] = cc; m[1] = sc * sg; m[2] = sc * cg;
      m[3] = 0; m[4] = cg; m[5] = -sg;
      m[6] = -sc; m[7] = cc * sg; m[8] = cc * cg;
    }
  }
  /** Mundo → pantalla. Devuelve { x, y, e (escala), z (profundidad de cámara) }. */
  proyectar(x, y, z) {
    const m = this.m, f = this.cam.f, dx = x - f[0], dy = y - f[1], dz = z - f[2];
    const zc = m[6] * dx + m[7] * dy + m[8] * dz;
    const e = (this.cam.zoom * this.D) / Math.max(this.D * 0.25, this.D + zc);
    return { x: this.ox + (m[0] * dx + m[1] * dy + m[2] * dz) * e, y: this.oy + (m[3] * dx + m[4] * dy + m[5] * dz) * e, e, z: zc };
  }
  /** Pantalla + profundidad de cámara → mundo (la inversa de proyectar). */
  desproyectar(sx, sy, zc) {
    const m = this.m, f = this.cam.f, e = (this.cam.zoom * this.D) / Math.max(this.D * 0.25, this.D + zc);
    const xc = (sx - this.ox) / e, yc = (sy - this.oy) / e;
    return { x: f[0] + m[0] * xc + m[3] * yc + m[6] * zc, y: f[1] + m[1] * xc + m[4] * yc + m[7] * zc, z: f[2] + m[2] * xc + m[5] * yc + m[8] * zc };
  }
  /** Vector del mundo que en pantalla apunta hacia arriba y un poco hacia la cámara (para el arco de los saltos). */
  arriba() { const m = this.m; return { x: -m[3] - 0.5 * m[6], y: -m[4] - 0.5 * m[7], z: -m[5] - 0.5 * m[8] }; }
  /** La cámara se acerca y deja el punto p al centro (500–700 ms). Con movimiento reducido o cámara fija no hace nada. */
  enfocar(p, zoom = 1.6) {
    const c = this.cam;
    if (c.fija || reloj.quieto || this.mini) return;
    c.z0 = c.zoom; c.f0 = c.f.slice(); c.z1 = zoom; c.f1 = [p.x, p.y, p.z]; c.k = 0; c.dur = 0.62; c.enfocada = true;
  }
  /** Mientras está enfocada, el foco sigue a este punto (la araña que se mueve). */
  seguir(p) { const c = this.cam; if (!c.enfocada) return; c.f1[0] += (p.x - c.f1[0]) * 0.18; c.f1[1] += (p.y - c.f1[1]) * 0.18; c.f1[2] += (p.z - c.f1[2]) * 0.18; }
  /** Regresa a la órbita. */
  soltar() { const c = this.cam; if (!c.enfocada) return; c.z0 = c.zoom; c.f0 = c.f.slice(); c.z1 = 1; c.f1 = [0, 0, 0]; c.k = 0; c.dur = 0.7; c.enfocada = false; }

  avanzar(dt, t) {
    if (!this.rect) return;
    const c = this.cam;
    if (!c.fija && !reloj.quieto) {
      c.giro += (TAU / VUELTA) * dt * (c.zoom > 1.05 ? 0.3 : 1);
      c.cabeceo = 0.1 * Math.sin(t / 8200);
    }
    if (c.k < 1) {
      c.k = Math.min(1, c.k + dt / c.dur);
      const e = entraSale(c.k);
      c.zoom = c.z0 + (c.z1 - c.z0) * e;
      for (let i = 0; i < 3; i++) c.f[i] = c.f0[i] + (c.f1[i] - c.f0[i]) * e;
    } else { c.zoom = c.z1; c.f[0] = c.f1[0]; c.f[1] = c.f1[1]; c.f[2] = c.f1[2]; }
    this.matriz();
    if (this.anim < 1) {
      this.anim = Math.min(1, this.anim + dt / 0.4);
      const k = entraSale(this.anim);
      for (const q of this.cumulos) { q.x = q.ax + (q.mx - q.ax) * k; q.y = q.ay + (q.my - q.ay) * k; q.z = q.az + (q.mz - q.az) * k; q.r = q.ar + (q.mr - q.ar) * k; }
      this.sucio = true;
    }
    if (reloj.rapido) { this.proyectarTodo(t); return; }
    // ondas: un anillo que crece en pantalla y enciende lo que toca
    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i]; o.r += o.vel * dt;      // se dibuja en pintarCalor: un frente nítido que viaja, sin dejar todo encendido
      if (o.r > o.max) this.ondas.splice(i, 1);
    }
    // enfriar lo que se calentó
    const f = Math.exp(-dt / 1.5), CAL = this.CAL;
    for (const q of this.cumulos) {
      if (q.tibio <= 0.02) continue;
      let max = 0;
      for (let i = q.ini, fin = q.ini + q.n; i < fin; i++) { const v = (CAL[i] *= f); if (v > max) max = v; }
      q.tibio = max;
    }
  }

  /** Proyecta centros y puntos de todos los cúmulos (lo usa la capa base y el calor). */
  proyectarTodo(t) {
    const m = this.m, f = this.cam.f, zoom = this.cam.zoom, D = this.D, ox = this.ox, oy = this.oy;
    const { OX, OY, OZ, PX, PY } = this, r = this.rect, quieto = reloj.quieto;
    for (const c of this.cumulos) {
      const dx = c.x - f[0], dy = c.y - f[1], dz = c.z - f[2];
      const cx = m[0] * dx + m[1] * dy + m[2] * dz, cy = m[3] * dx + m[4] * dy + m[5] * dz, cz = m[6] * dx + m[7] * dy + m[8] * dz;
      const e = (zoom * D) / Math.max(D * 0.25, D + cz);
      c.sx = ox + cx * e; c.sy = oy + cy * e; c.se = e; c.sz = cz;
      c.cerca = limitar(0.5 - cz / (2.2 * this.R), 0, 1);       // 1 = lo más cercano, 0 = lo más lejano
      const rs = c.r * e * 1.5;
      c.visible = c.sx + rs > r.x && c.sx - rs < r.x + r.w && c.sy + rs > r.y && c.sy - rs < r.y + r.h && D + cz > D * 0.3;
      if (!c.visible) continue;
      const u = c.r * UNIDAD * (quieto ? 1 : 1 + 0.02 * Math.sin(t / 4200 + c.fase));
      const zD = zoom * D;
      for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) {
        const a = OX[i], b = OY[i], g = OZ[i];
        const pe = zD / (D + cz + u * (m[6] * a + m[7] * b + m[8] * g));
        PX[i] = ox + (cx + u * (m[0] * a + m[1] * b + m[2] * g)) * pe;
        PY[i] = oy + (cy + u * (m[3] * a + m[4] * b + m[5] * g)) * pe;
      }
    }
  }

  // ---------- calor (lo que se enciende) ----------
  /** La araña pasa por (x, y) en pantalla: los puntos a menos de `radio` se iluminan. */
  calentar(x, y, radio, fuerza = 1) {
    const r2 = radio * radio, { PX, PY, CAL } = this;
    for (const c of this.cumulos) {
      if (!c.visible || Math.hypot(c.sx - x, c.sy - y) > c.r * c.se * 1.4 + radio) continue;
      const tope = c.activo ? 1 : 0.35;
      for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) {
        const dx = PX[i] - x, dy = PY[i] - y, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const k = 1 - Math.sqrt(d2) / radio, v = Math.min(tope, fuerza * k * (2 - k));
        if (v > CAL[i]) CAL[i] = v;
      }
      c.tibio = Math.max(c.tibio, 0.5);
    }
  }
  /** Enciende lo que cae en un anillo de radio r (± ancho) alrededor de (x, y). */
  anillo(x, y, r, ancho, fuerza) {
    const { PX, PY, CAL } = this;
    for (const c of this.cumulos) {
      if (!c.visible) continue;
      const dc = Math.hypot(c.sx - x, c.sy - y), rc = c.r * c.se * 1.4;
      if (dc + rc < r - ancho || dc - rc > r + ancho) continue;
      const tope = c.activo ? fuerza : fuerza * 0.4;
      for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) {
        const d = Math.abs(Math.hypot(PX[i] - x, PY[i] - y) - r);
        if (d < ancho) { const v = tope * (1 - d / ancho); if (v > CAL[i]) CAL[i] = v; }
      }
      c.tibio = Math.max(c.tibio, 0.5);
    }
  }
  /** Una onda sale de (x, y) y recorre toda la zona. */
  onda(x, y) {
    if (!this.rect || reloj.quieto || this.mini) return;
    const max = Math.hypot(this.rect.w, this.rect.h);
    this.ondas.push({ x, y, r: 8, vel: max / 1.1, max, ancho: 48 });
  }
  /** Enciende un cúmulo entero un instante. */
  encender(c, fuerza = 1) { for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) if (fuerza > this.CAL[i]) this.CAL[i] = fuerza * (0.55 + 0.45 * ((i * 7) % 10) / 10); c.tibio = 1; }

  // ---------- consultas ----------
  /** Posición de una skill en el MUNDO: { x, y, z, i, c }. */
  posSkill(id) {
    const i = this.indiceSkill.get(id);
    if (i == null) return null;
    const c = this.cumuloDe(i), u = c.r * UNIDAD;
    return { x: c.x + this.OX[i] * u, y: c.y + this.OY[i] * u, z: c.z + this.OZ[i] * u, i, c };
  }
  /** Posición de una skill en PANTALLA ahora mismo: { x, y, e, z, i, c }. */
  pantallaSkill(id) { const p = this.posSkill(id); if (!p) return null; const s = this.proyectar(p.x, p.y, p.z); s.i = p.i; s.c = p.c; return s; }
  cumuloDe(i) { return this.cumulos.find((c) => i >= c.ini && i < c.ini + c.n); }
  marcarUsadas(conjunto) { this.usadas = conjunto; this.sucio = true; }
  /** Atenúa los rótulos de los cúmulos indicados (mientras una etiqueta de skill los pisa). */
  atenuar(nombres) {
    let cambio = false;
    for (const c of this.cumulos) { const v = nombres.has(c.nombre); if (v !== c.tenue) { c.tenue = v; cambio = true; } }
    if (cambio) this.sucio = true;
  }

  // ---------- dibujo ----------
  dibujar(ctx, dpr) {
    if (!this.rect || !this.cumulos.length) return;
    // degradar puntos antes que cuadros: si el costo por cuadro sube, se dibuja menos polvo
    if (reloj.t - this.ultimoAjuste > 1200) {
      this.ultimoAjuste = reloj.t;
      // dos señales: el costo de simular+dibujar (ms) y el intervalo real entre cuadros (si el equipo no alcanza
      // a rasterizar, el intervalo sube aunque el costo medido sea bajo). Debe sostenerse ~4 s para actuar.
      const lento = lienzo.carga > 5.4 || lienzo.intervalo > 24, holgado = lienzo.carga < 3 && lienzo.intervalo < 20;
      this.racha = reloj.pausado ? 0 : lento ? Math.max(1, this.racha + 1) : holgado ? Math.min(-1, this.racha - 1) : 0;
      if (this.racha >= 3 && this.paso < 4) { this.paso += 1; this.racha = 0; } else if (this.racha <= -3 && this.paso > 1) { this.paso -= 1; this.racha = 0; }
    }
    // Se pinta directo en el lienzo, cada cuadro: 12 mil rectángulos de 1 px salen más baratos que
    // componer en aditivo un canvas aparte del tamaño de la zona (medido: 3–4 ms solo la copia).
    const m = this.medida, t0 = performance.now(), r = this.rect;
    this.proyectarTodo(reloj.t);
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    this.pintarBase(ctx);
    ctx.restore();
    const t1 = performance.now();
    this.pintarCalor(ctx);
    m.base += t1 - t0; m.calor += performance.now() - t1; m.n += 1;
    this.sucio = false;
    ctx.globalCompositeOperation = 'source-over';
  }

  pintarBase(g) {
    const { PX, PY, NIV } = this, mini = this.mini, paso = mini ? Math.max(2, this.paso) : this.paso;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
    // en zonas grandes los cúmulos son más grandes: los puntos crecen con la zona para que la nube no se vea rala
    const crece = Math.sqrt(this.cam.zoom) * this.grano;
    g.lineWidth = 1;

    for (const c of this.cumulos) {
      if (!c.visible) continue;
      const k = c.cerca, tono = c.tono;
      const ini = c.ini, finE = ini + c.e, fin = ini + c.n;
      if (c.activo && !mini) {
        // líneas finas entre vecinos y esqueleto entre skills
        g.beginPath();
        for (let e = c.aIni; e < c.aFin; e++) { const a = this.ARI[e * 2], b = this.ARI[e * 2 + 1]; g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); }
        g.strokeStyle = rgbaT(tono, 0.035 + 0.06 * k); g.stroke();
        g.beginPath();
        for (let e = c.eIni; e < c.eFin; e++) { const a = this.ESQ[e * 2], b = this.ESQ[e * 2 + 1]; g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); }
        g.strokeStyle = rgbaT(tono, 0.07 + 0.12 * k); g.stroke();
      }
      // polvo (1 px, dos brillos): lo lejano más chico y tenue
      const tp = (mini ? 1 : 0.8 + 0.55 * k) * crece, mp = tp / 2;
      // Un solo trazado y un relleno por nivel (probado: un fillRect por punto baja los cuadros por segundo).
      if (c.activo) {
        g.beginPath();
        for (let i = finE; i < fin; i += paso) if (NIV[i] === 0) g.rect(PX[i] - mp, PY[i] - mp, tp, tp);
        g.fillStyle = rgbaT(tono, 0.2 + 0.26 * k); g.fill();
        g.beginPath();
        for (let i = finE; i < fin; i++) if (NIV[i] === 4) g.rect(PX[i] - mp, PY[i] - mp, tp, tp);
        g.fillStyle = rgbaT(tono, 0.36 + 0.4 * k); g.fill();
        // estructura
        const te = (mini ? 1 : 1 + 0.6 * k) * crece, me = te / 2;
        g.beginPath();
        for (let i = ini + c.k; i < finE; i++) g.rect(PX[i] - me, PY[i] - me, te, te);
        g.fillStyle = rgbaT(tono, 0.3 + 0.4 * k); g.fill();
      } else {
        // plugin apagado: solo polvo gris tintado, sin líneas
        g.beginPath();
        for (let i = ini + c.k; i < fin; i += paso) g.rect(PX[i] - mp, PY[i] - mp, tp, tp);
        g.fillStyle = rgba('tinta3', (mini ? 0.45 : 0.5 + 0.35 * k)); g.fill();
      }
    }
    // skills: nodos brillantes (encima, sin sumar)
    g.globalCompositeOperation = 'source-over';
    for (const c of this.cumulos) {
      if (!c.visible) continue;
      const rp = (mini ? 1 : c.activo ? 1.3 + 1 * c.cerca : 1.1 + 0.6 * c.cerca) * crece;
      g.beginPath();
      for (let i = c.ini, fin = c.ini + c.k; i < fin; i++) { g.moveTo(PX[i] + rp, PY[i]); g.arc(PX[i], PY[i], rp, 0, TAU); }
      g.globalAlpha = 0.55 + 0.45 * c.cerca;
      g.fillStyle = c.activo ? c.tono.hex : COLOR.tinta3; g.fill();
    }
    g.globalAlpha = 1;
    if (!mini && this.usadas.size) {
      for (const id of this.usadas) {
        const i = this.indiceSkill.get(id); if (i == null) continue;
        const c = this.cumuloDe(i); if (!c.visible) continue;
        g.beginPath(); g.arc(PX[i], PY[i], 5.5 * crece, 0, TAU);
        g.strokeStyle = c.tono.hex; g.lineWidth = 1; g.stroke();
      }
    }
    if (!mini) this.pintarRotulos(g);
  }

  /** Rótulos de plugins: siguen a su cúmulo, se atenúan con la distancia y nunca se enciman (gana el más cercano). */
  pintarRotulos(g) {
    const r = this.rect, base = this.tamTexto, puestos = [];
    this.rotulos = [];
    const orden = this.cumulos.filter((c) => c.visible).sort((a, b) => a.sz - b.sz);     // de cerca a lejos
    g.textBaseline = 'top';
    for (const c of orden) {
      const px = Math.round(base * (0.94 + 0.16 * c.cerca));
      const cola = c.activo ? String(c.k) : 'apagado';
      const w = (c.nombre.length + cola.length + 1) * px * 0.61 + 12, h = px * 1.35;
      const rs = c.r * c.se;
      const x = limitar(c.sx - w / 2, r.x + 2, r.x + r.w - w - 2);
      // candidato 1: debajo del cúmulo; 2: encima. Si choca en los dos, se desvanece.
      const cand = [c.sy + rs * 0.8 + 4, c.sy - rs * 0.8 - h - 2];
      if (c.rotLado < 0) cand.reverse();
      let rect = null, lado = c.rotLado;
      for (let n = 0; n < 2 && !rect; n++) {
        const q = { x, y: cand[n], w, h };
        if (q.y < r.y || q.y + h > r.y + r.h) continue;
        if (!puestos.some((p) => q.x < p.x + p.w + 6 && q.x + q.w > p.x - 6 && q.y < p.y + p.h + 2 && q.y + q.h > p.y - 2)) { rect = q; if (n === 1) lado = -lado; }
      }
      const meta = rect ? 1 : 0;
      c.rotAlfa += (meta - c.rotAlfa) * 0.3;
      if (rect && lado !== c.rotLado) { c.rotLado = lado; c.rotAlfa = Math.min(c.rotAlfa, 0.3); }
      if (!rect) { c.rot = null; continue; }
      puestos.push(rect); c.rot = rect; this.rotulos.push({ c, rect });
      const alfa = (0.6 + 0.4 * c.cerca) * c.rotAlfa * (c.tenue ? 0.2 : 1);
      if (alfa < 0.03) continue;
      const tx = Math.round(rect.x), ty = Math.round(rect.y);
      // legible siempre: se borra el polvo de otros cúmulos que quede debajo del rótulo
      g.globalAlpha = 0.8 * c.rotAlfa; g.fillStyle = COLOR.fondo;
      g.fillRect(tx - 3, ty - 1, Math.round(w) + 2, Math.round(h) + 1);
      g.globalAlpha = alfa;
      // cuadrito del tono (leyenda) + nombre + cuántas skills
      g.fillStyle = c.activo ? c.tono.hex : COLOR.tinta3;
      g.fillRect(tx, ty + Math.round(px * 0.42), 5, 5);
      g.font = fuente(px, 500);
      g.fillStyle = c.activo ? COLOR.tinta2 : COLOR.tinta3;
      g.fillText(c.nombre, tx + 10, ty);
      const wn = g.measureText(c.nombre).width;
      g.font = fuente(Math.round(px * 0.92), 400);
      g.fillStyle = COLOR.tinta3;
      g.fillText(cola, tx + 10 + wn + 6, ty + px * 0.06);
    }
    g.globalAlpha = 1;
  }

  /** Lo que la araña (o una onda) iluminó: puntos en vivo, por tramos de calor, en el tono del cúmulo. */
  pintarCalor(ctx) {
    const { PX, PY, CAL } = this;
    const tramos = [[0.06, 0.4, 0.24, 1.3], [0.4, 0.8, 0.5, 1.6], [0.8, 9, 0.9, 1.9]];
    const r = this.rect;
    let hay = this.ondas.length > 0;
    for (const c of this.cumulos) if (c.tibio > 0.06 && c.visible) { hay = true; break; }
    if (!hay) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    // ondas: los puntos que toca el frente se encienden un instante (más fuerte en el borde de ataque)
    for (const o of this.ondas) {
      const ancho = o.ancho || 12, vida = 1 - (o.r / o.max) * 0.6;
      // el frente: un arco fino, y detrás los puntos que acaba de tocar
      ctx.strokeStyle = rgba('cian', 0.3 * vida); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke();
      for (const c of this.cumulos) {
        if (!c.visible) continue;
        const dc = Math.hypot(c.sx - o.x, c.sy - o.y), rc = c.r * c.se * 1.4;
        if (dc + rc < o.r - ancho || dc - rc > o.r) continue;
        const t = 2.3 * (0.8 + 0.4 * c.cerca) * this.grano, m = t / 2;
        ctx.beginPath();
        for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) { const d = o.r - Math.hypot(PX[i] - o.x, PY[i] - o.y); if (d > 0 && d < ancho * (0.35 + 0.65 * ((i * 13) % 8) / 8)) ctx.rect(PX[i] - m, PY[i] - m, t, t); }
        ctx.fillStyle = c.activo ? rgbaT(c.tono, 0.85 * vida) : rgba('tinta2', 0.5 * vida); ctx.fill();
      }
    }
    for (const c of this.cumulos) {
      if (c.tibio <= 0.06 || !c.visible) continue;
      const crece = (0.8 + 0.4 * c.cerca) * Math.sqrt(this.cam.zoom) * this.grano;
      for (const [a, b, alfa, tam] of tramos) {
        if (c.tibio <= a) continue;
        const t = tam * crece, m = t / 2;
        ctx.beginPath();
        for (let i = c.ini, fin = c.ini + c.n; i < fin; i++) { const v = CAL[i]; if (v > a && v <= b) ctx.rect(PX[i] - m, PY[i] - m, t, t); }
        ctx.fillStyle = c.activo ? rgbaT(c.tono, alfa) : rgba('tinta2', alfa * 0.6); ctx.fill();
      }
    }
    ctx.restore();
  }
}
