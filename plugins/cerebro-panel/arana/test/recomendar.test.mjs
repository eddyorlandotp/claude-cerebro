import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { configConRepo, hayHermanos, temporal } from '../ayudas-de-prueba.mjs';

process.env.XDG_STATE_HOME = path.join(temporal(), 'estado');
const { construirIndice } = await import('../lib/indice.mjs');
const { recomendar, buscar, puntuar, UMBRAL } = await import('../lib/recomendar.mjs');

// Índice chico hecho a mano: no depende de qué plugins haya en el repo.
const chico = {
  plugins: [
    {
      nombre: 'web', clave: 'web@x', activo: true, extras: { hooks: false, mcp: false, agentes: false },
      skills: [
        { id: 'web:landing-que-convierte', nombre: 'landing-que-convierte', desc: 'Estructura de una landing que convierte: hero, precios, CTA. Usa al decir landing, página de ventas.' },
        { id: 'web:seo-tecnico', nombre: 'seo-tecnico', desc: 'SEO técnico: title, meta, sitemap, Open Graph. Usa con SEO, Google.' },
      ],
    },
    {
      nombre: 'pagos', clave: 'pagos@x', activo: false, extras: { hooks: false, mcp: true, agentes: false },
      skills: [
        { id: 'pagos:stripe-checkout', nombre: 'stripe-checkout', desc: 'Stripe Checkout sessions, payment links and subscriptions billing.' },
        { id: 'pagos:solo-manual', nombre: 'solo-manual', desc: 'Stripe refund payment manual flow', manual: true },
      ],
    },
  ],
};

test('recomendar devuelve la forma del contrato', () => {
  const r = recomendar(chico, 'hazme una landing para vender el curso');
  assert.equal(r[0].id, 'web:landing-que-convierte');
  assert.equal(typeof r[0].puntaje, 'number');
  assert.equal(r[0].activo, true);
  assert.ok(r[0].puntaje >= UMBRAL && r[0].puntaje <= 1);
});

test('sin coincidencia clara no recomienda nada', () => {
  for (const t of ['hola', '', 'ok gracias', 'sí, hazlo', 'qué hora es', 'continúa', '¿y entonces?', '   ']) {
    assert.deepEqual(recomendar(chico, t), [], t);
  }
});

test('cruza idiomas con sinónimos y marca las de plugins apagados', () => {
  const r = recomendar(chico, 'quiero cobrar una suscripción con stripe');
  assert.equal(r[0].id, 'pagos:stripe-checkout');
  assert.equal(r[0].activo, false);
  assert.ok(!r.some((x) => x.id === 'pagos:solo-manual'), 'las skills manuales no se recomiendan');
});

test('k limita los resultados y buscar no aplica umbral', () => {
  assert.ok(recomendar(chico, 'landing con seo para google', { k: 1 }).length <= 1);
  const b = buscar(chico, 'google', { k: 5 });
  assert.ok(b.some((x) => x.id === 'web:seo-tecnico'));
  assert.deepEqual(buscar(chico, 'hola'), []);
});

test('un índice vacío o raro no truena', () => {
  assert.deepEqual(recomendar({ plugins: [] }, 'landing'), []);
  assert.deepEqual(recomendar(null, 'landing'), []);
  assert.deepEqual(puntuar({}, 'landing'), []);
});

// ---- Casos reales en español coloquial contra las skills del repo
const opciones = { skip: !hayHermanos && 'no están los plugins hermanos del repo' };

test('casos reales: lo que debe salir', opciones, () => {
  const { configDir, base } = configConRepo();
  const indice = construirIndice({ configDir, cwd: base });
  const casos = [
    ['el bot tarda 7 segundos en copiar', 4, ['cerebro-solana:helius-rpc-y-tiempo-real', 'cerebro-solana:enviar-transacciones-rapido', 'cerebro-codigo:depurar-rendimiento']],
    ['el bot tarda como 7 segundos en copiar las compras del trader, quiero que baje a 2 o menos. revisa dónde se va el tiempo y arréglalo', 4, ['cerebro-solana:bot-copy-trading', 'cerebro-codigo:depurar-rendimiento', 'cerebro-solana:enviar-transacciones-rapido']],
    ['hazme una miniatura para el juego', 3, ['cerebro-diseno:miniaturas-y-graficos']],
    ['súbelo a producción', 3, ['cerebro-base:deploy-y-monitoreo']],
    ['quiero cobrar suscripciones con mercado pago', 3, ['cerebro-web:cobros-y-suscripciones']],
    ['cómo conecto phantom para firmar el swap', 3, ['cerebro-solana:billetera-sin-custodia']],
    ['el wifi de mi cuarto está muy lento', 3, ['cerebro-casa:wifi-y-red-domestica']],
    ['necesito una landing para vender el juego de roblox', 4, ['cerebro-web:landing-que-convierte']],
    ['me quedé sin contexto, cómo gasto menos tokens', 3, ['cerebro-base:ahorrar-tokens']],
    ['el datastore pierde los datos de los jugadores', 3, ['cerebro-juegos:roblox-datos-y-monetizacion']],
    ['agrega un test para el parser de montos', 3, ['cerebro-codigo:testing-practico', 'cerebro-solana:montos-y-decimales']],
    ['quiero poner el servidor de minecraft para que prenda solo', 3, ['cerebro-linux:minecraft-bedrock-servidor']],
    ['revisa este token antes de comprarlo, no quiero un rug', 3, ['cerebro-solana:riesgo-memecoins']],
    ['necesito mi RFC para facturar', 3, ['cerebro-vida:tramites-mexico']],
    ['haz el logo del proyecto', 3, ['cerebro-diseno:branding-y-logos']],
  ];
  for (const [texto, k, esperadas] of casos) {
    const ids = recomendar(indice, texto, { k }).map((r) => r.id);
    for (const e of esperadas) assert.ok(ids.includes(e), `"${texto}" debía incluir ${e}; salió: ${ids.join(', ') || '(nada)'}`);
  }
});

test('casos reales: la primera es la obvia', opciones, () => {
  const { configDir, base } = configConRepo();
  const indice = construirIndice({ configDir, cwd: base });
  const primera = (t) => recomendar(indice, t)[0]?.id;
  assert.equal(primera('hazme una miniatura para el juego'), 'cerebro-diseno:miniaturas-y-graficos');
  assert.equal(primera('necesito mi RFC para facturar'), 'cerebro-vida:tramites-mexico');
  assert.equal(primera('haz el logo del proyecto'), 'cerebro-diseno:branding-y-logos');
});

test('casos reales: lo que NO debe disparar nada', opciones, () => {
  const { configDir, base } = configConRepo();
  const indice = construirIndice({ configDir, cwd: base });
  for (const t of ['hola', 'gracias, continúa', 'sí hazlo', 'ok', 'qué hora es', 'explícame qué es un closure', 'cambia el color del botón a azul', 'jajaja va', 'mmm no sé']) {
    assert.deepEqual(recomendar(indice, t).map((r) => r.id), [], t);
  }
});

test('casos reales: plugin apagado', opciones, () => {
  const { configDir, base } = configConRepo({ apagados: ['cerebro-diseno', 'cerebro-juegos'] });
  const indice = construirIndice({ configDir, cwd: base });
  // Modo completo: sale marcada como apagada (a lo mucho una)
  const completo = recomendar(indice, 'hazme una miniatura para el juego', { k: 4 });
  assert.equal(completo[0].id, 'cerebro-diseno:miniaturas-y-graficos');
  assert.equal(completo[0].activo, false);
  assert.ok(completo.filter((r) => !r.activo).length <= 1);
  // Modo ligero: compiten todas igual y siguen diciendo la verdad sobre su plugin
  const ligero = recomendar(indice, 'necesito una landing para vender el juego de roblox', { k: 4, modo: 'ligero' });
  assert.ok(ligero.filter((r) => !r.activo).length >= 2);
  assert.ok(ligero.some((r) => r.id === 'cerebro-web:landing-que-convierte' && r.activo));
});

test('recomendar es rápido con el índice del repo', opciones, () => {
  const { configDir, base } = configConRepo();
  const indice = construirIndice({ configDir, cwd: base });
  recomendar(indice, 'calentar');
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) recomendar(indice, 'el bot tarda 7 segundos en copiar las compras del trader');
  const cadaUna = (performance.now() - t0) / 50;
  assert.ok(cadaUna < 20, `cada recomendación tardó ${cadaUna.toFixed(2)} ms`);
});
