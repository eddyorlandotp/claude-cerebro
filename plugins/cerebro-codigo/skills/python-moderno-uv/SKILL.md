---
name: python-moderno-uv
description: Python moderno con uv - proyectos, dependencias y venv, pyproject.toml, ruff, tipado, pytest y scripts con dependencias inline (PEP 723); nunca pip global en Arch. Usa con Python, pip, venv, requirements.txt, error externally-managed.
---

# Python moderno con uv

Corrige esto de Claude: hace `pip install` global (en Arch truena con `externally-managed-environment` y luego intenta `--break-system-packages`), crea `requirements.txt` a mano, olvida activar el venv, usa versiones de Python que no existen en la máquina y entrega código sin correrlo.

## Reglas duras

1. **Nunca `pip install` fuera de un entorno virtual y nunca `--break-system-packages`.** El Python del sistema en CachyOS/Arch está marcado como "externally managed" (el paquete `python` trae `/usr/lib/python3.14/EXTERNALLY-MANAGED`): pacman es dueño de ese Python. Romperlo puede romper herramientas del sistema.
2. **Todo pasa por uv**: proyectos, dependencias, versiones de Python y herramientas de línea de comandos. Instálalo con `sudo pacman -S uv` (0.13.x en Arch a nov 2026).
3. **No actives el venv a mano en las instrucciones al usuario**: usa `uv run <comando>`, que sincroniza y usa `.venv` solo. Si de verdad hay que activarlo en fish: `source .venv/bin/activate.fish` (no el `activate` de bash).
4. **Verifica antes de confiar**: antes de usar una librería externa, confirma su API actual con Context7 (MCP `context7`) o WebFetch a su doc. Y mira la versión instalada: `uv tree --depth 1`.
5. **Explica en 1–3 frases simples** qué vas a instalar y por qué antes de hacerlo.

## Elegir el caso

| Necesidad | Haz |
|---|---|
| Script suelto de un archivo (scraper, convertir CSV, consultar una API) | Script con dependencias inline (PEP 723), ver abajo |
| Algo con varios archivos, tests o que va a crecer (bot, API) | Proyecto: `uv init` |
| Herramienta de terminal hecha en Python (yt-dlp, httpie) | `uv tool install <paquete>` o una vez: `uvx <paquete>` |
| Paquete que solo existe en los repos de Arch y lo usa el sistema | `sudo pacman -S python-<nombre>` (skill `cachyos-hyprland-fish`) |

## Proyecto con uv

```fish
uv init mi-bot            # o `uv init` dentro de una carpeta existente
cd mi-bot
uv add httpx pydantic     # dependencias normales
uv add --dev pytest ruff  # solo para desarrollo
uv run python -m mi_bot   # o: uv run main.py (depende de lo que generó uv init)
```

- `uv init` crea `pyproject.toml`, `.python-version`, `README.md` y `.gitignore`. El primer `uv run`/`uv sync`/`uv lock` crea `.venv/` y `uv.lock`. **Revisa lo que generó** antes de asumir la estructura (`--app`, `--lib`, `--package` cambian el layout).
- **`uv.lock` se commitea** y no se edita a mano. `.venv/` no se commitea.
- Quitar: `uv remove <paquete>`. Actualizar uno solo: `uv lock --upgrade-package <paquete>` y luego `uv sync`. Ver desactualizados: `uv tree --outdated --depth 1`.
- Migrar un `requirements.txt` existente: `uv add -r requirements.txt`.
- Versión de Python: `uv python install 3.14` y `uv python pin 3.14`. uv descarga su propio Python; no toca el del sistema. A nov 2026 existen 3.14 (la de Arch) y 3.15 (salió en oct 2026); si una dependencia no tiene wheels para la más nueva, quédate en 3.14.
- En CI y Docker usa `uv sync --locked` (falla si el lock no coincide con `pyproject.toml` en vez de cambiarlo en silencio).

## pyproject.toml base

```toml
[project]
name = "mi-bot"
version = "0.1.0"
requires-python = ">=3.14"
dependencies = ["httpx", "pydantic"]

[dependency-groups]
dev = ["pytest", "ruff"]

[tool.ruff]
line-length = 100

[tool.ruff.lint]
extend-select = ["I", "UP", "B"]   # imports ordenados, sintaxis moderna, bugs comunes

[tool.pytest]
testpaths = ["tests"]
addopts = ["-ra", "-q"]
```

`uv add` escribe `dependencies` y `[dependency-groups]` solo; no los edites a mano salvo para quitar algo. `[tool.pytest]` con tipos TOML nativos existe desde pytest 9 (con pytest más viejo usa `[tool.pytest.ini_options]`).

## Calidad: ruff, tipos y tests

- **ruff** para lint y formato (reemplaza flake8, isort y black):
  - `uv run ruff check --fix` y `uv run ruff format`.
  - En CI: `uv run ruff check` y `uv run ruff format --check` (no modifican, solo fallan).
- **Tipado**: anota funciones públicas (parámetros y retorno) y usa sintaxis moderna: `list[str]`, `dict[str, int]`, `X | None`. Valida datos externos con **pydantic** (`Modelo.model_validate(datos)`) o dataclasses si no hay datos externos.
- **Revisor de tipos**: si el proyecto ya usa mypy o pyright, sigue con ese. Si no, `uv add --dev ty` y `uv run ty check` (de Astral, muy rápido; **en beta** a nov 2026, versión 0.0.x). Si ty da falsos positivos raros, usa `uv add --dev mypy` y `uv run mypy src`.
- **pytest**: `uv run pytest`. Tests en `tests/test_*.py`. Usa los fixtures integrados `tmp_path` (archivos temporales) y `monkeypatch` (variables de entorno, funciones) antes de traer librerías de mocks. Qué probar: skill `testing-practico`.

## Scripts de un archivo con dependencias inline (PEP 723)

Para scripts sueltos no crees proyecto ni venv: declara las dependencias dentro del archivo.

```fish
uv init --script reporte.py --python 3.14
uv add --script reporte.py httpx rich
uv run reporte.py
```

Eso deja al inicio del archivo:

```python
# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "httpx>=0.28.1",
#     "rich>=15.0.0",
# ]
# ///
```

- uv agrega solo el mínimo de versión (`>=`). `dependencies` debe existir aunque esté vacío (`dependencies = []`).
- Con metadata inline, `uv run` **ignora las dependencias del proyecto** donde esté parado.
- Para que sea ejecutable directo: primera línea `#!/usr/bin/env -S uv run --script` y `chmod +x reporte.py`.
- Para que no cambie con el tiempo: `uv lock --script reporte.py` (crea `reporte.py.lock`) o fija fecha con `exclude-newer` en `[tool.uv]` dentro del bloque.
- Probar una librería una vez sin instalar nada: `uv run --with rich python -c "import rich; print(rich.__version__)"`.

## Errores comunes

| Síntoma | Causa | Arreglo |
|---|---|---|
| `error: externally-managed-environment` | `pip install` al Python del sistema | `uv add` en un proyecto, `uv add --script`, o `uv tool install` |
| `ModuleNotFoundError` con `python main.py` | Corriste el Python del sistema, no el del venv | `uv run main.py` |
| Funciona en tu PC y no en CI/Docker | Lock desactualizado o no commiteado | Commitea `uv.lock`; en CI `uv sync --locked` |
| Script de AUR/sistema dejó de servir tras actualizar Arch | Cambió la versión menor de Python del sistema | Reinstala ese paquete; tus proyectos con uv no se afectan |
| `uv` no encuentra la versión pedida | No está instalada | `uv python install <versión>` |

## Al terminar

Corre y muestra: `uv sync`, `uv run ruff check`, `uv run pytest` y el programa real una vez. Dale al usuario el comando exacto (`uv run ...`) y qué debe ver. Si algo no se pudo probar, dilo.

## Fuentes (verificado nov 2026)

- https://docs.astral.sh/uv/guides/projects/
- https://docs.astral.sh/uv/guides/scripts/
- https://docs.astral.sh/uv/concepts/projects/dependencies/
- https://docs.astral.sh/ruff/tutorial/
- https://docs.astral.sh/ty/ y https://pypi.org/project/ty/ (clasificador "Beta")
- https://docs.pytest.org/en/stable/reference/customize.html (`[tool.pytest]` desde pytest 9)
- https://peps.python.org/pep-0723/ y https://peps.python.org/pep-0668/
- https://archlinux.org/packages/core/x86_64/python/ (lista de archivos con `EXTERNALLY-MANAGED`) y https://archlinux.org/packages/extra/x86_64/uv/
- https://endoflife.date/python (3.15 lanzado oct 2026)
- Probado localmente: `uv init`, `uv add --dev pytest ruff ty`, el `pyproject.toml` de arriba, `ruff check`, `ruff format --check`, `pytest`, `ty check`, `uv tree --outdated` y `uv add --script`.
