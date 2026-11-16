// lienzo.js — el canvas único a pantalla completa. Cada módulo registra una capa
// (función de dibujo con un orden); aquí se limpia, se escala al devicePixelRatio
// (tope 2) y se llaman en orden.

const canvas = document.getElementById('lienzo');
export const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
export const lienzo = { ancho: 0, alto: 0, dpr: 1, brillo: 1 };

const capas = [];
/** Registra una capa: fn(ctx, t). Orden menor = más al fondo. */
export function capa(orden, fn) { capas.push({ orden, fn }); capas.sort((a, b) => a.orden - b.orden); }

export function ajustar() {
  lienzo.dpr = Math.min(2, window.devicePixelRatio || 1);
  lienzo.ancho = innerWidth; lienzo.alto = innerHeight;
  canvas.width = Math.round(lienzo.ancho * lienzo.dpr);
  canvas.height = Math.round(lienzo.alto * lienzo.dpr);
}

export function dibujar(t) {
  ctx.setTransform(lienzo.dpr, 0, 0, lienzo.dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#06090b';
  ctx.fillRect(0, 0, lienzo.ancho, lienzo.alto);
  for (const c of capas) {
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    c.fn(ctx, t);
  }
  // "Dormida": todo baja a 60 % de brillo. Se oscurece con un velo del color del fondo.
  if (lienzo.brillo < 0.995) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - lienzo.brillo;
    ctx.fillStyle = '#06090b';
    ctx.fillRect(0, 0, lienzo.ancho, lienzo.alto);
    ctx.globalAlpha = 1;
  }
}

/** Caja con texto (etiqueta recuadrada) en el lienzo. Devuelve el ancho usado. */
export function fuente(px, peso = 400) { return `${peso} ${px}px "IBM Plex Mono", monospace`; }
