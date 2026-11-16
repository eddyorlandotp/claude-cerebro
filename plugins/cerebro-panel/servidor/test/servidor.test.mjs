// Pruebas de punta a punta del servidor en un puerto libre (0), en modo demo y en modo real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'servidor-'));
// Carpeta de datos propia: las pruebas nunca tocan la del usuario.
process.env.XDG_STATE_HOME = path.join(base, 'estado');
const { crearServidor, leerArgumentos } = await import('../servidor.mjs');
const DEMO = JSON.parse(fs.readFileSync(path.join(AQUI, '..', '..', 'demo', 'sesion-demo.json'), 'utf8'));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function pedir(puerto, ruta, { host, metodo = 'GET' } = {}) {
  return new Promise((resolver, rechazar) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: metodo, headers: host ? { Host: host } : {} }, (res) => {
      let cuerpo = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (cuerpo += d));
      res.on('end', () => resolver({ codigo: res.statusCode, cabeceras: res.headers, cuerpo }));
    });
    req.on('error', rechazar);
    req.end();
  });
}

/** Se conecta a /eventos y junta eventos hasta que `listo(eventos)` sea verdadero o se acabe el tiempo. */
function escucharEventos(puerto, listo, maxMs = 8000) {
  return new Promise((resolver, rechazar) => {
    const eventos = [];
    let resto = '';
    const req = http.get({ host: '127.0.0.1', port: puerto, path: '/eventos' }, (res) => {
      const fin = () => {
        clearTimeout(reloj);
        req.destroy();
        resolver({ eventos, cabeceras: res.headers });
      };
      const reloj = setTimeout(fin, maxMs);
      res.setEncoding('utf8');
      res.on('data', (d) => {
        resto += d;
        let i;
        while ((i = resto.indexOf('\n\n')) >= 0) {
          const bloque = resto.slice(0, i);
          resto = resto.slice(i + 2);
          for (const l of bloque.split('\n')) if (l.startsWith('data: ')) eventos.push(JSON.parse(l.slice(6)));
        }
        if (listo(eventos)) fin();
      });
    });
    req.on('error', (e) => (eventos.length ? resolver({ eventos, cabeceras: {} }) : rechazar(e)));
  });
}

test('leerArgumentos', () => {
  assert.deepEqual(leerArgumentos([]), { puerto: 4317, demo: false, velocidad: 1, configDir: null, ayuda: false });
  assert.deepEqual(leerArgumentos(['--demo', '--puerto', '4399', '--velocidad', '8', '--config-dir', '/x']), { puerto: 4399, demo: true, velocidad: 8, configDir: '/x', ayuda: false });
  assert.equal(leerArgumentos(['--puerto', 'abc']).puerto, 4317);
  assert.equal(leerArgumentos(['--velocidad', '-3']).velocidad, 1);
});

test('modo demo: /salud, /estado, /eventos reproduce el guion en bucle, estáticos y seguridad', async () => {
  const panel = crearServidor({ puerto: 0, demo: true, velocidad: 400, pausaDemo: 150, intervaloLatido: 60 });
  const puerto = await panel.escuchar();
  try {
    assert.equal(panel.servidor.address().address, '127.0.0.1', 'solo escucha en local');
    const salud = await pedir(puerto, '/salud');
    assert.equal(salud.codigo, 200);
    const s = JSON.parse(salud.cuerpo);
    assert.equal(s.ok, true);
    assert.match(s.version, /^\d+\.\d+\.\d+/);
    assert.ok(!('access-control-allow-origin' in salud.cabeceras), 'sin CORS: otra página no puede leer el panel');

    // El guion completo dura ~135 ms a esta velocidad; se escucha hasta ver dos vueltas.
    const { eventos, cabeceras } = await escucharEventos(puerto, (ev) => ev.filter((e) => e.tipo === 'fin_turno').length >= 2 && ev.some((e) => e.tipo === 'latido'));
    assert.match(cabeceras['content-type'], /^text\/event-stream/);
    const tipos = eventos.map((e) => e.tipo);
    assert.equal(tipos[0] === 'sesion' || tipos[0] === 'biblioteca', true);
    assert.ok(tipos.includes('biblioteca') && tipos.includes('hilo'));
    for (const e of eventos) {
      assert.equal(typeof e.tipo, 'string');
      assert.equal(typeof e.ts, 'number');
      assert.equal(e.sesion, 'demo');
      assert.ok(!('t' in e), 'el campo t del guion no viaja');
    }
    // Una vuelta completa, en el orden del guion
    const desde = tipos.indexOf('prompt');
    const hasta = tipos.indexOf('fin_turno', desde);
    const esperados = DEMO.eventos.map((e) => e.tipo);
    const vuelta = tipos.slice(desde, hasta + 1).filter((t) => t !== 'latido');
    assert.deepEqual(vuelta, esperados.slice(esperados.indexOf('prompt'), esperados.indexOf('fin_turno') + 1));
    assert.ok(eventos.filter((e) => e.tipo === 'prompt').length >= 2, 'vuelve a empezar tras la pausa');
    assert.ok(tipos.includes('latido'));
    const sugeridas = eventos.find((e) => e.tipo === 'sugeridas');
    assert.equal(sugeridas.skills.length, 4);

    const estado = JSON.parse((await pedir(puerto, '/estado')).cuerpo);
    assert.equal(estado.sesion.proyecto, 'bot-copias');
    assert.ok(estado.biblioteca.plugins.length > 5);
    assert.ok(estado.turno.numero >= 1);

    // Estáticos
    const guion = await pedir(puerto, '/demo/sesion-demo.json');
    assert.equal(guion.codigo, 200);
    assert.match(guion.cabeceras['content-type'], /application\/json/);
    assert.equal(JSON.parse(guion.cuerpo).eventos.length, DEMO.eventos.length);
    const raiz = await pedir(puerto, '/');
    const hayUi = fs.existsSync(path.join(AQUI, '..', '..', 'ui', 'index.html'));
    assert.equal(raiz.codigo, hayUi ? 200 : 404);
    if (hayUi) assert.match(raiz.cabeceras['content-type'], /text\/html/);
    assert.equal((await pedir(puerto, '/no-existe.js')).codigo, 404);
    assert.equal((await pedir(puerto, '/', { metodo: 'HEAD' })).cuerpo, '');

    // Nada fuera de ui/ y demo/
    for (const ruta of ['/../servidor/servidor.mjs', '/..%2f..%2farana/bin/arana.mjs', '/demo/../docs/CONTRATO.md', '/demo/..%2fdocs%2fCONTRATO.md', '/%2e%2e/%2e%2e/etc/passwd', '/demo/%00']) {
      const r = await pedir(puerto, ruta);
      assert.ok([400, 403, 404].includes(r.codigo), `${ruta} -> ${r.codigo}`);
      assert.ok(!r.cuerpo.includes('Contrato técnico') && !r.cuerpo.includes('root:'), ruta);
    }
    // Solo GET, y solo si la petición viene dirigida a local (contra DNS rebinding)
    assert.equal((await pedir(puerto, '/estado', { metodo: 'POST' })).codigo, 405);
    assert.equal((await pedir(puerto, '/estado', { host: 'malo.example.com' })).codigo, 403);
    assert.equal((await pedir(puerto, '/estado', { host: `localhost:${puerto}` })).codigo, 200);
  } finally {
    await panel.cerrar();
  }
});

test('modo real: sigue un transcript que crece y emite los eventos en vivo', async () => {
  const config = path.join(base, 'claude-real');
  const proyecto = path.join(config, 'projects', '-home-usuario-proyectos-bot-copias');
  fs.mkdirSync(proyecto, { recursive: true });
  // Una skill instalada, para que haya biblioteca y sugerencias
  const raizPlugin = path.join(config, 'plugins', 'cache', 'm', 'solana', '1.0.0');
  fs.mkdirSync(path.join(raizPlugin, 'skills', 'bot-copy-trading'), { recursive: true });
  fs.mkdirSync(path.join(raizPlugin, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(raizPlugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'solana' }));
  fs.writeFileSync(path.join(raizPlugin, 'skills', 'bot-copy-trading', 'SKILL.md'), '---\nname: bot-copy-trading\ndescription: Bot de copy trading en Solana. Úsala para copiar trades, bot lento, latencia.\n---\ncuerpo\n');
  fs.writeFileSync(path.join(config, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'solana@m': [{ scope: 'user', installPath: raizPlugin, version: '1.0.0' }] } }));
  fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({ enabledPlugins: { 'solana@m': true } }));

  const lineas = fs.readFileSync(path.join(AQUI, 'fixtures', 'sesion-basica.jsonl'), 'utf8').split('\n').filter(Boolean);
  const transcript = path.join(proyecto, '11111111-2222-4333-8444-555555555555.jsonl');
  // Ya había un turno anterior terminado antes de arrancar el panel (historia)
  fs.writeFileSync(transcript, lineas.slice(0, 2).join('\n') + '\n');

  const panel = crearServidor({ puerto: 0, configDir: config, intervaloLatido: 60000 });
  const puerto = await panel.escuchar();
  try {
    await esperar(600);
    let estado = JSON.parse((await pedir(puerto, '/estado')).cuerpo);
    assert.equal(estado.sesion.proyecto, 'bot-copias');
    assert.equal(estado.biblioteca.plugins[0].nombre, 'solana');
    assert.equal(JSON.parse((await pedir(puerto, '/salud')).cuerpo).sesion, '11111111-2222-4333-8444-555555555555');

    // Cliente conectado mientras Claude "trabaja": se van agregando líneas al transcript
    const escucha = escucharEventos(puerto, (ev) => ev.some((e) => e.tipo === 'fin_turno') && ev.some((e) => e.tipo === 'hilo' && e.turnos >= 1 && e.archivos.length), 10000);
    await esperar(200);
    for (const l of lineas.slice(2, 42)) {
      fs.appendFileSync(transcript, l + '\n');
      await esperar(8);
    }
    const { eventos } = await escucha;
    const tipos = eventos.map((e) => e.tipo);
    // Al conectar: la foto del estado (lo que ya había), incluido el pedido en curso y sus sugerencias
    assert.deepEqual(tipos.slice(0, 3), ['sesion', 'biblioteca', 'hilo']);
    assert.ok(eventos.some((e) => e.tipo === 'prompt' && e.texto.startsWith('el bot tarda')));
    const sugeridas = eventos.find((e) => e.tipo === 'sugeridas');
    assert.deepEqual(sugeridas.skills.map((s) => s.id), ['solana:bot-copy-trading'], 'el servidor calcula las sugeridas sin depender de los hooks');
    assert.deepEqual(sugeridas.apagadas, []);
    // En vivo: pensamiento, herramientas emparejadas, error, subagente, uso, fin de turno e hilo
    for (const t of ['pensamiento', 'dicho', 'herramienta', 'skill_usada', 'subagente', 'uso', 'fin_turno', 'hilo']) assert.ok(tipos.includes(t), `faltó ${t}`);
    assert.ok(eventos.some((e) => e.tipo === 'herramienta' && e.fase === 'fin' && e.ok === false));
    const hilo = eventos.filter((e) => e.tipo === 'hilo').at(-1);
    assert.match(hilo.objetivo, /^el bot tarda/);
    assert.deepEqual(hilo.archivos[0], { ruta: 'src/detector.ts', veces: 3, accion: 'editado' });
    assert.ok(tipos.lastIndexOf('hilo') > tipos.indexOf('fin_turno'), 'el hilo sale al cerrar el turno');
    assert.ok(eventos.every((e) => e.sesion === '11111111-2222-4333-8444-555555555555'));

    // Un hook avisa que Claude espera permiso (eventos.jsonl)
    const espera = escucharEventos(puerto, (ev) => ev.some((e) => e.tipo === 'espera' && e.motivo === 'permiso'), 4000);
    await esperar(150);
    fs.appendFileSync(path.join(process.env.XDG_STATE_HOME, 'cerebro-panel', 'eventos.jsonl'),
      JSON.stringify({ ts: Date.now(), evento: 'Notification', sesion: '11111111-2222-4333-8444-555555555555', clase: 'permission_prompt' }) + '\n' +
      JSON.stringify({ ts: Date.now(), evento: 'Notification', sesion: 'otra-sesion', clase: 'permission_prompt' }) + '\nbasura\n');
    assert.ok((await espera).eventos.some((e) => e.tipo === 'espera' && e.motivo === 'permiso'));
    estado = JSON.parse((await pedir(puerto, '/estado')).cuerpo);
    assert.equal(estado.espera, 'permiso');

    // Empieza otra sesión más nueva: el panel se cambia solo
    const otra = path.join(proyecto, '99999999-0000-4000-8000-000000000000.jsonl');
    fs.writeFileSync(otra, JSON.stringify({ type: 'user', sessionId: '99999999-0000-4000-8000-000000000000', cwd: '/home/usuario/otro', timestamp: new Date().toISOString(), message: { content: 'hazme una landing para el juego' } }) + '\n');
    const futuro = new Date(Date.now() + 30000);
    fs.utimesSync(otra, futuro, futuro);
    await esperar(2600);
    estado = JSON.parse((await pedir(puerto, '/estado')).cuerpo);
    assert.equal(estado.sesion.proyecto, 'otro');
    assert.equal(estado.sesion.sesion, '99999999-0000-4000-8000-000000000000');
    assert.equal(estado.turno.numero, 1);
    assert.equal(estado.espera, null);
  } finally {
    await panel.cerrar();
  }
});

test('modo real sin ninguna sesión: responde y espera', async () => {
  const panel = crearServidor({ puerto: 0, configDir: path.join(base, 'vacio') });
  const puerto = await panel.escuchar();
  try {
    assert.equal(JSON.parse((await pedir(puerto, '/salud')).cuerpo).sesion, null);
    const estado = JSON.parse((await pedir(puerto, '/estado')).cuerpo);
    assert.equal(estado.sesion, null);
    assert.deepEqual(estado.biblioteca.plugins, []);
    const { eventos } = await escucharEventos(puerto, (ev) => ev.length >= 2, 1500);
    assert.deepEqual(eventos.map((e) => e.tipo), ['biblioteca', 'hilo']);
  } finally {
    await panel.cerrar();
  }
});

test('puerto ocupado: falla con un error claro en vez de quedarse colgado', async () => {
  const a = crearServidor({ puerto: 0, demo: true, velocidad: 100 });
  const puerto = await a.escuchar();
  const b = crearServidor({ puerto, demo: true });
  try {
    await assert.rejects(b.escuchar(), (e) => e.code === 'EADDRINUSE');
  } finally {
    await a.cerrar();
    await b.cerrar().catch(() => {});
  }
});
