#!/usr/bin/env node
// Genera servidor/test/fixtures/formato-real/: una sesión INVENTADA con la misma estructura que los
// transcripts reales de Claude Code 2.1.32x (medida en la máquina del usuario, ver local/telarana/REPORTE.md).
// Todo el texto es inventado; solo la forma de los registros es real.
//   node servidor/generar-fixture-real.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(AQUI, 'test', 'fixtures', 'formato-real', 'proyecto');
const S = '11111111-2222-4333-8444-555555555555';
const T0 = Date.parse('2026-11-01T10:00:00.000Z');
const base = { sessionId: S, cwd: '/home/u/tienda', version: '2.1.322', gitBranch: 'main', userType: 'external', entrypoint: 'cli' };
let n = 0;
const reg = (seg, r, extra = {}) => ({ parentUuid: null, isSidechain: false, ...r, uuid: `u-${++n}`, timestamp: new Date(T0 + seg * 1000).toISOString(), ...base, ...extra });
const uso = (entrada, lee, crea, sale) => ({
  input_tokens: entrada, cache_read_input_tokens: lee, cache_creation_input_tokens: crea, output_tokens: sale,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: crea }, service_tier: 'standard', iterations: null,
});
const asis = (seg, id, contenido, u, stop = 'tool_use', extra = {}) =>
  reg(seg, { type: 'assistant', requestId: 'req-' + id, message: { model: 'claude-prueba-9', id, type: 'message', role: 'assistant', content: contenido, stop_reason: stop, stop_sequence: null, usage: u } }, extra);
const pensar = { type: 'thinking', thinking: '', signature: 'firma-inventada' }; // así llegan 9 de cada 10
const usa = (id, name, input) => ({ type: 'tool_use', id, name, input, caller: { type: 'direct' } });
const res = (seg, id, content, tur, extra = {}, bloque = {}) =>
  reg(seg, { type: 'user', message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content, ...bloque }] }, toolUseResult: tur, sourceToolAssistantUUID: 'x' }, extra);

const ENCARGO_A = 'Revisa los precios del catálogo y dime cuáles están en cero.';
const ENCARGO_B = 'Cuenta cuántas fotos faltan en la carpeta de productos.';

const principal = [
  { type: 'permission-mode', permissionMode: 'default', sessionId: S },
  { type: 'session-owner', accountUuid: 'cuenta-inventada', organizationUuid: 'org-inventada', sessionId: S },
  reg(0, { type: 'attachment', attachment: { type: 'skill_listing', content: '- ejemplo: skill inventada', skillCount: 1, isInitial: true, names: ['ejemplo'] } }),
  reg(1, { type: 'user', promptId: 'p1', origin: { kind: 'human' }, promptSource: 'typed', turnOrigin: 'human', message: { role: 'user', content: '<pasted_content id="ab12">Arregla el carrito: no suma el envío.</pasted_content>' } }),
  // copias de la petición a la API: traen `message` pero NO son registros de la conversación
  { type: 'api-request', id: 'ar1', sessionId: S, timestamp: new Date(T0 + 1500).toISOString(), params: { model: 'claude-prueba-9', max_tokens: 1000 } },
  { type: 'api-request-blob', hash: 'h1', sessionId: S, message: { role: 'assistant', content: [usa('toolu_fantasma', 'Bash', { command: 'esto-no-debe-verse' })] } },
  // un mismo mensaje llega en varias líneas (una por bloque) con el mismo id y el mismo uso
  asis(2, 'msg_1', [pensar], uso(10, 5000, 300, 40), null, { thinkingDisplay: 'omitted', thinkingDurationMs: 900 }),
  asis(2, 'msg_1', [{ type: 'text', text: 'Voy a mirar cómo se calcula el total.' }], uso(10, 5000, 300, 40), null),
  asis(2, 'msg_1', [usa('toolu_leer', 'Read', { file_path: '/home/u/tienda/src/carrito.js' })], uso(10, 5000, 300, 40)),
  res(3, 'toolu_leer', 'export function total() { return 0; }', { type: 'text', file: { filePath: '/home/u/tienda/src/carrito.js' } }, {}, { is_error: false }),
  reg(3.5, { type: 'attachment', attachment: { type: 'hook_additional_context', content: ['aviso inventado'], hookName: 'PreToolUse:Bash', hookEvent: 'PreToolUse' } }),
  // subagente normal (espera a que termine) y otro en segundo plano; `run_in_background` llega como TEXTO
  asis(4, 'msg_2', [usa('toolu_agA', 'Agent', { description: 'Precios en cero', subagent_type: 'general-purpose', prompt: ENCARGO_A }), usa('toolu_agB', 'Agent', { description: 'Fotos faltantes', run_in_background: 'true', prompt: ENCARGO_B })], uso(12, 5300, 200, 90)),
  res(5, 'toolu_agB', [{ type: 'text', text: 'Agente lanzado en segundo plano.' }], { isAsync: true, status: 'async_launched', agentId: 'bbb222', description: 'Fotos faltantes', prompt: ENCARGO_B }),
  // el usuario escribe a media tarea: NO queda como registro `user`, queda como adjunto
  reg(6, { type: 'attachment', attachment: { type: 'queued_command', prompt: 'y de paso quita el botón viejo', commandMode: 'prompt', origin: { kind: 'human' }, humanTurn: true } }),
  reg(6.5, { type: 'attachment', attachment: { type: 'queued_command', prompt: '<task-notification>ruido de máquina</task-notification>', commandMode: 'task-notification', origin: { kind: 'task-notification' } } }),
  res(9, 'toolu_agA', [{ type: 'text', text: 'Hay tres productos con precio cero.' }], { status: 'completed', agentId: 'aaa111', prompt: ENCARGO_A, totalDurationMs: 4000 }),
  asis(10, 'msg_3', [usa('toolu_mal', 'Bash', { command: 'npm test' })], uso(14, 5600, 150, 30)),
  res(11, 'toolu_mal', 'Exit code 1\nFallaron 2 pruebas', 'Error: Exit code 1', {}, { is_error: true }),
  asis(12, 'msg_4', [usa('toolu_mon', 'Monitor', { description: 'esperar a que acaben las pruebas', command: 'tail -f salida.log' }), usa('toolu_alto', 'TaskStop', { task_id: 'btarea1' })], uso(15, 5700, 100, 20)),
  res(13, 'toolu_mon', 'listo', { stdout: 'listo' }),
  res(13, 'toolu_alto', 'detenida', { message: 'detenida' }),
  asis(14, 'msg_5', [{ type: 'text', text: 'Listo: el total ya suma el envío.' }], uso(16, 5900, 80, 60), 'end_turn'),
  reg(14.1, { type: 'system', subtype: 'turn_duration', durationMs: 13100, messageCount: 12, pendingBackgroundAgentCount: 1, isMeta: false }),
  { type: 'cost-state', sessionId: S, totalCostUSD: 0.4321, modelUsage: {} },
  { type: 'last-prompt', lastPrompt: 'texto inventado', sessionId: S },
  // segundo turno: reanuda al subagente A con SendMessage
  reg(60, { type: 'user', promptId: 'p2', origin: { kind: 'human' }, message: { role: 'user', content: 'ahora revisa también los descuentos' } }),
  asis(61, 'msg_6', [usa('toolu_msj', 'SendMessage', { to: 'aaa111', summary: 'revisar descuentos', message: 'Revisa también los descuentos.', type: 'message' })], uso(18, 6100, 60, 25)),
  res(62, 'toolu_msj', 'Mensaje entregado.', { success: true, message: 'ok', resumedAgentId: 'aaa111', revivedAgentId: 'aaa111' }),
  // error de la API: mensaje sintético, sin uso real
  asis(70, 'msg_err', [{ type: 'text', text: 'API Error: sobrecarga' }], uso(0, 0, 0, 0), 'stop_sequence', { isApiErrorMessage: true }),
];
principal.at(-1).message.model = '<synthetic>';
// contexto que pasa de 200k: la ventana es de 1M
principal.push(asis(80, 'msg_7', [{ type: 'text', text: 'Descuentos revisados.' }], uso(20, 250000, 500, 15), 'end_turn'));

const sub = (id, seg, lineas) => lineas.map((r, i) => ({ ...r, isSidechain: true, agentId: id, timestamp: new Date(T0 + (seg + i) * 1000).toISOString() }));
const agA = sub('aaa111', 4.2, [
  reg(0, { type: 'user', promptId: 'p1', message: { role: 'user', content: ENCARGO_A } }),
  asis(0, 'sa_1', [pensar, usa('toolu_a1', 'Grep', { pattern: 'precio: 0', path: '/home/u/tienda/datos' })], uso(5, 900, 50, 10)),
  res(0, 'toolu_a1', 'datos/catalogo.json:12', { numFiles: 1 }),
  asis(0, 'sa_2', [{ type: 'text', text: 'Hay tres productos con precio cero.' }], uso(6, 950, 20, 12), 'end_turn'),
]);
// lo que hace A cuando lo reanudan en el segundo turno
const agA2 = sub('aaa111', 63, [
  reg(0, { type: 'user', promptId: 'p2', message: { role: 'user', content: 'Revisa también los descuentos.' } }),
  asis(0, 'sa_3', [usa('toolu_a2', 'Read', { file_path: '/home/u/tienda/datos/descuentos.json' })], uso(7, 1000, 20, 8)),
  res(0, 'toolu_a2', '[]', { type: 'text' }),
]);
// B corre en segundo plano y lanza a su vez un sub-subagente (C)
const agB = sub('bbb222', 5.5, [
  reg(0, { type: 'user', promptId: 'p1', message: { role: 'user', content: ENCARGO_B } }),
  asis(0, 'sb_1', [usa('toolu_agC', 'Agent', { description: 'Listar carpeta', prompt: 'Lista la carpeta de fotos.' })], uso(5, 800, 40, 9)),
  res(20, 'toolu_agC', [{ type: 'text', text: 'Faltan dos fotos.' }], { status: 'completed', agentId: 'ccc333' }),
  asis(21, 'sb_2', [{ type: 'text', text: 'Faltan dos fotos.' }], uso(6, 850, 10, 7), 'end_turn'),
]);
agB[2].timestamp = new Date(T0 + 25500).toISOString();
agB[3].timestamp = new Date(T0 + 26500).toISOString();
const agC = sub('ccc333', 7, [
  reg(0, { type: 'user', promptId: 'p1', message: { role: 'user', content: 'Lista la carpeta de fotos.' } }),
  asis(0, 'sc_1', [usa('toolu_c1', 'Bash', { command: 'ls fotos' })], uso(3, 400, 20, 5)),
  res(0, 'toolu_c1', 'a.jpg\nb.jpg', { stdout: 'a.jpg\nb.jpg', stderr: '', interrupted: false }),
]);

const escribir = (ruta, lineas) => fs.writeFileSync(ruta, lineas.map((l) => JSON.stringify(l)).join('\n') + '\n');
fs.rmSync(DIR, { recursive: true, force: true });
const dirSub = path.join(DIR, S, 'subagents');
fs.mkdirSync(dirSub, { recursive: true });
escribir(path.join(DIR, S + '.jsonl'), principal);
escribir(path.join(dirSub, 'agent-aaa111.jsonl'), [...agA, ...agA2]);
escribir(path.join(dirSub, 'agent-bbb222.jsonl'), agB);
escribir(path.join(dirSub, 'agent-ccc333.jsonl'), agC);
const meta = (id, m) => fs.writeFileSync(path.join(dirSub, `agent-${id}.meta.json`), JSON.stringify({ isBuiltIn: true, spawnDepth: 1, requestNonInteractive: false, ...m }));
meta('aaa111', { agentType: 'general-purpose', description: 'Precios en cero', toolUseId: 'toolu_agA', finished: true });
meta('bbb222', { agentType: 'general-purpose', description: 'Fotos faltantes', toolUseId: 'toolu_agB' }); // sin `finished`: sigue corriendo
meta('ccc333', { agentType: 'general-purpose', description: 'Listar carpeta', toolUseId: 'toolu_agC', parentAgentId: 'bbb222', spawnDepth: 2, finished: true });
process.stdout.write(`Fixture escrito en ${DIR}\n`);
