import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARANA, RAIZ_PLUGIN, temporal } from '../ayudas-de-prueba.mjs';
import { leerDf, validarUrl, legible } from '../lib/espejos.mjs';

test('leerDf filtra pseudo-sistemas y ordena por espacio libre', () => {
  const salida = [
    'Mounted on                     Avail Type',
    '/                       50000000000 btrfs',
    '/dev                     8000000000 devtmpfs',
    '/dev/shm                 8000000000 tmpfs',
    '/run                     3000000000 tmpfs',
    '/sys/firmware/efi/efivars     100000 efivarfs',
    '/boot/efi                 500000000 vfat',
    '/home                   50000000000 btrfs',
    '/mnt/datos             900000000000 ext4',
    '/run/media/usuario/USB 64  30000000000 exfat',
    '/var/lib/docker/overlay2/abc/merged 50000000000 overlay',
    'línea rota',
  ].join('\n');
  const u = leerDf(salida);
  assert.deepEqual(u.map((x) => x.punto), ['/mnt/datos', '/', '/home', '/run/media/usuario/USB 64']);
  assert.equal(u[0].libre, 900000000000);
  assert.equal(u[3].tipo, 'exfat');
  assert.deepEqual(leerDf(''), []);
});

test('validarUrl solo acepta https limpio y arma un nombre de carpeta seguro', () => {
  assert.deepEqual(validarUrl('https://github.com/godotengine/godot-docs'), { url: 'https://github.com/godotengine/godot-docs', nombre: 'godotengine--godot-docs' });
  assert.equal(validarUrl('https://github.com/a/b.git').nombre, 'a--b');
  for (const mala of ['', 'git@github.com:a/b.git', 'http://github.com/a/b', '--upload-pack=touch /tmp/x', 'https://github.com/a/b; rm -rf ~', 'https://github.com/a/../b', 'file:///etc', 'https://github.com/solo']) {
    assert.throws(() => validarUrl(mala), mala);
  }
});

test('legible', () => {
  assert.equal(legible(512), '512 B');
  assert.equal(legible(1536), '1.5 KB');
  assert.equal(legible(250 * 1024 ** 3), '250 GB');
});

test('los espejos sugeridos tienen la forma esperada', () => {
  const j = JSON.parse(fs.readFileSync(path.join(RAIZ_PLUGIN, 'arana', 'espejos-sugeridos.json'), 'utf8'));
  assert.ok(j.espejos.length >= 5);
  const nombres = new Set();
  for (const e of j.espejos) {
    assert.match(e.nombre, /^[a-z0-9-]+$/);
    assert.ok(!nombres.has(e.nombre));
    nombres.add(e.nombre);
    assert.doesNotThrow(() => validarUrl(e.url));
    assert.ok(e.tema && e.tamano);
  }
});

test('CLI espejo: sin carpeta configurada lista unidades; `ruta <dir>` la guarda', () => {
  const base = temporal();
  const env = { ...process.env, XDG_STATE_HOME: path.join(base, 'estado'), HOME: base };
  const arana = (...a) => spawnSync(process.execPath, [ARANA, 'espejo', ...a], { encoding: 'utf8', env });
  const sin = arana('ruta');
  assert.equal(sin.status, 3);
  assert.match(sin.stdout, /Unidades montadas con espacio libre/);
  assert.match(sin.stdout, /Pregúntale al usuario/);
  assert.equal(arana('agregar', 'https://github.com/a/b').status, 3, 'no descarga nada sin carpeta');
  const destino = path.join(base, 'unidad', 'espejos');
  assert.equal(arana('ruta', destino).status, 0);
  assert.equal(arana('ruta').stdout.trim(), destino);
  assert.equal(JSON.parse(fs.readFileSync(path.join(base, 'estado', 'cerebro-panel', 'config.json'), 'utf8')).espejos.dir, destino);
  const lista = arana('listar');
  assert.match(lista.stdout, /ninguno descargado todavía/);
  assert.match(lista.stdout, /Sugeridos/);
  const mala = arana('agregar', '--upload-pack=x');
  assert.equal(mala.status, 1);
  assert.match(mala.stderr, /La URL debe ser https/);
  assert.match(arana('actualizar').stdout, /No hay espejos que actualizar/);
});
