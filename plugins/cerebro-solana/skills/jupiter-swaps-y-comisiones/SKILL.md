---
name: jupiter-swaps-y-comisiones
description: Swaps con Jupiter Swap API V2 (order/execute vs build), cobrar comisión de plataforma o referido como integrador, slippage, errores, rate limits y API key. Úsala para terminal de trading, bot, quote, swap, fee de integrador, referral, lite-api, Ultra.
---

# Jupiter: swaps y comisiones de integrador (estado nov 2026)

La API de Jupiter cambió varias veces en 2025–2026. Lo que funcionaba hace meses (lite-api, Ultra en `ultra-api.jup.ag`, `/quote` + `/swap` de V1) ya no es lo recomendado. **No escribas endpoints de memoria.**

## Regla 0: verifica antes de confiar

- Consulta la doc antes de codificar: MCP `jupiter-docs` de este plugin (`plugin:cerebro-solana:jupiter-docs`, búsqueda en la doc oficial), Context7 si está instalado, o WebFetch a `https://developers.jup.ag/docs/<ruta>.md` (cada página tiene versión `.md`). El índice completo está en `https://developers.jup.ag/docs/llms.txt`.
- Si una respuesta de la API no coincide con lo que esperabas, imprime el JSON real (sin llaves privadas) y ajusta el código a lo que llegó, no al revés.

## Estado actual

- Base URL: `https://api.jup.ag/swap/v2`. Autenticación: header `x-api-key` (llave del Developer Platform `https://developers.jup.ag/portal`, formato `jup_...`).
- `lite-api.jup.ag` se está retirando progresivamente: el reemplazo es usar `api.jup.ag` sin llave (keyless, 0.5 RPS). Migra cualquier `lite-api` que veas.
- Ultra (`ultra-api.jup.ag`) y Swap V1 (`/quote` + `/swap`, `/swap-instructions`) tienen guías de migración: Ultra → `/order` + `/execute`; V1 → `/order` o `/build`.

## Elige el camino

| | Meta-Aggregator: `GET /order` + `POST /execute` | Router: `GET /build` |
| - | - | - |
| Ruteo | Metis + JupiterZ (RFQ) + Dflow + OKX compiten | Solo Metis |
| Devuelve | Transacción armada (base64) para firmar | Instrucciones sueltas + ALTs |
| Envío | Jupiter la aterriza con `/execute` (sin RPC propio) | Tú: tu RPC, Helius Sender, Jito, o `tx.jup.ag` |
| Fee de Jupiter | Sí, según par (ver abajo) | **No** |
| Tu comisión | `referralAccount` + `referralFee` (50–255 bps), Jupiter se queda 20% | `platformFeeBps` + `feeAccount`, te quedas el 100% |
| Modificar la tx | No (JupiterZ tiene last-look; `/execute` valida que no cambió) | Sí: agregar tips, memo, cerrar cuentas, CPI |

Fee de plataforma de Jupiter en `/order` (a nov 2026): 0 bps comprando JUP/JLP/jupSOL o entre pegged; 2 bps SOL↔stable; 5 bps LST↔stable; 10 bps todo lo demás; **50 bps en tokens con menos de 24 h**. Con referral activo no hay fee de plataforma aparte: Jupiter toma 20% de tu `referralFee`.

Recomendación por proyecto (explícasela al usuario en 1–3 frases):
- **Terminal web donde el usuario firma con Phantom**: `/order` + `/execute` con `referralAccount`/`referralFee`. Mejor precio, sin RPC, y cobras comisión. Requiere que la billetera firme **sin enviar** (`solana:signTransaction`). Si el usuario usa una billetera embebida que solo hace sign-and-send (p. ej. embedded wallets del Phantom Connect SDK), usa `/build` y deja que la billetera envíe.
- **Bot de copy trading**: `/build` (sin fee de Jupiter, que en memecoins nuevas sería 50 bps por swap) + envío propio por Helius Sender. Necesitas modificar la tx para el tip de Sender, y eso `/order` no lo permite.

## Flujo `/order` + `/execute`

1. `GET /swap/v2/order?inputMint=...&outputMint=...&amount=<entero en unidades mínimas>&taker=<billetera>` (+ `referralAccount`, `referralFee` si cobras). Sin `taker` solo obtienes cotización (`transaction: null`), útil para mostrar precio.
2. Revisa la respuesta antes de pedir firma:
   - `transaction === ""` → no se pudo construir: lee `router` + `errorCode` (no hagas match con `errorMessage`).
   - `feeBps`, `platformFee`, `feeMint`, `referralAccount`: confirma que tu comisión se aplicó. Si cae al fee default, tu `referralTokenAccount` para ese `feeMint` no existe.
   - `outAmount`, `router`, `lastValidBlockHeight` (rutas agregador) o `expireAt` (RFQ).
3. Firma inmediatamente (la cotización envejece).
4. `POST /swap/v2/execute` con `{ signedTransaction, requestId }`. La respuesta trae `status`, `code`, `signature`, `totalInputAmount`, `totalOutputAmount`. `code: 0` = éxito.
5. Muestra al usuario el resultado real (`totalOutputAmount` convertido con los decimales del mint), no la cotización.

Parámetros opcionales y el efecto en el ruteo (`receiver` y `payer` desactivan Dflow y OKX; `referralAccount` no desactiva a nadie), tabla de errores `/order` y `/execute`: lee `references/order-execute-y-build.md`.

## Flujo `/build`

1. `GET /swap/v2/build?inputMint&outputMint&amount&taker` + opcionales: `slippageBps` (número o `rtse`), `platformFeeBps` + `feeAccount`, `computeUnitPricePercentile`, `mode=fast`, `maxAccounts`, `maxBytes`, `forJitoBundle`, `tipAmount` (solo para `tx.jup.ag`).
2. La respuesta trae `computeBudgetInstructions` (solo precio de CU, **no** el límite), `setupInstructions`, `swapInstruction`, `cleanupInstruction`, `otherInstructions`, `addressesByLookupTableAddress`, `blockhashWithMetadata`.
3. Arma: compute budget → setup → swap → cleanup → tus instrucciones (tip de Sender, cierre de cuentas). Simula, pon límite de CU = consumidas × 1.2 (tope 1 400 000), **acota el precio de CU** (puede venir disparado), compila a v0 con las ALTs, firma, envía.
4. `/execute` no sirve para `/build`.

## Cobrar comisión como integrador

Resumen (pasos exactos y código en `references/comisiones-integrador.md`):

- **`/order` (referral)**: una sola vez creas un `referralAccount` bajo el proyecto de referidos de Jupiter y un `referralTokenAccount` por cada mint en que esperas cobrar (empieza con SOL/wSOL y USDC). Lo puedes hacer en `https://referral.jup.ag/` o con `@jup-ag/referral-sdk`. Quien firma esas transacciones paga el rent de esas cuentas (tu billetera de plataforma, no el usuario). Jupiter decide el `feeMint` por prioridad: SOL → stables → LSTs → bluechips → otros; en un swap SOL↔memecoin normalmente cobra en SOL. Si falta la token account de ese mint, el swap se ejecuta **sin** tu comisión.
- **`/build` (platform fee)**: `platformFeeBps` (0–10000) + `feeAccount` (cualquier token account que controles). Tú creas y mantienes esa cuenta. La doc de V2 no especifica en qué mint se cobra en cada ruta: pruébalo con un swap chico y revisa la tx antes de producción.
- Muestra la comisión al usuario **antes** de firmar ("Comisión de la plataforma: 0.5%").
- Verifica en la doc vigente si hay términos o requisitos regulatorios para cobrar comisiones en tu país; no lo asumas.

## Slippage

- `/order` sin `slippageBps`: Jupiter aplica RTSE (estimador en tiempo real). Pasar `slippageBps` cambia `mode` de `ultra` a `manual`.
- `/build`: default 50 bps; `slippageBps=rtse` para usar RTSE.
- Para memecoins volátiles un slippage fijo bajo hace fallar swaps; uno alto te expone a sandwich. En el bot, el tope de precio de entrada (skill `bot-copy-trading`) es la protección principal, no el slippage.

## Rate limits y API key (a nov 2026, verifica en https://developers.jup.ag/docs/portal/rate-limits.md)

| Plan | RPS (ventana deslizante de 60 s) | `/swap/v2/execute` (bucket aparte) |
| - | - | - |
| Keyless | 0.5 | 20 |
| Free (con llave) | 1 | 50 |
| Developer $25/mes | 10 | 100 |
| Launch $100/mes | 50 | 100 |
| Pro $500/mes | 150 | 100 |

- El límite es **por organización**, no por llave: crear más llaves no da más RPS.
- Lee `x-ratelimit-remaining` y `x-ratelimit-reset` (timestamp Unix en segundos); en 429 espera hasta `reset`, no reintentes en loop.
- La llave va en el backend (Worker). Si la usas en el navegador, restríngela con permisos por producto y reglas de firewall del portal; nunca la commitees.
- Precio y tokens comparten el bucket principal: no consultes `/price/v3` en loop desde el bot.

## Otras APIs de Jupiter útiles

- Precio: `GET https://api.jup.ag/price/v3?ids=<hasta 50 mints>` → `usdPrice`, `decimals`, `liquidity`, `priceChange24h`. Tokens sin precio confiable **se omiten** de la respuesta: comprueba cada id.
- Tokens: `GET https://api.jup.ag/tokens/v2/search?query=<mint|símbolo>` → `decimals`, `tokenProgram`, `isVerified`, `organicScore`, `audit` (`mintAuthorityDisabled`, `freezeAuthorityDisabled`, `topHoldersPercentage`, `isSus` solo si fue marcado).
- No agregues el MCP de trading de Jupiter (`https://mcp.jup.ag`) a un flujo automático: puede ejecutar operaciones. Si el usuario lo quiere, que lo instale él con `claude mcp add` y confirme cada operación.

## Seguridad

- Nunca pidas ni guardes llaves de usuarios. La terminal solo recibe transacciones firmadas por la billetera.
- La llave del bot y la de la cuenta de referidos van como secrets del Worker. La billetera de referidos solo necesita SOL para rent.
- Antes del primer swap real: devnet no tiene la misma liquidez de Jupiter, así que prueba en mainnet con el monto mínimo y confirma con el usuario.

## Cómo comprobarlo tú mismo

Haz un swap de prueba chico, abre la firma en solscan.io y revisa: que el token llegó, cuánto se cobró de comisión y a qué cuenta. En `https://referral.jup.ag/` deberías ver tus comisiones acumuladas.

## Fuentes (verificado nov 2026)

- https://developers.jup.ag/docs/llms.txt (índice, keyless 0.5 RPS)
- https://developers.jup.ag/docs/swap/index.md (caminos, fees por par, FAQ)
- https://developers.jup.ag/docs/swap/order-and-execute.md (fees, referral, errores, matriz de ruteo)
- https://developers.jup.ag/docs/swap/build.md y https://developers.jup.ag/docs/api-reference/swap/build.md
- https://developers.jup.ag/docs/api-reference/swap/order.md (parámetros de `/order`)
- https://developers.jup.ag/docs/tool-kits/referral-program.md
- https://developers.jup.ag/docs/portal/rate-limits.md, https://developers.jup.ag/docs/portal/plans.md, https://developers.jup.ag/docs/portal/migration.md (retiro de lite-api)
- https://developers.jup.ag/docs/price/index.md, https://developers.jup.ag/docs/tokens/index.md
- https://developers.jup.ag/docs/ai/mcp.md (Docs MCP) y https://developers.jup.ag/docs/ai/trading-mcp.md
- https://docs.phantom.com/sdks/react-sdk/sign-and-send-transaction (embedded wallets sin `signTransaction`)
