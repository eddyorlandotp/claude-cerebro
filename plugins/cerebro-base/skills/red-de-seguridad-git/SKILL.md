---
name: red-de-seguridad-git
description: Git como red de seguridad - commits pequeños con mensajes claros, rama antes de cambios riesgosos, cómo deshacer (revert, reset, reflog), tags de versiones buenas y qué hacer si se commiteó un secreto. Usar con git, commit, deshacer, undo, revert, "se rompió", "regresa a como estaba".
---

# Red de seguridad con git

El usuario no puede revisar código, así que git es su única forma de volver a "cuando sí funcionaba". Tu trabajo: que siempre exista un punto de guardado reciente y bueno, y que deshacer sea fácil y no destructivo.

## Al empezar cualquier tarea

```bash
git status --short
git branch --show-current
git log --oneline -3
```
- Si hay cambios sin commitear que no son tuyos o no reconoces: NO los mezcles con tu trabajo. Pregunta si se commitean primero o se guardan con `git stash push -m "antes de <tarea>"`.
- Si no es repo git: propón `git init -b main` y un primer commit (skill `arrancar-proyecto`).

## Commits pequeños y frecuentes

- Commitea cada vez que un paso **funciona y está verificado** (test o prueba manual pasó). No acumules 3 horas de cambios en un commit.
- Un commit = una idea. Si el mensaje necesita "y" dos veces, son dos commits.
- Agrega archivos por nombre: `git add src/bot.ts src/limites.ts`. Evita `git add -A` / `git add .` salvo en el primer commit y después de revisar `git status`.
- Antes de cada commit: `git diff --staged --stat` y lee la lista. Si aparece un archivo que no esperabas, investiga.

Formato de mensaje (Conventional Commits, en español):
```
<tipo>: <qué cambia, en presente, máx ~70 caracteres>

<opcional: por qué, en 1-3 líneas>
```
Tipos: `feat` (algo nuevo), `fix` (arreglo), `docs`, `refactor` (mismo comportamiento, código distinto), `test`, `chore` (mantenimiento), `wip` (a medias, solo en ramas).

Bien: `fix: el bot ya no compra si el slippage supera el límite`
Mal: `cambios`, `update`, `arreglos varios`, `final final ahora sí`.

## Rama antes de lo riesgoso

Crea rama antes de: refactors, actualizar dependencias mayores, cambiar la base de datos, tocar lógica de dinero, probar una idea que quizás no sirva.
```bash
git switch -c experimento/<tema>       # o feature/<tema>, fix/<tema>
```
Si funciona: regresa a main y fusiona (`git switch main && git merge experimento/<tema>`). Si no: `git switch main` y la rama se queda ahí sin afectar nada. Para trabajos en paralelo, superpowers tiene `using-git-worktrees`.

## Deshacer: elige la opción menos destructiva

Explícale al usuario cuál vas a usar y por qué en una frase. Las que dicen **Sí** en la última columna pierden trabajo: confirma con el usuario antes (para `reset --hard` y `clean -f` el hook `guardia` también lo pide).

| Situación | Comando | Pierde algo |
|---|---|---|
| Sacar un archivo del stage | `git restore --staged <archivo>` | No |
| Corregir el mensaje del último commit (aún no subido) | `git commit --amend` | No |
| Deshacer el último commit local, conservando los cambios | `git reset --soft HEAD~1` | No |
| Deshacer un commit que YA se subió | `git revert <hash>` | No (crea un commit inverso) |
| Guardar cambios a un lado para probar algo | `git stash push -m "<nota>"` y luego `git stash pop` | No |
| Descartar cambios sin commitear de un archivo | `git restore <archivo>` | **Sí**, esos cambios |
| Volver todo el repo a un commit | `git reset --hard <hash>` | **Sí**, todo lo no commiteado y los commits posteriores |
| Borrar archivos no rastreados | `git clean -n -d` (ver) y luego `git clean -f -d` | **Sí**, sin papelera |

**revert vs reset**, dicho simple: `revert` agrega un "commit que deshace" y deja la historia intacta, así que es seguro aunque ya esté en GitHub. `reset` mueve la rama hacia atrás como si los commits no existieran; úsalo solo en commits que no has subido.

Antes de cualquiera de las destructivas, crea un respaldo barato:
```bash
git branch respaldo/$(date +%Y%m%d-%H%M)
```

## "Se perdió todo": git reflog

Git guarda por dónde ha estado cada rama (por defecto ~90 días las entradas alcanzables, ~30 las inalcanzables). Casi todo se recupera:
```bash
git reflog --date=relative | head -30     # busca el punto bueno (ej. HEAD@{5})
git branch rescate HEAD@{5}               # créale una rama, no reset directo
git switch rescate                        # revisa que esté lo que buscas
```
Lo único que reflog NO salva: cambios que nunca se commitearon ni se guardaron en stash. Por eso commits frecuentes.

`/rewind` de Claude Code deshace ediciones hechas con las herramientas de edición, pero no lo que hizo un comando de terminal ni lo de subagentes. No sustituye a git.

## Push

- Respaldo remoto frecuente en un repo privado: `git push` al terminar cada bloque verificado (si el usuario ya tiene remoto).
- **Nunca `git push --force` a `main`/`master`.** Si una rama propia necesita reescribirse: `git push --force-with-lease` (falla si alguien más subió algo).
- Si `git push` es rechazado: `git pull --rebase`, resuelve conflictos, prueba, y vuelve a empujar. No uses force para "ganar".

## Tags: marca las versiones que funcionan

Cuando algo funciona en producción o el usuario lo aprueba:
```bash
git tag -a v1.3.0 -m "Bot con límite de pérdida diaria, probado 24h"
git push origin v1.3.0
```
Versión `MAYOR.MENOR.PARCHE`: parche = arreglo, menor = algo nuevo compatible, mayor = cambia cómo se usa. Para volver a una versión buena sin perder lo actual:
```bash
git switch -c volver-a-v1.2.0 v1.2.0
```

## Si se commiteó un secreto

Orden obligatorio (detalle en `secretos-y-llaves`):
1. **Neutraliza primero.** Llave de billetera: mueve los fondos a una billetera nueva YA. API key/token: revócala y crea otra en el proveedor. Limpiar git NO desfilta lo que ya se copió.
2. Actualiza la llave nueva donde viva (secret de Cloudflare, CI, `.env` local) y verifica que el servicio siga funcionando.
3. Quita el archivo del repo y agrégalo a `.gitignore`: `git rm --cached <archivo>`.
4. Si **no** se ha subido: `git reset --soft HEAD~1` (o los commits necesarios), quita el secreto, commitea de nuevo.
5. Si **ya** se subió: reescribir historia con `git filter-repo` (pide confirmación explícita; es la única excepción al "nunca force-push"):
   ```bash
   git filter-repo --sensitive-data-removal --invert-paths --path <ruta/completa/del/archivo>
   git push --force --mirror origin
   ```
   Requiere git-filter-repo 2.47+ (en Arch/CachyOS: `sudo pacman -S git-filter-repo`). Clones y forks conservan el secreto; GitHub puede tener vistas en caché (soporte de GitHub las borra). Por eso el paso 1 es lo que de verdad protege.

## Hook guardia de este plugin

Bloquea `git add`/`git commit` con `.env`, `.dev.vars`, `id.json`, `*keypair*.json`, `*.pem` o contenido con llaves privadas, y pide confirmación para force-push a main, `reset --hard` y `clean -f`. Si te bloquea: no busques cómo saltarlo; arregla la causa (ignora el archivo, saca la llave) y explica al usuario qué pasó.

## Verifica antes de confiar

Si vas a usar un comando de git que no usas a diario (filter-repo, rebase, opciones poco comunes), confirma la sintaxis en https://git-scm.com/docs o con `git <comando> -h` antes de correrlo.

## Fuentes (verificado nov 2026)

- reflog y expiración por defecto (90/30 días): https://git-scm.com/docs/git-reflog
- revert / reset / restore / stash / switch / tag: https://git-scm.com/docs/git-revert , https://git-scm.com/docs/git-reset , https://git-scm.com/docs/git-restore , https://git-scm.com/docs/git-stash , https://git-scm.com/docs/git-switch , https://git-scm.com/docs/git-tag
- Quitar datos sensibles (rotar primero, filter-repo ≥2.47, `--sensitive-data-removal`, force push, forks y caché): https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- Conventional Commits (tipos permitidos): https://www.conventionalcommits.org/es/v1.0.0/
- git-filter-repo en Arch (extra, 2.47.0 a nov 2026): https://archlinux.org/packages/extra/any/git-filter-repo/
- `/rewind` no deshace cambios hechos por Bash ni por subagentes: https://code.claude.com/docs/en/checkpointing
