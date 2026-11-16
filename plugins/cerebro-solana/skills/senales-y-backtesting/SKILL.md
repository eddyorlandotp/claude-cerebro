---
name: senales-y-backtesting
description: Evaluar honestamente señales de memecoins (olas de flujo de dinero) - sin lookahead ni survivorship bias, paper trading con costos reales, métricas (acierto, retorno, drawdown, tiempo al pico, devolución), reglas de salida y registro auditable. Úsala para backtest, señales, estrategia.
---

# Señales y backtesting sin autoengaño

Una señal que "siempre sube" no prueba nada si no hay una **regla de salida** que se pueda ejecutar y que se midió con costos reales. El error típico: medir el precio máximo después de la señal (eso exige saber el futuro) y llamarlo rentabilidad. Esta skill obliga a medir lo que de verdad se habría ganado.

Sé honesto con el usuario: si los números no alcanzan para concluir, dilo. No redondees hacia el optimismo.

## Regla 0

- Verifica cualquier API de datos históricos antes de usarla (endpoint, resolución, límites, si incluye tokens muertos): ver `riesgo-memecoins/references/apis-de-datos.md` y la doc oficial.
- Para la parte de código de tests y planes usa las skills de `superpowers` (test-driven-development, writing-plans) si están instaladas; aquí solo va la metodología.

## 1. Registro de señales (antes que cualquier modelo)

Cada señal se escribe **en el momento en que se genera**, en un log append-only (no se edita después):

| Campo | Por qué |
| - | - |
| `signal_id`, `version_reglas` | Saber qué versión del modelo la emitió |
| `emitted_at_ms` (reloj del servidor) y `slot`/`blockTime` del último dato usado | Probar que no se usó información posterior |
| `mint`, `pool` | Qué token y dónde |
| `precio_al_emitir` + fuente (cotización Jupiter, último trade) | Base para medir |
| Snapshot de features (valores tal como se conocían en ese instante) | Auditar y re-entrenar sin lookahead |
| `liquidez_usd`, `edad_token` | Contexto para segmentar resultados |

Los resultados (precio a +1 min, +5 min, +1 h, pico, salida según cada regla) se guardan en **otra tabla** que referencia `signal_id`. Nunca recalcules features pasadas con datos nuevos.

## 2. Lookahead bias (usar el futuro sin darte cuenta)

Chequeos obligatorios:
- Cada feature en el instante t usa solo datos con `disponible_en <= t`. "Disponible" = cuando **tu sistema** lo recibió, no el `blockTime`. Modela la latencia de ingesta (mídela en vivo).
- `blockTime` tiene resolución de segundos y puede repetirse: ordena por `slot` e índice de transacción.
- Velas OHLCV: la vela de las 12:00–12:05 solo se conoce a las 12:05. No uses su cierre/máximo para una señal emitida a las 12:02.
- Normalizaciones (z-scores, percentiles) calculadas con todo el dataset filtran el futuro: calcúlalas con ventana pasada.
- Elegir umbrales mirando todo el histórico también es lookahead: separa por tiempo (abajo).
- El precio de entrada no es el de la señal: entras después de tu latencia y con slippage.

## 3. Survivorship bias (solo ver a los que sobrevivieron)

- Las listas de "tokens con liquidez hoy" excluyen a los que hicieron rug, murieron o nunca migraron. Si solo pruebas con esos, la señal se ve mucho mejor de lo que es.
- Construye el universo **en el momento** (todos los tokens que cumplían la condición en t, incluidos los que luego valieron 0), por ejemplo registrando en vivo desde ahora o con historial de transacciones por programa (pump.fun/PumpSwap).
- Tokens que dejaron de cotizar cuentan como pérdida total (o como el precio de venta que realmente hubieras obtenido), no se descartan.
- Reporta cuántos tokens del universo terminaron en ~0.

## 4. Separación temporal y sobreajuste

- Divide por tiempo: diseñas en un periodo, validas en el siguiente, y guardas un periodo final que no tocas hasta el final (walk-forward si hay datos suficientes).
- Cada variante que pruebas aumenta la probabilidad de encontrar algo "bueno" por azar. Registra cuántas variantes probaste y dilo junto al resultado.
- Compara contra una **línea base**: entradas aleatorias en el mismo universo y mismos horarios, con la misma regla de salida. Si la señal no le gana a la base con costos, no hay ventaja.
- Con pocas señales (decenas), el intervalo de confianza es enorme: reporta un intervalo por bootstrap, no solo el promedio.

## 5. Costos realistas (en SOL)

Por operación de ida y vuelta, descuenta:
- Fee de Jupiter si usas `/order` (50 bps en tokens de menos de 24 h; 10 bps en la mayoría) o tu ruta real.
- Priority fee + tip (Sender Max 0.001 SOL mínimo por tx) + base fee, en la compra y en la venta.
- Slippage/price impact según el **tamaño** que operarías: usa cotizaciones reales (Jupiter `/order` sin `taker`) guardadas en vivo, no el precio medio.
- Rent de ATAs (recuperable al cerrar).
- Latencia: el precio al que entras es el de t + latencia medida.

## 6. Paper trading

Antes de dinero real, corre la señal en vivo en modo papel al menos varias semanas:
- Mismo pipeline que el real (detección, cotización, decisión) pero sin enviar.
- Guarda la cotización real de entrada y salida en el momento: así el resultado incluye slippage y rutas inexistentes ("sin ruta" = no hubo trade).
- Compara papel vs backtest del mismo periodo: si difieren mucho, el backtest tiene un sesgo.

## 7. Métricas (todas netas de costos, en SOL y por regla de salida)

| Métrica | Definición |
| - | - |
| Número de señales | Sin esto nada significa |
| Tasa de acierto | % de operaciones cerradas con PnL neto > 0 **según la regla de salida** (no "tocó +X% alguna vez") |
| Retorno medio y mediano por señal | Neto; la mediana revela si unos pocos outliers cargan el promedio |
| Distribución | Percentiles 10/50/90 y peor caso |
| Máximo drawdown | Mayor caída de la curva de capital acumulada (con el tamaño de posición real) |
| Tiempo hasta el pico | Desde la entrada hasta el máximo posterior (descriptivo, no rentabilidad) |
| Devolución tras el pico | Cuánto del máximo se devolvió a +N min (muestra si la ola se revierte) |
| MFE / MAE | Máxima ganancia y máxima pérdida no realizadas durante la operación |
| Exposición | Tiempo con dinero invertido; capital simultáneo máximo |

El "pico" y el MFE son descriptivos: nadie vende exactamente en el máximo. Úsalos para diseñar reglas de salida, no como resultado.

## 8. Reglas de salida

- Define cada regla antes de mirar resultados: take profit fijo, stop loss, trailing stop, salida por tiempo, salida cuando el flujo se invierte.
- Evalúa todas sobre **las mismas señales** y reporta todas, no solo la mejor.
- La que elijas, confírmala en el periodo de validación y luego en papel.
- Simula la salida con precios y costos realistas: un take profit de +100% en un token sin liquidez a ese precio no se ejecuta igual.

## Antes de decir "funciona"

Checklist que Claude debe cumplir antes de afirmar que una señal es rentable:
- [ ] Log append-only con timestamps y features al momento.
- [ ] Sin lookahead (revisado con la lista de la sección 2).
- [ ] Universo con tokens muertos incluidos.
- [ ] Costos completos en SOL.
- [ ] Regla de salida definida de antemano y medida.
- [ ] Le gana a la línea base aleatoria fuera de muestra.
- [ ] Paper trading en vivo consistente con el backtest.
Si falta algo, el resultado se presenta como "preliminar" y se dice qué falta.

## Cómo comprobarlo tú mismo

Pide el reporte con: número de señales, tasa de acierto con la regla de salida, retorno mediano neto en SOL, peor operación y drawdown, comparado con entradas aleatorias. Si alguien te muestra solo "subió X% después de la señal", pregunta "¿y a qué precio habría vendido y cuánto pagué de fees?".

## Fuentes (verificado nov 2026)

- https://developers.jup.ag/docs/swap/index.md (fees por par: 10 bps general, 50 bps tokens < 24 h)
- https://www.helius.dev/docs/sending-transactions/sender.md (tip mínimo de Sender Max)
- https://solana.com/docs/rpc (commitment; `blockTime` y slots en respuestas RPC)
- Bailey, Borwein, López de Prado, Zhu: "The Probability of Backtest Overfitting" — https://papers.ssrn.com/abstract=2326253 (múltiples pruebas y sobreajuste)
