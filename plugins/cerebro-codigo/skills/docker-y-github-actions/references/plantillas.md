# Plantillas probadas (nov 2026)

Probadas en esta fecha: las dos imágenes se construyeron y corrieron (`docker build` + `docker run`, usuario no root, sin devDependencies), `docker compose config` validó el compose y `actionlint` 1.7.12 pasó los workflows sin errores. Los workflows **no** se ejecutaron en GitHub. Antes de copiarlas, revisa versiones y SHAs como dice el SKILL.md.

## Dockerfile: Node 26 + pnpm 12 (TypeScript corrido con type stripping)

Si el proyecto tiene paso de build (Vite, Next, bundle), agrega `RUN pnpm build` en la etapa `build` y copia `dist/` en vez de `src/`. Si hay `pnpm-workspace.yaml`, cópialo junto con `package.json` y el lockfile.

```dockerfile
# syntax=docker/dockerfile:1
# --- base: Node LTS + pnpm (binario copiado de la imagen oficial de pnpm) ---
FROM node:26-slim AS base
COPY --from=ghcr.io/pnpm/pnpm:12 /opt/pnpm /opt/pnpm
RUN ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm
WORKDIR /app

# --- build: todas las dependencias, typecheck y tests (si fallan, no hay imagen) ---
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile
COPY . .
RUN pnpm typecheck && pnpm test

# --- prod-deps: solo dependencias de producción ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --prod --frozen-lockfile

# --- runtime: imagen final chica, sin pnpm ni devDependencies, usuario sin root ---
FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src
USER node
EXPOSE 3000
CMD ["node", "src/main.ts"]
```

`.dockerignore`:

```
node_modules
.git
.env
.env.*
!.env.example
dist
coverage
*.log
```

El proceso debe cerrar limpio con SIGTERM (si no, `docker stop` espera 10 s y lo mata). En el código: `process.on("SIGTERM", () => server.close(() => process.exit(0)))`, o usa `init: true` en compose / `docker run --init`.

## Dockerfile: Python con uv

`.python-version` del proyecto **debe coincidir** con la versión de la imagen base (`python:3.14-slim` → `3.14`); si no, `uv sync` falla con "No interpreter found".

```dockerfile
# --- build: instala dependencias con uv en /app/.venv ---
FROM python:3.14-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# --- runtime: mismo Python, sin uv, usuario sin root ---
FROM python:3.14-slim AS runtime
RUN useradd --create-home app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH"
USER app
CMD ["python", "main.py"]
```

`.dockerignore`: `.venv`, `__pycache__`, `.git`, `.env`.

## compose.yaml para desarrollo (app + Postgres)

Arranca con `docker compose up --watch`: los cambios en `src/` se copian al contenedor y `node --watch` reinicia; cambiar `package.json` reconstruye la imagen.

```yaml
services:
  app:
    build:
      context: .
      target: build          # etapa con devDependencies para desarrollo
    command: ["pnpm", "exec", "node", "--watch", "src/main.ts"]
    ports:
      - "127.0.0.1:3000:3000"  # solo accesible desde tu PC
    env_file:
      - path: .env
        required: false
    environment:
      DATABASE_URL: postgres://app:app@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    init: true
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json
  db:
    image: postgres:18
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - db-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10
volumes:
  db-data:
```

Postgres 18+ guarda los datos en `/var/lib/postgresql/18/docker` y el volumen va en `/var/lib/postgresql`. Con 17 o menos el volumen va en `/var/lib/postgresql/data`; montarlo en otro lado = datos que se pierden al recrear el contenedor.

## GitHub Actions: CI + deploy a Cloudflare Workers (Node/pnpm)

Un solo workflow: `check` corre en cada push y PR; `deploy` solo en push a `main` y solo si `check` pasó. Más simple y seguro que encadenar workflows con `workflow_run`. Requiere scripts `typecheck`, `lint` y `test` en `package.json` y los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno `production`.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read            # mínimo; súbelo solo en el job que lo necesite

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1
        with:
          version: 12
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  deploy:
    needs: check            # solo si check pasó
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: production # secretos de entorno + aprobación manual opcional
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1
        with:
          version: 12
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## GitHub Actions: CI de Python con uv

```yaml
name: CI Python
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: astral-sh/setup-uv@68559e99cc807c1eb7e9238fd43a15bba460eec2 # v10.3.3
        with:
          enable-cache: true
      - run: uv sync --locked
      - run: uv run ruff check
      - run: uv run ruff format --check
      - run: uv run pytest
```
