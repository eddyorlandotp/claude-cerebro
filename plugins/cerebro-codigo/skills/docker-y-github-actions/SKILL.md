---
name: docker-y-github-actions
description: Dockerfile multi-stage mínimo (Node/pnpm, Python/uv), .dockerignore, compose para desarrollo, CI en GitHub Actions (lint+test), deploy con secretos, cachés y errores comunes. Usa con Docker, Dockerfile, compose, GitHub Actions, CI.
---

# Docker y GitHub Actions sin sorpresas

Corrige esto de Claude: imágenes de 1 GB con devDependencies y `.git` adentro, secretos en `ENV`/`ARG` o commiteados en el workflow, contenedores corriendo como root, `actions/x@v3` de memoria, CI que nunca corrió los tests y deploys que salen aunque los tests fallen.

Para dejar un servicio corriendo 24/7 con systemd o compose `restart:` usa `servicios-24-7` (`cerebro-linux`). Para el checklist de publicación y monitoreo, `deploy-y-monitoreo` (`cerebro-base`). Para secretos en general, `secretos-y-llaves`.

## ¿Hace falta Docker?

- **Cloudflare Workers/Pages, Vercel, Netlify**: no. Despliegas con su CLI; Docker no aporta.
- **Script o bot en tu mini-PC**: no es obligatorio; systemd + uv/node directo es más simple. Usa Docker si quieres aislarlo, fijar versiones o tienes varios servicios (app + base + redis).
- **VPS o servicio que pide imagen**: sí.
- **Dev local con Postgres/Redis**: compose es lo más cómodo.

Explica la decisión al usuario en 1–3 frases antes de crear archivos.

**Verifica antes de confiar**: imágenes base, versiones de acciones y opciones de compose cambian. Confírmalas con Context7 (MCP `context7`), WebFetch a la doc oficial o `git ls-remote` (para acciones) antes de escribirlas; nunca de memoria.

## Reglas del Dockerfile

1. **Multi-stage**: una etapa instala todo y corre typecheck + tests (si fallan, no hay imagen); otra instala solo dependencias de producción; la final copia solo lo necesario. Imagen final `-slim` oficial.
2. **Copia primero los manifiestos y el lockfile, instala, y después copia el código**: así cambiar código no reinstala dependencias. Instala siempre con lockfile congelado (`pnpm install --frozen-lockfile`, `uv sync --locked`).
3. **Caché de BuildKit** para el gestor: `RUN --mount=type=cache,...` (store de pnpm o `/root/.cache/uv`).
4. **`.dockerignore` obligatorio**: `node_modules`, `.venv`, `.git`, `.env*` (excepto `.env.example`), `dist`, logs. Sin él, mandas secretos y gigas al build.
5. **Usuario sin root** en la etapa final (`USER node` en imágenes de Node; `useradd` + `USER` en Python).
6. **Secretos nunca en `ARG` ni `ENV`** (quedan en la imagen). Para runtime: variables al correr (`docker run --env-file .env`, `env_file` en compose). Si el build necesita un token: `RUN --mount=type=secret,id=...` + `docker build --secret`.
7. **Señales**: el proceso debe terminar con SIGTERM. Node como PID 1 ignora Ctrl-C si no lo maneja: agrega el handler o usa `init: true`.
8. Versión fija de la base (`node:26-slim`, `python:3.14-slim`); para máxima reproducibilidad, fija también el digest `@sha256:...` y actualízalo a propósito.
9. Node + pnpm: copia el binario de la imagen oficial (`COPY --from=ghcr.io/pnpm/pnpm:12 /opt/pnpm /opt/pnpm`), como indica la doc de pnpm; no dependas de Corepack.
10. Python + uv: `COPY --from=ghcr.io/astral-sh/uv:<versión> /uv /uvx /bin/`, `uv sync --locked --no-dev`, y `ENV PATH="/app/.venv/bin:$PATH"` en la final.

Plantillas probadas (Node/pnpm, Python/uv, compose, workflows): **lee `references/plantillas.md`** antes de escribir uno de estos archivos.

## compose para desarrollo

- `compose.yaml` con la app y sus servicios (Postgres, Redis). Publica puertos solo en `127.0.0.1:` para no exponerlos a toda la red.
- `docker compose up --watch` con `develop.watch`: `sync` para código, `rebuild` para `package.json`/`pyproject.toml`.
- `depends_on` con `condition: service_healthy` y un `healthcheck` real en la base; sin eso la app arranca antes que la base y truena.
- Datos en volúmenes con nombre. **Postgres 18+ monta el volumen en `/var/lib/postgresql`**; con 17 o menos en `/var/lib/postgresql/data`.
- En CachyOS: `sudo pacman -S docker docker-compose docker-buildx` y habilitar el servicio (ver `cachyos-hyprland-fish` antes de instalar).

## GitHub Actions: CI

Workflow mínimo en cada push y PR: instalar con lockfile → typecheck → lint → tests. Reglas:

1. **Fija cada acción a un SHA completo** con comentario de versión: `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. No escribas versiones de memoria. Obtén el SHA:
   ```fish
   git ls-remote --tags https://github.com/actions/checkout | grep 'v7'
   ```
   Si aparece una línea con `^{}`, usa **ese** SHA (es el commit; el otro es el tag anotado). Algunos README (astral-sh/setup-uv) ya traen la línea con SHA lista para copiar.
2. `permissions: contents: read` arriba; sube permisos solo en el job que lo necesite.
3. `timeout-minutes` en cada job (el default de GitHub es enorme) y `concurrency` con `cancel-in-progress: true` para CI.
4. **Caché**: `actions/setup-node` con `cache: pnpm` (después de `pnpm/action-setup`), `astral-sh/setup-uv` con `enable-cache: true`. No cachees `node_modules` a mano.
5. Usa los **mismos comandos** que corres local (`pnpm typecheck`, `pnpm test`, `uv run pytest`): si el CI falla, se reproduce en tu PC.
6. Versiones a nov 2026 (verifica antes): `actions/checkout` v7, `actions/setup-node` v7, `actions/setup-python` v7, `actions/cache` v6, `pnpm/action-setup` v6 (pnpm también ofrece `pnpm/setup`, que instala pnpm y Node en un paso), `astral-sh/setup-uv` v10, `docker/build-push-action` v7, `docker/setup-buildx-action` v4, `docker/login-action` v4, `cloudflare/wrangler-action` v4.

## GitHub Actions: deploy con secretos

- Deploy como **job con `needs: check`** y `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. Así no se despliega si los tests fallan. Evita `workflow_run` y `pull_request_target` (privilegiados; pueden exponer secretos con código ajeno).
- Secretos: `gh secret set NOMBRE` (pide el valor; no lo pongas en el comando ni en el historial), o `gh secret set NOMBRE --env production` para un entorno. Úsalos como variables de entorno del paso: `env: CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, nunca como argumento de línea de comandos.
- `environment: production` en el job de deploy permite secretos solo de ese entorno y aprobación manual si el usuario la activa en GitHub.
- Cada valor sensible en su propio secreto (no un JSON con todo: el enmascarado de logs falla). Nunca `echo` de un secreto.
- No interpoles `${{ github.event.* }}` (títulos de PR, nombres de rama) dentro de `run:`: pásalos por `env:` y usa la variable (inyección de comandos).
- Los PR desde forks no reciben secretos (salvo `GITHUB_TOKEN`): es intencional, no lo "arregles".
- Cloudflare Workers: secretos `CLOUDFLARE_API_TOKEN` (token con permiso mínimo de Workers) y `CLOUDFLARE_ACCOUNT_ID`, y `pnpm exec wrangler deploy`. Para lo específico de Wrangler usa el plugin `cloudflare`.

## Errores comunes

| Síntoma | Causa | Arreglo |
|---|---|---|
| Imagen enorme, build lento | Sin `.dockerignore` o sin multi-stage | Ver reglas 1, 2 y 4 |
| `uv sync`: "No interpreter found for Python 3.x" en Docker | `.python-version` distinto a la imagen base | Iguálalos |
| `pnpm install --frozen-lockfile` falla en CI/Docker | Lockfile desactualizado o no commiteado | `pnpm install` local y commitea `pnpm-lock.yaml` |
| La app no conecta a la base en compose | Usa `localhost` dentro del contenedor | Usa el nombre del servicio (`db:5432`) |
| `docker stop` tarda 10 s | El proceso ignora SIGTERM | Handler de SIGTERM o `init: true` |
| Datos de Postgres desaparecen | Volumen en ruta equivocada | Ver sección de compose |
| Permiso denegado al escribir en el contenedor | Corre como `node`/`app` y la carpeta es de root | `COPY --chown=...` o crea la carpeta antes de `USER` |
| CI pasa y local falla (o al revés) | Versiones distintas de Node/Python/pnpm | Fija versiones en el workflow igual que local |

## Al terminar

Corre `docker build` y `docker run` de la imagen y prueba el endpoint o la salida; muestra el tamaño (`docker images`). Para workflows, si está disponible corre `actionlint` (`uvx --from actionlint-py actionlint`), haz push y revisa la pestaña Actions o `gh run watch`. Dile al usuario dónde ver si el CI pasó y qué hacer si sale rojo.

## Fuentes (verificado nov 2026)

- https://docs.docker.com/build/building/best-practices/ y https://docs.docker.com/build/building/secrets/
- https://docs.docker.com/compose/how-tos/file-watch/
- https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md (PID 1, `--init`, usuario `node`)
- https://pnpm.io/docker
- https://docs.astral.sh/uv/guides/integration/docker/ y https://docs.astral.sh/uv/guides/integration/github/
- https://github.com/docker-library/docs/blob/master/postgres/content.md (PGDATA y volumen en 18+)
- https://docs.github.com/en/actions/reference/security/secure-use (SHA, permisos, inyección)
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets (forks, `gh secret set`)
- https://github.com/actions/setup-node, https://github.com/pnpm/action-setup, https://github.com/astral-sh/setup-uv (README y tags vía `git ls-remote`)
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://archlinux.org/packages/?q=docker (docker 29.x, docker-compose 5.x, docker-buildx)
