# Guardar y analizar datos on-chain en Python

Plantilla para scripts de análisis. Antes de usar un endpoint, confirma ruta y límites en la doc (ver SKILL.md).

## Entorno (Linux, una vez por proyecto)

```bash
python3 -m venv .venv
source .venv/bin/activate.fish     # en fish; en bash: source .venv/bin/activate
pip install requests duckdb pandas pyarrow
```

Agrega `.venv/`, `.env` y `datos/` al `.gitignore`.

## Estructura

```
datos/
  crudo/<fuente>/<YYYY-MM-DD>/<consulta>.json   # respuesta tal cual, nunca se edita
  analisis.duckdb                                # tablas limpias
scripts/
  descargar_<fuente>.py
  limpiar.py
  analizar.py
```

## Cliente con caché, pausa y reintentos

```python
import json, os, time, hashlib, pathlib, datetime as dt
import requests

CRUDO = pathlib.Path("datos/crudo")

def get_json(url, params=None, headers=None, fuente="api", pausa_s=1.0, max_reintentos=5):
    """GET con caché en disco del día, pausa fija y espera creciente en 429/5xx."""
    clave = hashlib.sha256(json.dumps([url, params], sort_keys=True).encode()).hexdigest()[:16]
    dia = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    ruta = CRUDO / fuente / dia / f"{clave}.json"
    if ruta.exists():
        return json.loads(ruta.read_text())
    espera = pausa_s
    for intento in range(max_reintentos):
        r = requests.get(url, params=params, headers=headers, timeout=30)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(espera); espera *= 2; continue
        r.raise_for_status()                      # 401/403: plan o key, no reintentes
        data = r.json()
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps({"url": url, "params": params,
                                    "consultado_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                                    "data": data}))
        time.sleep(pausa_s)
        return {"data": data}
    raise RuntimeError(f"Sin respuesta tras {max_reintentos} intentos: {url}")
```

- Las keys se leen de variables de entorno (`os.environ["COINGECKO_DEMO_KEY"]`), cargadas desde `.env`. Nunca las imprimas.
- `pausa_s` según la fuente: DexScreener pares 300/min → 0.25 s; CoinGecko Demo 100/min → 0.7 s; GeckoTerminal 30/min → 2.1 s; Etherscan free 3/s → 0.4 s.

## Tabla limpia en DuckDB

```python
import duckdb
con = duckdb.connect("datos/analisis.duckdb")
con.execute("""
CREATE TABLE IF NOT EXISTS trades (
  cadena TEXT, tx_hash TEXT, ts_utc TIMESTAMP, billetera TEXT,
  token TEXT, lado TEXT,                 -- 'compra' | 'venta'
  monto_raw HUGEINT, decimales INTEGER,  -- monto = monto_raw / 10^decimales
  precio_usd DOUBLE, fuente TEXT,
  PRIMARY KEY (cadena, tx_hash, token, lado)
)""")
# Inserta con INSERT OR IGNORE para no duplicar al re-descargar.
```

- `HUGEINT` (128 bits) alcanza para montos raw con 18 decimales; no uses `DOUBLE` para el raw.
- Llave primaria por (cadena, tx, token, lado) evita contar dos veces un trade.

## Consultas típicas

```sql
-- Historial completo de una billetera (no solo los aciertos)
SELECT token, count(*) AS trades,
       sum(CASE WHEN lado='compra' THEN monto_raw / pow(10, decimales) * precio_usd END) AS usd_comprado,
       sum(CASE WHEN lado='venta'  THEN monto_raw / pow(10, decimales) * precio_usd END) AS usd_vendido
FROM trades WHERE billetera = ? GROUP BY token ORDER BY usd_comprado DESC;
```

Explica al usuario que `precio_usd` al momento del trade es aproximado (sale de una API de precios, no de la tx) y que el PnL real incluye fees y slippage.

## Comprobación

1. Corre el script dos veces: la segunda debe salir de caché (cero llamadas nuevas).
2. Elige 3 filas al azar y compáralas con el explorador.
3. Revisa que no haya filas duplicadas: `SELECT tx_hash, count(*) FROM trades GROUP BY 1 HAVING count(*) > 1`.
