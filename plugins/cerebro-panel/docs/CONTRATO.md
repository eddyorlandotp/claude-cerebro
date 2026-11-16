# Contrato técnico de cerebro-panel ("Telaraña")

Fuente única de verdad entre el servidor, la araña y la interfaz. Si cambias algo aquí, cambia los tres.

## Principios

1. **Cero IA, cero nube.** Todo corre en la máquina del usuario. Ningún componente llama a un modelo ni a internet. Sin telemetría.
2. **Cero dependencias.** Node ≥ 20, solo módulos `node:*`. Sin `npm install`, sin build. La UI es HTML + CSS + módulos ES nativos.
3. **Fail-open.** Si el panel o la araña fallan, Claude Code sigue igual. Ningún hook puede bloquear ni tardar: timeout corto, salida 0 ante cualquier error.
4. **Solo lectura.** El panel nunca escribe en los transcripts ni en el repo del usuario. Solo escribe en su carpeta de datos.
5. **Local.** El servidor escucha solo en `127.0.0.1`.

## Estructura

```
plugins/cerebro-panel/
  .claude-plugin/plugin.json
  hooks/hooks.json
  arana/
    bin/arana.mjs            CLI: indice | recomendar | hilo | hook <evento> | espejo
    lib/indice.mjs           escanea skills instaladas -> índice
    lib/recomendar.mjs       puntúa skills contra un texto (BM25 + sinónimos)
    lib/hilo.mjs             resumen extractivo de la sesión (sin IA)
    lib/texto.mjs            normalizar, tokenizar, stopwords es/en
    lib/rutas.mjs            carpetas de config/datos
    test/*.test.mjs          node --test
  servidor/
    servidor.mjs             HTTP + SSE + estáticos + modo demo
    lib/transcript.mjs       JSONL de Claude Code -> eventos normalizados
    lib/vigia.mjs            encuentra y sigue (tail) la sesión activa
    lib/estado.mjs           estado agregado para /estado
    test/*.test.mjs
  ui/                        index.html, css/, js/, fuentes/
  demo/sesion-demo.json      guion de eventos para --demo y para pruebas
  skills/abrir-panel/SKILL.md
  docs/                      este contrato, DISENO.md, PROMPT-LOCAL.md
  (el reporte y las capturas de la IA local van en /local/telarana/, fuera del plugin)
```

Carpeta de datos del usuario: `${XDG_STATE_HOME:-~/.local/state}/cerebro-panel/` (`indice.json`, `eventos.jsonl`, `hilos/<sessionId>.md`, `servidor.pid`, `config.json`).

## Fuentes de datos

- **Transcript** (principal): `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<proyecto>/<sessionId>.jsonl`. Una línea JSON por registro. Campos observados en Claude Code 2.1.3xx: `type` (`user`, `assistant`, `attachment`, `system`, `summary`, `queue-operation`, `cost-state`, `last-prompt`, otros), `uuid`, `parentUuid`, `timestamp` (ISO), `sessionId`, `cwd`, `version`, `gitBranch`, `isSidechain` (true = subagente). En `user`/`assistant`, `message` sigue el formato de la API de Anthropic: `message.content` es string o lista de bloques `text`, `thinking` (`thinking`: texto, puede venir vacío), `tool_use` (`id`, `name`, `input`), `tool_result` (`tool_use_id`, `content`, `is_error`). `assistant.message.model` y `assistant.message.usage` (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`). `attachment.attachment.type` incluye `skill_listing` (con `names`), `model`, etc. `cost-state` trae `totalCostUSD`. El parser debe **ignorar sin fallar** todo tipo o campo que no conozca. Los subagentes pueden vivir en el mismo archivo (`isSidechain: true`) o en `<sessionId>/subagents/*.jsonl`: soporta ambos.
- **Hooks** (complemento): el plugin registra hooks que agregan una línea al archivo `eventos.jsonl` (lo único que el transcript no da a tiempo: `Notification` = Claude espera permiso/respuesta, `PreCompact`, `SessionStart`, `Stop`).

## Eventos normalizados (servidor -> UI)

SSE en `GET /eventos`. Cada mensaje: `data: <json>\n\n`, con `{ "tipo": ..., "ts": <ms epoch>, "sesion": <id>, ... }`.

| tipo | campos |
|---|---|
| `sesion` | `proyecto` (nombre de carpeta), `cwd`, `modelo`, `version`, `rama` |
| `biblioteca` | `plugins: [{ nombre, activo, skills: [{ id, nombre, desc }] }]` (`id` = `plugin:skill`) |
| `prompt` | `texto` (recortado a 600) |
| `sugeridas` | `skills: [{ id, puntaje }]` (máx 4), `apagadas: [id]` (sugeridas cuyo plugin está apagado) |
| `pensamiento` | `texto` (recortado a 400), `agente` (id de subagente o null) |
| `dicho` | `texto` (texto visible del asistente, recortado a 400), `agente` |
| `herramienta` | `id`, `fase` (`inicio`\|`fin`), `nombre` (nombre real), `clase` (`leer`\|`buscar`\|`comando`\|`editar`\|`web`\|`agente`\|`skill`\|`mcp`\|`tarea`\|`pregunta`\|`otro`), `resumen` (≤ 80 car.: ruta, comando, consulta), `agente`; en `fin`: `ok` (bool), `ms`, `tamano` (caracteres del resultado) |
| `skill_usada` | `id` (cuando Claude invoca la herramienta Skill) |
| `subagente` | `id`, `fase` (`inicio`\|`fin`), `tipoAgente`, `descripcion` |
| `uso` | `entrada`, `salida`, `cacheLeida`, `cacheCreada`, `contexto` (tokens ocupando la ventana = entrada + cacheLeida + cacheCreada del último mensaje del hilo principal), `ventana` (200000 por defecto; 1000000 si el modelo lo indica), `costoUSD` (si se conoce) |
| `espera` | `motivo` (`permiso`\|`respuesta`\|`inactivo`) |
| `fin_turno` | `ms`, `pasos` |
| `compactacion` | (sin campos) |
| `hilo` | `objetivo`, `ultimoPedido`, `archivos: [{ ruta, veces, accion }]` (máx 8), `comandos: [string]` (máx 5), `errores: [string]` (máx 3), `pendientes: [{ texto, estado }]`, `turnos` |
| `latido` | cada 15 s para mantener viva la conexión |

Clasificación de herramientas -> `clase`: `Read`,`NotebookRead` = leer; `Grep`,`Glob`,`ToolSearch`,`LS` = buscar; `Bash`,`BashOutput`,`KillShell` = comando; `Edit`,`Write`,`MultiEdit`,`NotebookEdit` = editar; `WebFetch`,`WebSearch` = web; `Task`,`Agent` = agente; `Skill` = skill; `mcp__*` = mcp; `TodoWrite`,`TaskCreate`,`TaskUpdate` = tarea; `AskUserQuestion` = pregunta; resto = otro.

## HTTP

- `GET /` y estáticos de `ui/` (y `demo/` bajo `/demo/`).
- `GET /eventos` SSE. Al conectar envía primero `sesion`, `biblioteca`, `hilo`, `uso` del estado actual y los últimos 200 eventos del turno en curso.
- `GET /estado` JSON con el mismo estado agregado.
- `GET /salud` -> `{ ok: true, version, sesion }`.
- CLI: `node servidor/servidor.mjs [--puerto 4317] [--demo] [--velocidad 1] [--config-dir <ruta>]`. Con `--demo` reproduce `demo/sesion-demo.json` en bucle (no lee transcripts).

## Guion demo

`demo/sesion-demo.json`: `{ "biblioteca": {...evento biblioteca...}, "eventos": [ { "t": <ms desde el inicio>, ...evento sin ts... } ] }`. La UI también puede cargarlo directo con `?demo=1` (sin servidor) para desarrollo.

## API de la araña (módulos)

```js
// lib/indice.mjs
construirIndice({ configDir, cwd }) -> { generado, plugins: [{ nombre, marketplace, activo, skills: [{ id, nombre, desc, plugin }] }] }
// lib/recomendar.mjs
recomendar(indice, texto, { k = 3, umbral } = {}) -> [{ id, puntaje, activo }]
// lib/hilo.mjs
class Hilo { ingerir(eventoNormalizado); resumen() -> objeto del evento `hilo`; aMarkdown() -> string (≤ 1800 caracteres) }
```

## Hooks del plugin (`hooks/hooks.json`)

Todos con `command -v node >/dev/null 2>&1 && node "${CLAUDE_PLUGIN_ROOT}/arana/bin/arana.mjs" hook <Evento> || exit 0`, timeout ≤ 5 s.

| Evento | Qué hace | Tokens que agrega al contexto |
|---|---|---|
| `UserPromptSubmit` | recomienda skills; solo si el mejor puntaje pasa el umbral imprime contexto adicional: `[araña] Skills que encajan: a, b, c.` (más `Apagadas que servirían: x` si aplica) | ≤ 60, y 0 si no hay coincidencia clara |
| `SessionStart` (matcher `compact`) | imprime el hilo guardado de esa sesión para que Claude retome sin releer | ≤ 500, solo tras compactar (al reanudar el contexto sigue ahí) |
| `PreCompact`, `Stop` | actualiza `hilos/<sessionId>.md` leyendo el transcript | 0 |
| `Notification` | agrega una línea a `eventos.jsonl` | 0 |

Verifica el formato exacto de entrada/salida de cada hook en https://code.claude.com/docs/en/hooks antes de implementarlo.

## Modo ligero (entrega de skills por ruta)

Objetivo: que el contexto fijo de Claude sea mínimo. Casi todos los plugins quedan **apagados** a nivel usuario (sus descripciones no entran al contexto); la araña indexa igual todas las skills instaladas (la caché sigue en disco) y se las entrega a Claude **por ruta** cuando el mensaje del usuario lo amerita.

- `indice`: cada skill lleva `ruta` (SKILL.md absoluto) y `dir`; cada plugin, `activo` real y `extras: { hooks, mcp, agentes }`.
- CLI: `arana leer <id>` (imprime la skill sin frontmatter, con `${CLAUDE_SKILL_DIR}` y `${CLAUDE_PLUGIN_ROOT}` resueltos), `arana buscar "<texto>"` (sin umbral, una línea por skill), `arana modo ligero|completo|estado`. Lanzador ejecutable `bin/arana` en la raíz del plugin (queda en el PATH del Bash de Claude mientras el plugin está habilitado).
- `arana modo ligero` apaga con `claude plugin disable <id> --scope user` todo menos el **núcleo** y guarda el estado previo en `modo.json`; `completo` lo restaura. Núcleo por defecto (`config.json` → `ligero.nucleo`): `cerebro-panel`, `cerebro-guardia`, `superpowers`, `context7`, `security-guidance`, `playwright`, `typescript-lsp`, `pyright-lsp` y todo plugin con costo fijo 0. Nunca toca settings de proyecto.
- Hook `UserPromptSubmit` en modo ligero (≤ ~120 tokens, 0 si no hay coincidencia clara): `[araña] Skills locales que encajan (cárgalas solo si aplican: corre \`arana leer <id>\`): id — desc; …`. Si la skill es de un plugin apagado con MCP o agentes, lo avisa.
- Hook `SessionStart` (`startup|clear`) solo en modo ligero (≤ 120 tokens): nota de que hay N skills locales apagadas, que use `arana buscar` si cree que existe una skill y no hubo sugerencia, y los ids de `ligero.siempre` (por defecto `cerebro-base:modo-mentor`, `cerebro-base:investigar-antes-de-codear`, `cerebro-base:ahorrar-tokens`).
- Servidor: `skill_usada` también al ver un Read de `…/skills/<x>/SKILL.md` o un Bash `arana leer <id>`. El evento `biblioteca` añade `modo`; en ligero, `activo` = true para todo plugin instalado ("al alcance de la araña") y `sugeridas.apagadas` va vacío.

Límite conocido: la araña elige por palabras, no entiende. Fallará a veces; por eso existen `arana buscar` y la lista `siempre`, y por eso `superpowers` (skills que se disparan por situación, no por palabras) se queda prendido.

## Ampliaciones al contrato (ya implementadas)

- `pensamiento.texto` puede llegar vacío: la cara piensa sin burbuja.
- `herramienta` (fase `fin`) puede traer `detalle` (primera línea del error) y `tareas` (`{ op, items }`; de ahí salen los pendientes del hilo).
- `hilo.pendientes[].estado`: `hecho | en_curso | pendiente`.
- `uso.salida` es acumulada en la sesión; `entrada` y cachés son del último mensaje; `uso.acumulado` trae los totales.
- `subagente.id` es el id del `tool_use` del agente; los eventos de ese subagente llevan ese id en `agente`.
- Un `sesion` con id distinto = reinicio: el servidor reenvía `sesion`, `biblioteca`, `hilo`, `uso` y el turno en curso.
- `espera.motivo`: `permiso | respuesta | inactivo` (`inactivo` lo emite el servidor tras 2 min sin eventos).
- La araña no repite en la misma sesión una skill ya sugerida (se olvida tras compactar o limpiar). El aviso de MCP/agentes de un plugin apagado va una vez por plugin.
- El índice distingue `tipo: skill | comando` y marca `manual` (skills con `disable-model-invocation`).
- Estado de verificación: el parser solo se ha probado con transcripts sintéticos y con el encabezado, el prompt y el texto del asistente de una sesión real (Claude Code 2.1.326). Bloques `thinking`, `tool_use`/`tool_result`, subagentes y fin de turno reales están **sin verificar**; ver `PROMPT-LOCAL.md`.
