// Genera los transcripts sintéticos de prueba (formato observado en Claude Code 2.1.3xx).
// No contienen datos reales. Uso: node servidor/generar-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test', 'fixtures');
const SESION = '11111111-2222-4333-8444-555555555555';
const CWD = '/home/usuario/proyectos/bot-copias';
let reloj = Date.parse('2026-11-16T15:00:00.000Z');
let n = 0;
let padre = null;

const base = (extra = {}) => {
  reloj += 700;
  const uuid = `u-${String(++n).padStart(4, '0')}`;
  const r = {
    parentUuid: padre, isSidechain: false, userType: 'external', cwd: CWD, sessionId: SESION, version: '2.1.325',
    gitBranch: 'main', uuid, timestamp: new Date(reloj).toISOString(), ...extra,
  };
  padre = uuid;
  return r;
};
const uso = (entrada, salida, leida, creada) => ({
  input_tokens: entrada, output_tokens: salida, cache_read_input_tokens: leida, cache_creation_input_tokens: creada,
  service_tier: 'standard',
});
let msg = 0;
const asistente = (bloques, u, extra = {}, stop = 'tool_use') =>
  base({
    type: 'assistant', requestId: `req_${++msg}`,
    message: { id: `msg_${msg}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: bloques, stop_reason: stop, usage: u },
    ...extra,
  });
const usuario = (contenido, extra = {}) => base({ type: 'user', message: { role: 'user', content: contenido }, ...extra });
const resultado = (id, contenido, extra = {}, error = false) =>
  usuario([{ type: 'tool_result', tool_use_id: id, content: contenido, ...(error ? { is_error: true } : {}) }], extra);

const L = [];
L.push({ type: 'summary', summary: 'Bajar la latencia del bot', leafUuid: 'u-0000' });
L.push(usuario('el bot tarda como 7 segundos en copiar las compras del trader, quiero que baje a 2 o menos. revisa dónde se va el tiempo y arréglalo'));
L.push({ type: 'attachment', attachment: { type: 'skill_listing', names: ['cerebro-codigo:depurar-rendimiento'] }, sessionId: SESION, timestamp: new Date(reloj).toISOString() });
L.push(asistente([{ type: 'thinking', thinking: '', signature: 'firma-falsa' }], uso(1200, 4, 38000, 0)));
L.push(asistente([{ type: 'thinking', thinking: 'Antes de tocar nada necesito medir. Siete segundos pueden venir de la detección, del armado de la transacción o del envío.', signature: 'firma-falsa' }], uso(1200, 60, 38000, 0)));
L.push(asistente([{ type: 'text', text: 'Voy a medir cada etapa con marcas de tiempo antes de cambiar nada.' }], uso(1200, 95, 38000, 0)));
L.push(asistente([{ type: 'tool_use', id: 'toolu_skill1', name: 'Skill', input: { skill: 'cerebro-codigo:depurar-rendimiento' } }], uso(1200, 120, 38000, 0)));
L.push(resultado('toolu_skill1', 'Launching skill: cerebro-codigo:depurar-rendimiento', { toolUseResult: { success: true, commandName: 'cerebro-codigo:depurar-rendimiento' } }));
L.push(usuario([{ type: 'text', text: 'Base directory for this skill: /x\n\n# Depurar rendimiento…' }], { isMeta: true }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_read1', name: 'Read', input: { file_path: `${CWD}/src/detector.ts` } }], uso(900, 30, 52000, 9800)));
L.push(resultado('toolu_read1', [{ type: 'text', text: 'export function detectar() {\n  // sondeo cada 5 s\n}\n'.repeat(40) }], { toolUseResult: { type: 'text', file: { filePath: `${CWD}/src/detector.ts`, numLines: 120 } } }));
L.push('esto no es json {{{');
L.push('');
L.push({ type: 'queue-operation', operation: 'enqueue', timestamp: new Date(reloj).toISOString(), sessionId: SESION });
L.push({ type: 'tipo-que-no-existe-todavia', cosa: { rara: [1, 2, 3] } });
L.push(asistente([{ type: 'tool_use', id: 'toolu_grep1', name: 'Grep', input: { pattern: 'setInterval\\(', path: `${CWD}/src` } }], uso(900, 55, 52000, 9800)));
L.push(resultado('toolu_grep1', 'src/detector.ts:14:  setInterval(sondear, 5000)', { toolUseResult: { mode: 'content', numFiles: 1, durationMs: 41 } }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_bash1', name: 'Bash', input: { command: 'npm test -- detector', description: 'Correr pruebas del detector' } }], uso(1000, 80, 61000, 2000)));
L.push(resultado('toolu_bash1', 'Exit code 1\nFAIL test/detector.test.ts > reconexión\nError: socket cerrado con código 1006', { toolUseResult: 'Error: Exit code 1' }, true));
// Subagente dentro del mismo archivo (isSidechain)
L.push(asistente([{ type: 'tool_use', id: 'toolu_agente1', name: 'Agent', input: { description: 'Buscar límites de websockets en Workers', prompt: 'Investiga los límites de websockets salientes en Cloudflare Workers.', subagent_type: 'Explore' } }], uso(1100, 140, 70500, 6200)));
const lateral = { isSidechain: true, agentId: 'a1b2c3' };
L.push(usuario('Investiga los límites de websockets salientes en Cloudflare Workers.', lateral));
L.push(asistente([{ type: 'tool_use', id: 'toolu_web1', name: 'WebFetch', input: { url: 'https://developers.cloudflare.com/durable-objects/best-practices/websockets/', prompt: 'límites' } }], uso(300, 40, 9000, 500), lateral));
L.push(resultado('toolu_web1', 'Los Durable Objects pueden mantener websockets salientes…', { ...lateral, toolUseResult: { bytes: 5200, code: 200, durationMs: 1830 } }));
L.push(asistente([{ type: 'text', text: 'Los websockets salientes se sostienen desde un Durable Object.' }], uso(300, 90, 9400, 600), lateral, 'end_turn'));
L.push(resultado('toolu_agente1', [{ type: 'text', text: 'Los websockets salientes se sostienen desde un Durable Object.' }], { toolUseResult: { status: 'completed', agentId: 'a1b2c3', totalDurationMs: 4000, totalTokens: 10390 } }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_todo1', name: 'TodoWrite', input: { todos: [
  { content: 'Medir cada etapa', status: 'completed', activeForm: 'Midiendo cada etapa' },
  { content: 'Cambiar sondeo por websocket', status: 'in_progress', activeForm: 'Cambiando sondeo por websocket' },
  { content: 'Reducir tiempo de envío', status: 'pending', activeForm: 'Reduciendo tiempo de envío' },
] } }], uso(1100, 200, 70500, 6200)));
L.push(resultado('toolu_todo1', 'Todos have been modified successfully.'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_edit1', name: 'Edit', input: { file_path: `${CWD}/src/detector.ts`, old_string: 'setInterval(sondear, 5000)', new_string: 'abrirWebsocket()' } }], uso(1100, 260, 70500, 6200)));
L.push(resultado('toolu_edit1', 'The file has been updated.', { toolUseResult: { filePath: `${CWD}/src/detector.ts` } }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_write1', name: 'Write', input: { file_path: `${CWD}/src/medir.ts`, content: 'export const marca = () => performance.now()\n' } }], uso(1100, 300, 70500, 6200)));
L.push(resultado('toolu_write1', 'File created successfully.'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_edit2', name: 'Edit', input: { file_path: `${CWD}/src/detector.ts`, old_string: 'a', new_string: 'b' } }], uso(1100, 330, 70500, 6200)));
L.push(resultado('toolu_edit2', 'The file has been updated.'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_bash2', name: 'Bash', input: { command: 'npm test -- detector' } }], uso(1300, 360, 86000, 5400)));
L.push(resultado('toolu_bash2', 'PASS test/detector.test.ts (6 pruebas)', { toolUseResult: { stdout: 'PASS', stderr: '', interrupted: false } }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_bash3', name: 'Bash', input: { command: 'ls src' } }], uso(1300, 380, 86000, 5400)));
L.push(resultado('toolu_bash3', 'copiar.ts\ndetector.ts\nmedir.ts'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_mcp1', name: 'mcp__plugin_context7_context7__get-library-docs', input: { libraryId: '/cloudflare/workers-sdk', topic: 'websockets' } }], uso(1300, 400, 86000, 5400)));
L.push(resultado('toolu_mcp1', [{ type: 'text', text: 'docs…' }]));
L.push(asistente([{ type: 'text', text: 'Listo: la detección bajó de ~5 s a ~300 ms. Falta reducir el envío.' }], uso(1300, 2600, 86000, 5400), {}, 'end_turn'));
L.push(base({ type: 'system', subtype: 'turn_duration', durationMs: 58000, isMeta: false }));
L.push({ type: 'cost-state', totalCostUSD: 1.0234, sessionId: SESION, timestamp: new Date(reloj).toISOString() });
// Segundo turno: bloques de texto con recordatorio del sistema, comando local, tareas nuevas, skill por ruta
L.push(usuario('<local-command-stdout>Set model to opus</local-command-stdout>'));
L.push(usuario('<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args></command-args>'));
L.push(usuario([{ type: 'text', text: '<system-reminder>\nrecordatorio interno\n</system-reminder>\nahora baja el tiempo de envío, usa priority fee' }]));
L.push(asistente([{ type: 'tool_use', id: 'toolu_tc1', name: 'TaskCreate', input: { subject: 'Agregar priority fee dinámico', description: 'Calcular el fee con la mediana reciente' } }], uso(1400, 30, 92000, 300)));
L.push(resultado('toolu_tc1', 'Task #4 created successfully: Agregar priority fee dinámico', { toolUseResult: { task: { id: '4', subject: 'Agregar priority fee dinámico' } } }));
L.push(asistente([{ type: 'tool_use', id: 'toolu_tu1', name: 'TaskUpdate', input: { taskId: '4', status: 'in_progress' } }], uso(1400, 50, 92000, 300)));
L.push(resultado('toolu_tu1', 'Updated task #4 status'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_read2', name: 'Read', input: { file_path: '/home/usuario/.claude/plugins/cache/cerebro/cerebro-solana/0.1.0/skills/enviar-transacciones-rapido/SKILL.md' } }], uso(1400, 70, 92000, 300)));
L.push(resultado('toolu_read2', '# Enviar transacciones rápido'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_bash4', name: 'Bash', input: { command: 'arana leer cerebro-solana:helius-rpc-y-tiempo-real' } }], uso(1400, 90, 92000, 300)));
L.push(resultado('toolu_bash4', '# skill cerebro-solana:helius-rpc-y-tiempo-real · carpeta: /x'));
L.push(asistente([{ type: 'tool_use', id: 'toolu_ask1', name: 'AskUserQuestion', input: { questions: [{ question: '¿Cuánto es lo máximo que quieres pagar de fee por compra?', header: 'Fee', options: [] }] } }], uso(1400, 120, 92000, 300)));
L.push(resultado('toolu_ask1', 'El usuario respondió: 0.001 SOL'));
L.push(base({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted', compactMetadata: { trigger: 'auto', preTokens: 180000 } }));
L.push(usuario('This session is being continued from a previous conversation…', { isCompactSummary: true, isVisibleInTranscriptOnly: true }));
L.push(asistente([{ type: 'text', text: 'Sigo con el fee dinámico.' }], uso(800, 20, 12000, 9000), {}, 'end_turn'));
L.push(usuario('<command-name>/cerebro-base:cierre-de-sesion</command-name>\n<command-message>cerebro-base:cierre-de-sesion</command-message>\n<command-args>rápido</command-args>'));
L.push(asistente([{ type: 'text', text: 'Guardé el estado.' }], uso(820, 15, 21000, 100), {}, 'end_turn'));
L.push(usuario([{ type: 'text', text: '[Request interrupted by user]' }]));

fs.writeFileSync(path.join(AQUI, 'sesion-basica.jsonl'), L.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');

// Sesión con subagente en archivo aparte: <id>.jsonl + <id>/subagents/agent-<agentId>.jsonl
const S2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
reloj = Date.parse('2026-11-16T16:00:00.000Z');
n = 1000;
padre = null;
const P = [];
const b2 = (r) => ({ ...r, sessionId: S2 });
P.push(b2(usuario('revisa cómo valida el servidor los remotes del juego de roblox')));
P.push(b2(asistente([{ type: 'tool_use', id: 'toolu_ag2', name: 'Task', input: { description: 'Auditar RemoteEvents', prompt: 'Lista cada RemoteEvent y qué valida el servidor.', subagent_type: 'general-purpose' } }], uso(500, 30, 20000, 0))));
const A = [];
const lat2 = { isSidechain: true, agentId: 'f00d42', sessionId: S2 };
A.push(usuario('Lista cada RemoteEvent y qué valida el servidor.', lat2));
A.push(asistente([{ type: 'thinking', thinking: 'Empiezo por buscar OnServerEvent.', signature: 'x' }], uso(200, 20, 3000, 0), lat2));
A.push(asistente([{ type: 'tool_use', id: 'toolu_sub_grep', name: 'Grep', input: { pattern: 'OnServerEvent', glob: '**/*.luau' } }], uso(200, 40, 3000, 0), lat2));
A.push(resultado('toolu_sub_grep', 'src/server/Tienda.server.luau:12', lat2));
A.push(asistente([{ type: 'text', text: 'Hay 3 remotes; Tienda no valida el precio.' }], uso(200, 80, 3500, 0), lat2, 'end_turn'));
P.push(b2(resultado('toolu_ag2', [{ type: 'text', text: 'Hay 3 remotes; Tienda no valida el precio.' }], { toolUseResult: { status: 'completed', agentId: 'f00d42', totalDurationMs: 9000 } })));
P.push(b2(asistente([{ type: 'text', text: 'El remote de la tienda no valida el precio en el servidor.' }], uso(600, 60, 21000, 300), {}, 'end_turn')));
fs.mkdirSync(path.join(AQUI, 'con-subagente', S2, 'subagents'), { recursive: true });
fs.writeFileSync(path.join(AQUI, 'con-subagente', `${S2}.jsonl`), P.map((l) => JSON.stringify(l)).join('\n') + '\n');
fs.writeFileSync(path.join(AQUI, 'con-subagente', S2, 'subagents', 'agent-f00d42.jsonl'), A.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log('fixtures generados');
