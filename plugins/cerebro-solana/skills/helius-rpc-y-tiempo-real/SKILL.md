---
name: helius-rpc-y-tiempo-real
description: Helius para leer Solana y detectar transacciones de otra billetera en tiempo real - RPC, websockets (transactionSubscribe, logsSubscribe), webhooks, LaserStream, Parsed Streams, créditos y planes, y cómo correrlo en Cloudflare Workers con Durable Objects. Úsala para streaming.
---

# Helius: RPC y tiempo real (estado nov 2026)

Helius renombró y reorganizó productos en 2025–2026: los websockets "enhanced" ahora son **LaserStream WebSocket**, "Enhanced Transactions" quedó en mantenimiento (sucesor: **Parsed Events**), y hay productos nuevos (Parsed Streams, Preconfirmations, Gatekeeper). No uses nombres ni endpoints de memoria.

## Regla 0: verifica antes de confiar

- Índice oficial: `https://www.helius.dev/docs/llms.txt`; cada página tiene versión `.md` (p. ej. `https://www.helius.dev/docs/rpc/websocket.md`). Usa WebFetch o Context7 antes de escribir código.
- Planes, créditos y límites cambian seguido: los de abajo son a nov 2026; revisa `https://www.helius.dev/docs/billing/plans.md` antes de que el usuario pague o dependa de un límite.
- El MCP oficial `helius-mcp` es **local** (`npx helius-mcp@latest`) y necesita API key; además puede enviar transacciones. No viene en este plugin. Si el usuario lo quiere, que lo agregue en **modo solo lectura** (no puede firmar, enviar ni comprar créditos): `claude mcp add helius -- npx helius-mcp@latest --read-only` (o variable `HELIUS_MCP_READ_ONLY=1`), con la key en la variable `HELIUS_API_KEY` (que la ponga él; tú no la imprimas). Sin ese modo el servidor expone transferencias de SOL/tokens, staking, generar keypairs y pagos de plan: no lo uses así en un flujo automático.

## Endpoints base

- RPC HTTP: `https://mainnet.helius-rpc.com/?api-key=KEY` (devnet: `devnet.helius-rpc.com`).
- WebSocket (LaserStream WebSocket): `wss://mainnet.helius-rpc.com/?api-key=KEY`. Métodos estándar de Solana + extensiones Helius (`transactionSubscribe`, `accountSubscribe` con filtros).
- Gatekeeper (beta): `beta.helius-rpc.com` mismo API key, mismos métodos y precios, quita a Cloudflare del camino (Helius reporta de decenas a cientos de ms menos). Solo mainnet. Pruébalo midiendo, no lo asumas. Parsed Streams, Preconfirmations y `preprocessedSubscribe` se sirven **solo** desde `wss://beta.helius-rpc.com/?api-key=KEY` (no desde `mainnet.helius-rpc.com`).
- La API key en URL es un secreto: ponla en secrets del Worker, nunca en el frontend ni en logs (enmascara `api-key=` al loguear URLs).

## Planes y créditos (a nov 2026 — verifica en https://www.helius.dev/docs/billing/plans.md)

| | Free | Developer | Business | Professional |
| - | - | - | - | - |
| Precio | $0 | $49/mes | $499/mes | $999/mes |
| Créditos/mes | 1M | 10M | 100M | 200M |
| RPC | 10 req/s | 50 req/s | 200 req/s | 500 req/s |
| WebSocket estándar | Sí | Sí | Sí | Sí |
| `transactionSubscribe` (extensión) | **No** | Sí | Sí | Sí |
| Conexiones WebSocket simultáneas | 5 | 150 | 250 | 1 000 |
| LaserStream gRPC | No (devnet según página de LaserStream) | Solo devnet | Devnet + mainnet | Devnet + mainnet |
| Webhooks máx. | 5 | 50 | 50 | 50 |

Costos en créditos: llamada RPC estándar 1; `getPriorityFeeEstimate` 1; websockets LaserStream 2 créditos por 0.1 MB transmitido; evento de webhook 1 (se cobra aunque tu endpoint falle); crear/editar webhook 100; Parsed Events 10 por request; Parsed Streams 1 por evento; Sender 0 créditos (pagas tip en SOL). Detalle en `references/planes-y-creditos.md`.

## ¿Qué opción detecta más rápido la transacción de otra billetera?

De más rápida a más lenta (para el caso "copiar a un trader"):

| Opción | Commitment / momento | Plan mínimo | ¿Corre en Workers? | Nota |
| - | - | - | - | - |
| Preconfirmations (`preconfSubscribe`) / Preprocessed (`preprocessedSubscribe`) | Antes de `processed` | Developer (de pago) | WebSocket sí, pero cobro por mensaje y producto nuevo | Solo cubre slots de líderes con cobertura; evalúa costo |
| LaserStream gRPC | `processed`, con replay de 48 h | Business para mainnet | No: el cliente JS usa bindings nativos de Rust y gRPC; ponlo en un VPS si algún día lo usas | El más robusto, caro |
| `transactionSubscribe` con `accountInclude: [trader]` | `processed` | Developer | Sí (WebSocket saliente en Durable Object) | **Recomendado para el bot**: trae la tx completa en el mismo mensaje |
| `logsSubscribe` con `mentions: [trader]` | `processed` | Free | Sí | Solo te da firma y logs: necesitas un `getTransaction` extra (más latencia y créditos) |
| Parsed Streams (`parsedTransactionSubscribe`) | `confirmed` | Free | Sí | Ya decodificado (swaps con mints y montos), pero llega más tarde |
| Webhooks (raw o enhanced) | Push HTTP | Free | Sí (endpoint del Worker) | Latencia mayor y puede haber reintentos/duplicados |
| Polling `getSignaturesForAddress` | — | Free | Sí | Solo como respaldo para reconciliar |

Recomendación para la meta de 1–2 s: plan Developer + `transactionSubscribe` a `processed` como fuente principal, y un **respaldo** (Parsed Streams o polling de firmas cada pocos segundos) para no perder operaciones si el socket se cae. Explícale al usuario que `processed` puede revertirse: la compra del bot se basa en algo que casi siempre se confirma, pero no siempre.

### `transactionSubscribe` correcto

```json
{"jsonrpc":"2.0","id":1,"method":"transactionSubscribe","params":[
  {"accountInclude":["<TRADER>"],"failed":false,"vote":false},
  {"commitment":"processed","encoding":"jsonParsed","transactionDetails":"full",
   "maxSupportedTransactionVersion":1}]}
```

- `maxSupportedTransactionVersion` es obligatorio para `transactionDetails: "full"`; usa `1` para recibir legacy, v0 y v1.
- `failed:false` evita copiar swaps fallidos del trader.
- `accountInclude` admite hasta 50 000 direcciones; `tokenAccounts` opcional expande a sus ATAs.

## Websockets: reglas de supervivencia

- Helius cierra websockets con 10 minutos de inactividad: manda ping al menos cada minuto (su ejemplo: cada 30 s) y trata como caído si no hay pong/mensaje en ~30 s.
- **Siempre** reconexión automática con backoff (1 s, 2 s, 4 s… tope 30 s) y re-suscripción al reconectar (los ids de suscripción cambian).
- Al reconectar, rellena el hueco: pide `getSignaturesForAddress(trader, { until: últimaFirmaProcesada })` y procesa lo que faltó, con deduplicación por firma.
- Registra un heartbeat (timestamp del último mensaje) y alerta si pasa de N segundos sin mensajes mientras el trader opera.

## Cloudflare Workers: límites que afectan esto (verificados nov 2026)

Resumen; detalle y patrón de código en `references/cloudflare-workers.md`:

- Un Worker normal no mantiene una conexión abierta 24/7. Usa un **Durable Object** que abre el WebSocket saliente hacia Helius.
- Un DO que usa la API estándar de WebSocket (incluye un socket **saliente**) no puede hibernar: queda en memoria y se cobra duración. La Hibernation API solo aplica a sockets que el DO **acepta** como servidor.
- Operaciones pendientes (fetch, conexiones salientes) mantienen el DO en memoria hasta 15 min cada una; después aplican las reglas normales de desalojo (70–140 s sin eventos). Usa una **alarm** periódica (p. ej. cada 30 s) como latido que verifique el socket y reconecte: las alarms son eventos y reactivan el DO.
- Los despliegues y actualizaciones del runtime cierran los WebSockets: la reconexión no es opcional.
- CPU por invocación (Paid): 30 s por defecto, configurable hasta 5 min; Free: 10 ms por request HTTP. Esperar red no cuenta como CPU.
- Duración DO: Paid incluye 400 000 GB-s/mes; un DO de 128 MB despierto 30 días ≈ 324 000 GB-s. Free: 13 000 GB-s/día. Haz la cuenta con el usuario antes de prometer "gratis".
- 6 conexiones salientes simultáneas por request (Workers y DO).
- `locationHint` al crear el DO (`enam`, `wnam`, `weur`, `apac`, …) para ubicarlo cerca de los servidores que usas. Solo cuenta en el primer `get()`.
- Para APIs de Cloudflare (wrangler, bindings) usa el plugin oficial `cloudflare` si está instalado; aquí no se repite.

## Parsear el swap del trader

- Con `jsonParsed` + `full`: compara `meta.preTokenBalances` vs `meta.postTokenBalances` filtrando `owner === trader`, y `meta.preBalances`/`postBalances` del índice del trader para SOL (resta la fee si el trader es fee payer). Eso funciona para cualquier DEX o agregador sin depender de decodificar instrucciones.
- Ten en cuenta wSOL: un swap SOL→token puede verse como cambio en la token account de wSOL además de lamports nativos.
- Parsed Events (`POST https://mainnet.helius-rpc.com/v1/parsed-events/transactions`, 10 créditos) sirve para auditar después; no lo pongas en la ruta crítica.
- Detalles del cálculo de lado, monto y % del balance: skill `bot-copy-trading`.

## Errores típicos

| Síntoma | Causa | Arreglo |
| - | - | - |
| `transactionSubscribe` responde error de plan | Plan Free | Developer o usa `logsSubscribe` + `getTransaction` |
| No llegan tx versionadas | Falta `maxSupportedTransactionVersion` | Ponlo en `1` |
| El bot "se duerme" de madrugada | Socket muerto sin reconexión, DO desalojado | Ping + alarm de latido + reconexión + alerta |
| 429 HTTP al conectar | Tope de conexiones del plan | Una sola conexión compartida en un DO, no una por request |
| Operaciones repetidas | Reconexión + backfill sin dedupe | Deduplica por firma (tabla con clave única) |

## Cómo comprobarlo tú mismo

Deja el bot corriendo en modo "solo observar", haz tú una compra pequeña con la billetera vigilada y mide cuántos milisegundos pasan entre que firmas y que el bot la registra. Luego corta tu internet del lado del servidor (o redeploya) y confirma que reconecta solo y recupera las operaciones perdidas.

## Fuentes (verificado nov 2026)

- https://www.helius.dev/docs/llms.txt (catálogo, endpoints, Gatekeeper y qué productos viven solo en `beta.helius-rpc.com`, Enhanced en mantenimiento)
- https://www.helius.dev/docs/billing/plans.md, https://www.helius.dev/docs/billing/credits.md, https://www.helius.dev/docs/billing/rate-limits.md
- https://www.helius.dev/docs/rpc/websocket.md (requisito de plan, inactividad de 10 min, reconexión)
- https://www.helius.dev/docs/rpc/websocket/transaction-subscribe.md
- https://www.helius.dev/docs/laserstream.md y https://www.helius.dev/docs/laserstream/clients.md (plan Business, bindings nativos)
- https://www.helius.dev/docs/parsed-streams.md (commitment confirmed), https://www.helius.dev/docs/parsed-events.md, https://www.helius.dev/docs/webhooks.md
- https://www.helius.dev/docs/agents/mcp.md (helius-mcp local con API key, modo `--read-only`, acciones de escritura)
- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ , https://developers.cloudflare.com/durable-objects/best-practices/websockets/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/durable-objects/platform/limits/ , https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/durable-objects/reference/data-location/
