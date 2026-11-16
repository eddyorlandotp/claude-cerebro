---
name: codigo-heredado-y-refactors
description: Cambiar un repo desconocido o viejo sin romperlo - mapa rápido y puntos de entrada, tests de caracterización, refactor en pasos chicos, no reescribir todo, actualizar dependencias una a una, git bisect. Usa con refactor, limpiar, actualizar.
---

# Código heredado y refactors seguros

Corrige esto de Claude: abre un repo y empieza a cambiar sin entender cómo arranca, propone "reescribirlo todo bien", mezcla en un commit renombres + lógica nueva + actualización de dependencias, sube todas las dependencias a `latest` de golpe, y borra código "que no se usa" sin comprobarlo.

Para crear `CLAUDE.md`, `.gitignore` y comandos base al adoptar un proyecto usa `arrancar-proyecto` (`cerebro-base`); para commits, ramas y deshacer, `red-de-seguridad-git`.

## 1. Mapa rápido (antes de tocar nada)

En un repo grande, delega esta exploración a un subagente (Explore) y quédate con el resumen. Pasos:

1. `README*`, `CLAUDE.md`/`AGENTS.md`, y `git log --oneline -20` (qué se tocó último y con qué estilo de mensajes).
2. **Cómo se corre**: `package.json` (`scripts`, `type`, `engines`) o `pyproject.toml`; qué lockfile hay (define el gestor: no lo cambies).
3. **Puntos de entrada**: `main`/`bin` en `package.json`, `src/main.*`/`index.*`, `app/` o `pages/` (Next), `wrangler.toml`/`wrangler.jsonc` (`main`), `CMD` del `Dockerfile`, servicios systemd, `.github/workflows/*` (qué corre CI y cómo se despliega).
4. **Forma del código**:
   ```fish
   git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20   # carpetas con más archivos
   git ls-files '*.ts' '*.tsx' '*.py' | xargs wc -l | sort -n | tail -15   # archivos más grandes
   ```
5. **Configuración**: `.env.example`, y busca qué variables lee el código (`process.env.`, `os.environ`, `import.meta.env`). Lista cuáles faltan.
6. **¿Hay tests y pasan?** Córrelos tal cual antes de cambiar nada. Esa es la línea base; si ya fallan, anótalo y díselo al usuario: no es culpa de tu cambio.
7. Escribe el mapa en 10–20 líneas (en `CLAUDE.md` o en las notas del proyecto): qué hace, cómo se corre, puntos de entrada, módulos principales, riesgos (dinero, datos de usuarios, llaves).

Explícale al usuario en 2–3 frases qué encontraste y qué propones antes de editar.

## 2. Red de seguridad: tests de caracterización

Si el código que vas a tocar no tiene tests, **primero captura lo que hace hoy**, aunque parezca raro (puede que algo dependa de eso):

- Elige entradas reales (fixtures de logs, respuestas de API guardadas, ejemplos del usuario) y guarda la salida actual.
- TS/vitest: `expect(resultado).toMatchInlineSnapshot()` o `toMatchSnapshot()` y corre una vez para que se llene. Python: guarda la salida en `tests/fixtures/*.json` y compárala.
- Para scripts o bots completos: corre el programa con entradas fijas y guarda la salida (stdout, archivo generado, requests que haría) como "golden file".
- Un comportamiento claramente erróneo se arregla **en un paso separado y avisado**, no a escondidas durante el refactor.

## 3. Refactor en pasos chicos

1. Rama nueva antes de empezar.
2. **Un tipo de cambio por commit**: renombrar, mover archivos, extraer función, cambiar lógica, actualizar dependencia. Nunca mezcles "cambio de estructura" con "cambio de comportamiento".
3. Después de **cada** paso: typecheck + tests + correr el programa. Si algo falla, el culpable es el último paso pequeño; si no lo ves en 2 intentos, revierte ese paso.
4. Orden típico: renombrar para que se entienda → extraer funciones puras de las funciones gigantes → separar efectos (red, base) de lógica → recién entonces cambiar comportamiento.
5. Borrar código muerto: busca usos (`grep -rn "nombreFuncion"`, incluyendo strings dinámicos, rutas, crons y config), bórralo en su propio commit y corre todo.

### No reescribir todo

La reescritura completa casi siempre tarda más, pierde casos borde que el código viejo ya resolvía y deja al usuario sin nada que funcione a la mitad. En vez de eso:

- **Estrangulamiento**: escribe el módulo nuevo junto al viejo, pasa un uso a la vez al nuevo, y borra el viejo cuando ya nadie lo usa.
- Reescribe solo si se cumplen las tres: es chico (unos cientos de líneas), hay tests o caracterización que cubren lo importante, y el usuario lo aprueba sabiendo el costo.

## 4. Actualizar dependencias con seguridad

1. **Mira qué hay**: `pnpm outdated` / `npm outdated` / `uv tree --outdated --depth 1`. Vulnerabilidades: `pnpm audit` / `npm audit`.
2. **Prioridad**: primero las que tienen vulnerabilidad real en código que usas; luego parches y menores; los majors al final y de a uno.
3. **Una a la vez** (o un grupo de parches juntos): `pnpm up <paquete>@<versión>` o `uv lock --upgrade-package <paquete>` + `uv sync`. Nunca `pnpm up --latest` de todo junto en un proyecto que funciona.
4. **Verifica antes de confiar**: no asumas la API nueva de memoria. Antes de un major, lee el changelog o las release notes (GitHub releases del paquete, guía de migración oficial). Busca "breaking". Si el framework trae codemods oficiales úsalos y revisa el diff (Next.js: `npx @next/codemod upgrade`).
5. Después de cada una: install, typecheck, tests, correr la app y probar el flujo principal. **Commit por dependencia** con mensaje claro ("deps: zod 3 -> 4"). Así se revierte una sola sin perder las demás.
6. Commitea el lockfile siempre. Si una actualización obliga a cambiar código, ese cambio va en el mismo commit que la dependencia, nada más.
7. pnpm no instala versiones publicadas hace menos de un día (`minimumReleaseAge`); no lo desactives para "tener lo último".

## 5. "Antes funcionaba": git bisect

Si algo se rompió y no sabes en qué commit:

```fish
git bisect start
git bisect bad                 # el commit actual está mal
git bisect good v1.2.0         # un tag o commit que funcionaba
git bisect run pnpm test       # o un script que salga 0 si está bien y 1 si está mal
git bisect reset
```

Necesita un comando que distinga bien de mal; si no hay test, escribe primero uno pequeño que reproduzca el problema.

## Al terminar

Entrega: el mapa del repo, la lista de commits (uno por paso) con qué cambió cada uno, la salida de tests antes y después, y qué quedó pendiente. Dile al usuario cómo probar él mismo que todo sigue igual (comando y qué revisar en pantalla).

## Fuentes (verificado nov 2026)

- https://pnpm.io/cli/outdated, https://pnpm.io/cli/update y https://pnpm.io/cli/audit
- https://pnpm.io/supply-chain-security (`minimumReleaseAge`)
- https://docs.astral.sh/uv/guides/projects/ (`uv lock --upgrade-package`) y `uv tree --help` (`--outdated`)
- https://nextjs.org/docs/app/guides/upgrading/codemods (`npx @next/codemod upgrade`)
- https://vitest.dev/guide/snapshot (snapshots e inline snapshots)
- https://git-scm.com/docs/git-bisect (`git bisect run`)
- Idea de "tests de caracterización" y estrangulamiento: Michael Feathers, *Working Effectively with Legacy Code*, y Martin Fowler, "StranglerFigApplication" (https://martinfowler.com/bliki/StranglerFigApplication.html).
