---
name: testing-practico
description: Qué probar en proyectos chicos y cómo - dinero, parsers y casos borde primero, vitest y pytest, mocks mínimos, fixtures reales, smoke tests E2E con Playwright y tests antes de cada commit. Usa con test, prueba, vitest, pytest, playwright.
---

# Testing práctico

El ciclo rojo-verde-refactor lo cubre la skill TDD de `superpowers` (úsala si está instalada). Esta skill decide **qué** vale la pena probar en un proyecto chico, con qué herramienta y cómo dejar las pruebas corriendo solas. Corrige esto de Claude: escribe tests que prueban el mock y no el código, llena el proyecto de tests triviales y se salta los cálculos de dinero, usa `sleep` y fechas reales (tests que fallan a veces), y dice "listo" sin haber corrido la suite.

**Verifica antes de confiar**: revisa la versión instalada de vitest, pytest o Playwright (`package.json`, `uv tree --depth 1`) y confirma cualquier API de mocks o configuración con Context7 (MCP `context7`) o WebFetch a la doc oficial; cambian entre majors.

## Qué probar primero (en este orden)

1. **Dinero y cantidades**: comisiones, bps, slippage, PnL, conversiones de decimales, precios, redondeo. Un error aquí cuesta dinero real. Prueba con enteros/`bigint` y valores enormes.
2. **Parsers y transformaciones**: parsear un swap de una transacción, un webhook, un CSV, la respuesta de una API. Usa **fixtures reales** (JSON copiado de una respuesta verdadera, sin secretos) en `tests/fixtures/`.
3. **Reglas de negocio y estados**: ¿puede pasar una suscripción de `cancelada` a `activa`? ¿se compra dos veces si llega el mismo evento?
4. **Validación de entradas**: lo que rechaza tu schema (zod/pydantic) y lo que acepta.
5. **Cada bug que ya pasó**: antes de arreglarlo, escribe el test que lo reproduce (debe fallar); luego arregla.

**No pierdas tiempo** probando el framework, getters, que una librería haga lo suyo, ni pixeles de la UI. No persigas un porcentaje de cobertura.

### Casos borde que siempre revisas

`0`, negativos, vacío (`""`, `[]`, `null`/`undefined`/`None`), un solo elemento, muchísimos, decimales (`0.1 + 0.2`), números gigantes, texto con acentos y emoji, duplicados, fechas en otra zona horaria y cambios de día en UTC, timeouts y respuestas 429/500 de la API.

## Diseñar para que se pueda probar

- Separa **lógica pura** (recibe datos, devuelve datos) de **efectos** (red, base, disco, reloj). La lógica pura se prueba sin mocks.
- Pasa las dependencias como parámetros (`ahora: () => Date`, `obtenerPrecio: (mint) => Promise<bigint>`) en vez de importarlas fijas. Así el test pasa una función falsa simple.
- **Mocks mínimos**: solo en el borde con el mundo exterior (HTTP, reloj, aleatorio). Si un test necesita más de 2–3 mocks, la función hace demasiado: pártela.
- **Nunca** llames APIs reales que muevan dinero ni envíes transacciones desde un test. Tests de integración contra APIs reales (solo lectura) van aparte y se corren a mano.

## TypeScript: vitest

A nov 2026: Vitest 5.1, pide Node ≥ 22.12 y Vite ≥ 6.4 (si no usas Vite no importa, vitest lo trae).

```fish
pnpm add -D vitest
```

`package.json`: `"test": "vitest run"` (una pasada, para CI y commits) y `"test:watch": "vitest"`. Archivos `*.test.ts` junto al código.

```ts
import { describe, expect, test, vi } from "vitest";
import { comision } from "./comision.ts";

describe("comision", () => {
  test.each([
    { monto: 0n, bps: 100, esperado: 0n },
    { monto: 1n, bps: 100, esperado: 1n },        // redondea hacia arriba
    { monto: 10_000n, bps: 100, esperado: 100n },
  ])("$monto con $bps bps -> $esperado", ({ monto, bps, esperado }) => {
    expect(comision(monto, bps)).toBe(esperado);
  });

  test("rechaza entradas inválidas", () => {
    expect(() => comision(-1n, 100)).toThrow(RangeError);
  });
});

test("fecha fija", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  // ... código que usa new Date() / Date.now()
  vi.useRealTimers();
});
```

- `test.each` para tablas de casos borde. `vi.fn()` para una función falsa; `vi.useFakeTimers()` para reintentos y backoff sin esperar de verdad.
- Para `fetch`: mejor inyectar la función; si no se puede, `vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(fixture)))` y restaura con `vi.restoreAllMocks()`.

## Python: pytest

```fish
uv add --dev pytest
uv run pytest            # todo
uv run pytest -x -k comision   # para en el primer fallo, solo tests que coinciden
```

```python
import pytest
from mi_bot.comision import comision

@pytest.mark.parametrize(("monto", "bps", "esperado"), [(0, 100, 0), (1, 100, 1), (10_000, 100, 100)])
def test_comision(monto: int, bps: int, esperado: int) -> None:
    assert comision(monto, bps) == esperado

def test_rechaza_negativos() -> None:
    with pytest.raises(ValueError):
        comision(-1, 100)
```

Fixtures integrados antes que librerías: `tmp_path` (carpeta temporal), `monkeypatch` (env vars, reemplazar una función). Config en `pyproject.toml` bajo `[tool.pytest]` (ver `python-moderno-uv`).

## Smoke test E2E con Playwright

Para una web, 1 a 3 tests que prueban lo que, si se rompe, el usuario nota de inmediato: la página carga, el flujo principal funciona (login, buscar, pagar en modo prueba), sin errores en consola. No intentes cubrir todo con E2E: son lentos y frágiles.

```fish
pnpm create playwright        # o: npm init playwright@latest
pnpm exec playwright install chromium
pnpm exec playwright test
```

- En CachyOS/Arch **no uses `--with-deps`**: instala dependencias con apt y Playwright solo soporta oficialmente Debian/Ubuntu. Instala solo el navegador; si falta una librería del sistema, lee el error y búscala en pacman (skill `cachyos-hyprland-fish`).
- En `playwright.config.ts` usa `webServer` para que levante la app sola: `command: "pnpm dev"`, `url: "http://localhost:3000"`, `reuseExistingServer: !process.env.CI`, y `use: { baseURL: "http://localhost:3000" }`.
- Selecciona por rol o texto visible (`page.getByRole("button", { name: "Comprar" })`), no por clases CSS.
- Captura errores de consola: `page.on("pageerror", e => errores.push(e))` y al final `expect(errores).toEqual([])`.
- Nunca `waitForTimeout(3000)`: usa las aserciones que esperan solas (`await expect(locator).toBeVisible()`).
- Para explorar una página a mano desde Claude Code usa el plugin `playwright` (MCP); esta sección es para tests que quedan en el repo.

## Tests que no fallan "a veces"

Fecha y hora fijas (fake timers / pasar `ahora`), semillas fijas para aleatorios, nada de `sleep`, cada test crea sus propios datos y no depende del orden, sin red real. Si un test falla intermitente, arréglalo o bórralo; no lo reintentes hasta que pase.

## Correr antes de cada commit

1. Un solo script que corre todo lo rápido: `"check": "tsc && biome check . && vitest run"` (ajusta al linter del proyecto) o en Python `uv run ruff check && uv run ruff format --check && uv run pytest`.
2. **Antes de cada commit, Claude corre `check` y muestra la salida.** Si falla, no se commitea (skill `red-de-seguridad-git`).
3. Opcional, para que no dependa de memoria: hook de git `.git/hooks/pre-commit` con `#!/bin/sh` y `exec pnpm check` (`chmod +x`). Los E2E no van en el hook (lentos): van en CI (skill `docker-y-github-actions`).

## Al terminar

Muestra la salida real de la suite (cuántos pasaron). Si agregaste un test por un bug, demuestra que fallaba antes del arreglo. Explícale al usuario en una frase qué protege cada test nuevo y cómo correrlos él (`pnpm test` o `uv run pytest`).

## Fuentes (verificado nov 2026)

- https://vitest.dev/guide/ (v5.1.0, requisitos de Node y Vite, `vitest run`)
- https://vitest.dev/api/vi (`vi.fn`, `vi.spyOn`, `vi.useFakeTimers`, `vi.setSystemTime`)
- https://docs.pytest.org/en/stable/how-to/parametrize.html y https://docs.pytest.org/en/stable/reference/customize.html
- https://playwright.dev/docs/intro (distros soportadas, comandos) y https://playwright.dev/docs/test-webserver
- Probado localmente: el ejemplo de vitest de arriba (Vitest 5.1.0, 6 tests en verde, `tsc` limpio).
