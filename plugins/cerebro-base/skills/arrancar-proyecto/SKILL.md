---
name: arrancar-proyecto
description: Arranca o adopta un proyecto con base sólida - CLAUDE.md breve, git init, .gitignore correcto, .env.example, README corto y comandos de dev/test/deploy verificados. Usar al crear un proyecto nuevo, clonar uno, "empecemos", "nuevo proyecto", new project, setup repo, init.
---

# Arrancar o adoptar un proyecto

Haz esto ANTES de escribir la primera feature. Un proyecto sin `.gitignore` filtra secretos en el primer commit; uno sin `CLAUDE.md` obliga a redescubrir los comandos en cada sesión.

Antes de empezar, explica al usuario en 2 frases qué vas a crear y por qué (skill `modo-mentor`).

## 0. Diagnóstico (proyecto existente)

Corre y lee antes de cambiar nada:
```bash
ls -la
git status 2>&1 | head -5
cat package.json 2>/dev/null | head -40          # o pyproject.toml, Cargo.toml, default.project.json, wrangler.jsonc/toml
ls CLAUDE.md .claude/CLAUDE.md README* .env* .gitignore 2>/dev/null
```
Anota: lenguaje, framework, gestor de paquetes (por el lockfile: `package-lock.json` npm, `pnpm-lock.yaml` pnpm, `yarn.lock` yarn, `bun.lock`/`bun.lockb` bun), cómo se despliega. No cambies de gestor de paquetes ni de framework sin que el usuario lo pida.

Si ya existen `CLAUDE.md` o `README`, actualízalos; no los sobrescribas.

## 1. Git

```bash
git init -b main          # solo si no existe .git
```
Si el proyecto es adoptado y ya tiene archivos con posibles secretos, NO hagas el primer commit hasta terminar el paso 2 y el escaneo del paso 3.

## 2. .gitignore

Parte de la plantilla oficial de GitHub para el stack (https://github.com/github/gitignore) y asegúrate de que incluya SIEMPRE este bloque de secretos:

```gitignore
# Secretos (nunca al repo)
.env
.env.*
!.env.example
.dev.vars
.dev.vars.*
!.dev.vars.example
*.pem
*.key
id.json
*keypair*.json
CLAUDE.local.md

# Dependencias y builds
node_modules/
dist/
build/
.wrangler/
.next/
__pycache__/
.venv/

# Sistema
.DS_Store
*.log
```

Ajusta la segunda parte al stack real (un proyecto Rojo/Roblox no tiene `.next/`). Luego verifica que nada ignorado esté ya rastreado:
```bash
git ls-files -ci --exclude-standard
```
Si sale algo (por ejemplo `.env`), sácalo del índice sin borrarlo del disco: `git rm --cached <archivo>`, y si ese archivo ya estuvo en un commit, trátalo como secreto filtrado (skill `secretos-y-llaves`).

## 3. Variables de entorno

1. Lista las variables que el código lee realmente: 
   ```bash
   grep -rhoE "process\.env\.[A-Z0-9_]+|import\.meta\.env\.[A-Z0-9_]+|env\.[A-Z0-9_]+|os\.(environ\.get\(|environ\[|getenv\()['\"][A-Z0-9_]+" \
     --include=*.{js,ts,mjs,tsx,jsx,py} --exclude-dir={node_modules,dist,.wrangler} . | sort -u
   ```
   (Ajusta extensiones al lenguaje. Esto lista NOMBRES, nunca leas ni muestres los valores del `.env`.)
2. Crea `.env.example` (o `.dev.vars.example` en Cloudflare Workers) con cada nombre, valor vacío y un comentario de dónde se obtiene:
   ```bash
   # RPC de Solana con API key. Se obtiene en el dashboard del proveedor.
   HELIUS_API_KEY=
   # Límite de pérdida diaria del bot, en SOL.
   MAX_DAILY_LOSS_SOL=0.5
   ```
   Valores por defecto seguros solo si no son secretos.
3. Si el proyecto ya tiene archivos con secretos y `gitleaks` está instalado, escanea antes del primer commit: `gitleaks dir --redact -v .` (detalles en `secretos-y-llaves`).

## 4. Comandos: descúbrelos y PRUÉBALOS

No inventes comandos. Sácalos de `package.json` → `scripts`, del `Makefile`, de `wrangler.jsonc`, del README existente o de la doc oficial del framework. Corre cada uno al menos una vez:
- **dev**: arranca y responde (para servidores: `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:<puerto>` en otra llamada, y luego detén el proceso).
- **test**: corre; anota cuántos pasan. Si no hay tests, escribe "no hay tests todavía" en vez de inventar uno.
- **build**: termina con código 0.
- **deploy**: NO lo corras sin confirmación; solo documenta el comando y a dónde publica.

Lo que no pudiste correr va marcado como "sin verificar" en el `CLAUDE.md`.

## 5. CLAUDE.md del proyecto

- Si el usuario prefiere, `/init` genera un borrador; luego recórtalo a la plantilla.
- Usa la plantilla de `references/plantilla-claude-md.md`. Límite: **60 líneas**. Es para Claude, no para humanos: comandos exactos, reglas y trampas conocidas; nada de marketing.
- Va en la raíz del repo (`./CLAUDE.md`). Preferencias personales que no deben compartirse van en `CLAUDE.local.md` (ya está en el `.gitignore`).
- Nunca pongas secretos en `CLAUDE.md`; pon el NOMBRE de la variable y dónde vive.

## 6. README corto

Para humanos, máximo ~30 líneas:
```markdown
# <Nombre>
<Qué hace en una frase.>

## Correrlo en local
1. Copia `.env.example` a `.env` y llena los valores.
2. `<instalar dependencias>`
3. `<comando dev>` y abre http://localhost:<puerto>

## Publicar
`<comando deploy>` — publica en <dónde>.

## Estado
<Qué funciona hoy / qué falta.>
```

## 7. Primer commit y respaldo

```bash
git add .gitignore .env.example README.md CLAUDE.md <resto de archivos por nombre o carpeta>
git status --short        # revisa que no aparezca .env ni llaves
git commit -m "chore: estructura inicial del proyecto"
```
Respaldo remoto privado (pregunta antes; requiere `gh` autenticado):
```bash
gh repo create <nombre> --private --source=. --push
```

## 8. Fija versiones

- Commitea el lockfile siempre.
- Para dependencias críticas (SDKs de pago o de blockchain), instala versión exacta: `npm install --save-exact <paquete>@<versión>`.
- Anota en `CLAUDE.md` la versión de las librerías externas importantes y el link a su doc (ver `investigar-antes-de-codear`).

## Checklist final (muéstrala al usuario con ✓/✗ real)

- [ ] `git status` limpio tras el primer commit
- [ ] `git ls-files -ci --exclude-standard` no muestra nada
- [ ] `.env.example` lista todas las variables que lee el código
- [ ] dev / test / build corridos (o marcados "sin verificar" con razón)
- [ ] `CLAUDE.md` < 60 líneas con comandos probados
- [ ] README dice cómo correrlo y publicarlo

## Verifica antes de confiar

Los comandos del framework (crear proyecto, dev server, deploy) cambian entre versiones. Antes de usar uno que no viene del propio repo, confírmalo con Context7 (MCP `context7`, si está instalado) o WebFetch a la doc oficial del framework.

## Fuentes (verificado nov 2026)

- Ubicaciones de CLAUDE.md, `CLAUDE.local.md`, imports `@ruta`, recomendación de tamaño: https://code.claude.com/docs/en/memory
- `/init`: https://code.claude.com/docs/en/commands
- Plantillas de .gitignore: https://github.com/github/gitignore
- `.dev.vars`/`.env` fuera de git en Workers: https://developers.cloudflare.com/workers/configuration/secrets/
- `git ls-files` (`-c -i --exclude-standard`): https://git-scm.com/docs/git-ls-files
- `npm install --save-exact`: https://docs.npmjs.com/cli/commands/npm-install
- `gh repo create --private --source --push`: https://cli.github.com/manual/gh_repo_create
