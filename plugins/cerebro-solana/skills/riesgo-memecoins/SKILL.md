---
name: riesgo-memecoins
description: Chequeos de riesgo de un token Solana antes de comprarlo o listarlo - mint y freeze authority, LP, holders, dev, migración pump.fun a PumpSwap, honeypot, Token-2022 (transfer hook, fees) y APIs RugCheck, DexScreener, Birdeye, GeckoTerminal, Jupiter. Úsala para rug check.
---

# Riesgo de memecoins: qué revisar y con qué datos

Sirve para (a) mostrar alertas de riesgo en la terminal antes de que el usuario compre y (b) análisis manual. **No apliques estos filtros al bot de copy trading** salvo que el usuario lo pida explícitamente: la regla del bot es copiar fiel.

Ningún chequeo garantiza que un token sea seguro. Preséntalos como señales ("riesgo alto: el creador puede emitir más tokens"), nunca como "seguro" o "verificado" por tu cuenta.

## Regla 0: verifica antes de confiar

- Lee los datos on-chain directamente (RPC) para lo crítico (authorities, extensiones, decimales). Las APIs de terceros sirven para contexto y pueden estar desactualizadas o caídas.
- Antes de usar una API externa, confirma endpoint y límites en su doc (WebFetch). Las de abajo están verificadas a nov 2026; detalles en `references/apis-de-datos.md`.

## Checklist on-chain (orden recomendado)

Todo con `getAccountInfo(mint, { encoding: "jsonParsed" })` → `data.parsed.info` + `owner`:

1. **Programa del token**: `owner` = SPL Token (`Tokenkeg…`) o Token-2022 (`TokenzQd…`).
2. **Mint authority** (`mintAuthority`): si no es `null`, alguien puede emitir más tokens y diluirte. Riesgo alto en memecoins.
3. **Freeze authority** (`freezeAuthority`): si no es `null`, pueden congelar tu token account y no podrás vender. Riesgo alto en memecoins. (Ojo: stablecoins legítimas como USDC sí tienen ambas authorities; el contexto importa.)
4. **Extensiones Token-2022** (`info.extensions[]`, nombres en jsonParsed):
   - `transferHook`: un programa externo se ejecuta en cada transferencia y puede bloquear ventas → riesgo alto si el hook no es conocido.
   - `transferFeeConfig`: cobra % en cada transferencia; recibes menos de lo cotizado si no lo cuentas.
   - `permanentDelegate`: una cuenta puede mover o quemar tus tokens → riesgo crítico.
   - `pausable`: pueden pausar transferencias.
   - `nonTransferable`, `defaultAccountState` (cuentas nacen congeladas), `mintCloseAuthority`.
   - Un token con extensiones no es automáticamente estafa (PYUSD tiene varias), pero en memecoins exige explicación.
5. **Decimales y supply**: `decimals`, `supply` (string). Ver `montos-y-decimales`.
6. **Concentración de holders**: `getTokenLargestAccounts(mint)` (top 20). **Excluye** cuentas de pools/bonding curve/LP antes de calcular el % del top 10; si no, todo token nuevo parece concentrado. Jupiter Tokens v2 ya da `audit.topHoldersPercentage`.
7. **Liquidez y LP**: liquidez en USD (DexScreener / Jupiter Price `liquidity`). Para pools tipo AMM clásico revisa si los LP tokens están quemados o bloqueados (RugCheck reporta markets/lockers). Tokens graduados de pump.fun: según la doc de pump.fun, los LP tokens del pool de PumpSwap se queman al migrar.
8. **Billetera del dev**: el creador (en pump.fun está en la cuenta de bonding curve, campo `creator`) — cuánto tiene, si vendió, si recibió fondos de billeteras ligadas. RugCheck tiene `insiders/graph`; Helius Wallet API da fuentes de fondeo. Trátalo como señal, no prueba.
9. **Prueba de venta (honeypot)**: cotiza una venta pequeña (Jupiter `/order` sin `taker`, mint → SOL). Si no hay ruta o el impacto es absurdo, alerta. Para mayor certeza, simula una tx de venta real con una billetera que tenga el token (`simulateTransaction`): un transfer hook o freeze se ve ahí.

## pump.fun: cómo funciona hoy (a nov 2026, doc oficial de pump.fun)

- Programa de bonding curve `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`; AMM PumpSwap `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`.
- La curva usa reservas virtuales (fórmula tipo Uniswap V2). Cuando se acaban los tokens reales de la curva, `complete = true`.
- La liquidez migra a PumpSwap con `migrate` (permisionless e idempotente: cualquiera puede ejecutarla). La migración vieja a Raydium (`withdraw`) está deshabilitada.
- Entre `complete` y la migración, **todo trade en la curva falla** con `BondingCurveComplete`.
- "Synthetic migration" (2026): con las instrucciones v3, la compra que vacía la curva puede seguir comprando al precio que tendría el pool, y el pool abre donde terminó esa compra.
- Hay variantes nuevas (coins con holder rewards, mayhem mode, pares con quote distinto de SOL). Si tu código lee la cuenta de bonding curve, lee la doc vigente: se agregaron campos y algunos pueden faltar en cuentas viejas.
- Doc: https://github.com/pump-fun/pump-public-docs (léela con WebFetch antes de decodificar cuentas).

## Cómo presentarlo en la terminal

- Semáforo por chequeo con una frase clara: "Freeze authority activa: el creador puede congelar tus tokens y no podrías vender".
- Fuente y hora de cada dato ("RugCheck, hace 2 min"). Si una API falla, muestra "sin datos", no "OK".
- Nunca ocultes un token por riesgo sin decir por qué; nunca marques "seguro".
- Cachea resultados por mint unos minutos para respetar rate limits; los datos on-chain críticos (authorities) se pueden cachear más porque solo cambian por acción del creador.

## Forma del resultado (para que la UI y los logs sean consistentes)

```ts
type Chequeo = {
  id: "mintAuthority" | "freezeAuthority" | "token2022" | "holders" | "liquidez" | "dev" | "ventaPosible";
  nivel: "ok" | "atencion" | "alto" | "sin_datos";
  mensaje: string;          // frase simple para el usuario
  fuente: string;           // "rpc", "jupiter", "rugcheck", "dexscreener"...
  consultadoEn: number;     // ms
  datos?: unknown;          // valores crudos para auditar
};
```

Nunca conviertas un error de API en `ok`: usa `sin_datos`.

## APIs de datos (resumen a nov 2026 — detalle en `references/apis-de-datos.md`)

| API | Qué da | Gratis | Límites |
| - | - | - | - |
| Jupiter Tokens v2 / Price v3 | Metadata, `decimals`, `tokenProgram`, `isVerified`, `organicScore`, `audit` (mint/freeze deshabilitada, top holders, `isSus`); precio USD y liquidez | Sí, keyless 0.5 RPS; llave Free 1 RPS | Comparten bucket con swaps |
| RugCheck (`api.rugcheck.xyz`) | Reporte completo y resumen de riesgo, insiders, metadata | GET de reportes sin llave; bulk y lockers con llave | No documentados en su swagger |
| DexScreener (`api.dexscreener.com`) | Pares, liquidez, volumen, txns, precio por token | Sí, sin llave | 300 req/min (pares/tokens), 60 req/min (perfiles/boosts) |
| Birdeye (`X-API-KEY` obligatorio) | Precios, OHLCV, trades, holders, PnL de wallets | Plan Standard: 30 000 CU/mes, 1 rps, acceso "Limited" (la doc se contradice sobre cuántos endpoints: verificar en https://data.birdeye.so/docs/guides/data-accessibility-by-packages.md antes de depender de esto) | Lite $39/mes 15 rps; websockets desde Premium |
| GeckoTerminal / CoinGecko onchain | Pools, OHLCV, trades | La página de GeckoTerminal indica 30 llamadas/min gratis; pagando sube a 500 | Usa endpoints `/onchain` de CoinGecko con llave |

## Cómo comprobarlo tú mismo

Toma un token que sepas que es legítimo (USDC) y uno recién lanzado; corre los chequeos y compara con lo que muestra rugcheck.xyz y solscan.io (pestaña del mint: authorities y extensiones). Deben coincidir.

## Fuentes (verificado nov 2026)

- https://solana.com/docs/tokens/extensions (extensiones Token-2022)
- RPC mainnet `getAccountInfo` jsonParsed (forma de `mintAuthority`, `freezeAuthority`, `extensions`)
- https://developers.jup.ag/docs/tokens/index.md , https://developers.jup.ag/docs/price/index.md , https://developers.jup.ag/docs/portal/rate-limits.md
- https://api.rugcheck.xyz/swagger/doc.json
- https://docs.dexscreener.com/api/reference
- https://data.birdeye.so/docs/guides/payment/pricing.md , https://data.birdeye.so/docs/guides/api-access/rate-limiting/index.md , https://data.birdeye.so/docs/guides/data-accessibility-by-packages.md
- https://www.geckoterminal.com/dex-api , https://docs.coingecko.com/docs/errors-and-rate-limits.md
- https://github.com/pump-fun/pump-public-docs (PUMP_PROGRAM_README.md, PUMP_SWAP_README.md, SYNTHETIC_MIGRATION.md)
- https://www.helius.dev/docs/llms.txt (Wallet API: identidades y fuentes de fondeo)
