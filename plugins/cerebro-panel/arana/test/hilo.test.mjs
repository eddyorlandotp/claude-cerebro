import test from 'node:test';
import assert from 'node:assert/strict';
import { Hilo } from '../lib/hilo.mjs';

const h1 = (id, nombre, clase, resumen, extra = {}) => ({ tipo: 'herramienta', id, fase: 'inicio', nombre, clase, resumen, agente: null, ...extra });
const fin = (id, ok = true, extra = {}) => ({ tipo: 'herramienta', id, fase: 'fin', ok, ms: 10, tamano: 5, agente: null, ...extra });

function sesionEjemplo() {
  const h = new Hilo();
  const eventos = [
    { tipo: 'prompt', texto: 'hola' },
    { tipo: 'prompt', texto: 'el bot tarda 7 segundos en copiar las compras, quiero que baje a 2' },
    h1('a', 'Read', 'leer', 'src/copiar.ts'), fin('a'),
    h1('b', 'Edit', 'editar', 'src/detector.ts'), fin('b'),
    h1('c', 'Edit', 'editar', 'src/detector.ts'), fin('c'),
    h1('d', 'Write', 'editar', 'src/medir.ts'), fin('d'),
    h1('e', 'Bash', 'comando', 'npm test -- detector'), fin('e', false, { detalle: 'Exit code 1' }),
    h1('f', 'Bash', 'comando', 'ls -la'), fin('f'),
    h1('g', 'Bash', 'comando', 'npm test -- detector'), fin('g'),
    h1('h', 'Bash', 'comando', 'wrangler deploy --env pruebas'), fin('h'),
    h1('i', 'TodoWrite', 'tarea', '3 tareas', { tareas: { op: 'lista', items: [
      { texto: 'Medir cada etapa', estado: 'hecho' }, { texto: 'Cambiar sondeo por websocket', estado: 'en_curso' }, { texto: 'Reducir envío', estado: 'pendiente' },
    ] } }), fin('i'),
    h1('j', 'Read', 'leer', '…/skills/bot-copy-trading/SKILL.md'), fin('j'),
    { tipo: 'pensamiento', texto: 'no cuenta' }, { tipo: 'uso', contexto: 5 }, null, 'basura', { tipo: 'desconocido' },
    { tipo: 'prompt', texto: 'ahora el envío' },
  ];
  for (const e of eventos) h.ingerir(e);
  return h;
}

test('resumen: forma del evento hilo', () => {
  const r = sesionEjemplo().resumen();
  assert.deepEqual(Object.keys(r).sort(), ['archivos', 'comandos', 'errores', 'objetivo', 'pendientes', 'turnos', 'ultimoPedido']);
  assert.equal(r.objetivo, 'el bot tarda 7 segundos en copiar las compras, quiero que baje a 2', 'el primer pedido sustantivo, no el saludo');
  assert.equal(r.ultimoPedido, 'ahora el envío');
  assert.equal(r.turnos, 3);
  assert.deepEqual(r.archivos, [
    { ruta: 'src/detector.ts', veces: 2, accion: 'editado' },
    { ruta: 'src/medir.ts', veces: 1, accion: 'creado' },
    { ruta: 'src/copiar.ts', veces: 1, accion: 'leído' },
  ]);
  assert.deepEqual(r.comandos, ['wrangler deploy --env pruebas', 'npm test -- detector'], 'sin repetidos, sin triviales, lo más reciente primero');
  assert.deepEqual(r.errores, ['Bash: npm test -- detector → Exit code 1']);
  assert.deepEqual(r.pendientes.map((p) => p.estado), ['hecho', 'en_curso', 'pendiente']);
});

test('límites: máx 8 archivos, 5 comandos, 3 errores', () => {
  const h = new Hilo();
  h.ingerir({ tipo: 'prompt', texto: 'refactoriza todo el módulo de pagos por favor' });
  for (let i = 0; i < 30; i++) {
    h.ingerir(h1('e' + i, 'Edit', 'editar', `src/archivo-${i}.ts`));
    h.ingerir(h1('b' + i, 'Bash', 'comando', `npm run paso-${i}`));
    h.ingerir(fin('b' + i, false, { detalle: 'falló ' + i }));
  }
  const r = h.resumen();
  assert.equal(r.archivos.length, 8);
  assert.equal(r.comandos.length, 5);
  assert.equal(r.errores.length, 3);
  assert.match(r.errores[0], /paso-29/);
});

test('tareas: crear y actualizar por id', () => {
  const h = new Hilo();
  h.ingerir(fin('x', true, { tareas: { op: 'crear', items: [{ id: '1', texto: 'Uno', estado: 'pendiente' }] } }));
  h.ingerir(fin('y', true, { tareas: { op: 'crear', items: [{ id: '2', texto: 'Dos', estado: 'pendiente' }] } }));
  h.ingerir(h1('z', 'TaskUpdate', 'tarea', '#1', { tareas: { op: 'actualizar', items: [{ id: '1', estado: 'hecho' }] } }));
  h.ingerir(h1('w', 'TaskUpdate', 'tarea', '#2', { tareas: { op: 'actualizar', items: [{ id: '2', estado: 'borrada' }] } }));
  h.ingerir(h1('v', 'TaskUpdate', 'tarea', '#9', { tareas: { op: 'actualizar', items: [{ id: '9', estado: 'hecho' }] } }));
  assert.deepEqual(h.resumen().pendientes, [{ texto: 'Uno', estado: 'hecho' }]);
});

test('aMarkdown: encabezado, datos útiles y nunca más de 1800 caracteres', () => {
  const md = sesionEjemplo().aMarkdown();
  assert.match(md, /^## Hilo de la sesión \(guardado por la araña, sin IA\)\n/);
  for (const trozo of ['Objetivo: el bot tarda', 'Último pedido: ahora el envío', 'src/detector.ts (editado ×2)', '`wrangler deploy --env pruebas`', 'Exit code 1', '[~] Cambiar sondeo por websocket', 'hechos: 1']) {
    assert.ok(md.includes(trozo), trozo);
  }
  assert.ok(md.length <= 1800);

  const enorme = new Hilo();
  enorme.ingerir({ tipo: 'prompt', texto: 'x'.repeat(600) + ' con muchas palabras distintas para contar como sustantivo' });
  for (let i = 0; i < 80; i++) {
    enorme.ingerir(h1('e' + i, 'Edit', 'editar', 'src/' + 'carpeta-larga/'.repeat(4) + `archivo-${i}.ts`));
    enorme.ingerir(h1('b' + i, 'Bash', 'comando', `node scripts/${'y'.repeat(60)}-${i}.mjs`));
    enorme.ingerir(fin('b' + i, false, { detalle: 'z'.repeat(120) }));
    enorme.ingerir(fin('t' + i, true, { tareas: { op: 'crear', items: [{ id: String(i), texto: 'tarea ' + 'w'.repeat(100) }] } }));
  }
  const grande = enorme.aMarkdown();
  assert.ok(grande.length <= 1800, `midió ${grande.length}`);
  assert.match(grande, /^## Hilo de la sesión/);
});

test('aMarkdown vacío si no hay nada que contar', () => {
  assert.equal(new Hilo().aMarkdown(), '');
});

test('aJSON / desdeJSON conservan el hilo', () => {
  const h = sesionEjemplo();
  const copia = Hilo.desdeJSON(JSON.parse(JSON.stringify(h.aJSON())));
  assert.deepEqual(copia.resumen(), h.resumen());
  assert.equal(copia.aMarkdown(), h.aMarkdown());
  assert.equal(Hilo.desdeJSON(null).aMarkdown(), '');
  assert.equal(Hilo.desdeJSON({ v: 99 }).resumen().turnos, 0);
});
