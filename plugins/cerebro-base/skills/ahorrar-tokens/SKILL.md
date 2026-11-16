---
name: ahorrar-tokens
description: Trabajar gastando menos tokens sin bajar la calidad - leer solo lo necesario, filtrar salidas largas, delegar lo ruidoso a subagentes y saber cuándo /clear o /compact. Úsala en sesiones largas o cuando el usuario se queje del límite.
---

# Ahorrar tokens sin volverse más tonto

La regla de oro: **se ahorra quitando ruido, nunca quitando pensamiento ni verificación**. Una respuesta barata que está mal sale más cara, porque hay que repetirla.

## Lo que NUNCA se recorta

- La verificación antes de decir "listo" (tests, abrir la página, correr el comando).
- La lectura del código que vas a cambiar. Leer de menos y adivinar es el error más caro.
- El nivel de esfuerzo/modelo en código que mueve dinero, llaves, auth o datos de usuarios.
- Las explicaciones que el usuario necesita para decidir (ver `modo-mentor`). Sé breve, no críptico: nada de "modo cavernícola".

## Lo que sí se recorta (hazlo siempre)

### Al leer
- Busca antes de abrir: `grep -rn`/Glob para ubicar, luego Read con `offset`/`limit` solo de la parte relevante.
- No releas un archivo que acabas de editar ni uno que ya está en el contexto sin cambios.
- Archivos generados (lockfiles, `dist/`, `node_modules/`, minificados, `.min.js`, CSV gigantes) no se leen completos: `head`, `wc -l`, o un script que resuma.
- Si existe un plugin LSP (typescript-lsp, pyright-lsp), úsalo para "ir a la definición" en vez de leer archivos candidatos.

### Al correr comandos
- Filtra la salida en el mismo comando: `2>&1 | tail -40`, `| grep -E "FAIL|ERROR|error" -A5 | head -80`, `--quiet`, `--reporter=dot`.
- Logs: busca por patrón y rango de tiempo, no los vuelques enteros (`journalctl -u x --since "10 min ago" | tail -50`).
- Datos grandes (JSON de APIs, respuestas on-chain): guárdalos a archivo y procésalos con `jq`/python; muestra solo el resumen.
- Si el usuario tiene **RTK** instalado (`command -v rtk`), sus comandos ya salen comprimidos. Cuando estés diagnosticando un fallo y la salida comprimida no alcance, usa `rtk bypass <cmd>` o `-v` para ver todo: **ahorrar no justifica depurar a ciegas**.

### Al trabajar
- Tareas ruidosas (correr suites de tests, leer docs largas, revisar muchos archivos, procesar logs): delega a un subagente con el resultado pedido en pocas líneas. Para subagentes de búsqueda simple, `model: haiku` o `sonnet` basta.
- Prefiere CLIs (`gh`, `wrangler`, `solana`) sobre servidores MCP cuando hagan lo mismo.
- Antes de una tarea grande, plan corto aprobado (plan mode / skill de planear): evita rehacer trabajo, que es el mayor desperdicio.
- No repitas en tu respuesta lo que el usuario ya ve (diffs completos, archivos enteros). Resume qué cambió y dónde.

## Qué decirle al usuario (cuando aplique, una línea)

- Cambió de tema por completo → sugiere `/rename` y luego `/clear` (no cuesta nada; `/resume` para volver).
- Sesión muy larga en el mismo tema → `/compact Conserva: <decisiones, archivos y pendientes clave>`. Ojo: compactar un contexto enorme es en sí una petición grande; si no necesita continuidad, `/clear` es mejor.
- Tarea sencilla (renombrar, formatear, preguntas rápidas) → `/effort` más bajo o `/model` Sonnet; tarea difícil o de dinero → modelo y esfuerzo altos.
- Para ver en qué se va el uso: `/usage` (en planes Pro/Max muestra atribución por plugin/skill/MCP y recomendaciones; la tecla `f` aplica las que puede) y `/context` para ver qué ocupa la ventana.
- Historial de consumo por día: `npx ccusage@latest daily` (lee los logs locales, no sube nada).
- Auditoría completa de plugins por proyecto: `/cerebro-base:dieta-de-contexto`.

## CLAUDE.md

- Mantén el CLAUDE.md de cada proyecto por debajo de ~200 líneas: solo stack, comandos, reglas y rutas clave.
- Instrucciones de flujos específicos (deploy, migraciones, revisiones) van en skills, que se cargan solo cuando se usan.
- Puedes agregar una sección `# Compact instructions` con lo que debe sobrevivir a la compactación (p. ej. "conserva decisiones, rutas de archivos y salida de tests fallidos").

## Fuentes (verificado nov 2026)

- Manage costs effectively (Claude Code): https://code.claude.com/docs/en/costs
- Skills, presupuesto de descripciones y `disable-model-invocation`: https://code.claude.com/docs/en/skills
- RTK (Rust Token Killer), `rtk bypass`, salida filtrada: https://github.com/rtk-ai/rtk
- ccusage: https://github.com/ryoppippi/ccusage
