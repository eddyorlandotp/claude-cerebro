---
name: bot-copy-trading
description: Arquitectura de un bot de copy trading Solana 24/7 (Cloudflare Workers, Helius, Jupiter) - detección, parseo del swap, tamaño proporcional, tope de precio, envío, dedupe, reconexión, alertas, reconciliación y PnL en SOL. Úsala para copiar trades, copy bot, wallet tracker.
---

# Bot de copy trading: copiar fiel, rápido y una sola vez

**Regla de producto: copiar fiel.** El bot hace lo que hizo el trader, en proporción, con las validaciones que el usuario pidió (tope de precio de entrada, saldo mínimo, slippage). No agregues filtros, predicciones, stop-loss, "mejoras" ni lógica propia que el usuario no pidió. Si crees que algo ayudaría, propónlo en una frase y espera su respuesta.

Antes de tocar este código lee también: `helius-rpc-y-tiempo-real` (detección y Workers), `enviar-transacciones-rapido` (envío e idempotencia), `jupiter-swaps-y-comisiones` (`/build`), `montos-y-decimales` (BigInt).

## Regla 0: verifica antes de confiar

Cada pieza externa (Helius, Jupiter, Sender, Cloudflare) cambió en 2025–2026. Antes de escribir una llamada, confírmala en la doc oficial (WebFetch a la página `.md`, Context7 o los MCP de docs de este plugin). Si una respuesta real no coincide con lo que esperabas, imprime el JSON (sin secretos) y ajusta.

## Seguridad y dinero real (no negociable)

- Billetera del bot **dedicada**, con solo el saldo que el usuario está dispuesto a perder. La llave privada va como secret del Worker (`wrangler secret put`); nunca en código, logs, `.env` commiteado ni en el chat. Si el usuario la pega en el chat, dile que la considere comprometida y la rote.
- Límites duros configurables y activos desde el día 1: tamaño máximo por operación (SOL), pérdida máxima diaria (SOL) que pausa el bot, máximo de operaciones por hora, interruptor de pausa manual.
- Arranca en **modo observación** (detecta, calcula y registra lo que habría hecho, sin enviar). Pasa a dinero real solo con confirmación explícita del usuario y con montos mínimos.
- Simula antes de enviar (salvo decisión explícita del usuario para la ruta ultra rápida, ver `enviar-transacciones-rapido`).

## Arquitectura de referencia

```
Helius WSS (transactionSubscribe, processed) ─┐
Respaldo: getSignaturesForAddress cada N s  ──┼─► Durable Object "Copier" (1 por trader)
                                              │     1. dedupe por firma del trader
                                              │     2. parsear swap (mint, lado, montos, % del balance)
                                              │     3. calcular tamaño proporcional
                                              │     4. validar (tope de precio, saldo mínimo, límites)
                                              │     5. Jupiter /build → simular → firmar → Sender
                                              │     6. confirmar → registrar → PnL
                                              └─► alarm() cada 30 s: latido, reconexión, alertas
Cron cada 1 min: asegurar que el DO vive · Cron cada N min: reconciliación trader vs bot
Almacenamiento: SQLite del DO (operaciones, posiciones, señales de salud)
```

Pseudocódigo completo, esquema de tablas y cálculos detallados: `references/arquitectura.md`.

## 1. Detección

- Fuente principal: `transactionSubscribe` con `accountInclude: [trader]`, `failed: false`, `commitment: processed`, `maxSupportedTransactionVersion: 1` (requiere plan Developer de Helius). En Free: `logsSubscribe` con `mentions` + `getTransaction` (más lento).
- Respaldo obligatorio: al reconectar y cada pocos segundos, `getSignaturesForAddress(trader, { until: últimaFirmaProcesada })`. Todo pasa por la misma deduplicación.
- `processed` puede revertirse (raro). Registra la firma del trader y, en la reconciliación, verifica que se confirmó.

## 2. Parseo del swap del trader

Usa cambios de balance, no decodificación de instrucciones (funciona con cualquier DEX, agregador o pump.fun):

- Token: `meta.preTokenBalances` / `postTokenBalances` con `owner === trader`, agrupado por `mint`. Usa `uiTokenAmount.amount` (string entero) → `BigInt`, nunca `uiAmount` (float).
- SOL: `meta.preBalances[i]` / `postBalances[i]` del índice del trader en las account keys (incluye las cargadas por ALT: `meta.loadedAddresses`). Si el trader pagó la fee, súmale `meta.fee` de vuelta para obtener lo que gastó en el swap. Combina SOL nativo + wSOL del trader.
- Lado: token sube y SOL baja → **compra**; token baja y SOL sube → **venta**. Si cambian dos tokens no-SOL (token↔USDC), registra "par no soportado" y alerta: no improvises (pregunta al usuario cómo quiere manejarlo).
- Porcentaje del balance:
  - Compra: `pct = SOL gastado / SOL disponible del trader antes del swap`. Usa el pre-balance de la misma tx: es el dato más fresco.
  - Venta: `pct = tokens vendidos / tokens que tenía el trader antes` (pre-balance del mint). Venta del 100% = salida total.
- Precio del trader = SOL gastado (lamports) / tokens recibidos (unidades raw). Guárdalo como fracción de dos `BigInt`, no como float.
- Ignora transacciones del trader que no son swaps (transfers, creación de cuentas) y regístralas como "no-swap".

## 3. Tamaño proporcional

- Compra: `tamaño = pct × (SOL del bot − reserva)`. La reserva cubre fees, tips, rent de ATAs y las ventas futuras (configurable; muestra al usuario de cuánto es y por qué).
- Venta: vende `pct × posición actual del bot en ese mint`. Si el trader vendió 100%, vende 100% y cierra la token account para recuperar el rent.
- Aplica topes: mínimo (si da menos que el mínimo útil, registra "omitida: monto muy chico") y máximo por operación.
- Todo en `BigInt` con redondeo hacia abajo (nunca gastar más de lo calculado).

## 4. Validaciones (solo las que el usuario pidió)

- **Tope de precio de entrada**: con la cotización de `/build`, precio del bot = `inAmount / outAmount`. Si `precioBot > precioTrader × (1 + topeBps/10 000)` → no compres, registra "omitida: precio" con ambos precios. Compara multiplicando en cruz con `BigInt`, sin dividir.
- **Slippage alineado al tope**: elige `slippageBps` para que el peor caso tampoco pase el tope: `slippage ≤ 1 − precioCotizado / precioTope`. Si ese margen es menor al mínimo operable, omite. Así el tope se respeta también al ejecutar, no solo al cotizar.
- **Saldo mínimo**: si el SOL del bot menos la reserva no alcanza, omite y alerta "saldo bajo".
- **Ventas**: no apliques tope de precio a ventas salvo que el usuario lo pida (copiar fiel = salir cuando sale el trader).
- Límites duros (máximo por operación, pérdida diaria, operaciones por hora).

## 5. Envío

Jupiter `/build` (sin fee de Jupiter; en tokens de menos de 24 h `/order` cobraría 50 bps) → agrega tip de Sender → simula → límite de CU × 1.2 → priority fee con tope → firma → Sender → rebroadcast del mismo tx → confirma. Detalle en `enviar-transacciones-rapido`. Clave de idempotencia: `firmaTrader + lado`.

Pump.fun: entre que la bonding curve se completa y se migra a PumpSwap, cualquier trade en la curva falla (`BondingCurveComplete`). Si la copia falla así, registra el motivo exacto; no reintentes en loop. Si Jupiter no tiene ruta para un token muy nuevo, registra "sin ruta": no construyas un camino alterno sin que el usuario lo pida.

## 6. Registro (cada operación, auditable)

Guarda: firma del trader, slot y hora de detección, mint, lado, montos del trader (raw), pct, precio del trader, tamaño calculado, cotización, precio del bot, slippage usado, motivo si se omitió, firma del bot, slot de confirmación, montos reales (de balances post), fees pagadas (base + priority + tip + comisiones), estado final, latencias (detección, decisión, envío, confirmación).

## 7. Salud: heartbeats, reconexión y alertas

Alerta (Telegram/Discord/email) cuando:
- No hay mensajes del stream en X min mientras el respaldo sí encuentra firmas del trader (stream muerto).
- N reconexiones seguidas o el DO se reinició.
- K copias fallidas seguidas, o una operación en `enviada` sin confirmar tras expirar.
- Saldo de SOL bajo la reserva; créditos de Helius cerca del límite; 429 repetidos de Jupiter.
- Pérdida diaria alcanzada (y pausa automática).
Envía además un resumen diario: operaciones copiadas/omitidas/fallidas con motivos, latencia mediana, PnL del día.

## 8. Reconciliación periódica trader vs bot

Cada N minutos: lista tokens del trader y del bot (`getTokenAccountsByOwner` para ambos programas de token). Alerta si:
- El bot tiene un token que el trader ya no tiene (se perdió una venta).
- El trader tiene una posición abierta que el bot no copió y no hay registro de "omitida" (se perdió una compra).
- La proporción de una posición se desvió más de X% de lo esperado.
Qué hacer ante una diferencia (vender automáticamente, solo alertar) lo decide el usuario: pregúntale y deja la regla configurada.

## 9. PnL en SOL

- Por posición: `PnL realizado = SOL recibido en ventas − SOL gastado en compras − fees (base + priority + tips + comisiones) + rent recuperado al cerrar cuentas`.
- No realizado: cotiza la venta de la posición con `/order` sin `taker` (salida en lamports) — es más realista que precio × cantidad en tokens sin liquidez.
- Reporta en SOL (la unidad en la que opera el bot). Si el usuario quiere USD, conviértelo aparte con el precio de SOL del momento y dilo.
- Compara contra el trader: mismo cálculo con sus montos, para saber cuánto cuesta el retraso.

## Cómo comprobarlo tú mismo

En modo observación, deja correr un día y revisa el registro: ¿cada compra/venta del trader aparece una sola vez con su cálculo? Luego, con dinero mínimo, compara en solscan.io la tx del trader y la del bot: mismo token, proporción correcta, precio dentro del tope y diferencia de slots.

## Fuentes (verificado nov 2026)

- https://www.helius.dev/docs/rpc/websocket/transaction-subscribe.md , https://www.helius.dev/docs/rpc/websocket.md
- https://developers.jup.ag/docs/swap/build.md , https://developers.jup.ag/docs/swap/index.md (fees por par, 50 bps en tokens < 24 h)
- https://www.helius.dev/docs/sending-transactions/sender.md
- https://raw.githubusercontent.com/pump-fun/pump-public-docs/main/docs/PUMP_PROGRAM_README.md y .../SYNTHETIC_MIGRATION.md (`complete`, `BondingCurveComplete`, migración a PumpSwap)
- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
- https://solana.com/docs/core/transactions/retry
