# Latencia por etapa: código probado

Probado nov 2026: TypeScript con Vitest 5.1 + `tsc` (TS 7.0.2) limpio; Python 3 con salida real (`{'detectar': 20.2, 'enviar': 5.1}` para esperas de 20 ms y 5 ms).

## Uso en un bot

```ts
const t = nuevoTrazo(firma);          // al detectar el evento (o usa el id del evento)
t.marca("detectar");                   // llegó el mensaje del websocket
t.marca("parsear");                    // ya sé qué token, cuánto, dirección
t.marca("decidir");                    // pasó filtros y riesgo
t.marca("cotizar");                    // respuesta de la API de quote
t.marca("enviar");                     // tx enviada
t.marca("confirmar");                  // confirmada
console.log(JSON.stringify({ tipo: "latencia", ...t.resumen() }));
```

Cada línea JSON queda en el log (journalctl o `wrangler tail`). Para analizar: junta los `total_ms` y los de cada etapa de las últimas N operaciones y calcula `percentiles`. Compara siempre p50 **y** p95/p99.

## TypeScript

```ts
// Medir latencia por etapa en un pipeline en tiempo real (ej. bot: detectar -> parsear -> decidir -> enviar -> confirmar).
// performance.now() es monotónico: úsalo para duraciones. Date.now() solo para comparar con horas externas.
export type Etapa = string;

export function nuevoTrazo(id: string) {
  const t0 = performance.now();
  const marcas: Array<[Etapa, number]> = [];
  return {
    marca(etapa: Etapa) { marcas.push([etapa, performance.now()]); },
    resumen() {
      let previo = t0;
      const etapas: Record<Etapa, number> = {};
      for (const [etapa, t] of marcas) { etapas[etapa] = Math.round((t - previo) * 10) / 10; previo = t; }
      return { id, total_ms: Math.round((previo - t0) * 10) / 10, etapas };
    },
  };
}

// Percentiles sobre muchas muestras: el promedio esconde los picos que te hacen perder trades.
export function percentiles(valores: number[], ps = [50, 95, 99]): Record<string, number> {
  if (valores.length === 0) return {};
  const v = [...valores].sort((a, b) => a - b);
  const out: Record<string, number> = {};
  for (const p of ps) out[`p${p}`] = v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]!;
  return out;
}
```

## Python

```python
import time
from dataclasses import dataclass, field


@dataclass
class Trazo:
    """Latencia por etapa. perf_counter_ns es monotónico: úsalo para duraciones."""

    id: str
    t0: int = field(default_factory=time.perf_counter_ns)
    marcas: list[tuple[str, int]] = field(default_factory=list)

    def marca(self, etapa: str) -> None:
        self.marcas.append((etapa, time.perf_counter_ns()))

    def resumen(self) -> dict:
        previo, etapas = self.t0, {}
        for etapa, t in self.marcas:
            etapas[etapa] = round((t - previo) / 1e6, 1)
            previo = t
        return {"id": self.id, "total_ms": round((previo - self.t0) / 1e6, 1), "etapas": etapas}


def percentiles(valores: list[float], ps: tuple[int, ...] = (50, 95, 99)) -> dict[str, float]:
    if not valores:
        return {}
    v = sorted(valores)
    return {f"p{p}": v[min(len(v) - 1, -(-p * len(v) // 100) - 1)] for p in ps}
```

## Medir una llamada HTTP por fases con curl

```fish
curl -sS -o /dev/null -w "dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n" https://api.ejemplo.com/salud
```

Los tiempos son acumulados desde el inicio, en segundos. `tls` alto = handshake caro (reusa conexiones). `ttfb - tls` alto = el servidor tarda en responder (o está lejos). Corre 10 veces y mira la variación, no una sola.
