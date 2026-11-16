# Jupiter Swap API V2: parámetros y errores (verificado nov 2026)

Fuente: https://developers.jup.ag/docs/swap/order-and-execute.md, https://developers.jup.ag/docs/api-reference/swap/order.md, https://developers.jup.ag/docs/swap/build.md. Si algo no cuadra, vuelve a leer esas páginas: cambian.

## `GET https://api.jup.ag/swap/v2/order`

Requeridos: `inputMint`, `outputMint`, `amount` (entero en unidades mínimas del token de entrada), `taker` (para recibir transacción; sin él solo cotiza).

Opcionales:

| Parámetro | Qué hace | Efecto en ruteo |
| - | - | - |
| `slippageBps` | 0–10000. Si no lo mandas, Jupiter decide (RTSE) | Pasa `mode` a `manual` |
| `referralAccount` + `referralFee` | Tu comisión, 50–255 bps. Van juntos | No desactiva routers |
| `payer` | Otra billetera paga firmas, priority fee y rent (gasless de integrador) | Desactiva Dflow y OKX |
| `receiver` | Otra billetera recibe el output | Desactiva Dflow y OKX |
| `priorityFeeLamports`, `jitoTipLamports`, `broadcastFeeType` (`maxCap`/`exactFee`) | Sobrescriben la optimización automática de fees | — |
| `excludeRouters` | `metis`, `jupiterz`, `dflow`, `okx` separados por coma | Excluye esos |
| `excludeDexes` | Solo afecta a Metis; etiquetas sensibles a mayúsculas (`/program-id-to-label`). En `/order` NO se respeta `dexes` | — |
| `maxSupportedTransactionVersion` | `1` acepta tx v1 (solo si gana Metis y no es gasless); lee `transactionVersion` de la respuesta | — |

Respuesta, campos clave: `transaction` (base64; `null` sin taker; `""` si no se pudo construir), `requestId`, `outAmount`, `router`, `mode` (`ultra`/`manual`), `feeBps` (total, incluye recuperación de gasless), `platformFee.{amount,feeBps,feeMint}`, `feeMint`, `referralAccount`, `transactionVersion`, `lastValidBlockHeight` (agregador) o `expireAt` (RFQ), `signatureFeePayer` (para saber si fue gasless), `errorCode`, `errorMessage`.

### Errores de `/order` (cuando `transaction === ""`)

Haz match con `router` + `errorCode`:

| router | errorCode | Significado |
| - | - | - |
| metis / dflow / okx | 1 | Fondos insuficientes del token de entrada |
| metis / dflow / okx | 2 | SOL insuficiente para gas |
| metis / dflow / okx | 3 | Swap debajo del mínimo para gasless |
| jupiterz | 1 | Balance insuficiente |
| jupiterz | 2 | Falta la associated token account |
| jupiterz | 3 | La cotización no se pudo construir en transacción |

## `POST https://api.jup.ag/swap/v2/execute`

Body: `signedTransaction` (base64), `requestId` (de `/order`), opcional `lastValidBlockHeight`.

Respuesta: `status` (`Success`/`Failed`), `signature`, `code`, `totalInputAmount` (lo que salió de la billetera, incluye fee si se cobró en el input), `inputAmountResult`, `outputAmountResult`, `totalOutputAmount` (lo que llegó a la billetera, después de fee si se cobró en el output).

| code | Tipo | Significado | Qué hacer |
| - | - | - | - |
| 0 | — | Confirmada | Registrar |
| -1 | Execute | `requestId` no encontrado o expirado | Pedir nueva orden |
| -2 | Execute | Transacción firmada inválida | Revisar que la billetera no la modificó |
| -3 | Execute | Bytes del mensaje inválidos | Igual que -2 |
| -1000 | Agregador | No aterrizó | Nueva orden (no re-firmes la misma) |
| -1001 | Agregador | Error desconocido | Registrar y nueva orden |
| -1002 | Agregador | Transacción inválida | Revisar construcción |
| -1003 | Agregador | No está completamente firmada | Faltan firmas (p. ej. `payer`) |
| -1004 | Agregador | Block height inválido | Nueva orden |
| -1005 | Agregador | Expiró antes de aterrizar (se firmó tarde) | Firmar más rápido, nueva orden |
| -2000…-2004 | RFQ | No aterrizó / desconocido / payload inválido / cotización expirada / rechazada | Nueva orden |

Antes de pedir una orden nueva tras un fallo, confirma por `signature` en tu RPC que la anterior **no** aterrizó (ver idempotencia en `enviar-transacciones-rapido`).

## `GET https://api.jup.ag/swap/v2/build`

Requeridos: `inputMint`, `outputMint`, `amount`, `taker`.

| Parámetro | Default | Notas |
| - | - | - |
| `slippageBps` | 50 | Número o `rtse` |
| `platformFeeBps` | 0 | 0–10000; requiere `feeAccount` |
| `feeAccount` | — | Token account que controlas |
| `computeUnitPricePercentile` | p50 (p90 en `mode=fast`) | `medium` (p25), `high` (p50), `veryHigh` (p75) o entero 0–10000 en bps |
| `mode` | — | `fast` (beta): menos latencia de ruteo, sin splits |
| `maxAccounts` | 64 | 1–64 |
| `maxBytes` | — | 1–1232, presupuesto de bytes para dejar espacio a tus instrucciones (solo v0) |
| `payer` | taker | Quién paga fees y rent |
| `wrapAndUnwrapSol` | true | |
| `dexes` / `excludeDexes` | — | Mutuamente excluyentes |
| `destinationTokenAccount`, `nativeDestinationAccount` | — | Destinos alternos |
| `blockhashSlotsToExpiry` | 150 | 1–300 |
| `forJitoBundle` | false | Excluye DEXes incompatibles con bundles de Jito |
| `tipAmount` | — | Lamports de tip para `tx.jup.ag` (mínimo 1 000 000) |
| `transactionVersion` | `"0"` | `"1"` devuelve instrucciones v1 (sin ALTs; compute budget como campos) |

Respuesta: `computeBudgetInstructions` (solo precio; vacío en v1), `setupInstructions`, `swapInstruction`, `cleanupInstruction`, `otherInstructions`, `tipInstruction` (si mandaste `tipAmount`), `addressesByLookupTableAddress`, `transactionVersion`, `computeUnitPrice` (v1), `blockhashWithMetadata`.

Instrucción = `{ programId, accounts: [{ pubkey, isWritable, isSigner }], data (base64) }`.

Las instrucciones de V2 **no emiten fee events**: para saber cuánto recibiste, lee los balances de token pre/post de la transacción confirmada.

## `tx.jup.ag` (envío por la infraestructura de Jupiter)

JSON-RPC `sendTransaction` en `https://tx.jup.ag`, con `x-api-key` obligatorio. Requiere tip mínimo de 1 000 000 lamports (0.001 SOL) a una de sus cuentas de tip, máximo 1 232 bytes, `encoding: base64`, sin preflight (`skipPreflight:false` se rechaza) y `maxRetries` 0. Es solo de envío: confirma en tu RPC. Ver https://developers.jup.ag/docs/transaction/submit.md.
