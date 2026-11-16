---
name: montos-y-decimales
description: Montos correctos en Solana - lamports vs SOL, decimales leídos del mint (nunca asumir 6 o 9), BigInt en vez de float, bps, redondeo, conversiones UI a raw y tests mínimos para este bug. Úsala siempre que el código calcule, muestre, guarde o compare cantidades de tokens o SOL.
---

# Montos y decimales: el bug que vacía billeteras

En código de trading, un monto mal convertido no es un bug cosmético: compra 1000× más (o menos) de lo pedido. Claude tiende a usar `Number`, `parseFloat`, `* 1e9` o asumir 6/9 decimales. Esta skill lo prohíbe.

## Reglas duras

1. **On-chain todo es entero.** SOL en lamports (1 SOL = 1 000 000 000 lamports); tokens en unidades raw (`amount` = UI × 10^decimals). Usa `bigint` en TypeScript/JS para cualquier monto que vaya a una transacción, a una API (Jupiter `amount`) o a la base de datos.
2. **Nunca `Number`/float para montos.** Prohibido `parseFloat`, `Number(x)`, `x * 1e9`, `Math.round(ui * 10 ** d)`, `toFixed` para calcular. Un `Number` pierde precisión arriba de 2^53 (≈ 9 × 10^15) — el supply raw de muchos memecoins (p. ej. 10^9 tokens × 10^6) ya ronda ese orden — y además `0.1 + 0.2 !== 0.3`.
3. **Decimales: léelos del mint, siempre.** `getAccountInfo(mint, {encoding:"jsonParsed"})` → `parsed.info.decimals`, o `decimals` de Jupiter Tokens/Price API. Cachéalos por mint. Nunca hardcodees 6 o 9 "porque los memecoins usan 6": hay de 0 a 9 y más.
4. **Texto ↔ raw con funciones exactas** (strings, no floats): usa `toRaw(ui, decimals)` y `toUi(raw, decimals)` de `scripts/montos.mjs`. Rechaza entradas con más decimales que el mint en vez de redondear en silencio.
5. **De APIs, toma el campo entero.** En balances de token del RPC usa `uiTokenAmount.amount` (string entero), no `uiAmount` (float). Jupiter devuelve `inAmount`/`outAmount` como strings: `BigInt(order.outAmount)`.
6. **bps**: 1 bp = 0.01%; 10 000 bps = 100%. `mulBps(amount, bps)` con redondeo explícito. Para ti (lo que gastas) redondea **hacia abajo**; para mínimos que exiges recibir, también hacia abajo (más estricto).
7. **Divide al final y compara en cruz.** Para comparar precios a/b vs c/d usa `a*d > c*b` con `BigInt`. Si necesitas un precio para mostrar, calcúlalo solo para la UI.
8. **Serialización**: `JSON.stringify` lanza error con `BigInt`. Convierte a string (`x.toString()`) al guardar o enviar; guarda en DB como `TEXT` o entero de 64 bits si cabe, nunca como `REAL`.
9. **SOL vs wSOL**: wSOL es un token de 9 decimales (`So111…112`) en una token account; suma ambos si necesitas "SOL total" de una billetera.

## Casos que rompen la conversión simple

- **Transfer fee (Token-2022)**: recibes menos de lo enviado. Calcula lo recibido con los balances post de la transacción confirmada, no con lo cotizado.
- **Scaled UI Amount / Interest-Bearing (Token-2022)**: la cantidad que muestran las billeteras no es simplemente `raw / 10^decimals`. Para transacciones usa siempre raw. Para mostrar, lee la configuración de la extensión del mint (jsonParsed `extensions`) y confirma en la doc de Token-2022 cómo se calcula el valor mostrado antes de escribir la fórmula.
- **Rent y fees**: el SOL "disponible" de una billetera no es todo su balance; descuenta rent de cuentas que vas a crear, fees y tips.
- **Precios en USD** (Jupiter `usdPrice`) son floats por naturaleza: úsalos solo para mostrar, nunca para calcular el `amount` de un swap.

## Patrones correctos (TypeScript)

```ts
import { toRaw, toUi, mulBps, ratioBps, minOutConSlippage, precioMayor } from "./montos.mjs";

const decimals = await getMintDecimals(mint);          // del mint, con caché
const amount = toRaw(inputDelUsuario, decimals);       // "0.25" -> 250000000n (si 9)
const params = new URLSearchParams({ inputMint, outputMint, amount: amount.toString(), taker });
const order = await (await fetch(url + params)).json();
const out = BigInt(order.outAmount);
mostrar(`Recibirás ~${toUi(out, outDecimals)} tokens`);

// copy trading: % del balance del trader, y el mismo % del bot
const pct = ratioBps(solGastadoTrader, solAntesTrader);          // bps
const tamano = mulBps(solDisponibleBot, pct, "abajo");
```

## Tests mínimos obligatorios

Antes de dar por terminado cualquier código que convierta montos, debe haber tests (usa la skill test-driven-development de superpowers si está disponible) que cubran:

- `toRaw("0.1", 9) === 100000000n` y `toRaw("0.1", 9) + toRaw("0.2", 9) === toRaw("0.3", 9)`.
- Token de 6, 9 y **0** decimales; ida y vuelta `toUi(toRaw(x, d), d) === x`.
- Rechazo de `number` como entrada, de notación científica y de más decimales que el mint.
- El error de 1000× al asumir 9 decimales en un mint de 6.
- Montos grandes (supply completo de un memecoin) sin pérdida de precisión.
- Redondeo: `mulBps(3n, 5000)` → `1n` (abajo).
- Serialización: el objeto que se guarda o se manda a la API no contiene `bigint` crudo.

Ejecuta las pruebas de referencia con `node skills/montos-y-decimales/scripts/montos.mjs --test` (desde la carpeta del plugin) para ver que todas pasan, y replica los casos en el framework de tests del proyecto.

## Dónde suele colarse el bug

- **Input del usuario**: rechaza o normaliza la coma decimal ("0,5"), espacios y separadores de miles antes de `toRaw`. Si hay botones de "25% / 50% / Máx", calcúlalos con `mulBps` sobre el balance raw y deja reserva de SOL para fees en "Máx".
- **Sliders y porcentajes** guardados como `0.25`: guárdalos como bps enteros (`2500`).
- **Precios USD** de APIs: solo para mostrar.
- **Conversión SOL → USD → token** encadenada: cada paso con floats acumula error; cotiza directo con Jupiter (`amount` raw).
- **Base de datos**: columnas `REAL`/`FLOAT` para montos; usa `TEXT` o entero.
- **Logs y UI**: mostrar `raw` sin convertir (un 1000000 que en realidad es 1 USDC) confunde al usuario y a Claude al depurar; imprime ambos: `1000000 (1 USDC)`.

## Búsqueda rápida de bugs en un repo

Pide a Claude buscar estos patrones y revisar cada uno: `parseFloat(`, `Number(`, `* 1e9`, `* 1e6`, `10 ** 9`, `10 ** 6`, `LAMPORTS_PER_SOL *`, `uiAmount` (sin `String`), `toFixed(`, `Math.round(` cerca de montos, `decimals: 6`, `decimals = 9`. `LAMPORTS_PER_SOL` es un `number` en web3.js v1: no lo multipliques por floats.

## Cómo comprobarlo tú mismo

Haz un swap de prueba de un monto "raro" (p. ej. 0.0123 SOL) y compara en solscan.io: el monto que salió de la billetera debe coincidir exactamente con lo que pusiste, y lo recibido con lo que la app mostró (menos slippage/comisión).

## Fuentes (verificado nov 2026)

- https://solana.com/docs/core/fees (lamports, micro-lamports)
- https://solana.com/docs/tokens/extensions (Transfer Fee, Scaled UI Amount, Interest-Bearing)
- https://developers.jup.ag/docs/api-reference/swap/order.md (`amount` en unidades mínimas, montos como string)
- https://developers.jup.ag/docs/price/index.md (`decimals` en Price API)
- RPC mainnet `getAccountInfo` jsonParsed (campo `decimals` del mint)
- MDN: BigInt y JSON.stringify (TypeError con BigInt) — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
