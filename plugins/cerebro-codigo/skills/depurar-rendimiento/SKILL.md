---
name: depurar-rendimiento
description: Encontrar por qué algo es lento o gasta memoria midiendo antes de optimizar - profilers de Node, Python y navegador, N+1, fugas, latencia de red, Lighthouse y latencia por etapa en bots. Usa con lento, lag, latencia, memoria, optimizar.
---

# Depurar rendimiento: medir, no adivinar

Para bugs de lógica usa `systematic-debugging` de `superpowers`. Esta skill es para "está lento", "se come la RAM" o "el bot llega tarde". Corrige esto de Claude: "optimiza" a ciegas (memoiza, cambia librerías, reescribe en otro lenguaje) sin medir, mide una vez y saca conclusiones, reporta promedios que esconden los picos y declara "ya es más rápido" sin números.

## El método (siempre en este orden)

1. **Define la métrica y la meta** con el usuario en una frase: "la página carga en menos de 2 s", "el bot compra en menos de 400 ms desde que la otra billetera compró (p95)", "la RAM no pasa de 300 MB en 24 h".
2. **Reproduce y mide la línea base**: mismo escenario, varias corridas (mínimo 10 muestras, idealmente cientos para latencias). Anota p50 y p95, no solo el promedio.
3. **Encuentra dónde se va el tiempo** con un profiler o con marcas por etapa (abajo). Clasifica: ¿CPU, espera de red, base de datos, memoria/GC o render del navegador?
4. **Cambia una sola cosa**, la que más pesa en la medición. Optimizar lo que pesa 5% no sirve.
5. **Mide otra vez con el mismo escenario** y compara. Si no mejoró, revierte el cambio.
6. **Reporta con números**: "antes p95 = 1,240 ms, después p95 = 380 ms; la etapa de cotizar bajó de 900 a 60 ms por reusar conexión".

Explica al usuario en 1–3 frases qué vas a medir y por qué antes de instrumentar.

**Verifica antes de confiar**: flags de profilers y opciones cambian entre versiones. Revisa la versión instalada (`node --version`, `python --version`) y confirma el comando con `--help`, Context7 (MCP `context7`) o WebFetch a la doc oficial antes de dárselo al usuario.

### ¿Dónde mirar primero?

| Síntoma | Sospechoso #1 | Primera medición |
|---|---|---|
| CPU al 100% (`top`/`htop`) | Bucle o cálculo caro | Profiler de CPU (Node o Python, abajo) |
| CPU baja pero tarda | Esperas de red o base | Marcas por etapa + `curl -w` + contar queries |
| RAM sube y nunca baja | Fuga (cachés, listeners) | Uso de memoria cada minuto por horas |
| Lento solo a veces | Picos de red, GC, rate limit (429) | Percentiles p95/p99 y logs de status por llamada |
| Web lenta al cargar | Imágenes y JavaScript | Lighthouse en el sitio desplegado |
| Web lenta al interactuar | Re-renders, trabajo en el hilo principal | Panel Performance de DevTools |

## Bots en tiempo real: latencia por etapa

Lo primero en un bot de copy trading o alertas: **marcar el tiempo de cada etapa de cada evento** y loguearlo como JSON.

- Etapas típicas: recibido (websocket) → parseado → decidido (filtros/riesgo) → cotizado → enviado → confirmado.
- Duraciones con reloj **monotónico**: `performance.now()` (Node/navegador), `time.perf_counter_ns()` (Python). `Date.now()` / `time.time()` solo para comparar con horas externas (hora del bloque, timestamp de la API), y sabiendo que el reloj de la máquina puede estar desfasado: mantén NTP activo.
- Mide también **desde el evento original**: hora del bloque o del trade de la billetera copiada vs. cuándo lo recibiste. Si eso ya es 2 s, optimizar tu código no sirve: cambia de proveedor de datos o de método de streaming (ver `helius-rpc-y-tiempo-real` y `enviar-transacciones-rapido` de `cerebro-solana`).
- Reporta **p50, p95 y p99 por etapa**. Un p99 malo es justo la compra que llega tarde.
- Helpers probados `nuevoTrazo`/`Trazo` y `percentiles` en TS y Python, y cómo medir HTTP por fases con `curl -w`: **lee `references/latencia.md`** cuando vayas a instrumentar.

## Latencia de red (lo más común en bots y APIs)

- Mide por fases con `curl -w` (DNS, TCP, TLS, primer byte). TLS caro → **reusa conexiones** (un solo cliente HTTP compartido, no uno por request). Primer byte alto → el servidor está lejos o lento: corre tu proceso cerca del proveedor (región) o cambia de endpoint.
- **Paraleliza lo independiente** (`Promise.all`, `asyncio.gather`); no encadenes `await` que no dependen entre sí.
- **Cachea** lo que cambia poco (decimales de un mint, metadata, config) en memoria con expiración.
- Websocket en vez de polling cuando necesitas reaccionar rápido.
- Timeouts siempre; un request colgado arruina el p99 (ver `apis-y-webhooks`).

## Base de datos: N+1 e índices

- **N+1**: una consulta para la lista y luego una por cada fila (`for pedido in pedidos: cliente = consulta(...)`). Síntoma: el número de queries crece con el número de filas. Detección: cuenta las queries por request en el log. Arreglo: un `JOIN`, o `WHERE id IN (...)` en lote.
- Consulta lenta: mira el plan (`EXPLAIN QUERY PLAN` en SQLite/D1, `EXPLAIN ANALYZE` en Postgres). Un "SCAN" sobre una tabla grande = falta índice en la columna del `WHERE`/`ORDER BY`. Diseño de índices: `base-de-datos-practica` de `cerebro-web`.
- Trae solo las columnas y filas que usas; pagina.

## CPU en Node

- `node --cpu-prof src/main.ts` genera un `.cpuprofile` al salir; ábrelo en Chrome DevTools (panel Performance, cargar perfil) y busca las funciones más anchas.
- Proceso que ya está corriendo o servidor: `node --inspect src/main.ts`, abre `chrome://inspect` y graba un perfil mientras reproduces la lentitud.
- Sospechosos frecuentes: `JSON.parse`/`stringify` de objetos enormes en cada evento, regex costosas, ordenar listas grandes repetidamente, logs síncronos excesivos.

## CPU en Python

- Python 3.15+: profiler de muestreo integrado (Tachyon): `python -m profiling.sampling run --flamegraph -o perfil.html script.py`, o a un proceso vivo `python -m profiling.sampling attach --flamegraph -d 30 -o perfil.html <PID>`.
- Python 3.14 o menor: `python -m cProfile -o perfil.prof script.py`, o `py-spy record -o perfil.svg --pid <PID>` (`uvx py-spy ...`; adjuntarse a un proceso puede pedir `sudo` en Linux).
- Con uv: `uv run python -m cProfile ...` para usar el entorno del proyecto.

## Memoria y fugas

- Primero confirma que crece: registra cada minuto `process.memoryUsage().heapUsed` (Node) o el RSS del proceso (`ps -o rss= -p <PID>`) durante horas. Sube y baja = normal; solo sube = fuga.
- Node: `node --heapsnapshot-signal=SIGUSR2 src/main.ts`, luego `kill -USR2 <PID>` dos veces con minutos de diferencia y compara los snapshots en DevTools (Memory). Python: `tracemalloc` (biblioteca estándar) y compara snapshots.
- Causas típicas en bots 24/7: `Map`/dict de caché sin límite ni expiración, listeners que se agregan en cada reconexión sin quitar los viejos, `setInterval` que nunca se limpia, websockets viejos que no se cierran al reconectar, arrays de historial que nunca se recortan.

## Frontend

- Lighthouse (pide Node 22+): `npx lighthouse https://tu-sitio.com --only-categories=performance --view` (usa `--preset=desktop` para escritorio). Corre 3 veces y toma la mediana; mide en el sitio desplegado, no en `dev`.
- Core Web Vitals y su impacto en SEO: `seo-tecnico` de `cerebro-web`. Traza detallada automatizada: plugin `chrome-devtools-mcp` si está instalado.
- Sospechosos frecuentes: imágenes sin tamaño ni compresión, JavaScript enorme (en Next, `"use client"` demasiado arriba; ver `react-y-nextjs`), demasiados re-renders por actualizaciones de websocket sin agrupar, fuentes bloqueantes.

## Al terminar

Entrega una tabla antes/después con la métrica acordada (p50 y p95), qué cambiaste y cómo repetir la medición (comando exacto). Si no se alcanzó la meta, di cuál es ahora el cuello de botella más grande. Deja las marcas de latencia en el código si es un bot: sirven para monitorear.

## Fuentes (verificado nov 2026)

- https://nodejs.org/api/cli.html (`--cpu-prof`, `--inspect`, `--heapsnapshot-signal`, `--heap-prof`)
- https://docs.python.org/3.15/whatsnew/3.15.html (PEP 799, módulo `profiling`) y https://docs.python.org/3.15/library/profiling.sampling.html
- https://docs.python.org/3/library/profile.html y https://docs.python.org/3/library/tracemalloc.html
- https://github.com/benfred/py-spy (comandos `record`, `top`, `dump`; cuándo pide sudo)
- https://github.com/GoogleChrome/lighthouse (Node 22+, `--view`, `--preset`, `--only-categories`)
- https://curl.se/docs/manpage.html (variables de `-w`)
- https://sqlite.org/eqp.html y https://www.postgresql.org/docs/current/using-explain.html
