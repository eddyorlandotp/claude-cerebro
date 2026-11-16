import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Seguidor, Vigia, listarSesiones, sesionMasReciente } from '../lib/vigia.mjs';

const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-'));
const fechar = (ruta, msAtras) => {
  const t = new Date(Date.now() - msAtras);
  fs.utimesSync(ruta, t, t);
};

test('Seguidor: solo líneas completas y solo lo nuevo', () => {
  const f = path.join(temporal(), 'a.jsonl');
  const s = new Seguidor(f);
  assert.deepEqual(s.leer().lineas, [], 'el archivo aún no existe');
  fs.writeFileSync(f, '{"a":1}\n{"b":2}\n{"c":');
  assert.deepEqual(s.leer().lineas, ['{"a":1}', '{"b":2}']);
  assert.deepEqual(s.leer().lineas, []);
  fs.appendFileSync(f, '3}\n\n{"d":4}\n');
  assert.deepEqual(s.leer().lineas, ['{"c":3}', '{"d":4}'], 'la línea a medias se completa en la siguiente lectura');
  // Si el archivo se trunca se vuelve a empezar
  fs.writeFileSync(f, '{"e":5}\n');
  assert.deepEqual(s.leer().lineas, ['{"e":5}']);
});

test('Seguidor: acentos partidos entre dos lecturas y archivos grandes por trozos', () => {
  const f = path.join(temporal(), 'b.jsonl');
  const linea = JSON.stringify({ texto: 'canción ñandú 🕷️' });
  const bytes = Buffer.from(linea + '\n');
  fs.writeFileSync(f, bytes.subarray(0, 14)); // corta a media letra acentuada
  const s = new Seguidor(f);
  assert.deepEqual(s.leer().lineas, []);
  fs.appendFileSync(f, bytes.subarray(14));
  assert.deepEqual(s.leer().lineas, [linea]);

  const grande = path.join(temporal(), 'c.jsonl');
  const fila = JSON.stringify({ relleno: 'x'.repeat(2000) }) + '\n';
  fs.writeFileSync(grande, fila.repeat(3000)); // ~6 MB
  const g = new Seguidor(grande);
  let total = 0;
  let vueltas = 0;
  for (;;) {
    const r = g.leer(2 * 1024 * 1024);
    total += r.lineas.length;
    vueltas++;
    if (!r.pendiente) break;
  }
  assert.equal(total, 3000);
  assert.ok(vueltas >= 3, 'lee por partes para no bloquear');
});

test('Seguidor desdeElFinal ignora lo que ya había', () => {
  const f = path.join(temporal(), 'eventos.jsonl');
  fs.writeFileSync(f, '{"viejo":1}\n');
  const s = new Seguidor(f, { desdeElFinal: true });
  assert.deepEqual(s.leer().lineas, []);
  fs.appendFileSync(f, '{"nuevo":2}\n');
  assert.deepEqual(s.leer().lineas, ['{"nuevo":2}']);
});

test('sesionMasReciente: el .jsonl modificado más recientemente; ignora subagentes y otros archivos', () => {
  const config = temporal();
  assert.equal(sesionMasReciente(config), null, 'sin carpeta projects');
  const p1 = path.join(config, 'projects', '-home-u-uno');
  const p2 = path.join(config, 'projects', '-home-u-dos');
  fs.mkdirSync(path.join(p1, 'vieja', 'subagents'), { recursive: true });
  fs.mkdirSync(p2, { recursive: true });
  fs.writeFileSync(path.join(p1, 'vieja.jsonl'), '{}\n');
  fs.writeFileSync(path.join(p1, 'vieja', 'subagents', 'agent-1.jsonl'), '{}\n');
  fs.writeFileSync(path.join(p2, 'nueva.jsonl'), '{}\n');
  fs.writeFileSync(path.join(p2, 'notas.txt'), 'x');
  fechar(path.join(p1, 'vieja.jsonl'), 60000);
  fechar(path.join(p2, 'nueva.jsonl'), 1000);
  assert.equal(listarSesiones(config).length, 2);
  const s = sesionMasReciente(config);
  assert.equal(s.id, 'nueva');
  assert.equal(s.dirProyecto, p2);
});

test('Vigia: historia, líneas en vivo, subagentes y cambio de sesión', () => {
  const config = temporal();
  const proyecto = path.join(config, 'projects', '-home-u-proyecto');
  fs.mkdirSync(proyecto, { recursive: true });
  const a = path.join(proyecto, 'sesion-a.jsonl');
  fs.writeFileSync(a, '{"n":1}\n{"n":2}\n');
  fechar(a, 10000);
  const v = new Vigia({ configDir: config, intervaloBusqueda: 0, histeresis: 3000 });
  const visto = [];
  v.on('sesion', (s) => visto.push(['sesion', s.id]));
  v.on('linea', (l) => visto.push(['linea', l.texto, l.agente, l.historico]));
  v.on('al-dia', () => visto.push(['al-dia']));

  v.tic();
  assert.deepEqual(visto, [['sesion', 'sesion-a'], ['linea', '{"n":1}', null, true], ['linea', '{"n":2}', null, true], ['al-dia']]);
  visto.length = 0;

  fs.appendFileSync(a, '{"n":3}\n');
  v.tic();
  assert.deepEqual(visto, [['linea', '{"n":3}', null, false]]);
  visto.length = 0;

  // Aparece un archivo de subagente
  fs.mkdirSync(path.join(proyecto, 'sesion-a', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(proyecto, 'sesion-a', 'subagents', 'agent-abc123.jsonl'), '{"sub":1}\n');
  v.tic();
  assert.deepEqual(visto, [['linea', '{"sub":1}', 'abc123', false]]);
  visto.length = 0;
  v.tic();
  assert.deepEqual(visto, [], 'sin cambios no emite nada');

  // Otra sesión apenas más nueva no roba el foco (dos sesiones activas a la vez)
  const b = path.join(config, 'projects', '-home-u-proyecto', 'sesion-b.jsonl');
  fs.writeFileSync(b, '{"otra":1}\n');
  v.tic();
  assert.deepEqual(visto, []);
  // ...pero una claramente más reciente sí
  const futuro = new Date(Date.now() + 60000);
  fs.utimesSync(b, futuro, futuro);
  v.tic();
  assert.deepEqual(visto, [['sesion', 'sesion-b'], ['linea', '{"otra":1}', null, true], ['al-dia']]);
});

test('Vigia sin sesiones no truena y engancha la primera que aparezca', () => {
  const config = temporal();
  const v = new Vigia({ configDir: config, intervaloBusqueda: 0 });
  const visto = [];
  v.on('sesion', (s) => visto.push(s.id));
  v.tic();
  v.tic();
  assert.deepEqual(visto, []);
  fs.mkdirSync(path.join(config, 'projects', 'p'), { recursive: true });
  fs.writeFileSync(path.join(config, 'projects', 'p', 'primera.jsonl'), '');
  v.tic();
  assert.deepEqual(visto, ['primera']);
});
