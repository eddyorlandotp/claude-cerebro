---
name: analisis-on-chain
description: Investigar datos on-chain - exploradores (Etherscan, Basescan, Blockscout, Solscan), Dune SQL y API, precios (CoinGecko, DexScreener, DefiLlama), rastrear billeteras y flujos, guardar datos en Python. Úsala para analizar wallets, smart money, datos.
---

# Análisis on-chain

Para responder preguntas como "¿qué hizo esta billetera?", "¿de dónde viene el volumen de este token?" o "¿este trader gana de verdad?". Para Solana en tiempo real (detectar swaps, parsear tx) usa `helius-rpc-y-tiempo-real` y `bot-copy-trading` de cerebro-solana; para chequeos de rug usa `riesgo-memecoins`; para evaluar señales sin engañarte usa `senales-y-backtesting`.

## Regla 0: verifica antes de confiar

- Los planes gratis de estas APIs cambian seguido (Dune y Etherscan los recortaron en 2025-2026). Antes de diseñar algo que dependa de un límite, haz WebFetch a la página de límites/precios que está en Fuentes.
- Confirma endpoints con Context7 (si está instalado) o la doc oficial; varias tienen `/llms.txt` y páginas `.md` (docs.dune.com, docs.etherscan.io, docs.coingecko.com, docs.dexscreener.com, api-docs.defillama.com).
- Prueba cada endpoint con un `curl` antes de escribir el script. Si da 401/403/429, para y revisa el plan en vez de reintentar en bucle.
- Las API keys van en `.env` (en `.gitignore`) o como secret; nunca en el código ni en el chat.

## Reglas de honestidad (no negociables)

- **Un dato on-chain no es una conclusión.** Distingue siempre "lo que muestra la cadena" (tx, montos, horas) de "lo que interpreto" (que es un insider, que es smart money).
- Las etiquetas de exploradores y plataformas pueden estar mal o ser viejas. Dilo cuando uses una.
- Una billetera que ganó mucho puede ser suerte, insider o una de muchas que perdieron (sesgo de supervivencia). No la llames "smart money" sin medir su historial completo.
- Nada de recomendaciones de inversión: entregas datos y su lectura, no "compra/vende".

## Qué herramienta para qué (a nov 2026)

| Necesidad | Herramienta | Costo / límite |
|---|---|---|
| Ver una tx o billetera a mano (EVM) | Etherscan, Basescan, Blockscout (web) | Gratis en la web |
| Ver una tx o billetera a mano (Solana) | Solscan (web) | Gratis en la web |
| API tipo Etherscan, Ethereum/Arbitrum/Polygon | Etherscan API V2 (una key, parámetro `chainid`) | Free: 3 llamadas/s, hasta 100 000/día |
| API tipo Etherscan en **Base**, OP, BNB | Etherscan las tiene **solo en plan de pago**; usa Blockscout API | Blockscout free: 5 req/s con key `proapi_...` |
| SQL sobre toda la historia de una cadena | Dune | Free es solo ver; ejecutar queries y API requieren trial o plan pago |
| Precio actual/histórico de tokens conocidos | CoinGecko Demo, DefiLlama | Ver tabla de abajo |
| Pares DEX, liquidez, tokens nuevos | DexScreener, GeckoTerminal | Gratis con límites |
| TVL, stablecoins, fees de protocolos | DefiLlama (sin key) | Gratis |

Flipside **cerró** su Studio, dashboards y API en julio de 2025 (sus datos quedaron en Snowflake). No escribas código contra la API vieja de Flipside. Allium ofrece APIs de billeteras/precios y SQL, pero no verifiqué su plan gratis: revísalo antes de proponerlo.

## APIs de precios y DEX (límites verificados nov 2026)

- **CoinGecko Demo** (gratis, con cuenta): root `https://api.coingecko.com/api/v3/`, header `x-cg-demo-api-key`. 10 000 créditos/mes y 100 llamadas/min, pide atribución. Incluye endpoints `/onchain/...` (datos de GeckoTerminal). Las keys Pro usan otro root (`pro-api.coingecko.com`); mezclarlos da error 10010/10011. Cada request cuenta, incluso las que fallan.
- **GeckoTerminal API** pública: 30 llamadas/min (planes pagos de CoinGecko suben el límite).
- **DexScreener** (`https://api.dexscreener.com`, sin key): 300 req/min en pares, búsqueda y tokens (`/latest/dex/pairs/{chainId}/{pairId}`, `/latest/dex/search`, `/token-pairs/v1/{chainId}/{token}`, `/tokens/v1/{chainId}/{tokens}`); 60 req/min en perfiles, boosts y metas.
- **DefiLlama** (sin key): TVL en `https://api.llama.fi` (`/protocols`, `/tvl/{protocol}`, `/v2/chains`). Precios por contrato: `https://coins.llama.fi/prices/current/{chain}:{address}` (probado nov 2026; el índice `llms-free.txt` los lista bajo `api.llama.fi`, pero esa ruta devolvió "Route not found"). Formato de token: `ethereum:0x...`, `base:0x...`, `coingecko:ethereum`.

Para muchos tokens, junta direcciones en una sola llamada (DexScreener `/tokens/v1` y DefiLlama aceptan listas separadas por coma) en vez de una llamada por token.

## Dune (SQL)

- Free = solo ver dashboards/queries públicos. Ejecutar queries propias, exportar por API o CSV requiere trial o plan pago (Analyst, Plus). Dile esto al usuario antes de proponer Dune como base de un sistema.
- API: header `X-DUNE-API-KEY`; `POST https://api.dune.com/api/v1/query/{query_id}/execute`, luego estado y resultados; "Get Latest Query Result" devuelve el último resultado guardado sin re-ejecutar (más barato). Las ejecuciones y exportaciones gastan créditos; revisa `execution_cost_credits` en el endpoint de estado.
- Antes de escribir SQL, busca la tabla correcta en el catálogo (`docs.dune.com/_llms/data-catalog.txt`). Prefiere tablas curadas (p. ej. trades de DEX ya decodificados) a parsear logs crudos.
- Filtra siempre por fecha/bloque y cadena: una query sin filtro de tiempo escanea todo y gasta créditos.

## Rastrear una billetera o un flujo (método)

1. Define la pregunta en una frase con el usuario ("¿esta billetera compró antes del pump?").
2. Junta los hechos: lista de tx con hora, token, lado, monto y contraparte (explorador/API o Dune). Guárdalos crudos antes de analizar.
3. Sigue el dinero: de dónde llegó el fondeo inicial (exchange, puente, otra billetera) y a dónde salió. Billeteras fondeadas por la misma fuente en minutos suelen ser del mismo dueño (indicio, no prueba).
4. Mide el historial completo, no solo los aciertos: número de trades, % ganadores, PnL total con fees, tiempo de tenencia, tamaño típico.
5. Reporta: hechos (con links a tx), interpretación (con nivel de confianza) y qué no sabes.

Para copiar a una billetera de Solana en vivo, el método de medición está en `bot-copy-trading` y `senales-y-backtesting`.

## Guardar datos para analizar en Python

Detalle y plantilla en `references/datos-en-python.md`. Reglas:

- Guarda la respuesta cruda (JSON) con fecha de consulta, y aparte una tabla limpia (Parquet o DuckDB). Así puedes recalcular sin volver a gastar llamadas.
- Montos: guarda el entero raw + los decimales del token; convierte a decimal solo para mostrar.
- Tiempos en UTC (timestamp de bloque), nunca la hora local del servidor.
- Respeta límites: pausa entre llamadas según la tabla, reintento con espera creciente en 429, y caché local.

## Errores comunes que debes evitar

- Usar Etherscan free para Base y no entender el error "Free API access is not supported for this chain".
- Proponer Dune o Flipside como "gratis".
- Confundir precio de un par DEX con poca liquidez con el precio "real" del token.
- Llamar "smart money" a una billetera por 3 trades buenos.
- Mezclar montos raw y decimales en la misma columna.
- Hacer cientos de llamadas en bucle sin caché ni pausa y quemar el límite del día.

## Cómo lo compruebas tú (usuario)

Elige 2-3 filas del resultado y ábrelas en el explorador (link a la tx): hora, token y monto deben coincidir. Si una no coincide, el análisis entero está en duda.

## Fuentes (verificado nov 2026)

- https://docs.etherscan.io/supported-chains (Base/OP/BNB solo pago) · https://docs.etherscan.io/resources/rate-limits · https://docs.etherscan.io/resources/common-error-messages · https://kb.etherscan.com/whats-changing-in-the-free-api-tier-coverage-and-why
- https://docs.blockscout.com/devs/migrate-from-etherscan
- https://docs.dune.com/api-reference/overview/billing · https://docs.dune.com/api-reference/overview/authentication · https://docs.dune.com/api-reference/overview/rate-limits · https://docs.dune.com/learning/how-tos/pricing-faqs · https://docs.dune.com/llms.txt
- https://docs.flipsidecrypto.xyz/support/product-special-releases/2025/2025-06-20-or-deprecating-studio-dashboards-api-sdk
- https://www.allium.so/product/allium-developer
- https://docs.coingecko.com/docs/common-errors-rate-limit · https://www.coingecko.com/en/api/pricing · https://docs.coingecko.com/demo/reference/authentication · https://www.geckoterminal.com/dex-api
- https://docs.dexscreener.com/api/reference
- https://api-docs.defillama.com/llms-free.txt (y prueba directa a coins.llama.fi)
