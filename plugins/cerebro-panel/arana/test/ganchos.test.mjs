// Pruebas de los hooks y del CLI corriendo el proceso real, como lo hace Claude Code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARANA, RAIZ_PLUGIN, configConRepo, hayHermanos, temporal, escribir } from '../ayudas-de-prueba.mjs';

const FIXTURE = path.join(RAIZ_PLUGIN, 'servidor', 'test', 'fixtures', 'sesion-basica.jsonl');
const opciones = { skip: !hayHermanos && 'no están los plugins hermanos del repo' };

function entorno(apagados = []) {
  const e = hayHermanos ? configConRepo({ apagados }) : (() => { const base = temporal(); return { base, configDir: path.join(base, '.claude'), datos: path.join(base, 'estado') }; })();
  e.env = { ...process.env, CLAUDE_CONFIG_DIR: e.configDir, XDG_STATE_HOME: e.datos, HOME: e.base };
  delete e.env.CLAUDE_PROJECT_DIR;
  e.dirDatos = path.join(e.datos, 'cerebro-panel');
  return e;
}

function correr(e, args, entrada = '') {
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [ARANA, ...args], { input: entrada, encoding: 'utf8', env: e.env, cwd: e.base, timeout: 15000 });
  return { codigo: r.status, salida: r.stdout, error: r.stderr, ms: performance.now() - t0 };
}
const gancho = (e, evento, datos) => correr(e, ['hook', evento], typeof datos === 'string' ? datos : JSON.stringify(datos));
const ponerLigero = (e) => escribir(path.join(e.dirDatos, 'modo.json'), { modo: 'ligero', previo: {} });

test('todo hook sale 0 ante cualquier entrada (fail-open)', () => {
  const e = entorno();
  for (const evento of ['UserPromptSubmit', 'SessionStart', 'PreCompact', 'Stop', 'Notification', 'EventoQueNoExiste']) {
    for (const entrada of ['', 'no soy json', '[]', 'null', '{"prompt": 5, "session_id": {"raro": true}}', '{"transcript_path": "/no/existe.jsonl", "session_id": "../../etc"}']) {
      const r = gancho(e, evento, entrada);
      assert.equal(r.codigo, 0, `${evento} con ${entrada}: ${r.error}`);
    }
  }
  assert.equal(correr(e, ['hook']).codigo, 0);
});

test('un hook no escribe fuera de la carpeta de datos aunque el id de sesión sea malicioso', () => {
  const e = entorno();
  gancho(e, 'Stop', { session_id: '../../../fuera', transcript_path: FIXTURE });
  assert.ok(!fs.existsSync(path.join(e.base, 'fuera.md')));
  assert.ok(fs.readdirSync(path.join(e.dirDatos, 'hilos')).every((n) => /^[A-Za-z0-9_.-]+$/.test(n)));
});

test('UserPromptSubmit en modo completo: solo nombres, corto, y no repite en la misma sesión', opciones, () => {
  const e = entorno(['cerebro-diseno']);
  const r = gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'el bot tarda 7 segundos en copiar las compras del trader' });
  assert.equal(r.codigo, 0);
  assert.match(r.salida, /^\[araña\] Skills que encajan: /);
  assert.match(r.salida, /cerebro-solana:bot-copy-trading/);
  assert.ok(r.salida.trim().length <= 230, `midió ${r.salida.trim().length}`);
  assert.ok(!r.salida.includes('arana leer'));
  // Mismo tema otra vez: ya se lo dijo, no gasta tokens de nuevo
  assert.equal(gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'el bot sigue tardando en copiar las compras' }).salida, '');
  // Otra sesión sí lo recibe
  assert.match(gancho(e, 'UserPromptSubmit', { session_id: 's2', cwd: e.base, prompt: 'el bot tarda en copiar las compras' }).salida, /bot-copy-trading/);
  // Skill de plugin apagado
  const apagada = gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'hazme una miniatura para el juego' });
  assert.match(apagada.salida, /Apagadas que servirían: cerebro-diseno:miniaturas-y-graficos/);
});

test('UserPromptSubmit: cero salida cuando no hay coincidencia clara', opciones, () => {
  const e = entorno();
  for (const prompt of ['hola', 'gracias', 'sí, hazlo', '/compact', '!ls', 'qué hora es', 'ok continúa']) {
    const r = gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt });
    assert.equal(r.salida, '', prompt);
    assert.equal(r.codigo, 0);
  }
});

test('UserPromptSubmit en modo ligero: entrega por ruta con `arana leer` y avisa de MCP/agentes', opciones, () => {
  const e = entorno(['cerebro-solana', 'cerebro-codigo', 'cerebro-diseno']);
  ponerLigero(e);
  const r = gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'el bot tarda 7 segundos en copiar las compras del trader' });
  assert.match(r.salida, /^\[araña\] Skills locales que encajan \(cárgalas solo si aplican: corre `arana leer <id>`\): /);
  assert.match(r.salida, /cerebro-solana:bot-copy-trading — /);
  // cerebro-solana trae MCP y un agente: se avisa qué se pierde y cómo prenderlo solo aquí
  assert.match(r.salida, /plugin cerebro-solana apagado: su MCP\/agentes no están disponibles; préndelo con `claude plugin enable cerebro-solana@cerebro --scope local` si los necesitas/);
  assert.equal(r.salida.split('plugin cerebro-solana apagado').length, 2, 'el aviso va una sola vez por plugin');
  assert.ok(r.salida.split(' — ').length >= 3, 'caben al menos dos skills además del aviso');
  assert.ok(r.salida.trim().length <= 450, `midió ${r.salida.trim().length}`);
  // Un plugin apagado sin MCP ni agentes no lleva aviso
  const simple = gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'hazme una miniatura para el juego' });
  assert.match(simple.salida, /cerebro-diseno:miniaturas-y-graficos — /);
  assert.ok(!simple.salida.includes('apagado:'));
  assert.equal(gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'hola' }).salida, '');
});

test('se puede apagar la sugerencia desde config.json', opciones, () => {
  const e = entorno();
  escribir(path.join(e.dirDatos, 'config.json'), { arana: { sugerir: false } });
  assert.equal(gancho(e, 'UserPromptSubmit', { session_id: 's1', cwd: e.base, prompt: 'el bot tarda en copiar las compras' }).salida, '');
});

test('Stop y PreCompact guardan el hilo; SessionStart(compact|resume) lo devuelve', () => {
  const e = entorno();
  const transcript = path.join(e.base, 'sesion.jsonl');
  const lineas = fs.readFileSync(FIXTURE, 'utf8').split('\n');
  // Primero solo la mitad del transcript, luego el resto: el hook sigue desde donde se quedó.
  fs.writeFileSync(transcript, lineas.slice(0, 19).join('\n') + '\n');
  const datos = { session_id: 'abc-123', transcript_path: transcript, cwd: e.base };
  assert.equal(gancho(e, 'Stop', datos).salida, '');
  const md1 = fs.readFileSync(path.join(e.dirDatos, 'hilos', 'abc-123.md'), 'utf8');
  assert.match(md1, /^## Hilo de la sesión \(guardado por la araña, sin IA\)/);
  assert.ok(!md1.includes('src/medir.ts'));
  const estado1 = JSON.parse(fs.readFileSync(path.join(e.dirDatos, 'hilos', 'abc-123.json'), 'utf8'));
  fs.appendFileSync(transcript, lineas.slice(19).join('\n') + '\n');
  assert.equal(gancho(e, 'PreCompact', { ...datos, trigger: 'auto' }).salida, '');
  const estado2 = JSON.parse(fs.readFileSync(path.join(e.dirDatos, 'hilos', 'abc-123.json'), 'utf8'));
  assert.ok(estado2.offset > estado1.offset);
  assert.equal(estado2.offset, fs.statSync(transcript).size);

  const tras = gancho(e, 'SessionStart', { ...datos, source: 'compact' });
  assert.match(tras.salida, /^## Hilo de la sesión/);
  assert.match(tras.salida, /Objetivo: el bot tarda como 7 segundos/);
  assert.match(tras.salida, /src\/detector\.ts \(editado ×3\)/);
  assert.match(tras.salida, /src\/medir\.ts \(creado\)/);
  assert.match(tras.salida, /Agregar priority fee dinámico/);
  assert.ok(tras.salida.trim().length <= 1800);
  assert.equal(gancho(e, 'SessionStart', { ...datos, source: 'resume' }).salida, tras.salida);
  // Arranque normal en modo completo: cero tokens
  assert.equal(gancho(e, 'SessionStart', { ...datos, source: 'startup' }).salida, '');
  assert.equal(gancho(e, 'SessionStart', { ...datos, source: 'clear' }).salida, '');
  // Sesión sin hilo guardado pero con transcript: lo arma al vuelo
  const nueva = gancho(e, 'SessionStart', { session_id: 'otra', transcript_path: transcript, source: 'resume' });
  assert.match(nueva.salida, /^## Hilo de la sesión/);
  // Sesión sin nada: silencio
  assert.equal(gancho(e, 'SessionStart', { session_id: 'vacia', source: 'compact' }).salida, '');

  const eventos = fs.readFileSync(path.join(e.dirDatos, 'eventos.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(eventos.slice(0, 3).map((x) => x.evento), ['Stop', 'PreCompact', 'SessionStart']);
  assert.equal(eventos[1].disparo, 'auto');
  assert.equal(eventos[2].origen, 'compact');
});

test('SessionStart(startup|clear) en modo ligero: una nota corta', opciones, () => {
  const e = entorno(['cerebro-solana', 'cerebro-base', 'cerebro-juegos']);
  ponerLigero(e);
  const r = gancho(e, 'SessionStart', { session_id: 's1', source: 'startup', cwd: e.base });
  assert.match(r.salida, /^\[araña\] Modo ligero: hay \d+ skills locales apagadas/);
  assert.match(r.salida, /arana buscar/);
  assert.match(r.salida, /arana leer <id>/);
  assert.match(r.salida, /cerebro-base:modo-mentor, cerebro-base:investigar-antes-de-codear, cerebro-base:ahorrar-tokens/);
  assert.ok(r.salida.trim().length <= 450, `midió ${r.salida.trim().length}`);
  assert.equal(gancho(e, 'SessionStart', { session_id: 's1', source: 'clear', cwd: e.base }).salida, r.salida);
});

test('Notification agrega una línea a eventos.jsonl', () => {
  const e = entorno();
  const r = gancho(e, 'Notification', { session_id: 's9', notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' });
  assert.equal(r.salida, '');
  const ultima = JSON.parse(fs.readFileSync(path.join(e.dirDatos, 'eventos.jsonl'), 'utf8').trim().split('\n').pop());
  assert.equal(ultima.evento, 'Notification');
  assert.equal(ultima.clase, 'permission_prompt');
  assert.equal(ultima.sesion, 's9');
});

test('los hooks son rápidos', opciones, () => {
  const e = entorno();
  gancho(e, 'UserPromptSubmit', { session_id: 'c', cwd: e.base, prompt: 'calentar el índice del bot' });
  const tiempos = [];
  for (let i = 0; i < 5; i++) tiempos.push(gancho(e, 'UserPromptSubmit', { session_id: 'r' + i, cwd: e.base, prompt: 'el bot tarda 7 segundos en copiar las compras' }).ms);
  tiempos.sort((a, b) => a - b);
  // Objetivo 150 ms; se deja margen porque la máquina de pruebas puede ir cargada.
  assert.ok(tiempos[2] < 400, `mediana ${tiempos[2].toFixed(0)} ms`);
});

test('CLI: indice, recomendar, buscar, leer e hilo', opciones, () => {
  const e = entorno(['cerebro-solana']);
  const indice = JSON.parse(correr(e, ['indice', '--json']).salida);
  const solana = indice.plugins.find((p) => p.nombre === 'cerebro-solana');
  assert.equal(solana.activo, false);
  assert.deepEqual(solana.extras, { hooks: false, mcp: true, agentes: true });
  assert.ok(solana.skills.every((s) => path.isAbsolute(s.ruta) && s.ruta.endsWith('SKILL.md') && s.dir === path.dirname(s.ruta) && !('terminos' in s)));
  assert.match(correr(e, ['indice']).salida, /apagado\s+cerebro-solana/);

  const rec = JSON.parse(correr(e, ['recomendar', 'hazme una miniatura para el juego', '--json']).salida);
  assert.deepEqual(Object.keys(rec[0]).sort(), ['activo', 'id', 'puntaje']);
  assert.equal(rec[0].id, 'cerebro-diseno:miniaturas-y-graficos');
  assert.match(correr(e, ['recomendar', 'hola']).salida, /sin coincidencia clara/);

  const buscado = correr(e, ['buscar', 'websocket', '-k', '3']).salida.trim().split('\n');
  assert.ok(buscado.length <= 3 && buscado.length >= 1);
  for (const l of buscado) {
    assert.match(l, /^\S+ — .+/);
    assert.ok(l.split(' — ')[1].replace(/ \((plugin apagado|solo manual)\)$/, '').length <= 90, l);
  }

  // leer funciona aunque el plugin esté apagado: sin frontmatter y con la carpeta en la primera línea
  const leida = correr(e, ['leer', 'cerebro-solana:bot-copy-trading']);
  assert.equal(leida.codigo, 0);
  const primera = leida.salida.split('\n')[0];
  assert.match(primera, /^# skill cerebro-solana:bot-copy-trading · carpeta: \/.+\/skills\/bot-copy-trading$/);
  assert.ok(!leida.salida.includes('\n---\n') || !/^---/m.test(leida.salida.split('\n').slice(0, 5).join('\n')));
  assert.ok(!/^name: /m.test(leida.salida.split('\n').slice(0, 6).join('\n')));
  assert.equal(correr(e, ['leer', 'bot-copy-trading']).salida, leida.salida, 'también por nombre suelto');
  const mala = correr(e, ['leer', 'no-existe-xyz']);
  assert.equal(mala.codigo, 1);
  assert.equal(mala.salida, '');

  const hilo = JSON.parse(correr(e, ['hilo', FIXTURE]).salida);
  assert.equal(hilo.turnos, 3);
  assert.match(correr(e, ['hilo', FIXTURE, '--md']).salida, /^## Hilo de la sesión/);
  assert.equal(correr(e, ['hilo', '/no/existe.jsonl']).codigo, 1);
  assert.equal(correr(e, ['comando-raro']).codigo, 2);
});

test('leer sustituye ${CLAUDE_SKILL_DIR} y ${CLAUDE_PLUGIN_ROOT}', () => {
  const base = temporal();
  const configDir = path.join(base, '.claude');
  const raiz = path.join(configDir, 'plugins', 'cache', 'm', 'p', '1.0.0');
  escribir(path.join(raiz, '.claude-plugin', 'plugin.json'), { name: 'p' });
  escribir(path.join(raiz, 'skills', 's', 'SKILL.md'), '---\nname: s\ndescription: prueba\n---\nCorre `${CLAUDE_SKILL_DIR}/scripts/x.sh` y lee ${CLAUDE_PLUGIN_ROOT}/README.md\n');
  escribir(path.join(configDir, 'plugins', 'installed_plugins.json'), { version: 2, plugins: { 'p@m': [{ scope: 'user', installPath: raiz, version: '1.0.0' }] } });
  const e = { base, env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, XDG_STATE_HOME: path.join(base, 'estado'), HOME: base } };
  const r = correr(e, ['leer', 'p:s']);
  assert.equal(r.codigo, 0);
  assert.equal(r.salida, `# skill p:s · carpeta: ${path.join(raiz, 'skills', 's')}\nCorre \`${path.join(raiz, 'skills', 's')}/scripts/x.sh\` y lee ${raiz}/README.md\n`);
});

test('el lanzador bin/arana existe y es ejecutable', () => {
  const lanzador = path.join(RAIZ_PLUGIN, 'bin', 'arana');
  assert.ok(fs.statSync(lanzador).mode & 0o111);
  const r = spawnSync(lanzador, ['ayuda'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /arana leer/);
});
