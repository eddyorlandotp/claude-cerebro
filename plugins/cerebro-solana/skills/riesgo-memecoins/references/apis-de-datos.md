# APIs de datos de tokens (verificado nov 2026)

Precios y límites cambian. Antes de depender de uno, vuelve a abrir la URL de la fuente.

## Jupiter

- Base `https://api.jup.ag`, header opcional `x-api-key`. Keyless 0.5 RPS; Free 1 RPS; Developer $25/mes 10 RPS. Límite por organización, bucket compartido con swaps. Fuente: https://developers.jup.ag/docs/portal/rate-limits.md
- `GET /tokens/v2/search?query=<nombre|símbolo|mint>` (hasta 100 mints separados por coma): `id`, `name`, `symbol`, `icon`, `decimals`, `tokenProgram`, `isVerified`, `organicScore`, `organicScoreLabel`, `audit.mintAuthorityDisabled`, `audit.freezeAuthorityDisabled`, `audit.topHoldersPercentage`, `audit.isSus` (solo presente si fue marcado: revisa presencia, no valor). Otros: `/tokens/v2/tag?query=verified`, `/tokens/v2/{toporganicscore|toptraded|toptrending}/{5m|1h|6h|24h}`, `/tokens/v2/recent`. Fuente: https://developers.jup.ag/docs/tokens/index.md
- `GET /price/v3?ids=<hasta 50 mints>`: `usdPrice`, `decimals`, `blockId`, `priceChange24h`, `liquidity`, `createdAt`. Tokens sin precio confiable se **omiten**. Fuente: https://developers.jup.ag/docs/price/index.md

## RugCheck

- Base `https://api.rugcheck.xyz`. Swagger: https://api.rugcheck.xyz/swagger/doc.json
- Sin llave: `GET /v1/tokens/{mint}/report`, `GET /v1/tokens/{mint}/report/summary`, `GET /v1/tokens/{mint}/insiders/graph`, `/insiders/networks`, `/metadata`, `/v1/stats/new_tokens`, `/v1/stats/trending`, `/v1/stats/verified`, `/v1/search`.
- Con llave (`ApiKeyAuth`): `POST /v1/bulk/tokens/report`, `POST /v1/bulk/tokens/summary`, `GET /v1/tokens/{mint}/lockers`, verificación de tokens, votos.
- Rate limits: no aparecen en el swagger. Cachea y maneja 429 con backoff.
- Antes de mapear campos del reporte, imprime una respuesta real: el esquema no está garantizado entre versiones.

## DexScreener

- Base `https://api.dexscreener.com`, sin llave. Fuente: https://docs.dexscreener.com/api/reference
- 300 req/min: `/tokens/v1/{chainId}/{tokenAddresses}` (varias direcciones separadas por coma), `/token-pairs/v1/{chainId}/{tokenAddress}`, `/latest/dex/pairs/{chainId}/{pairId}`, `/latest/dex/search?q=`.
- 60 req/min: `/token-profiles/latest/v1`, `/token-profiles/recent-updates/v1`, `/token-boosts/latest/v1`, `/token-boosts/top/v1`, `/community-takeovers/latest/v1`, `/ads/latest/v1`, `/orders/v1/{chainId}/{tokenAddress}`, `/metas/trending/v1`.
- Para Solana, `chainId` = `solana`. Ojo: "boosts" y "ads" son pagados por los proyectos; no son señal de calidad.

## Birdeye (Birdeye Data)

- Llave obligatoria en header `X-API-KEY`. Docs: https://data.birdeye.so/docs/llms.txt
- Planes (USD/mes, compute units incluidas, rate limit por cuenta): Standard $0, 30 000 CU, 1 rps, acceso limitado (la página de rate limits dice "3 endpoints" pero la tabla de accesibilidad por paquete marca decenas para Standard: verificar en https://data.birdeye.so/docs/guides/data-accessibility-by-packages.md antes de depender de esto) · Lite $39, 2.5M CU, 15 rps · Starter $99, 8M CU, 15 rps · Premium $199, 20M CU, 50 rps + websockets · Business $499, 60M CU, 100 rps. Fuente: https://data.birdeye.so/docs/guides/payment/pricing.md
- Cada endpoint cuesta distintas CU; revisa el costo antes de ponerlo en un loop.

## GeckoTerminal / CoinGecko onchain

- La página https://www.geckoterminal.com/dex-api indica que el acceso gratuito es de 30 llamadas/min y que un plan pago de CoinGecko sube a 500 llamadas/min; los mismos datos están en los endpoints `/onchain` de CoinGecko API.
- CoinGecko: plan Demo 100 llamadas/min; sin llave, limitado por IP y compartido. Las IDs de red de GeckoTerminal no son las mismas que las de CoinGecko. Fuentes: https://docs.coingecko.com/docs/errors-and-rate-limits.md , https://docs.coingecko.com/docs/querying-onchain-data.md

## Patrón de consumo

- Una función por proveedor con timeout corto, caché por mint (TTL de minutos) y backoff en 429.
- Nunca bloquees la compra del usuario esperando una API lenta: muestra "cargando"/"sin datos" y deja que decida.
- Registra qué fuente dio cada dato para poder auditar.
