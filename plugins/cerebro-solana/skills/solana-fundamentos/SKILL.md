---
name: solana-fundamentos
description: Base de Solana para escribir código que no falle - cuentas, lamports, SPL Token vs Token-2022, ATAs, rent, compute units, priority fees, commitment, expiración de blockhash, versioned tx y lookup tables, qué SDK usar (@solana/kit vs web3.js). Úsala al empezar cualquier código Solana.
---

# Solana: fundamentos que Claude suele adivinar mal

Lee esto antes de escribir o revisar código que lea cuentas, construya transacciones o elija librería de Solana. El objetivo: no inventar APIs, no mezclar SDKs y no romper montos ni tiempos.

## Regla 0: verifica antes de confiar

- Antes de escribir código contra una API o librería, confírmala en la doc oficial: usa el MCP `solana` de este plugin (`plugin:cerebro-solana:solana`, doc oficial de Solana y Anchor), o Context7 (MCP `context7`) si está instalado, o WebFetch a solana.com/docs. No escribas firmas de funciones de memoria.
- Antes de instalar algo, revisa `package.json` del proyecto y la versión publicada: `npm view <paquete> version`.
- Al usuario explícale en 1–3 frases qué vas a usar y por qué ("Uso @solana/kit porque es el SDK que Solana recomienda hoy").

## Qué SDK usar (a nov 2026, verifica con `npm view` antes de instalar)

| Situación | Usa | Notas |
| - | - | - |
| Proyecto nuevo (Worker, backend, frontend) | `@solana/kit` (latest 8.x) + `@solana-program/system`, `@solana-program/token`, `@solana-program/token-2022`, `@solana-program/compute-budget` | Solana lo marca como el SDK recomendado. Ojo: `helius-sdk` 3.5.0 declara como peer `@solana/kit ^6.9.0` (no 8.x) y `@solana-program/token ^0.13.0`; con Kit 8 `npm install` puede fallar por peers. Revisa `npm view helius-sdk peerDependencies` antes de combinarlos; para RPC, WebSocket y Sender basta `fetch`/`WebSocket` sin ese SDK. |
| Proyecto existente con estilo `Connection`/`Keypair` | `@solana/web3.js` v3 | Es la versión recomendada de web3.js; usa internals de Kit. NO es drop-in: varios métodos que eran síncronos ahora son `async` (p. ej. `Keypair.generate()`, `transaction.sign()`). |
| Código viejo en web3.js 1.x | Déjalo funcionar, no agregues features nuevas encima | 1.x está en modo mantenimiento (solo fixes críticos). |
| Tokens con web3.js v3 o Kit | `@solana-program/token` / `@solana-program/token-2022` | `@solana/spl-token` depende de web3.js 1.x y no corre en v3. |

Trampas concretas:
- `npm install @solana/web3.js` hoy instala la v3. Ejemplos de internet con `new Connection(...)` síncrono de v1 pueden romperse. Fija la versión mayor en `package.json`.
- `@jup-ag/referral-sdk` (0.3.0) depende de `@solana/web3.js ^1.77` y `@solana/spl-token 0.3.8`. Úsalo solo en un script aparte de configuración única, no lo mezcles con el código Kit del producto.
- `@solana/wallet-adapter-react` (0.15.x) pide `@solana/web3.js ^1.99` como peer. Ver skill `billetera-sin-custodia`.
- Nunca mezcles tipos de v1 (`PublicKey`, `Transaction`) con tipos de Kit (`Address`, mensajes compilados) en la misma función sin convertir explícitamente.

## Cuentas, lamports y rent

- 1 SOL = 1 000 000 000 lamports. Montos siempre en enteros (`bigint`). Ver skill `montos-y-decimales`.
- Toda cuenta tiene: `lamports`, `owner` (programa dueño), `data`, `executable`. Solo el programa dueño puede modificar `data` o restar lamports.
- Rent: una cuenta debe tener el mínimo exento de rent para existir. **No lo hardcodees**: pide `getMinimumBalanceForRentExemption(tamañoEnBytes)`.
  - Dato real consultado en mainnet en nov 2026: 165 bytes (token account SPL clásica) = 1 488 440 lamports; 82 bytes (mint) = 1 066 800. Valores viejos que verás en tutoriales (2 039 280 para una token account) ya no aplican. Por eso: consulta, no asumas.
- Cerrar una token account vacía (`closeAccount`) devuelve su rent al destino que elijas. Útil para que el bot recupere SOL después de vender todo un token.

## SPL Token vs Token-2022

| | SPL Token | Token-2022 (Token Extensions) |
| - | - | - |
| Program ID | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| Extensiones | No | Sí: transfer fee, transfer hook, permanent delegate, non-transferable, default account state, pausable, scaled UI amount, etc. |

Reglas:
- Lee el `owner` de la cuenta del mint para saber qué programa usar. Si usas el programa equivocado, la instrucción falla (o derivas la ATA equivocada).
- Las cuentas de Token-2022 pueden medir más de 165 bytes por las extensiones: calcula rent con el tamaño real.
- Extensiones que cambian lo que recibes o si puedes vender: transfer fee, transfer hook, permanent delegate, pausable, non-transferable, default account state (frozen). Revísalas en la skill `riesgo-memecoins`.

## ATAs (Associated Token Accounts)

- Program ID: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`. La dirección se deriva de (dueño, programa de token, mint). Si cambias el programa de token, cambia la ATA.
- Crea con la instrucción **idempotente** (`createAssociatedTokenAccountIdempotent` o su equivalente en `@solana-program/token`): no falla si ya existe. Así evitas el error clásico de "account already in use".
- Quien paga la creación paga el rent. Si tu plataforma no quiere pagar ATAs de usuarios, no pongas tu billetera como payer.
- wSOL: el mint `So11111111111111111111111111111111111111112` envuelve SOL en una token account. Jupiter lo maneja con `wrapAndUnwrapSol` (default `true` en `/build`).

## Fees, compute units y priority fees

- Base fee: 5 000 lamports por firma (50% se quema, 50% al validador).
- Priority fee = `ceil(compute_unit_price × compute_unit_limit / 1 000 000)` lamports. El precio va en **micro-lamports por CU** y 100% va al validador.
- Límite de CU: 200 000 por instrucción por defecto (3 000 para instrucciones builtin), máximo 1 400 000 por transacción.
- Patrón correcto: simula con límite alto, lee CU consumidas, pon límite ≈ consumidas × 1.1–1.2 (Jupiter recomienda 1.2 con tope 1 400 000). Un límite inflado te hace pagar priority fee por CU que no usas.
- Para estimar el precio por CU usa `getPriorityFeeEstimate` de Helius pasando la transacción o las cuentas writable (ver `enviar-transacciones-rapido`). Pon siempre un **tope** al precio: las estimaciones de percentil alto pueden dispararse.

## Commitment

| Nivel | Qué significa | Úsalo para |
| - | - | - |
| `processed` | Lo más nuevo que vio el nodo; puede revertirse | Detectar rápido (copy trading), nunca para contabilidad |
| `confirmed` | Votado por más de 2/3 del stake | Pedir blockhash, confirmar que tu tx aterrizó, actualizar UI |
| `finalized` | Máximo lockout | Contabilidad final, PnL definitivo |

Si omites `commitment`, el default suele ser `finalized` (más lento). Decláralo siempre.

## Blockhash y expiración

- Una transacción referencia un blockhash reciente que vale ~150 bloques (la doc de reintentos lo estima en ~1 min 19 s). Guarda `lastValidBlockHeight` al pedirlo.
- Pide el blockhash con `confirmed` (evitas blockhashes de un fork minoritario).
- **Antes de volver a firmar** (nuevo blockhash) confirma que el blockhash viejo ya expiró: si no, ambas versiones pueden ejecutarse = compra doble. Detalle en `enviar-transacciones-rapido`.
- Construye, firma y envía en cuanto obtengas la cotización: cada segundo de espera gasta vida del blockhash y la cotización se vuelve vieja.

## Tamaño, versioned transactions y lookup tables

- Legacy y v0: máximo 1 232 bytes y 64 cuentas. v0 permite Address Lookup Tables (ALT) para referenciar muchas cuentas con 1 byte cada una. Las rutas de Jupiter usan ALTs: compila a mensaje v0 con las tablas que te devuelve la API.
- v1 (SIMD-0385, activo en mainnet según Jupiter): hasta 4 096 bytes, cuentas inline sin ALTs, compute budget en la configuración del mensaje. Construir v1 requiere `@solana/kit` ≥ 8.0.0 o `@solana/web3.js` ≥ 3.0.2 (web3.js 1.99 solo lo lee).
- Al suscribirte o leer transacciones (RPC, websockets), pasa `maxSupportedTransactionVersion` (Helius recomienda `1` para recibir legacy, v0 y v1). Sin él, las tx versionadas no llegan o fallan al leerse.
- Las cuentas de tip de Jito no deben ir dentro de una ALT (lo pide la doc de Jito); por las dudas, deja fuera de ALTs cualquier cuenta de tip.

## Errores típicos y qué hacer

| Síntoma | Causa común | Arreglo |
| - | - | - |
| `Blockhash not found` / `block height exceeded` | Firmaste tarde o blockhash de `processed` | Blockhash `confirmed`, firma y envía de inmediato, reintenta con el mismo blockhash |
| `insufficient funds for rent` | No contaste rent de ATAs/cuentas nuevas | Reserva SOL para rent + fees, consulta el mínimo |
| `exceeded CUs meter` | Límite de CU bajo | Simula y pon consumidas × 1.2 |
| `Transaction too large` | Muchas cuentas sin ALT | Mensaje v0 con ALTs, `maxAccounts`/`maxBytes` en Jupiter `/build` |
| `IncorrectProgramId` en token | Mint de Token-2022 tratado como SPL | Lee el owner del mint |
| Tx "enviada" pero nunca aparece | Se cayó; nadie reintentó | Rebroadcast hasta `lastValidBlockHeight`, luego decide |
| 429 en RPC público | Endpoints públicos no son para producción | Usa un RPC con API key (Helius) |

## Seguridad (reglas duras)

- Nunca pidas, imprimas, loguees ni commitees llaves privadas o seed phrases. En Workers van como secret (`wrangler secret put`), nunca en `wrangler.toml` ni en el código.
- Billetera del bot dedicada y con poco saldo. Pruebas primero en devnet o con montos mínimos.
- Simula antes de enviar y pide confirmación explícita del usuario antes de cualquier acción que mueva fondos reales.

## Cómo comprobarlo tú mismo

Pídele a Claude que corra `npm ls @solana/kit @solana/web3.js` para ver qué SDK y versión tiene tu proyecto, y que te muestre en el explorador (solscan.io o explorer.solana.com) la transacción de prueba con sus compute units y fee.

## Fuentes (verificado nov 2026)

- https://solana.com/docs/core/fees (base fee, fórmula de priority fee, límites de CU)
- https://solana.com/docs/core/transactions (1 232 bytes, v1 4 096 bytes, blockhash 150 slots)
- https://solana.com/docs/core/transactions/retry (expiración, cuándo re-firmar)
- https://solana.com/docs/rpc (niveles de commitment, RPC público no es para producción)
- https://solana.com/docs/clients/javascript (Kit recomendado, web3.js v3, 1.x en mantenimiento, spl-token no corre en v3)
- https://solana.com/docs/tokens/extensions (extensiones Token-2022)
- https://developers.jup.ag/docs/swap/advanced/transaction-versions.md (v1 en mainnet) y https://developers.jup.ag/docs/swap/advanced/compute-units.md (CU × 1.2)
- https://docs.phantom.com/sdks/react-sdk/sign-and-send-transaction (versiones mínimas para construir v1)
- https://www.helius.dev/docs/rpc/websocket/transaction-subscribe.md (`maxSupportedTransactionVersion: 1`)
- Registro npm (`npm view`) para versiones y peers (16 nov 2026: `@solana/web3.js` latest 3.2.1, `@solana/kit` 8.6.0, `helius-sdk` 3.5.0 con peer `@solana/kit ^6.9.0`, `@solana/spl-token` 0.4.15 con peer web3.js `^1.95.5`); RPC mainnet `getMinimumBalanceForRentExemption` y `getAccountInfo` para rent e IDs de programas.
