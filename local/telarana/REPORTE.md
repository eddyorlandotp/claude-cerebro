# Telaraña en la máquina real: reporte

Fecha: 2026-11-16. Rama `local/panel-2026-11-16`. Claude Code 2.1.326, Node 26.13, Hyprland 0.57.1 (CachyOS), dos monitores: 3440×1440 horizontal y 1440×2560 vertical, ambos a 165 Hz, GPU dedicada. Navegador: Chromium de flatpak (no hay chromium, brave, chrome ni firefox en el PATH).

Lo comprobado contra datos reales: 25 sesiones y 134 archivos de subagente de `~/.claude/projects` (versiones 2.1.319 a 2.1.326), solo estructura; ningún texto real salió de la máquina ni entró al repo.

## 1. Qué funciona y cómo se comprobó

| Qué | Cómo se comprobó |
|---|---|
| `node --test`: 93 de 93 | Corrido en esta máquina, antes (86) y después de los cambios (93). |
| Demo completo sin errores de consola | Ventana real manejada por el puerto de depuración de Chromium durante dos vueltas del demo, en cada monitor: 0 errores, 0 excepciones. |
| Abrir en el monitor elegido y a pantalla completa | `abrir.sh abrir --monitor DP-2` y `DP-3`: `hyprctl` respondió `ok` a la sintaxis Lua (`hl.dsp.window.move` y `hl.dsp.window.fullscreen`); `hyprctl -j clients` confirmó monitor y `fullscreen: 2`. La sintaxis clásica de reserva no hizo falta. |
| Cerrar | `abrir.sh cerrar` cierra la ventana y detiene el servidor (tras el arreglo para flatpak). |
| Teclas `1`–`5`, `0` | Enviadas a la ventana real; capturas `6` y `7` de cada monitor. `F` no se probó (la pantalla completa la pone Hyprland). |
| Sesión real en vivo | Servidor en modo real siguiendo esta misma sesión: proyecto, modelo, turno, contexto (ventana de 1M detectada), hilo, skill usada y el último mensaje mandado a media tarea salieron correctos en `/estado`. |
| Hook `UserPromptSubmit` | En esta sesión Claude recibió la línea `[araña] …` en mensajes reales. A mano: "el bot tarda mucho en copiar" da 3 skills; "hola" y "gracias, continúa" no agregan nada. |
| `arana` en el PATH del Bash de Claude | `arana modo estado` funcionó sin ruta. |
| Hook `SessionStart` en modo ligero | La nota corta llegó al arrancar esta sesión. |
| Hook `Notification` | Quedó registrado un `permission_prompt` real en `eventos.jsonl`; inyectado a mano, `/estado` pasó a `espera: permiso`. |
| Hooks `Stop`, `PreCompact`, `SessionStart(compact)` | A mano con la entrada documentada y un transcript real: guardan y reinyectan el hilo (1,168 caracteres). |
| Ningún hook bloquea | Entrada rota: sale 0 sin texto. Sin `node` en el PATH: sale 0 en 0 ms. Servidor apagado: igual. |
| Modo ligero ida y vuelta | `completo → ligero → completo`: `enabledPlugins` idéntico byte a byte. |
| Espejos | Los 15 sugeridos ya estaban descargados; el usuario eligió dejarlos en su disco principal. |

## 2. Qué cambió, archivo por archivo

- `servidor/lib/transcript.mjs`
  - Subagentes enlazados por `meta.json` (`toolUseId`) en vez de adivinar por el texto del encargo; sirve también para los que lanza otro subagente.
  - Un subagente cerrado que vuelve a escribir se reabre (reanudado con `SendMessage`, o en segundo plano). `cerrarSubagente()` y `caducarSubagentes()` (15 min) nuevos.
  - `run_in_background` llega como texto `"true"`: antes no se reconocía.
  - Mensajes mandados a media tarea (`attachment` `queued_command` humano) ahora son `prompt` con `enCola: true`. Antes no se veían: 27 casos en las sesiones reales.
  - Se quita la envoltura `<pasted_content>` del texto del pedido.
  - `Monitor`, `TaskStop`, `TaskOutput` pasan a clase `comando`; resumen propio para `SendMessage`.
  - La ventana de 1M se recuerda por modelo; `rama` vacía cuando el transcript dice `HEAD`.
- `servidor/lib/vigia.mjs`: lee `agent-<id>.meta.json`, lo entrega con cada línea y emite `agente-fin` cuando marca `finished`. La historia se entrega ordenada por fecha (antes: todo el archivo principal y después los subagentes, lo que dejaba 14,504 eventos de subagente detrás de su propio fin). En vivo lee primero los subagentes.
- `servidor/servidor.mjs`: pasa `meta`, atiende `agente-fin`, guarda `ventanas.json`, caduca subagentes mudos.
- `servidor/lib/estado.mjs`, `arana/lib/hilo.mjs`: un `prompt` en cola no abre turno nuevo.
- `servidor/abrir.sh`: encuentra Chromium/Brave/Chrome de flatpak; perfil dentro de `~/.var/app/<id>/`; busca la ventana por clase o título cuando el pid no coincide; cierra por perfil; `TELARANA_NAVEGADOR_ARGS`.
- `ui/js/estado.js`, `flujo.js`, `pensamiento.js`, `barra.js`, `biblioteca.js`: el mensaje en cola agrega un bloque sin borrar el turno; los subagentes ya no desaparecen al terminar el turno y pueden volver a salir.
- `ui/js/principal.js`: tope de 60 fps (`?fps=0` lo quita).
- `ui/css/zonas.css`: Contexto ya no se estira con huecos cuando se minimizan Hilo y Actividad.
- `servidor/generar-fixture-real.mjs`, `servidor/test/fixtures/formato-real/`, `servidor/test/formato-real.test.mjs`: sesión inventada con la forma real y 7 pruebas.
- `arana/espejos-sugeridos.json`: tamaños medidos de los 15.
- `docs/CONTRATO.md`, `README.md`, `skills/abrir-panel/SKILL.md`: al día con lo anterior. **El contrato cambió**: `prompt.enCola`, clases de herramienta, reglas de subagentes, ventana, tope de fps.
- `INSTALAR.md` (fuera del plugin, a pedido expreso del usuario): el modo por defecto pasa a ser **completo**; el ligero solo si se pide.

## 3. Las 5 preguntas del formato

1. **¿Los bloques `thinking` traen texto?** Casi nunca. De 6,718 bloques, 6,146 (91 %) llegan vacíos y todos traen `signature`; los 572 con texto tienen una mediana de 202 caracteres. `thinkingDisplay` vale `updates` u `omitted`. La interfaz ya pensaba sin burbuja con texto vacío; no hizo falta cambiarla. En la práctica las burbujas salen de lo que Claude dice y de la herramienta en curso.
2. **¿Cómo se guardan los subagentes?** Siempre en `<sessionId>/subagents/agent-<id>.jsonl` (134 de 134), con `isSidechain: true` y `agentId` en cada línea; nunca dentro del archivo principal. Junto a cada uno hay `agent-<id>.meta.json` con `toolUseId` (134 de 134), `agentType`, `description`, `finished` y, en 8, `parentAgentId` (subagente de subagente). El enlace por texto del encargo fallaba en 6 de 134. El resultado del `Agent` trae `agentId`; los de segundo plano traen `isAsync: true` y `status: "async_launched"`. `SendMessage` reanuda uno existente (`resumedAgentId`).
3. **¿`tool_use` y `tool_result` se emparejan?** Sí: 11,895 resultados, 0 huérfanos. El error es `is_error: true` (250 casos); el campo falta en 3,573 resultados correctos. El contenido es texto o lista (`text`, `image`, `tool_reference`).
4. **¿Modelo, tokens y costo?** Modelo en `assistant.message.model` (`<synthetic>` en errores de API, 67 casos). Uso en `assistant.message.usage`; el mismo mensaje se repite en varias líneas con el mismo `id` y el mismo uso (3,547 repeticiones en los archivos principales), así que se cuenta una vez. Costo en registros `cost-state` (`totalCostUSD`), que aparecen poco (54). El tamaño de la ventana no viene en ningún lado: se vieron contextos de hasta 920,725 tokens, o sea ventanas de 1M.
5. **¿Tipos desconocidos?** Se ignoran sin fallar: `api-request`, `api-request-blob`, `api-request-shape`, `last-prompt`, `session-owner`, `atis-latch`, `mode`, `permission-mode`, `ai-title`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `tools-used`, y `system` de subtipo `away_summary`, `informational`, `scheduled_task_fire`, `stop_hook_summary`. Ojo con `api-request-blob`: trae `message` con bloques, pero no es conversación. De `attachment` solo se usa `queued_command`. El fin de turno lo marcan `stop_reason: "end_turn"` y `system` `turn_duration` (con `durationMs`).

## 4. Números

**Tokens fijos por sesión** (`arana modo estado`, 49 plugins instalados):

| Modo | Plugins prendidos | Tokens fijos |
|---|---|---|
| Completo | 39 | ≈ 18,904 |
| Ligero | 8 | ≈ 1,039 |

**Hooks** (una corrida de cada uno, a mano):

| Hook | Tiempo | Agrega |
|---|---|---|
| `UserPromptSubmit` con coincidencia (modo completo) | 37 ms | 129–140 caracteres |
| `UserPromptSubmit` sin coincidencia | 16–29 ms | 0 |
| `Notification` | 17 ms | 0 |
| `Stop` | 29 ms la primera, 21 ms la segunda | 0 |
| `PreCompact` | 22 ms | 0 |
| `SessionStart` tras compactar | 17 ms | 1,168 caracteres |
| `SessionStart` al arrancar, modo completo | 18 ms | 0 |

**Rendimiento** (ventana real, 10 s por medición, igual en los dos monitores):

| | Antes | Con tope de 60 fps |
|---|---|---|
| Refresco del navegador | 165 por segundo, mediana 6.1 ms, p99 6.2 ms, ningún cuadro de más de 25 ms | igual (el navegador sigue a 165; el panel dibuja 1 de cada 3, unos 55 por segundo) |
| CPU de Chromium | ≈ 35 % de un núcleo | ≈ 19 % |
| CPU de `node` | 0–0.2 % | 0–0.2 % |
| Memoria | Chromium ≈ 1.2 GB (todos sus procesos), `node` ≈ 70 MB (120 MB al ponerse al día con una sesión grande) | igual |

## 5. Qué sigue fallando o quedó sin probar

- **Sin probar en vivo:** `/compact` real (el hilo se reinyecta bien a mano, pero no se corrió una compactación de verdad); el cambio automático de sesión (solo por pruebas unitarias); la tecla `F`; el aviso ámbar visto en pantalla (se comprobó en `/estado`, no a ojo); que `meta.json` pierda `finished` cuando se reanuda un subagente (si no lo pierde, el subagente reanudado se cierra por silencio y no por señal).
- **Sin hacer:** los 15–20 minutos de tarea en modo ligero como prueba aparte. Lo observado sale de esta sesión, que arrancó en ligero: la araña sugirió 7 skills en 4 mensajes y Claude no cargó ninguna con `arana leer`; ninguna hacía falta para la tarea.
- **Recomendador, fallo sin arreglar:** "Copias locales de documentación" sugiere `cerebro-solana:bot-copy-trading` (0.98). Causa: el recortador de raíces deja igual "copias" y "copiar", y "copiar" está en el grupo de copy trading. Quitar "copia/copias" del diccionario no cambia nada; hay que distinguir el sustantivo del verbo en `raiz()`.
- **`claude plugin install` vuelve a prender plugins apagados.** Reinstalar sobre modo ligero dejó 39 prendidos con `modo.json` diciendo "ligero". `arana modo completo` lo normalizó, pero la araña no detecta ese desfase sola.
- **El plugin instalado sigue siendo el viejo** hasta que esta rama se una a `main` y se actualice: `/cerebro-panel:abrir-panel` todavía no encuentra el navegador de flatpak.
- **Hilo:** "Archivos tocados" solo ve `Read`/`Edit`/`Write`; lo que se edita desde `Bash` no aparece.
- **Vertical:** la zona Flujo queda con media altura vacía cuando los bloques caben en una fila.
- `claude plugin validate` pasa, con un aviso: el README del plugin no tiene la línea de instalación desde el marketplace.

## 6. Qué opina el usuario

Preguntado al final, con el panel en el monitor vertical siguiendo la sesión real, eligió: **"Bien, con cambios"**. No dijo todavía cuáles; quedan por pedirle.

Otras decisiones suyas en esta sesión: el modo por defecto debe ser **completo** ("cambia a que predeterminadamente sea arana modo completo") y las copias de documentación se quedan donde están.

## Capturas

`capturas/<monitor>-<n>-<momento>.png`, todas con `--demo`: `1-reposo`, `2-arana-entregando`, `3-mitad-de-turno`, `4-error`, `5-espera`, `6-dos-zonas-minimizadas`, `7-todo-minimizado`, para `ultrawide-3440x1440` y `vertical-1440x2560`.
