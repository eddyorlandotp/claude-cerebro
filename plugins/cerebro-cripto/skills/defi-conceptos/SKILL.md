---
name: defi-conceptos
description: Explicar y calcular DeFi sin errores - AMM x*y=k, liquidez concentrada, price impact vs slippage, impermanent loss, MEV y sandwich (RPC privados), stablecoins, puentes y liquidaciones, con calculadora probada. Úsala para slippage, LP, MEV, préstamos.
---

# Conceptos DeFi (con números que cuadran)

Para cuando el usuario pregunta "¿por qué recibí menos?", "¿me conviene ser LP?", "¿qué es un sandwich?" o cuando el código de la terminal/bot calcula montos mínimos, impacto o riesgo. Explica simple (1-3 frases, con un ejemplo en números) y **calcula con el script**, no de cabeza.

Para Solana específico: slippage y RTSE de Jupiter en `jupiter-swaps-y-comisiones`, Jito y envío en `enviar-transacciones-rapido`, tope de precio del bot en `bot-copy-trading` (todas de cerebro-solana).

## Reglas

- **Calcula con `scripts/defi_calc.py`** (solo python3, sin dependencias, con pruebas): `python3 scripts/defi_calc.py test` primero; luego `swap`, `il`, `minout`, `hf`. Pega el comando y el resultado en tu respuesta para que el usuario pueda repetirlo.
- Explica conceptos, no des recomendaciones de inversión. "Ser LP en este pool te expone a X" sí; "mete tu dinero aquí" no.
- Si un número depende de datos en vivo (reservas, APR, precio), consíguelo de la fuente (on-chain o API, ver `analisis-on-chain`) y di de dónde y cuándo.
- Verifica detalles de un protocolo concreto (fees, parámetros de riesgo, oráculos) en su doc oficial antes de afirmarlos; los parámetros cambian por gobernanza.

## AMM de producto constante (x·y = k)

Un pool guarda dos tokens con reservas `x` e `y`. Un swap mantiene `k = x·y` (o lo sube con la fee). Si metes `dx` (después de la fee `f`):

```
salida dy = y · dx(1−f) / (x + dx(1−f))
precio spot = y / x
```

- **Price impact**: el precio empeora mientras más grande es tu trade respecto a las reservas. Regla rápida sin fee: si metes el p% de la reserva de entrada, el impacto es ≈ p/(1+p). Ej.: 10 % de la reserva → ~9.09 % de impacto.
- Ejemplo con el script: pool de 100 ETH / 300 000 USDC, vendes 5 ETH con fee 0.3 %:
  `python3 scripts/defi_calc.py swap 100 300000 5 30` → recibes ~14 244.9 USDC, precio efectivo ~2 849 vs spot 3 000 (≈5 % entre impacto y fee).
- **Liquidez concentrada (Uniswap v3/v4)**: cada LP elige un rango de precio; la fórmula x·y=k aplica dentro de cada rango. Más profundidad cerca del precio actual, pero si el precio sale de tu rango ya no ganas fees y quedas 100 % en el token que bajó. v4 agrega hooks (código extra por pool): revisa qué hace el hook antes de confiar en un pool.

## Slippage ≠ price impact

- **Price impact**: lo que mueve el precio tu propio trade (se sabe al cotizar).
- **Slippage**: cuánto puede cambiar el resultado entre la cotización y la ejecución (otros trades, bots, latencia).
- **Tolerancia de slippage** = el mínimo que aceptas: `minOut = cotizado × (1 − slippage_bps/10 000)`. `python3 scripts/defi_calc.py minout 1000 100` → 990.
- Muy baja: la tx falla en tokens volátiles. Muy alta: regalas ese margen a un sandwich. En el código, `minOut` y `deadline` nunca van en 0/infinito.

## MEV y sandwich

- **Sandwich**: un bot ve tu swap pendiente, compra antes (sube el precio), tu swap se ejecuta peor (hasta tu `minOut`), y el bot vende después. Lo que pierdes está acotado por tu tolerancia de slippage.
- Protección en Ethereum mainnet: enviar por RPC privado que no pasa por el mempool público:
  - Flashbots Protect: `https://rpc.flashbots.net` (o `/fast`). Solo Ethereum mainnet y Sepolia. No incluye tx que revierten; rechaza priority fee 0.
  - MEV Blocker: `https://rpc.mevblocker.io` (rutas `/fast`, `/noreverts`, `/fullprivacy`, ...). Solo Ethereum; da reembolsos de backrun.
- En Base el secuenciador arma bloques de 200 ms ordenados por priority fee, y los RPC públicos no exponen el `txpool`. Eso cambia cómo se hace MEV, no garantiza que no exista: la protección práctica sigue siendo `minOut` ajustado y montos acordes a la liquidez.
- En Solana: Jito y envío rápido → `enviar-transacciones-rapido`.

## Impermanent loss (LP 50/50 en x·y=k)

Si el precio relativo de los dos tokens cambia por un factor `r`:

```
valor_LP / valor_si_solo_holdeabas = 2·√r / (1 + r)
IL = 2·√r / (1 + r) − 1
```

- Precio ×2 o ÷2 → −5.72 %; ×4 → −20 %. Simétrico: `il 3` = `il 0.3333`. `python3 scripts/defi_calc.py il 2`.
- Las fees ganadas compensan (o no) el IL; el script no las incluye. En liquidez concentrada el efecto es mayor dentro del rango.
- "Impermanente" solo si el precio regresa; si retiras con el precio movido, es pérdida real.

## Stablecoins y sus riesgos

- Respaldo fiat (USDC, USDT): dependen del emisor y sus reservas. Circle dice en sus términos que puede bloquear direcciones y congelar USDC, y que no garantiza 1 USDC = 1 USD en todas las plataformas.
- Algorítmicas o con colateral cripto: pueden perder el peg en caídas fuertes.
- Misma moneda, distintos contratos/decimales por cadena (ver `evm-y-base`); las versiones "puenteadas" no son la nativa.
- Para la app: nunca asumas precio = 1.00; léelo de una fuente de precios si el monto importa.

## Puentes (bridges)

- Los puentes concentran mucho dinero en contratos y validadores: Chainalysis estimó ~2 000 millones de USD robados de puentes solo en 2022 (hasta agosto).
- Prefiere el puente nativo o el emisor nativo del activo; entiende el tiempo de salida (Base → Ethereum por el puente nativo: días, ver `evm-y-base`).
- Prueba con monto pequeño, verifica la dirección del puente en su doc oficial (nunca desde un anuncio o DM) y espera confirmación en ambos lados antes de mandar el resto.

## Préstamos y liquidaciones (estilo Aave)

- Depositas colateral, pides prestado contra él. **Health factor** (doc de Aave): colateral ponderado por el umbral de liquidación / deuda. **Menor a 1 → liquidable**: un liquidador paga parte de tu deuda y se lleva tu colateral con descuento (bono de liquidación).
- `python3 scripts/defi_calc.py hf 10000 0.8 7000` → 1.14. Una caída de ~12.5 % del colateral lo lleva a 1.
- El HF se mueve con precios del oráculo e intereses acumulados, sin que hagas nada. Umbrales y bonos son por activo: léelos en la app/doc del mercado concreto.

## Errores comunes que debes evitar

- Confundir price impact con slippage o con la fee.
- Calcular IL o salidas de AMM de memoria (usa el script).
- Decir que Flashbots o MEV Blocker protegen en Base o Solana.
- Poner `minOut = 0` "para que no falle".
- Presentar un APR de pool como ganancia segura sin restar IL y riesgo.
- Tratar una stablecoin puenteada como si fuera la nativa.

## Cómo lo compruebas tú (usuario)

Corre `python3 scripts/defi_calc.py test` (debe decir "OK") y repite cualquier cálculo de la respuesta con los mismos números. En un swap real, compara en el explorador lo recibido con el `minOut` que se mostró antes de firmar.

## Fuentes (verificado nov 2026)

- https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works (x·y=k, rangos en v3/v4, price impact)
- https://docs.flashbots.net/flashbots-protect/quick-start · https://docs.mevblocker.io/ · https://docs.mevblocker.io/reference/api/transaction-endpoints
- https://docs.base.org/specifications/transactions/transaction-ordering
- https://aave.com/docs/aave-v3/overview · https://aave.com/docs/aave-v3/markets/health-factor
- https://www.circle.com/legal/usdc-risk-factors
- https://www.coindesk.com/business/2022/08/04/chainalysis-estimates-2b-stolen-from-cross-chain-bridge-hacks-this-year/
- Fórmulas de AMM e IL derivadas de x·y=k y comprobadas con las pruebas de `scripts/defi_calc.py`.
