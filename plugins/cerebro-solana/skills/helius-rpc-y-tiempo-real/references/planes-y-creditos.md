# Helius: planes, créditos y límites (a nov 2026)

Cambian seguido. Antes de recomendar un plan, vuelve a leer:
https://www.helius.dev/docs/billing/plans.md , https://www.helius.dev/docs/billing/credits.md , https://www.helius.dev/docs/billing/rate-limits.md

## Planes estándar

| | Free | Developer | Business | Professional |
| - | - | - | - | - |
| Precio (USD) | $0 | $49/mes | $499/mes | $999/mes |
| Créditos mensuales | 1M | 10M | 100M | 200M |
| RPC | 10 req/s | 50 req/s | 200 req/s | 500 req/s |
| DAS / Enhanced APIs | 2 req/s | 10 req/s | 50 req/s | 100 req/s |
| Parsed Events | 10 créditos/req | igual | igual | igual |
| Parsed Streams | 1 crédito/evento | igual | igual | igual |
| LaserStream WSS métodos estándar | Incluido | Incluido | Incluido | Incluido |
| LaserStream WSS extensiones (`transactionSubscribe`) | — | Incluido | Incluido | Incluido |
| LaserStream gRPC | — | Devnet | Devnet + Mainnet | Devnet + Mainnet |
| Preconfirmations | — | 10 créditos/msg (mínimo 300 créditos por slot con ≥1 mensaje, por suscripción) | igual | igual |
| Preprocessed (`preprocessedSubscribe`, beta) | — | 0.1 créditos/msg | igual | igual |
| Soporte | Comunidad | Chat | Chat prioritario | Slack/Telegram |

Autoscaling de créditos está activo por defecto en Business y Professional (cobra extra al acabarse los créditos). En Free y Developer el servicio se corta: alerta antes.

## Costos en créditos relevantes para trading

| Uso | Créditos |
| - | - |
| Llamada RPC estándar (incluye `getTransaction`, `getSignaturesForAddress`) | 1 |
| `getPriorityFeeEstimate` | 1 |
| `getTransactionsForAddress` | 10+ (según resultados) |
| LaserStream WebSocket (estándar o extensiones) | 2 por 0.1 MB transmitido (sin comprimir) |
| LaserStream gRPC | 2 por 0.1 MB |
| Webhook: evento enviado | 1 (aunque tu endpoint falle) |
| Webhook: crear/editar/borrar | 100 |
| Parsed Events | 10 por request |
| Parsed Streams | 1 por evento entregado |
| Sender | 0 (pagas tip en SOL) |

## Límites de conexiones

| | Free | Developer | Business | Professional |
| - | - | - | - | - |
| LaserStream WebSocket: conexiones simultáneas | 5 | 150 | 250 | 1 000 |
| LaserStream WebSocket: suscripciones por conexión | 1 000 | 1 000 | 1 000 | 1 000 |
| Parsed Streams: conexiones | 5 | 10 | 50 | 50 |
| Parsed Streams: suscripciones por conexión | 25 | 25 | 25 | 25 |
| Webhooks | 5 | 50 | 50 | 50 |
| Direcciones por webhook | 100k | 100k | 100k | 100k |
| Sender | 50/s con API key (por llave, por región); sin llave 1/s por IP | | | |

## Estimar consumo del bot de copy trading

- Stream: tamaño promedio de una tx `jsonParsed` completa × tx del trader por mes. Un trader de memecoins puede hacer cientos al día; mide una semana con un contador antes de elegir plan.
- Por cada copia: ~1 `getPriorityFeeEstimate` + 1 simulación + 1–3 `getSignatureStatuses` + lecturas de balance.
- Reconciliación periódica (comparar billeteras): `getTokenAccountsByOwner` ×2 cada N minutos.
Haz que el bot guarde un contador diario de llamadas por tipo y muéstralo en el resumen diario.
