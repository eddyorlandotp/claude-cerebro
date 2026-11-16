---
name: cierre-de-sesion
description: Cierra una sesión de trabajo sin perder nada - guarda estado en Obsidian o NOTAS.md, prioriza pendientes, deja comandos para retomar y hace commit. Usar cuando digan "ya me voy", "terminamos", "guarda todo", "cierra", "mañana seguimos", wrap up, end session, o el contexto está por llenarse.
---

# Cierre de sesión

Objetivo: que mañana (o tras un `/compact`) cualquiera, incluido tú sin memoria, pueda retomar en menos de 2 minutos. Esta skill es el "ritual de cierre" de `memoria-obsidian`; la estructura de la bóveda y las plantillas están allá.

## Cuándo correrla

- El usuario dice que termina, se va, o "guarda todo".
- El contexto está por llenarse: conversación muy larga, muchas lecturas de archivos grandes, o `/context` muestra poco espacio libre. Ciérrala ANTES de que se compacte solo; un resumen automático pierde detalles que tú sí sabes ahora.
- Antes de cambiar a un proyecto distinto en la misma sesión.

No pidas permiso para correr el cierre cuando el usuario ya dijo que termina; solo pide confirmación para el commit si hay algo raro (ver paso 5).

## Paso 1. Foto real del estado (no de memoria)

Corre y lee:
```bash
git status --short
git branch --show-current
git log --oneline -5
git stash list
```
Más el comando de test o build del proyecto (está en su `CLAUDE.md`). Clasifica cada cosa trabajada hoy:
- **Verificado**: con el comando y resultado.
- **Sin verificar**: con la razón.
- **Roto**: qué falla y la última pista que tenías.

Si no corriste el test hoy, la respuesta es "sin verificar", no "funciona".

## Paso 2. Bitácora del día

Con Obsidian (bóveda en `~/.claude/CLAUDE.md`, ver `memoria-obsidian`): crea o amplía `Proyectos/<proyecto>/bitacora/AAAA-MM-DD.md` con: qué se hizo, verificado (comando → resultado), problemas y aprendizajes, commits, siguiente.

Sin Obsidian: agrega una sección `### AAAA-MM-DD` arriba de `## Bitácora` en `NOTAS.md` del repo.

Escribe hechos, no narrativa. Mal: "Trabajamos en el bot y avanzamos bastante". Bien: "El bot ya lee posiciones de la wallet líder vía webhook; falta aplicar el límite de pérdida diaria (P0)".

## Paso 3. Reescribe el estado

`estado.md` (o `## Estado` en NOTAS.md) se reescribe completo, no se le agrega texto al final. Debe contestar en menos de 40 líneas:
- qué es el proyecto (una frase);
- dónde estamos (último avance, verificado, roto);
- siguiente paso concreto;
- cómo retomar (paso 4).

Actualiza la fecha `actualizado:` del frontmatter y la línea del proyecto en `Proyectos/Inicio.md`.

## Paso 4. Comandos para retomar

Deben poder copiarse tal cual (el usuario usa fish: nada de `export` ni heredocs):

```bash
cd /ruta/absoluta/al/repo
git switch <rama-actual>
<comando para levantar el entorno de desarrollo>
<comando de test>
claude --continue          # retoma la conversación más reciente en esta carpeta
```

Si la sesión tiene nombre (lo pones con `/rename <nombre>`), anota `claude --resume <nombre>`. Si hay procesos que el usuario debe volver a levantar (túnel, `wrangler dev`, servidor de Minecraft), lístalos.

## Paso 5. Pendientes priorizados

Reordena `pendientes.md` (o `## Pendientes`):
- **P0**: bloquea el avance o hay dinero/seguridad en riesgo (bot con fondos sin límite de pérdida, secreto expuesto, producción caída).
- **P1**: lo siguiente que da valor.
- **P2**: ideas y mejoras.

Cada tarea: verbo + "hecho cuando: <criterio comprobable>". Marca `[x]` lo terminado hoy. Si quedó algo a medias, la primera tarea P0/P1 dice exactamente dónde se quedó ("el endpoint `/health` existe pero no revisa el RPC; falta eso y su test").

## Paso 6. Commit

1. `git status --short` y `git diff --stat`. Revisa que no haya `.env`, llaves, `id.json`, dumps de base de datos ni archivos enormes. El hook de `cerebro-guardia` bloquea los casos obvios, pero revisa tú también.
2. Agrega archivos por nombre, no `git add -A` a ciegas.
3. Decide dónde:
   - Si los tests pasan: commit normal en la rama actual con mensaje claro (`feat: ...`, `fix: ...`).
   - Si algo está roto o a medias y estás en `main`: crea rama `wip/AAAA-MM-DD-<tema>` y commitea ahí con `wip: <qué falta>`. Nunca dejes `main` roto.
4. `git push` solo si el usuario lo pidió o el repo ya se empuja por costumbre; si no, pregunta en una línea ("¿Lo subo a GitHub como respaldo?"). Nunca `--force`.
5. Si las notas viven en el repo (`NOTAS.md`), entran en el mismo commit. La bóveda de Obsidian no se commitea desde aquí.

Detalle de commits y ramas: skill `red-de-seguridad-git`. Si superpowers está instalado y la rama está terminada, `finishing-a-development-branch` decide merge/PR; aquí solo dejas todo guardado.

## Paso 7. Mensaje final al usuario (máximo 8 líneas)

```
**Guardado.**
- Notas: <ruta de la bitácora / NOTAS.md>
- Commit: <hash corto> en <rama> (<subido / solo local>)
- Estado: <verificado / sin verificar / roto: qué>
- Siguiente: <P0 o P1 en una línea>
- Para retomar: `cd <repo> && claude --continue`, o di "abre Obsidian y continuemos con <proyecto>"
```

## Si el contexto se está llenando a mitad de una tarea

1. Para lo que estés haciendo en un punto estable (no a mitad de una edición de varios archivos).
2. Corre los pasos 1-5 (el commit puede ser `wip:` en rama).
3. Dile al usuario que conviene compactar o empezar sesión nueva, y dale el comando: `/compact conserva: <tarea actual>, <archivos clave>, <siguiente paso>`. O cerrar y abrir con `claude --continue`.

## Errores comunes

- Escribir el resumen de memoria sin correr `git status` ni los tests.
- Agregar texto al final de `estado.md` cada sesión hasta que nadie lo lee.
- Pendientes vagos ("mejorar el bot") sin criterio de terminado.
- Commitear en `main` algo que no compila.
- Olvidar procesos corriendo (túnel, bot en local) que el usuario cree que siguen vivos al apagar la PC: díselo.
- Guardar llaves o tokens en la bitácora "para no perderlos".

## Verifica antes de confiar

Los comandos de retomar se prueban: corre al menos el de test o build antes de anotarlo. Si un flag de Claude Code o de git no lo has usado hoy, confírmalo en la doc oficial (WebFetch) antes de dejarlo escrito.

## Fuentes (verificado nov 2026)

- `claude --continue`, `claude --resume <nombre>`, `-n/--name`: https://code.claude.com/docs/en/cli-reference
- `/compact [instrucciones]`, `/rename`, `/context`: https://code.claude.com/docs/en/commands
- Prioridades y "hecho cuando" adaptados de prácticas de superpowers (MIT), sin duplicar `finishing-a-development-branch`: https://github.com/obra/superpowers
