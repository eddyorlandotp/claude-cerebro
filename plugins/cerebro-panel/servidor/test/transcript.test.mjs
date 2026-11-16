import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Interprete, interpretarTexto, clasificar, resumir, skillPorRuta } from '../lib/transcript.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const basica = fs.readFileSync(path.join(FIXTURES, 'sesion-basica.jsonl'), 'utf8');
const S2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('clasificar sigue la tabla del contrato', () => {
  const tabla = {
    Read: 'leer', NotebookRead: 'leer', Grep: 'buscar', Glob: 'buscar', ToolSearch: 'buscar', LS: 'buscar',
    Bash: 'comando', BashOutput: 'comando', KillShell: 'comando', Edit: 'editar', Write: 'editar', MultiEdit: 'editar',
    NotebookEdit: 'editar', WebFetch: 'web', WebSearch: 'web', Task: 'agente', Agent: 'agente', Skill: 'skill',
    mcp__github__create_issue: 'mcp', TodoWrite: 'tarea', TaskCreate: 'tarea', TaskUpdate: 'tarea',
    AskUserQuestion: 'pregunta', HerramientaNueva: 'otro',
  };
  for (const [nombre, clase] of Object.entries(tabla)) assert.equal(clasificar(nombre), clase, nombre);
  assert.equal(clasificar(undefined), 'otro');
});

test('resumir: nunca pasa de 80 caracteres y dice lo importante', () => {
  const cwd = '/home/u/proyecto';
  assert.equal(resumir('Read', { file_path: '/home/u/proyecto/src/a.ts' }, cwd), 'src/a.ts');
  assert.equal(resumir('Bash', { command: 'npm   test\n-- x' }, cwd), 'npm test -- x');
  assert.equal(resumir('WebFetch', { url: 'https://www.ejemplo.com/docs' }, cwd), 'ejemplo.com/docs');
  assert.equal(resumir('Skill', { skill: '/plugin:cosa' }, cwd), 'plugin:cosa');
  assert.equal(resumir('Agent', { description: 'Buscar límites', prompt: 'largo' }, cwd), 'Buscar límites');
  const casos = [
    ['Read', { file_path: '/muy/' + 'largo/'.repeat(40) + 'archivo.ts' }],
    ['Bash', { command: 'echo ' + 'x'.repeat(500) }],
    ['Grep', { pattern: 'p'.repeat(200), path: '/otro/lado' }],
    ['WebSearch', { query: 'q'.repeat(300) }],
    ['mcp__x__y', { cosa: 'z'.repeat(300) }],
    ['Desconocida', null],
    ['TodoWrite', { todos: 'no es lista' }],
    ['AskUserQuestion', { questions: [{ question: '¿' + 'w'.repeat(200) + '?' }] }],
  ];
  for (const [n, i] of casos) {
    const r = resumir(n, i, cwd);
    assert.equal(typeof r, 'string');
    assert.ok(r.length <= 80, `${n}: ${r.length}`);
  }
  assert.ok(resumir('Read', { file_path: '/muy/' + 'largo/'.repeat(40) + 'archivo.ts' }, cwd).endsWith('archivo.ts'));
});

test('skillPorRuta reconoce Read de SKILL.md y `arana leer`', () => {
  assert.equal(skillPorRuta('Read', { file_path: '/x/plugins/cache/m/p/1.0/skills/mi-skill/SKILL.md' }).nombre, 'mi-skill');
  assert.equal(skillPorRuta('Read', { file_path: '/x/skills/mi-skill/references/tabla.md' }), null);
  assert.equal(skillPorRuta('Bash', { command: 'arana leer cerebro-web:seo-tecnico' }).id, 'cerebro-web:seo-tecnico');
  assert.equal(skillPorRuta('Bash', { command: 'cd x && node /p/arana/bin/arana.mjs leer "pdf" | head' }).id, 'pdf');
  assert.equal(skillPorRuta('Bash', { command: 'arana buscar websocket' }), null);
  assert.equal(skillPorRuta('Bash', { command: 'echo mañana leer algo' }), null);
});

test('transcript básico: secuencia completa de eventos', () => {
  const { eventos } = interpretarTexto(basica);
  const tipos = eventos.map((e) => e.tipo);
  // Todos llevan tipo, ts numérico y sesión
  for (const e of eventos) {
    assert.equal(typeof e.ts, 'number');
    assert.equal(e.sesion, '11111111-2222-4333-8444-555555555555');
  }
  const sesion = eventos.filter((e) => e.tipo === 'sesion').at(-1);
  assert.deepEqual(
    { proyecto: sesion.proyecto, cwd: sesion.cwd, modelo: sesion.modelo, version: sesion.version, rama: sesion.rama },
    { proyecto: 'bot-copias', cwd: '/home/usuario/proyectos/bot-copias', modelo: 'claude-opus-5-5', version: '2.1.325', rama: 'main' },
  );
  assert.equal(tipos[0], 'sesion');

  const prompts = eventos.filter((e) => e.tipo === 'prompt').map((e) => e.texto);
  assert.equal(prompts.length, 3, 'ni el comando local, ni su salida, ni el resumen de compactación, ni los meta son pedidos');
  assert.match(prompts[0], /^el bot tarda como 7 segundos/);
  assert.equal(prompts[1], 'ahora baja el tiempo de envío, usa priority fee', 'sin el recordatorio del sistema');
  assert.equal(prompts[2], '/cerebro-base:cierre-de-sesion rápido');

  const pensamientos = eventos.filter((e) => e.tipo === 'pensamiento');
  assert.equal(pensamientos.length, 2);
  assert.equal(pensamientos[0].texto, '', 'el pensamiento vacío se emite igual: la cara debe ponerse a pensar');
  assert.match(pensamientos[1].texto, /^Antes de tocar nada necesito medir/);
  assert.equal(pensamientos[1].agente, null);

  assert.ok(eventos.some((e) => e.tipo === 'dicho' && e.texto.startsWith('Voy a medir cada etapa')));
});

test('herramientas: inicio y fin emparejados, con error, duración y tamaño', () => {
  const { eventos } = interpretarTexto(basica);
  const h = eventos.filter((e) => e.tipo === 'herramienta');
  const inicios = h.filter((e) => e.fase === 'inicio');
  const fines = h.filter((e) => e.fase === 'fin');
  assert.equal(inicios.length, fines.length);
  for (const i of inicios) {
    const f = fines.find((x) => x.id === i.id);
    assert.ok(f, `falta el fin de ${i.id}`);
    assert.equal(typeof f.ok, 'boolean');
    assert.ok(Number.isInteger(f.ms) && f.ms >= 0);
    assert.ok(Number.isInteger(f.tamano) && f.tamano >= 0);
    assert.ok(i.resumen.length <= 80);
    assert.ok(eventos.indexOf(i) < eventos.indexOf(f));
  }
  const de = (id) => [inicios.find((e) => e.id === id), fines.find((e) => e.id === id)];
  const [leerI, leerF] = de('toolu_read1');
  assert.deepEqual([leerI.nombre, leerI.clase, leerI.resumen], ['Read', 'leer', 'src/detector.ts']);
  assert.equal(leerF.tamano, 2080);
  const [, grepF] = de('toolu_grep1');
  assert.equal(grepF.ms, 41, 'usa la duración medida cuando el transcript la trae');
  const [bashI, bashF] = de('toolu_bash1');
  assert.equal(bashI.clase, 'comando');
  assert.equal(bashF.ok, false);
  assert.equal(bashF.detalle, 'Exit code 1');
  assert.equal(de('toolu_mcp1')[0].clase, 'mcp');
  assert.equal(de('toolu_ask1')[0].clase, 'pregunta');
  assert.ok(eventos.some((e) => e.tipo === 'espera' && e.motivo === 'respuesta'));
});

test('skills usadas: herramienta Skill, Read de SKILL.md, `arana leer` y comando de barra', () => {
  const { eventos } = interpretarTexto(basica);
  const usadas = eventos.filter((e) => e.tipo === 'skill_usada');
  assert.deepEqual(usadas.map((e) => e.id), [
    'cerebro-codigo:depurar-rendimiento',
    'enviar-transacciones-rapido',
    'cerebro-solana:helius-rpc-y-tiempo-real',
    'cerebro-base:cierre-de-sesion',
  ]);
  assert.match(usadas[1].ruta, /skills\/enviar-transacciones-rapido\/SKILL\.md$/);
});

test('subagente en el mismo archivo (isSidechain)', () => {
  const { eventos } = interpretarTexto(basica);
  const sub = eventos.filter((e) => e.tipo === 'subagente');
  assert.deepEqual(sub.map((e) => [e.id, e.fase, e.tipoAgente, e.descripcion]), [
    ['toolu_agente1', 'inicio', 'Explore', 'Buscar límites de websockets en Workers'],
    ['toolu_agente1', 'fin', 'Explore', 'Buscar límites de websockets en Workers'],
  ]);
  const suyos = eventos.filter((e) => e.agente === 'toolu_agente1');
  assert.deepEqual(suyos.map((e) => `${e.tipo}:${e.fase ?? ''}`), ['herramienta:inicio', 'herramienta:fin', 'dicho:']);
  assert.equal(suyos[0].clase, 'web');
  // El encargo del subagente no cuenta como pedido del usuario ni cierra el turno
  assert.ok(!eventos.some((e) => e.tipo === 'prompt' && e.texto.startsWith('Investiga los límites')));
  const [ini, fin] = sub.map((e) => eventos.indexOf(e));
  assert.ok(suyos.every((e) => eventos.indexOf(e) > ini && eventos.indexOf(e) < fin));
});

test('subagente en archivo aparte (<sesion>/subagents/agent-*.jsonl)', () => {
  const interprete = new Interprete({ sesion: S2 });
  const principal = fs.readFileSync(path.join(FIXTURES, 'con-subagente', `${S2}.jsonl`), 'utf8').split('\n');
  const lateral = fs.readFileSync(path.join(FIXTURES, 'con-subagente', S2, 'subagents', 'agent-f00d42.jsonl'), 'utf8').split('\n');
  const eventos = [];
  // Orden en vivo: el pedido y el Task, luego el subagente trabaja, luego vuelve el resultado.
  for (const l of principal.slice(0, 2)) eventos.push(...interprete.linea(l));
  for (const l of lateral) eventos.push(...interprete.linea(l, { agente: 'f00d42' }));
  for (const l of principal.slice(2)) eventos.push(...interprete.linea(l));
  const sub = eventos.filter((e) => e.tipo === 'subagente');
  assert.deepEqual(sub.map((e) => [e.id, e.fase, e.tipoAgente]), [['toolu_ag2', 'inicio', 'general-purpose'], ['toolu_ag2', 'fin', 'general-purpose']]);
  const suyos = eventos.filter((e) => e.agente != null);
  assert.ok(suyos.length >= 4);
  assert.ok(suyos.every((e) => e.agente === 'toolu_ag2'), 'los eventos del archivo usan el mismo id con el que se anunció');
  assert.ok(suyos.some((e) => e.tipo === 'pensamiento' && e.texto.startsWith('Empiezo por buscar')));
  assert.equal(eventos.filter((e) => e.tipo === 'prompt').length, 1);
  // El uso del subagente no mueve la ventana del hilo principal
  assert.equal(eventos.filter((e) => e.tipo === 'uso').at(-1).contexto, 600 + 21000 + 300);
  assert.equal(eventos.filter((e) => e.tipo === 'fin_turno').length, 1);
});

test('subagente que nadie anunció: se anuncia solo', () => {
  const interprete = new Interprete({ sesion: 'x' });
  const eventos = interprete.linea(JSON.stringify({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'hola' }] } }), { agente: 'zzz' });
  assert.deepEqual(eventos.map((e) => e.tipo), ['subagente', 'dicho']);
  assert.equal(eventos[0].id, 'zzz');
  assert.equal(eventos[1].agente, 'zzz');
});

test('uso: contexto = entrada + caché leída + caché creada del último mensaje principal', () => {
  const { eventos } = interpretarTexto(basica);
  const usos = eventos.filter((e) => e.tipo === 'uso');
  for (const u of usos) {
    assert.equal(u.contexto, u.entrada + u.cacheLeida + u.cacheCreada);
    assert.equal(u.ventana, 200000);
  }
  assert.deepEqual([usos[0].entrada, usos[0].cacheLeida, usos[0].contexto], [1200, 38000, 39200]);
  assert.ok(usos.some((u) => u.contexto === 62700) && usos.some((u) => u.contexto === 92700));
  assert.equal(usos.at(-1).costoUSD, 1.0234);
  assert.ok(usos.every((u, i) => i === 0 || u.salida >= usos[i - 1].salida), 'la salida es acumulada');
  // Ventana de 1M cuando el contexto no cabría en 200k
  const grande = new Interprete().linea(JSON.stringify({ type: 'assistant', message: { id: 'm', model: 'claude-x', content: [], usage: { input_tokens: 10, cache_read_input_tokens: 450000 } } }));
  assert.equal(grande.find((e) => e.tipo === 'uso').ventana, 1000000);
});

test('el mismo mensaje repartido en varias líneas no se cuenta doble', () => {
  const i = new Interprete();
  const linea = (bloque, salida) => JSON.stringify({ type: 'assistant', message: { id: 'msg_1', model: 'm', content: [bloque], usage: { input_tokens: 100, output_tokens: salida, cache_read_input_tokens: 5000 } } });
  i.linea(linea({ type: 'thinking', thinking: 'a' }, 10));
  i.linea(linea({ type: 'text', text: 'b' }, 40));
  i.linea(linea({ type: 'tool_use', id: 't1', name: 'Read', input: {} }, 90));
  assert.deepEqual(i.acumulado, { entrada: 100, salida: 90, cacheLeida: 5000, cacheCreada: 0 });
});

test('turnos, tareas y compactación', () => {
  const { eventos } = interpretarTexto(basica);
  const fines = eventos.filter((e) => e.tipo === 'fin_turno');
  assert.equal(fines.length, 3);
  assert.equal(fines[0].pasos, 13);
  assert.ok(fines.every((f) => Number.isInteger(f.ms) && f.ms >= 0));
  assert.equal(eventos.filter((e) => e.tipo === 'compactacion').length, 1, 'el límite y su resumen son una sola compactación');
  const lista = eventos.find((e) => e.nombre === 'TodoWrite').tareas;
  assert.equal(lista.op, 'lista');
  assert.deepEqual(lista.items.map((t) => t.estado), ['hecho', 'en_curso', 'pendiente']);
  const creada = eventos.find((e) => e.tareas?.op === 'crear');
  assert.deepEqual(creada.tareas.items, [{ id: '4', texto: 'Agregar priority fee dinámico', estado: 'pendiente' }]);
  const actualizada = eventos.find((e) => e.tareas?.op === 'actualizar');
  assert.equal(actualizada.tareas.items[0].estado, 'en_curso');
});

test('cerrarTurno desde fuera (hook Stop) y turno que se cierra con el siguiente pedido', () => {
  const i = new Interprete({ sesion: 's' });
  const usuario = (t, ts) => JSON.stringify({ type: 'user', timestamp: ts, message: { content: t } });
  assert.deepEqual(i.linea(usuario('primer pedido', '2026-11-16T10:00:00Z')).map((e) => e.tipo), ['prompt']);
  assert.deepEqual(i.linea(usuario('segundo pedido', '2026-11-16T10:00:30Z')).map((e) => e.tipo), ['fin_turno', 'prompt']);
  const cierre = i.cerrarTurno(Date.parse('2026-11-16T10:01:00Z'));
  assert.deepEqual(cierre.map((e) => [e.tipo, e.ms]), [['fin_turno', 30000]]);
  assert.deepEqual(i.cerrarTurno(), [], 'cerrar dos veces no repite');
});

test('tolera basura: nunca lanza y no inventa eventos', () => {
  const i = new Interprete({ sesion: 's' });
  const basura = [
    '', '   ', 'no soy json', '{"a":', '[]', '[1,2]', 'null', '42', '"texto"', '{}', '{"type":null}', '{"type":"user"}',
    '{"type":"user","message":null}', '{"type":"user","message":{"content":[null,5,{"type":"tool_result"}]}}',
    '{"type":"assistant","message":{"content":[{"type":"tool_use"},{"type":"tool_use","id":5},null,{"type":"otro"}]}}',
    '{"type":"assistant","message":{"content":"texto suelto","usage":"mal"}}',
    '{"type":"assistant","message":{"content":[{"type":"text"}],"usage":{"input_tokens":"x"}}}',
    '{"type":"system"}', '{"type":"cost-state","totalCostUSD":"caro"}', '{"type":"attachment","attachment":null}',
    '{"type":"summary","summary":{"x":1}}', '{"type":"algo-nuevo","datos":[1,2,3]}', '{"type":"user","timestamp":"no es fecha","message":{"content":"hola"}}',
    '\u0000\u0001\u0002', '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"huerfano","content":"x"}]}}',
  ];
  for (const l of basura) assert.doesNotThrow(() => i.linea(l), l);
  for (const l of [undefined, null, 5, {}, []]) assert.deepEqual(i.linea(l), []);
  assert.deepEqual(new Interprete().linea('{"type":"algo-nuevo"}'), []);
  assert.deepEqual(new Interprete().linea('{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"huerfano","content":"x"}]}}'), []);
});

test('textos largos se recortan: prompt a 600, pensamiento y dicho a 400', () => {
  const i = new Interprete();
  const [p] = i.linea(JSON.stringify({ type: 'user', message: { content: 'a'.repeat(5000) } })).filter((e) => e.tipo === 'prompt');
  assert.equal(p.texto.length, 600);
  const ev = i.linea(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'b'.repeat(5000) }, { type: 'text', text: 'c'.repeat(5000) }] } }));
  assert.equal(ev.find((e) => e.tipo === 'pensamiento').texto.length, 400);
  assert.equal(ev.find((e) => e.tipo === 'dicho').texto.length, 400);
});
