import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Estado } from '../lib/estado.mjs';

const DEMO = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'demo', 'sesion-demo.json'), 'utf8'));

test('estado vacío: /estado y eventos iniciales tienen forma estable', () => {
  const e = new Estado({ version: '1.2.3' });
  const f = e.instantanea();
  assert.equal(f.version, '1.2.3');
  assert.equal(f.sesion, null);
  assert.deepEqual(f.biblioteca, { modo: 'completo', plugins: [] });
  assert.deepEqual(f.hilo, { objetivo: '', ultimoPedido: '', archivos: [], comandos: [], errores: [], pendientes: [], turnos: 0 });
  assert.equal(f.uso, null);
  assert.deepEqual(f.eventos, []);
  assert.deepEqual(e.iniciales().map((x) => x.tipo), ['biblioteca', 'hilo']);
  assert.doesNotThrow(() => JSON.stringify(f));
});

test('con el guion demo: agrega sesión, uso, hilo, turno y skills', () => {
  const e = new Estado();
  e.aplicar({ ...DEMO.biblioteca, tipo: 'biblioteca' });
  let n = 0;
  for (const { t, ...ev } of DEMO.eventos) e.aplicar({ ...ev, ts: 1000 + (n++), sesion: 'demo' });
  const f = e.instantanea();
  assert.equal(f.sesion.proyecto, 'bot-copias');
  assert.equal(f.uso.contexto, 92700);
  assert.equal(f.hilo.turnos, 1);
  assert.equal(f.turno.numero, 1);
  assert.equal(f.turno.abierto, false);
  assert.equal(f.turno.pasos, 13);
  assert.equal(f.turno.ms, 58000);
  assert.equal(f.espera, 'respuesta');
  assert.equal(f.sugeridas.skills.length, 4);
  assert.ok(f.usadas.includes('cerebro-codigo:depurar-rendimiento'));
  assert.deepEqual(f.subagentes, [], 'el subagente ya terminó');
  assert.ok(f.biblioteca.plugins.length > 5);
  assert.equal(f.eventos[0].tipo, 'prompt');

  const ini = e.iniciales();
  assert.deepEqual(ini.slice(0, 4).map((x) => x.tipo), ['sesion', 'biblioteca', 'hilo', 'uso']);
  assert.equal(ini[4].tipo, 'prompt');
  assert.ok(!ini.slice(4).some((x) => ['sesion', 'uso', 'hilo', 'biblioteca', 'latido'].includes(x.tipo)));
});

test('guarda a lo mucho los últimos 200 eventos del turno y empieza de cero con cada pedido', () => {
  const e = new Estado();
  e.aplicar({ tipo: 'prompt', texto: 'uno', ts: 1 });
  for (let i = 0; i < 500; i++) e.aplicar({ tipo: 'herramienta', id: 'h' + i, fase: 'inicio', nombre: 'Read', clase: 'leer', resumen: 'x', ts: 2 + i });
  assert.equal(e.instantanea().eventos.length, 200);
  assert.equal(e.instantanea().eventos.at(-1).id, 'h499');
  assert.equal(e.instantanea().turno.pasos, 500);
  e.aplicar({ tipo: 'prompt', texto: 'dos', ts: 999 });
  assert.equal(e.instantanea().eventos.length, 1);
  assert.equal(e.instantanea().turno.numero, 2);
});

test('la espera se quita cuando Claude sigue trabajando; reiniciar conserva la biblioteca', () => {
  const e = new Estado();
  e.aplicar({ tipo: 'biblioteca', modo: 'ligero', plugins: [{ nombre: 'p', activo: true, skills: [] }] });
  e.aplicar({ tipo: 'sesion', sesion: 'abc', proyecto: 'x' });
  e.aplicar({ tipo: 'espera', motivo: 'permiso', ts: 5 });
  assert.equal(e.instantanea().espera, 'permiso');
  e.aplicar({ tipo: 'herramienta', id: 'h', fase: 'fin', ok: true, ts: 6 });
  assert.equal(e.instantanea().espera, null);
  e.aplicar({ tipo: 'subagente', id: 'a1', fase: 'inicio', tipoAgente: 'Explore', descripcion: 'd' });
  assert.equal(e.instantanea().subagentes.length, 1);
  e.reiniciar('otra');
  const f = e.instantanea();
  assert.equal(f.sesion, null);
  assert.equal(f.subagentes.length, 0);
  assert.equal(f.biblioteca.modo, 'ligero');
  assert.equal(f.biblioteca.plugins.length, 1);
  for (const raro of [null, undefined, 5, 'x', {}, { tipo: 'no-existe' }, { tipo: 'latido' }]) assert.doesNotThrow(() => e.aplicar(raro));
});
