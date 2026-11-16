---
name: enviar-transacciones-rapido
description: Hacer que una tx de Solana aterrice rápido y una sola vez - priority fee, compute budget, simulación, Helius Sender, Jito tips y bundles, reintentos con el mismo blockhash, confirmación e idempotencia (no comprar dos veces). Úsala en bots, landing, tx que no confirma.
---

# Enviar transacciones rápido (y una sola vez)

Dos objetivos que compiten: **velocidad** (aterrizar en 1–2 s) y **no duplicar** (nunca comprar dos veces). El error típico de Claude es reintentar re-firmando con un blockhash nuevo mientras el anterior sigue vivo: eso puede ejecutar ambas compras.

## Regla 0: verifica antes de confiar

Tips mínimos, endpoints y cuentas de tip cambian (Sender subió su tip mínimo en 2026). Antes de codificar, WebFetch a:
`https://www.helius.dev/docs/sending-transactions/sender.md`, `https://docs.jito.wtf/lowlatencytxnsend/`, `https://developers.jup.ag/docs/transaction/submit.md`. Copia las cuentas de tip de la doc vigente, nunca de memoria.

## Pipeline estándar (bot)

1. **Blockhash**: `getLatestBlockhash` con `confirmed`; guarda `blockhash` y `lastValidBlockHeight`. Mejor: mantén uno fresco en memoria refrescado cada ~1–2 s para no pagar ese viaje en la ruta crítica (verifica su altura antes de usarlo).
2. **Instrucciones**: compute budget (límite + precio) → instrucciones del swap (Jupiter `/build`) → tip.
3. **Simular** (`simulateTransaction`, `replaceRecentBlockhash: true`, `sigVerify: false`) para obtener `unitsConsumed` y detectar errores (slippage, saldo, token con hook). Límite de CU = consumidas × 1.2, tope 1 400 000.
   - En la ruta de latencia extrema puedes saltar la simulación **solo** si ya tienes un límite de CU medido para ese tipo de swap y aceptas pagar fallos. Decide con el usuario; por defecto, simula.
4. **Priority fee**: `getPriorityFeeEstimate` de Helius pasando la **transacción serializada** (o las cuentas writable), nivel `High` o `VeryHigh` para competir. Nunca uses la estimación global (sin cuentas): mide la red entera y te hace sobrepagar. Aplica un **tope** en micro-lamports configurable (los percentiles altos pueden dispararse; `UnsafeMax` puede llegar a miles de millones por CU).
5. **Firmar** una vez. La firma (signature) es el id de la operación: guárdala **antes** de enviar.
6. **Enviar** por Sender (abajo) con `skipPreflight: true` (ya simulaste) y `maxRetries: 0` (tú controlas el reintento).
7. **Rebroadcast** del **mismo** tx firmado a intervalos cortos (la doc no fija un número; empieza en ~1 s y ajusta midiendo, respetando el rate limit de Sender) mientras no esté confirmado y `blockHeight <= lastValidBlockHeight`.
8. **Confirmar** con `getSignatureStatuses` (o `signatureSubscribe`) a `confirmed`. Revisa `err`: confirmada con error = falló on-chain (pagaste fees, no hubo swap).
9. **Expiró sin confirmar** → solo ahora puedes construir una nueva (nuevo blockhash, nueva firma), y solo si la regla de negocio lo permite (¿el precio sigue bajo el tope?).

## Idempotencia: no comprar dos veces

- Clave de operación = `firmaDelTrader + lado` (copy trading) o un `requestId` propio (terminal). Guárdala con estado (`pendiente`, `enviada:<firma>`, `confirmada`, `fallida`, `expirada`) en almacenamiento persistente con restricción de unicidad, **antes** de enviar.
- Si llega el mismo evento dos veces (reconexión, backfill, webhook duplicado), la clave ya existe → no hacer nada.
- Nunca re-firmes mientras el blockhash anterior siga válido. La doc de Solana: "antes de re-firmar, asegúrate de que el blockhash de la transacción inicial expiró"; si no, ambas pueden aceptarse.
- Si el proceso se reinicia con una operación en `enviada:<firma>`, primero consulta esa firma; no reenvíes a ciegas.
- Tope de operaciones simultáneas por token (p. ej. 1 compra abierta por mint) como segunda red de seguridad.

## Helius Sender (a nov 2026 — verifica tips y endpoints antes de usar)

- Envía por todas las rutas a la vez (Helius, Jito, Harmonic, Rakurai, …). No consume créditos; pagas tip en SOL. Disponible en plan Free.
- Mismo JSON-RPC `sendTransaction` (`encoding: "base64"`). También `sendBundle` (hasta 4 tx atómicas en Sender Max).
- **Requisitos**: cada tx debe llevar (a) transferencia de SOL a una de las cuentas de tip de Sender y (b) instrucción de compute unit price. Sin ambas, se rechaza.

| Tier | Endpoint | Tip mínimo | Notas |
| - | - | - | - |
| Sender Max | `https://sender.helius-rpc.com/fast` | 0.001 SOL (1 000 000 lamports) | Entra al buffer de prioridad; priority fee mínima 5 000 lamports, recomiendan ≥ 10 000 |
| SWQOS-only | mismo endpoint + `?swqos_only=true` | 0.000005 SOL (5 000 lamports) | Una sola ruta, más barato |

- Con API key: 50 req/s por llave por región; sin llave: 1 req/s por IP.
- Endpoints regionales (`slc`, `ewr`, `lon`, `fra`, `ams`, `sg`, `tyo`) son **HTTP sin TLS**: si pones la API key en la URL viaja en claro. Desde un Worker usa el HTTPS global salvo que midas una mejora real y aceptes ese riesgo.
- Si pasan más de 5 s sin enviar, calienta la conexión con `GET /ping` (no cuenta para el rate limit).
- **Haz la cuenta con el usuario**: un tip de 0.001 SOL en una copia de 0.05 SOL es 2% por operación (y otro 2% al vender). Para montos chicos, SWQOS-only o RPC normal con buena priority fee puede convenir más. Ofrece el tier como configuración.

## Jito directo (si no usas Sender)

- Block engine: `https://mainnet.block-engine.jito.wtf` (+ regionales `ny.`, `slc.`, `frankfurt.`, `amsterdam.`, `london.`, `dublin.`, `singapore.`, `tokyo.`). Rutas: `/api/v1/transactions` (sendTransaction) y `/api/v1/bundles` (sendBundle, getBundleStatuses, getTipAccounts, getInflightBundleStatuses).
- Bundles: hasta 5 tx, secuenciales y atómicas (todo o nada). Tip mínimo 1 000 lamports, a una de las 8 cuentas de tip (`getTipAccounts`). El mínimo casi nunca basta en competencia: consulta el tip floor (https://explorer.jito.wtf/tip-floor).
- `sendTransaction` de Jito siempre hace `skip_preflight=true`; con `?bundleOnly=true` va como bundle de 1 tx (protección de revert). Para sendTransaction recomiendan repartir 70% priority fee / 30% tip.
- Tips solo sirven con líderes Jito-Solana. No pongas cuentas de tip en una ALT.
- Límite por defecto: 1 req/s por IP por región.
- Jupiter `/build` con `forJitoBundle=true` excluye DEXes incompatibles con bundles.

## `tx.jup.ag` (alternativa de Jupiter)

Requiere API key de Jupiter, tip de 0.001 SOL a sus cuentas (o `tipAmount` en `/build`), sin preflight y `maxRetries` 0. Solo envía: confirma en tu RPC. Ver skill `jupiter-swaps-y-comisiones`.

## Terminal web (usuario con Phantom)

- Con Jupiter `/order` + `/execute`, Jupiter aterriza la tx: no agregues Sender ni reintentos propios (la tx no se puede modificar). Tu trabajo: mostrar estado y no permitir doble clic (deshabilita el botón y usa un `requestId` por intento).
- Si la tx la envía la billetera (`signAndSendTransaction`), la billetera elige ruta; tú confirmas por firma.
- El endpoint HTTPS global de Sender evita problemas de CORS en navegador, pero eso implica exponer la API key en el frontend: mejor envía desde tu backend.

## Errores típicos

| Síntoma | Causa | Arreglo |
| - | - | - |
| Compra duplicada | Re-firma con blockhash nuevo mientras el viejo vivía | Rebroadcast del mismo tx; re-firmar solo tras expirar |
| Sender rechaza | Falta tip o compute unit price, o tip < mínimo del tier | Agrega ambos; revisa tier |
| Aterriza lento en congestión | Priority fee de estimación global o muy baja | Estima con la tx; nivel `High`/`VeryHigh` con tope |
| Pagas fees altísimos | Precio de CU sin tope o límite de CU inflado | Tope de precio + límite = consumidas × 1.2 |
| "Confirmada" pero no hubo swap | `err` no nulo en el status | Revisa `err` y logs; marca fallida |
| Tx v0 rechazada por tamaño | Muchas cuentas + tip | `maxAccounts`/`maxBytes` en `/build`, ALTs |

## Cómo comprobarlo tú mismo

En los logs del bot cada operación debe tener una sola firma confirmada. Busca la firma en solscan.io: verás la priority fee, el tip y en qué slot entró. Compara el slot con el de la tx del trader para medir el retraso real.

## Fuentes (verificado nov 2026)

- https://www.helius.dev/docs/sending-transactions/sender.md , https://www.helius.dev/docs/sending-transactions/sender-max.md , https://www.helius.dev/docs/sending-transactions/sender-swqos-only.md
- https://www.helius.dev/docs/billing/rate-limits.md (Sender 50/s con llave, 1/s sin llave)
- https://www.helius.dev/docs/priority-fee-api.md (niveles, estimación por tx vs global, advertencia UnsafeMax)
- https://docs.jito.wtf/lowlatencytxnsend/ (endpoints, bundles de 5, tip mínimo 1 000 lamports, 70/30, rate limit)
- https://developers.jup.ag/docs/transaction/submit.md , https://developers.jup.ag/docs/swap/advanced/compute-units.md
- https://solana.com/docs/core/transactions/retry (maxRetries, rebroadcast, cuándo re-firmar)
- https://solana.com/docs/core/fees (fórmula de priority fee)
