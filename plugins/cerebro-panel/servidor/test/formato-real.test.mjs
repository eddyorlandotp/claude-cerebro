// El lector contra la forma REAL de los transcripts (Claude Code 2.1.32x). El fixture es inventado
// (servidor/generar-fixture-real.mjs) pero cada registro copia la estructura medida en sesiones reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Interprete, clasificar, resumir } from '../lib/transcript.mjs';
import { Vigia, leerMeta } from '../lib/vigia.mjs';
import { Estado } from '../lib/estado.mjs';

const ORIGEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'formato-real', 'proyecto');
const S = '11111111-2222-4333-8444-555555555555';

/** Copia el fixture a una carpeta de config temporal y devuelve los eventos tal como los vería el servidor. */
function reproducir({ ventanas } = {}) {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'real-'));
  const destino = path.join(config, 'projects', 'proyecto');
  fs.cpSync(ORIGEN, destino, { recursive: true });
  const v = new Vigia({ configDir: config, intervaloBusqueda: 0 });
  let it = null;
  const eventos = [];
  v.on('sesion', ({ id }) => { it = new Interprete({ sesion: id, ventanas }); });
  v.on('linea', ({ texto, agente, meta }) => eventos.push(...it.linea(texto, { agente, meta })));
  v.on('agente-fin', ({ agente }) => eventos.push(...it.cerrarSubagente(agente, it.ultimoTs)));
  v.tic();
  return { eventos, it, v, destino };
}
const de = (eventos, tipo) => eventos.filter((e) => e.tipo === tipo);

test('leerMeta: enlaza el archivo del subagente con el tool_use que lo lanzó', () => {
  const dir = path.join(ORIGEN, S, 'subagents');
  assert.deepEqual(leerMeta(path.join(dir, 'agent-aaa111.jsonl')), { toolUseId: 'toolu_agA', tipoAgente: 'general-purpose', descripcion: 'Precios en cero', padre: null, terminado: true });
  assert.equal(leerMeta(path.join(dir, 'agent-bbb222.jsonl')).terminado, false);
  assert.equal(leerMeta(path.join(dir, 'agent-ccc333.jsonl')).padre, 'bbb222');
  assert.equal(leerMeta(path.join(dir, 'no-existe.jsonl')), null);
});

test('formato real: pensamiento vacío, mensaje repartido en líneas, registros ajenos ignorados', () => {
  const { eventos } = reproducir();
  const pensamientos = de(eventos, 'pensamiento');
  assert.ok(pensamientos.length >= 2);
  assert.ok(pensamientos.every((p) => p.texto === ''), 'los bloques thinking llegan vacíos (solo firma)');
  assert.ok(!eventos.some((e) => e.id === 'toolu_fantasma'), 'api-request-blob no es parte de la conversación');
  assert.ok(!JSON.stringify(eventos).includes('esto-no-debe-verse'));
  // msg_1 llega en 3 líneas con el mismo uso: la salida se cuenta una sola vez
  const primerUso = de(eventos, 'uso')[0];
  assert.equal(primerUso.salida, 40);
  assert.equal(primerUso.contexto, 10 + 5000 + 300);
});

test('formato real: el pedido pegado se limpia y el mensaje en cola es un prompt del mismo turno', () => {
  const { eventos, it } = reproducir();
  const prompts = de(eventos, 'prompt');
  assert.deepEqual(prompts.map((p) => [p.texto, p.enCola === true]), [
    ['Arregla el carrito: no suma el envío.', false],
    ['y de paso quita el botón viejo', true],
    ['ahora revisa también los descuentos', false],
  ]);
  assert.equal(it.turno.numero, 2, 'dos pedidos; el mensaje en cola no abre turno');
  // El estado del servidor tampoco reinicia el turno con un mensaje en cola
  const est = new Estado();
  for (const e of eventos.slice(0, eventos.indexOf(prompts[1]) + 1)) est.aplicar(e);
  assert.equal(est.turno.numero, 1);
  assert.ok(est.eventosTurno.length > 3);
});

test('formato real: tool_use y tool_result se emparejan; el error trae su primera línea', () => {
  const { eventos, it } = reproducir();
  const h = de(eventos, 'herramienta');
  const inicios = h.filter((e) => e.fase === 'inicio');
  const fines = h.filter((e) => e.fase === 'fin');
  assert.equal(inicios.length, fines.length);
  assert.equal(it.abiertas.size, 0);
  const mal = fines.find((e) => e.id === 'toolu_mal');
  assert.equal(mal.ok, false);
  assert.equal(mal.detalle, 'Exit code 1');
  assert.equal(fines.find((e) => e.id === 'toolu_leer').ok, true);
  assert.equal(clasificar('Monitor'), 'comando');
  assert.equal(clasificar('TaskStop'), 'comando');
  assert.equal(inicios.find((e) => e.id === 'toolu_mon').resumen, 'esperar a que acaben las pruebas');
  assert.equal(inicios.find((e) => e.id === 'toolu_alto').resumen, 'btarea1');
  assert.equal(resumir('SendMessage', { to: 'aaa111', summary: 'revisar descuentos', message: 'x' }), 'revisar descuentos');
});

test('formato real: subagentes enlazados por meta.json, anidados, en segundo plano y reanudados', () => {
  const { eventos, it } = reproducir();
  const sub = de(eventos, 'subagente').map((e) => `${e.id}:${e.fase}`);
  assert.deepEqual(sub, [
    'toolu_agA:inicio', 'toolu_agB:inicio', 'toolu_agC:inicio',
    'toolu_agA:fin',                // llegó su tool_result
    'toolu_agC:fin',                // tool_result dentro del archivo de B
    'toolu_agA:inicio',             // SendMessage lo reanuda
    'toolu_agA:fin',                // su meta.json dice finished
  ]);
  // Cada paso de un subagente lleva el id del tool_use que lo lanzó, no el nombre de su archivo
  const porAgente = (id) => de(eventos, 'herramienta').filter((e) => e.fase === 'inicio' && e.agente === id).map((e) => e.nombre);
  assert.deepEqual(porAgente('toolu_agA'), ['Grep', 'Read']);
  assert.deepEqual(porAgente('toolu_agB'), ['Agent']);
  assert.deepEqual(porAgente('toolu_agC'), ['Bash']);
  assert.equal(it.subagentes.get('toolu_agB').fondo, true, 'run_in_background llega como texto "true"');
  assert.equal(it.subagentes.get('toolu_agB').cerrado, false, 'B no tiene finished en su meta: sigue vivo');
  // La historia sale ordenada por fecha: el Grep de A va antes que el resultado del Agent A
  const i = (pred) => eventos.findIndex(pred);
  assert.ok(i((e) => e.tipo === 'herramienta' && e.nombre === 'Grep') < i((e) => e.tipo === 'herramienta' && e.id === 'toolu_agA' && e.fase === 'fin'));
  // Red de seguridad: un subagente callado demasiado tiempo se cierra
  const cierre = it.caducarSubagentes(it.ultimoTs + 16 * 60 * 1000);
  assert.deepEqual(cierre.map((e) => `${e.id}:${e.fase}`), ['toolu_agB:fin']);
});

test('formato real: en vivo, el meta que pasa a finished cierra al subagente', () => {
  const { eventos, v, destino, it } = reproducir();
  eventos.length = 0;
  const meta = path.join(destino, S, 'subagents', 'agent-bbb222.meta.json');
  fs.appendFileSync(path.join(destino, S, 'subagents', 'agent-bbb222.jsonl'), JSON.stringify({ type: 'assistant', isSidechain: true, agentId: 'bbb222', timestamp: new Date().toISOString(), message: { id: 'sb_9', model: 'claude-prueba-9', content: [{ type: 'text', text: 'Terminé.' }], stop_reason: 'end_turn' } }) + '\n');
  v.tic();
  assert.deepEqual(eventos.map((e) => e.tipo), ['dicho']);
  assert.equal(eventos[0].agente, 'toolu_agB');
  fs.writeFileSync(meta, JSON.stringify({ ...JSON.parse(fs.readFileSync(meta, 'utf8')), finished: true }));
  v.actual.subagentes.get('agent-bbb222.jsonl').revisado = 0;
  v.tic();
  assert.deepEqual(eventos.slice(1).map((e) => `${e.tipo}:${e.id}:${e.fase}`), ['subagente:toolu_agB:fin']);
  assert.equal(it.subagentes.get('toolu_agB').cerrado, true);
});

test('formato real: modelo, costo y ventana de contexto', () => {
  const ventanas = {};
  const { eventos } = reproducir({ ventanas });
  const sesion = de(eventos, 'sesion').at(-1);
  assert.equal(sesion.modelo, 'claude-prueba-9', 'el mensaje <synthetic> de error no cambia el modelo');
  assert.equal(sesion.proyecto, 'tienda');
  const usos = de(eventos, 'uso');
  assert.equal(usos.find((u) => u.costoUSD != null).costoUSD, 0.4321);
  assert.equal(usos[0].ventana, 200000);
  assert.equal(usos.at(-1).ventana, 1000000, 'al pasar de 200k se sabe que la ventana es de 1M');
  assert.deepEqual(ventanas, { 'claude-prueba-9': 1000000 }, 'y se recuerda para ese modelo');
  // Una sesión nueva con ese modelo arranca ya con 1M
  const otra = reproducir({ ventanas });
  assert.equal(de(otra.eventos, 'uso')[0].ventana, 1000000);
});
