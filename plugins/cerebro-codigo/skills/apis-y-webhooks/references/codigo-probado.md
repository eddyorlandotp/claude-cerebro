# Código probado: reintentos y verificación de firmas

Probado en nov 2026 con Node 22 (type stripping) + TypeScript 7.0.2 (`tsc` limpio con el tsconfig de `typescript-node-moderno`) y Python 3. Cópialo y adáptalo; **el formato exacto de la firma lo dicta la doc de cada proveedor** (header, hex o base64, prefijos como `v1,` o `sha256=`).

## TypeScript: `fetchConReintentos`

Reintenta solo errores de red, timeouts y 408/429/5xx. Respeta `Retry-After` en segundos. Backoff exponencial con *full jitter*. No lo uses para un POST que crea algo si la API no acepta llave de idempotencia.

```ts
// Llamar una API externa con timeout, reintentos y backoff con jitter.
const REINTENTABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function fetchConReintentos(
  url: string,
  init: RequestInit = {},
  { intentos = 4, timeoutMs = 10_000, baseMs = 500, maxMs = 8_000 } = {},
): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!REINTENTABLE.has(res.status) || i >= intentos) return res;
      await esperar(retrasoMs(i, baseMs, maxMs, res.headers.get("retry-after")));
    } catch (err) {
      // TimeoutError o error de red: reintenta; si se acabaron los intentos, sube el error.
      if (i >= intentos) throw new Error(`Falló ${url} tras ${i} intentos`, { cause: err });
      await esperar(retrasoMs(i, baseMs, maxMs, null));
    }
  }
}

function retrasoMs(intento: number, baseMs: number, maxMs: number, retryAfter: string | null): number {
  const segundos = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(segundos)) return Math.min(segundos * 1000, 60_000);
  const techo = Math.min(maxMs, baseMs * 2 ** (intento - 1));
  return Math.random() * techo; // "full jitter": evita que todos reintenten al mismo tiempo
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

## TypeScript: verificar firma HMAC-SHA256

Recibe el cuerpo **crudo** (texto exacto del request, antes de `JSON.parse`). En un Worker o Route Handler: `const crudo = await request.text()`; verifica; y solo después `JSON.parse(crudo)`.

```ts
// Verificar un webhook firmado con HMAC-SHA256 (esquema genérico: firma hex de `${timestamp}.${body}`).
// Adapta el formato exacto (headers, hex/base64, prefijos) a la doc del proveedor.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCIA_S = 5 * 60;

export function firmaValida(cuerpoCrudo: string, timestamp: string, firmaHex: string, secreto: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCIA_S) return false;
  const esperada = createHmac("sha256", secreto).update(`${timestamp}.${cuerpoCrudo}`).digest();
  const recibida = Buffer.from(firmaHex, "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
```

## Python: verificar firma HMAC-SHA256

```python
import hashlib
import hmac
import time

TOLERANCIA_S = 5 * 60


def firma_valida(cuerpo_crudo: bytes, timestamp: str, firma_hex: str, secreto: str) -> bool:
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > TOLERANCIA_S:
        return False
    mensaje = timestamp.encode() + b"." + cuerpo_crudo
    esperada = hmac.new(secreto.encode(), mensaje, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, firma_hex)

```

## Idempotencia del receptor (SQL)

Guarda el ID del evento con restricción única **en la misma transacción** que el efecto. Si el insert choca, ya lo procesaste: responde 200 y no hagas nada.

```sql
CREATE TABLE webhook_eventos (
  proveedor TEXT NOT NULL,
  evento_id TEXT NOT NULL,
  recibido_en INTEGER NOT NULL,
  PRIMARY KEY (proveedor, evento_id)
);
-- INSERT INTO webhook_eventos (...) VALUES (...) ON CONFLICT DO NOTHING;
-- si no insertó ninguna fila -> duplicado
```

## Prueba mínima que debe pasar

- Firma correcta -> válida. Un byte distinto en el cuerpo -> inválida. Timestamp de hace 10 min -> inválida. Firma basura (no hex) -> inválida sin lanzar excepción.
- Servidor que responde 503 dos veces y luego 200 -> `fetchConReintentos` devuelve 200 en el tercer intento.
- Puerto cerrado con 2 intentos -> lanza error con `cause`.
