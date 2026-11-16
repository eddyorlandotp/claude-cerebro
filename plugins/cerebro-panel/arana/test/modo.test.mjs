// Modo ligero/completo con un `claude` falso en el PATH (no se toca ninguna instalación real).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARANA, temporal, escribir, skill } from '../ayudas-de-prueba.mjs';
import { leerCostoFijo } from '../lib/modo.mjs';

test('leerCostoFijo entiende comas de miles, ceros y sufijo k', () => {
  assert.equal(leerCostoFijo('  Always-on:   ~706 tok   added to every session'), 706);
  assert.equal(leerCostoFijo('Always-on:   ~2,924 tok   added'), 2924);
  assert.equal(leerCostoFijo('Always-on: ~1,169 tok'), 1169);
  assert.equal(leerCostoFijo('Always-on:   ~0 tok'), 0);
  assert.equal(leerCostoFijo('Always-on: ~12.5k tok'), 12500);
  assert.equal(leerCostoFijo('Always-on: ~1.2k tok'), 1200);
  assert.equal(leerCostoFijo('sin esa línea'), null);
  assert.equal(leerCostoFijo(''), null);
});

/** Instalación falsa + un `claude` de mentira que edita settings.json igual que el real. */
function preparar() {
  const base = temporal();
  const configDir = path.join(base, '.claude');
  const costos = { 'grande@m': 1500, 'chico@m': 80, 'cero@m': 0, 'superpowers@m': 706, 'ya-apagado@m': 300, 'cerebro-panel@m': 40 };
  const instalados = { version: 2, plugins: {} };
  for (const clave of Object.keys(costos)) {
    const nombre = clave.split('@')[0];
    const raiz = path.join(configDir, 'plugins', 'cache', 'm', nombre, '1.0.0');
    escribir(path.join(raiz, '.claude-plugin', 'plugin.json'), { name: nombre });
    skill(path.join(raiz, 'skills'), `skill-de-${nombre}`, `Skill de ${nombre}`);
    instalados.plugins[clave] = [{ scope: 'user', installPath: raiz, version: '1.0.0' }];
  }
  escribir(path.join(configDir, 'plugins', 'installed_plugins.json'), instalados);
  const enabled = { 'grande@m': true, 'chico@m': true, 'cero@m': true, 'superpowers@m': true, 'ya-apagado@m': false, 'cerebro-panel@m': true };
  escribir(path.join(configDir, 'settings.json'), { otraCosa: 1, enabledPlugins: enabled });
  const bin = path.join(base, 'bin');
  escribir(path.join(bin, 'claude'), `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
const costos = ${JSON.stringify(costos)};
const ruta = process.env.CLAUDE_CONFIG_DIR + '/settings.json';
fs.appendFileSync(process.env.CLAUDE_CONFIG_DIR + '/llamadas.log', a.join(' ') + '\\n');
if (a[0] === '--version') { console.log('9.9.9 (falso)'); process.exit(0); }
if (a[0] === 'plugin' && a[1] === 'details') {
  if (!(a[2] in costos)) { console.error('Plugin not found'); process.exit(1); }
  const n = costos[a[2]].toLocaleString('en-US');
  console.log(a[2] + '\\n\\nProjected token cost\\n  Always-on:   ~' + n + ' tok   added to every session');
  process.exit(0);
}
if (a[0] === 'plugin' && (a[1] === 'enable' || a[1] === 'disable') && a[3] === '--scope' && a[4] === 'user') {
  const s = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  s.enabledPlugins[a[2]] = a[1] === 'enable';
  fs.writeFileSync(ruta, JSON.stringify(s, null, 2));
  process.exit(0);
}
process.exit(2);
`);
  fs.chmodSync(path.join(bin, 'claude'), 0o755);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir, XDG_STATE_HOME: path.join(base, 'estado'), HOME: base, PATH: `${bin}:${process.env.PATH}` };
  const arana = (...args) => spawnSync(process.execPath, [ARANA, ...args], { encoding: 'utf8', env, cwd: base, timeout: 60000 });
  const activos = () => JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8')).enabledPlugins;
  return { base, configDir, enabled, arana, activos, datos: path.join(base, 'estado', 'cerebro-panel') };
}

test('modo estado: cuenta prendidos, apagados y tokens fijos', () => {
  const p = preparar();
  const r = p.arana('modo', 'estado', '--json');
  assert.equal(r.status, 0, r.stderr);
  const e = JSON.parse(r.stdout);
  assert.equal(e.modo, 'completo');
  assert.equal(e.prendidos, 5);
  assert.equal(e.apagados, 1);
  assert.equal(e.tokensFijos, 1500 + 80 + 0 + 706 + 40);
  assert.equal(e.tokensApagados, 300);
  assert.match(p.arana('modo', 'estado').stdout, /modo completo: 5 plugins prendidos, 1 apagados · contexto fijo ≈ 2,326 tokens/);
});

test('modo ligero y de regreso a completo: ida y vuelta exacta', () => {
  const p = preparar();
  const ida = p.arana('modo', 'ligero', '--json');
  assert.equal(ida.status, 0, ida.stderr);
  const r = JSON.parse(ida.stdout);
  assert.deepEqual(r.apagados.sort(), ['chico@m', 'grande@m']);
  // Se quedan prendidos: el núcleo (superpowers, cerebro-panel) y lo que cuesta 0
  assert.deepEqual(p.activos(), { 'grande@m': false, 'chico@m': false, 'cero@m': true, 'superpowers@m': true, 'ya-apagado@m': false, 'cerebro-panel@m': true });
  assert.equal(r.antes.tokensFijos, 2326);
  assert.equal(r.despues.tokensFijos, 746);
  assert.equal(r.despues.modo, 'ligero');
  const foto = JSON.parse(fs.readFileSync(path.join(p.datos, 'modo.json'), 'utf8'));
  assert.equal(foto.modo, 'ligero');
  assert.equal(foto.previo['grande@m'], true);
  assert.equal(foto.previo['ya-apagado@m'], false);
  // settings.json conserva lo demás
  assert.equal(JSON.parse(fs.readFileSync(path.join(p.configDir, 'settings.json'), 'utf8')).otraCosa, 1);

  // Repetir `ligero` no pierde la foto original
  assert.equal(p.arana('modo', 'ligero').status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p.datos, 'modo.json'), 'utf8')).previo['grande@m'], true);

  const vuelta = p.arana('modo', 'completo', '--json');
  assert.equal(vuelta.status, 0, vuelta.stderr);
  assert.deepEqual(p.activos(), p.enabled, 'queda exactamente como estaba (lo que ya estaba apagado sigue apagado)');
  assert.equal(JSON.parse(vuelta.stdout).despues.tokensFijos, 2326);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p.datos, 'modo.json'), 'utf8')).modo, 'completo');
  // `completo` otra vez no hace nada
  assert.match(p.arana('modo', 'completo').stdout, /No había un modo ligero que deshacer/);
  // Nunca se usó otro alcance que el de usuario
  const llamadas = fs.readFileSync(path.join(p.configDir, 'llamadas.log'), 'utf8').split('\n').filter((l) => /enable|disable/.test(l));
  assert.ok(llamadas.length >= 4 && llamadas.every((l) => l.endsWith('--scope user')));
});

test('el núcleo se puede cambiar en config.json', () => {
  const p = preparar();
  escribir(path.join(p.datos, 'config.json'), { ligero: { nucleo: ['grande'] } });
  assert.equal(p.arana('modo', 'ligero').status, 0);
  const a = p.activos();
  assert.equal(a['grande@m'], true);
  assert.equal(a['superpowers@m'], false);
  assert.equal(a['cero@m'], true);
});

test('sin `claude` en el PATH avisa y no cambia nada', () => {
  const p = preparar();
  const r = spawnSync(process.execPath, [ARANA, 'modo', 'ligero'], {
    encoding: 'utf8',
    env: { CLAUDE_CONFIG_DIR: p.configDir, XDG_STATE_HOME: path.join(p.base, 'estado'), HOME: p.base, PATH: '/nonexistent' },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No encuentro el comando `claude`/);
  assert.deepEqual(p.activos(), p.enabled);
});
