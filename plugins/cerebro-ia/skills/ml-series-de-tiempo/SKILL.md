---
name: ml-series-de-tiempo
description: Entrenar modelos de señales sobre precios y flujos (el cazador) - etiquetas sin lookahead, walk-forward con hueco, línea base, desbalance, métricas, reentrenar sin sobreajuste, LightGBM/XGBoost/PyTorch en GPU. Usa con modelo, entrenar, ML.
---

# ML de series de tiempo para señales

Esta skill cubre **cómo construir y validar el modelo**. Cómo medir si la señal gana dinero (costos en SOL, paper trading, reglas de salida, survivorship) está en `senales-y-backtesting` de `cerebro-solana`: úsalas juntas. El error que corrige: Claude mezcla filas al azar en train/test, normaliza con todo el dataset, reporta 97% de accuracy en un problema donde 97% de las filas son "no sube", y "mejora" el modelo reentrenando con cada fallo hasta que memoriza el ruido.

## Sé honesto con el usuario

- Los mercados de memecoins cambian de régimen cada semanas; lo que funcionó el mes pasado puede no funcionar hoy. La mayoría de las señales no sobreviven a los costos.
- Un modelo da **probabilidades**, no certezas. Dilo así: "de cada 10 señales con este umbral, en validación ~4 llegaron a +X% antes de −Y%".
- Si los resultados no alcanzan para concluir (pocas señales, un solo periodo), dilo y marca el resultado como preliminar.
- El modelo no opera dinero real sin los frenos de `cerebro-solana` (límite de pérdida, billetera dedicada, confirmación).

## Regla 0

- Verifica la API de cada librería en su doc o con Context7 antes de usarla (versiones a nov 2026: scikit-learn 1.9, LightGBM 4.7, XGBoost 3.4, polars 2.1, PyTorch 2.15).
- Entorno aislado: `uv venv` por proyecto; no instales en el Python del sistema. Fija versiones en `pyproject.toml` y la semilla aleatoria.

## 1. Define la etiqueta (lo único que puede ver el futuro)

Escribe la pregunta exacta antes de tocar datos:
> "En el instante t, ¿el precio toca **+X%** antes de tocar **−Y%** dentro de los próximos **H minutos**?"

Esto es el método de triple barrera (López de Prado): toma, stop y tiempo. Es mejor que "¿sube en H minutos?" porque se parece a una operación real.
- La etiqueta usa datos de (t, t+H]. **Las features usan solo datos ≤ t.**
- El precio de "entrada" para la etiqueta es el que obtendrías tras tu latencia, no el de t (ver `senales-y-backtesting`).
- Guarda `t`, `t_fin_etiqueta` (cuando se resolvió) e `id_token` en cada fila: los necesitas para separar train/test sin fuga.

## 2. Features sin fuga de información

- Ventanas que **terminan en t**: retornos 1/5/15 min, volumen y número de compradores/vendedores únicos, flujo neto, cambio de liquidez, concentración de holders, edad del token, hora UTC.
- "Disponible en t" significa **cuando tu sistema lo recibió**, no el `blockTime`. Si en vivo los datos llegan con 2 s de retraso, simula ese retraso al construir features.
- Velas: la vela que cierra en t+5 no existe en t.
- Normalizaciones, escaladores, percentiles y "target encoding": se ajustan **solo con el train** de cada fold. Usa `sklearn.pipeline.Pipeline` para que sea automático.
- Nada de features calculadas con el futuro: "máximo de la próxima hora", "¿migró a PumpSwap?" (si migró después de t), "holders finales".
- Prueba anti-fuga: entrena con las etiquetas **barajadas al azar**; si el modelo aún da buenos resultados, hay fuga.

## 3. Validación walk-forward (nunca mezclar al azar)

```
|--- train ---|-gap-|-- test --|
|------ train ------|-gap-|-- test --|
|---------- train ---------|-gap-|-- test --|      ... y al final un periodo HOLDOUT que no se toca
```

- `sklearn.model_selection.TimeSeriesSplit(n_splits=5, gap=G)` con `G` ≥ filas que cubren el horizonte H (o divide por fechas a mano). El **gap (purga)** evita que etiquetas del train "vean" precios del test.
- Ordena por `t` y separa por **tiempo y por token**: un token cuyo lanzamiento cae en el periodo de test no debe tener filas en el train.
- Reserva el último periodo (por ejemplo 2–4 semanas) como **holdout**: se evalúa una sola vez, al final, con el modelo y umbral ya elegidos.
- Elige hiperparámetros y umbral en validación, nunca mirando el holdout.

## 4. Líneas base tontas (obligatorias)

Reporta siempre, en los mismos periodos:
1. **Siempre "no"** (clase mayoritaria): muestra por qué accuracy no sirve.
2. **Regla simple**: ej. "flujo neto 5 min > umbral y compradores únicos > N". Si el modelo no le gana a una regla de una línea, quédate con la regla.
3. **Entradas aleatorias** con la misma frecuencia y la misma regla de salida (en `senales-y-backtesting`).

## 5. Desbalance de clases y métricas

- Las subidas fuertes son raras (ej. 2–5% de las filas). **No uses accuracy ni ROC-AUC como métrica principal.**
- Métricas de clasificación: **precisión en el umbral elegido** (de las señales que doy, cuántas aciertan), recall (cuántas olas detecto), **PR-AUC** (`average_precision_score`), y número de señales por día.
- Calibración: si dices "70%", que en validación ~70% de esas filas sean positivas (`calibration_curve`).
- Manejo del desbalance: pesos de clase (`class_weight="balanced"`, `scale_pos_weight` en LightGBM/XGBoost) y elegir el umbral por la precisión que necesitas. Si haces sobremuestreo (SMOTE), solo dentro del train de cada fold; con boosting casi nunca hace falta.
- Métricas de trading (PnL neto en SOL, drawdown, MFE/MAE): las calcula `senales-y-backtesting`. Un modelo con buena PR-AUC puede perder dinero; manda la métrica de trading.

## 6. Modelos y GPU (RTX 5070, 12 GB)

Orden recomendado: regla simple → **LightGBM o XGBoost** → solo si les ganas por margen claro fuera de muestra, redes (PyTorch).
- Datos tabulares de pocos millones de filas: LightGBM en CPU suele bastar. Mide antes de complicarte con GPU.
- **XGBoost en GPU**: el wheel de Linux x86_64 ya trae CUDA 13 (`pip install xgboost`); usa `device="cuda"`. Si tu driver no soporta CUDA 13, la doc indica un paquete para CUDA 12.
- **LightGBM en GPU**: el wheel normal trae la versión OpenCL (`device_type="gpu"`). La versión CUDA se compila: `pip install lightgbm --no-binary lightgbm --config-settings=cmake.define.USE_CUDA=ON` y `device_type="cuda"` (Blackwell: revisa `CMAKE_CUDA_ARCHITECTURES` en su README).
- **PyTorch**: en un venv instala el wheel CUDA que indique https://pytorch.org/get-started/locally/ (o `python-pytorch-cuda` de Arch para el sistema). Comprueba `torch.cuda.is_available()` y el nombre de la GPU antes de entrenar.
- pandas o polars para features; guarda datasets en Parquet con la versión del código de features.
- No entrenes mientras un LLM local ocupa la VRAM (`nvidia-smi`).

## 7. Reentrenamiento: "se automejora cuando falla" sin autoengaño

Un modelo que se reentrena tras cada error aprende el ruido. Haz esto:
1. **Calendario fijo** (ej. semanal) con ventana móvil, usando exactamente el mismo protocolo walk-forward. No reentrenes por un fallo aislado.
2. **Campeón vs retador**: el modelo nuevo entra solo si le gana al actual en el periodo más reciente fuera de muestra **y** en paper trading de al menos varios días. Si no, se queda el actual.
3. **Monitoreo de deriva**: precisión móvil de las últimas N señales, número de señales por día y distribución de las features principales vs el train. Alerta (Telegram) si se salen del rango; la respuesta por defecto es **pausar señales**, no reentrenar a ciegas.
4. "Aprender de los fallos" = guardar cada señal con sus features y resultado (log append-only de `senales-y-backtesting`) para que entren al **siguiente** reentrenamiento programado, no para parchear el modelo en caliente.
5. Versiona todo: `modelo_vNN` + commit del código de features + rango de fechas + métricas. Cada señal registra qué versión la emitió. Debe poder hacerse rollback en un comando.
6. Cuenta cuántas variantes probaste y repórtalo junto al resultado: probar 200 configuraciones y quedarte con la mejor infla los números.

## Antes de decir "funciona"

- [ ] Etiqueta escrita con X, Y, H y latencia; features solo con datos ≤ t (disponibles en t).
- [ ] Walk-forward con gap ≥ horizonte, separación por token y holdout sin tocar.
- [ ] Prueba de etiquetas barajadas: resultado ≈ azar.
- [ ] Le gana a las 3 líneas base en precisión al umbral y en métrica de trading neta.
- [ ] Número de variantes probadas reportado.
- [ ] Plan de reentrenamiento campeón/retador y monitoreo con pausa automática.
Si falta algo, el resultado es "preliminar" y se dice qué falta.

## Cómo comprobarlo tú mismo

Pide la tabla final: precisión, señales por día y PnL neto del modelo vs "regla simple" vs "entradas al azar", en el periodo holdout. Si el modelo no gana claramente en esa tabla, no está listo, aunque el accuracy diga 97%.

## Fuentes (verificado nov 2026)

- https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html (parámetro `gap`)
- https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html
- https://scikit-learn.org/stable/modules/generated/sklearn.calibration.calibration_curve.html
- https://lightgbm.readthedocs.io/en/latest/Parameters.html (`device_type`: cpu, gpu, cuda) y README del paquete de Python (build CUDA)
- https://xgboost.readthedocs.io/en/stable/install.html (wheel Linux con CUDA 13, `device=cuda`)
- https://pytorch.org/get-started/locally/
- López de Prado, "Advances in Financial Machine Learning" (Wiley, 2018): triple barrera, purga y embargo
- Bailey, Borwein, López de Prado, Zhu, "The Probability of Backtest Overfitting": https://papers.ssrn.com/abstract=2326253
- PyPI (versiones a nov 2026): scikit-learn 1.9.1, lightgbm 4.7.0, xgboost 3.4.1, polars 2.1.0, torch 2.15.0
