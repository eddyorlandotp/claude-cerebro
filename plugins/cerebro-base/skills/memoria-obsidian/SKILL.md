---
name: memoria-obsidian
description: Usa una bóveda de Obsidian como memoria entre sesiones (estado, decisiones, pendientes, bitácora por proyecto). Usar cuando digan "abre Obsidian y continuemos con X", "dónde nos quedamos", "retoma el proyecto", "anota esta decisión", Obsidian vault, notes, memory.
---

# Memoria en Obsidian

Claude Code no recuerda sesiones anteriores. La bóveda de Obsidian del usuario es la memoria del proyecto: tú la lees al empezar y la actualizas al decidir y al cerrar. Funciona solo leyendo y escribiendo archivos Markdown; no necesitas ningún MCP ni que Obsidian esté abierto.

## 1. Localiza la bóveda (una sola vez)

1. Busca en `~/.claude/CLAUDE.md` una línea `Bóveda de Obsidian: <ruta>`. Si está y la carpeta existe, úsala.
2. Si no, revisa la variable `OBSIDIAN_VAULT` (`printenv OBSIDIAN_VAULT`).
3. Si no, busca candidatas: una bóveda es una carpeta que contiene `.obsidian/` en su raíz.
   ```bash
   find ~ -maxdepth 4 -type d -name .obsidian -not -path '*/node_modules/*' 2>/dev/null
   ```
4. Muestra las candidatas al usuario y pregunta cuál es. Si no hay ninguna, pregunta la ruta o si quiere usar `NOTAS.md` en el repo (ver sección 7).
5. Guarda la respuesta para siempre: agrega al final de `~/.claude/CLAUDE.md` (créalo si no existe; avisa al usuario que lo vas a editar):
   ```markdown
   ## Memoria
   Bóveda de Obsidian: /home/usuario/Documentos/MiBoveda
   Carpeta de proyectos dentro de la bóveda: Proyectos/
   ```
   No vuelvas a preguntar en sesiones futuras.

## 2. Estructura (créala si no existe)

```
<bóveda>/Proyectos/
  Inicio.md                       índice: un wikilink por proyecto + estado en una línea
  <proyecto>/
    estado.md                     dónde estamos HOY (se reescribe, no crece)
    pendientes.md                 lista priorizada de tareas (checkboxes)
    decisiones.md                 registro de decisiones (solo se agregan entradas)
    bitacora/AAAA-MM-DD.md        qué se hizo cada sesión (una nota por día)
```

- Nombre de carpeta de proyecto: kebab-case sin acentos (`bot-copy-trading`, `juego-roblox`).
- Como todos los proyectos tienen un `estado.md`, enlaza SIEMPRE con ruta para evitar ambigüedad: `[[Proyectos/bot-copy-trading/estado|estado]]`, nunca `[[estado]]`.
- Todo lo que escribes vive bajo `Proyectos/`. No toques otras notas del usuario salvo que lo pida.

Plantillas completas de cada archivo: lee `references/plantillas.md` cuando vayas a crear un proyecto nuevo en la bóveda.

## 3. Ritual de inicio ("abre Obsidian y continuemos con X")

1. Localiza la bóveda (sección 1).
2. Encuentra el proyecto: `ls "<bóveda>/Proyectos"`. Compara con lo que dijo el usuario, también contra la propiedad `aliases` del frontmatter de cada `estado.md` (`grep -l -i "nombre" "<bóveda>"/Proyectos/*/estado.md`). Si hay duda entre dos, pregunta.
3. Lee, en este orden y nada más:
   - `estado.md` completo;
   - `pendientes.md` completo;
   - la última nota de bitácora: `ls "<bóveda>/Proyectos/<p>/bitacora" | sort | tail -1`;
   - `decisiones.md` solo si la tarea toca algo ya decidido (búscalo con `grep -n -i "<tema>"`).
4. Revisa el repo real (la ruta está en la propiedad `repo` de `estado.md`): `git status --short`, `git log --oneline -5`, rama actual. Si el repo no coincide con lo que dice `estado.md` (commits nuevos, cambios sin guardar), díselo al usuario: la nota puede estar desactualizada.
5. Responde en máximo 5 líneas: dónde nos quedamos, qué está verificado y qué no, el siguiente pendiente P0/P1 y tu propuesta de por dónde empezar. Pide confirmación antes de arrancar.

No leas toda la bóveda ni bitácoras viejas "por contexto": gastas memoria de la sesión sin ganar nada.

## 4. Durante la sesión

- **Decisión tomada** (elegir librería, cambiar arquitectura, descartar una idea, fijar un límite de riesgo): agrega una entrada a `decisiones.md` en el momento, no al final:
  ```markdown
  ## 2026-11-16 — Usar Durable Objects para el estado del bot
  - **Decisión:** ...
  - **Por qué:** ...
  - **Descartado:** ... (y por qué)
  - **Revisar si:** ... (qué haría cambiar esta decisión)
  ```
- **Tarea nueva descubierta**: agrégala a `pendientes.md` con prioridad; no la empieces sin avisar.
- **Algo que costó trabajo averiguar** (un error raro, un límite de API): una línea en la bitácora del día y, si aplica al código, también en el `CLAUDE.md` del proyecto.

## 5. Ritual de cierre

Cuando el usuario termina o el contexto se está llenando, sigue la skill `cierre-de-sesion`: escribe la bitácora del día, reescribe `estado.md`, prioriza `pendientes.md` y deja los comandos para retomar.

## 6. Formato compatible con Obsidian

- **Frontmatter YAML** al inicio, entre líneas `---`. Cada propiedad `nombre: valor`. Listas con un elemento por línea precedido de `- `.
- **Wikilinks dentro del frontmatter van entre comillas**: `relacionado: "[[Proyectos/juego-roblox/estado]]"`.
- **Fechas** en formato `AAAA-MM-DD` (Obsidian las reconoce como tipo fecha).
- **Tags**: en el frontmatter como lista (`tags:` y debajo `- proyecto/bot-trading`); en el texto `#proyecto/bot-trading`. Sin espacios, con al menos un carácter no numérico; `/` crea jerarquía.
- **Enlaces**: `[[ruta/nota]]`, a un encabezado `[[ruta/nota#Encabezado]]`, con texto propio `[[ruta/nota|texto]]`. Rutas desde la raíz de la bóveda, con `/`.
- **Tareas**: `- [ ] pendiente` y `- [x] hecho`.
- **Avisos**: callouts `> [!warning] Título` (tipos: note, info, todo, tip, success, question, warning, failure, danger, bug, example, quote).
- Escribe con las herramientas de edición (Edit/Write), no con `echo >>` desde bash: así `/rewind` puede deshacerlo y no rompes el frontmatter.

## 7. Sin Obsidian: NOTAS.md en el repo

Si el usuario no usa Obsidian o la bóveda no está disponible, usa `NOTAS.md` en la raíz del repo con las mismas secciones (`## Estado`, `## Pendientes`, `## Decisiones`, `## Bitácora`). Está bien commitearlo. Anota en el `CLAUDE.md` del proyecto: `Memoria: NOTAS.md`.

## 8. Seguridad de la bóveda

- Nunca escribas llaves, tokens, seed phrases, contraseñas ni direcciones privadas en la bóveda: puede sincronizarse (Obsidian Sync, git, Drive) o compartirse. Escribe "la llave está en el secret `HELIUS_API_KEY` de Cloudflare", no la llave.
- No borres notas ni secciones escritas por el usuario. Si algo te parece obsoleto, márcalo (`~~texto~~` o un callout) y pregunta.

## Opcional: herramientas de Obsidian

No son necesarias para esta skill. Úsalas solo si el usuario ya las tiene configuradas:
- **Obsidian CLI oficial** (a nov 2026 requiere Obsidian 1.12.7+, se activa en Settings → General → Command line interface; necesita la app abierta). Útil para `obsidian search query="..."` sobre la bóveda. Verifica comandos en https://obsidian.md/help/cli antes de usarlos.
- **Servidores MCP comunitarios** (por ejemplo `mcp-obsidian`, que pasa por el plugin Local REST API y requiere Obsidian abierto y una API key). No son oficiales; revisa el repo y sus permisos antes de instalar. Leer/escribir archivos directamente es más simple y no depende de nada.

## Verifica antes de confiar

Si cambias algo del formato (propiedades nuevas, sintaxis de callouts, CLI), confírmalo en la ayuda oficial de Obsidian con WebFetch antes de escribirlo en muchas notas.

## Fuentes (verificado nov 2026)

- Propiedades y frontmatter (wikilinks entre comillas, listas, tipos): https://obsidian.md/help/properties
- Enlaces internos (rutas, encabezados, texto alternativo): https://obsidian.md/help/links
- Reglas de tags: https://obsidian.md/help/tags
- Callouts: https://obsidian.md/help/callouts
- Carpeta `.obsidian` en la raíz de cada bóveda: https://obsidian.md/help/configuration-folder
- Obsidian CLI oficial: https://obsidian.md/help/cli
- Ubicación de `~/.claude/CLAUDE.md` y memoria de Claude Code: https://code.claude.com/docs/en/memory
- Panorama de MCPs de Obsidian (REST API vs. archivos): https://www.morphllm.com/obsidian-mcp-server
