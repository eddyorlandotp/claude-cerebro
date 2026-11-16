---
name: roblox-en-linux-con-rojo
description: Flujo para hacer juegos de Roblox desde Linux con Claude Code - Roblox Studio con Vinegar, Rojo, Rokit, Wally, StyLua, Selene y luau-lsp, MCP de Studio. Usar al crear o sincronizar un proyecto Roblox, instalar herramientas o cuando Studio falla en Linux.
---

# Roblox en Linux con Rojo

El usuario hace juegos de Roblox en Linux (CachyOS + Hyprland + fish) y no programa: tú escribes el código y él opera Roblox Studio. Esta skill dice qué funciona hoy, cómo se divide el trabajo y qué comandos usar.

## Regla 0: verifica antes de confiar

- Antes de escribir código contra una API de Roblox, confírmala: usa Context7 (MCP `context7`) si está instalado, o haz WebFetch a la doc oficial. Truco verificado: agrega `.md` a cualquier URL de `create.roblox.com/docs/...` y obtienes la página en Markdown limpio (ej. `https://create.roblox.com/docs/reference/engine/classes/RemoteEvent.md`). Índice: `https://create.roblox.com/docs/llms.txt`.
- Antes de dar un comando de Rojo/Rokit/Wally, revisa `rojo --help`, `rokit --help`, etc. en la máquina. Las versiones cambian.
- Nunca digas "ya funciona" sin que el usuario lo haya probado en Studio (Play). Tú no ves Studio.

## Realidad de Roblox en Linux (a nov 2026)

Roblox **no soporta Linux oficialmente**. Todo lo de abajo es de la comunidad y puede romperse con una actualización de Roblox.

| Necesidad | Herramienta | Estado |
|---|---|---|
| Roblox Studio (crear) | **Vinegar** (bootstrapper sobre Wine). Último tag visto: v1.9.4 | Funciona; es la vía estándar |
| Jugar (cliente) | **Sober** (Flathub, código cerrado, sin Wine) | Funciona para probar como jugador |
| Wine "a mano" sin Vinegar | — | No lo uses; Vinegar ya trae los parches |

Instalar Studio (el usuario lo corre, tú le das el comando):

```bash
flatpak install flathub org.vinegarhq.Vinegar   # oficial
# alternativa comunitaria en Arch/CachyOS: paquete AUR "vinegar" (no oficial)
```

Problemas conocidos y su arreglo (de la doc de Vinegar, ver `references/problemas-vinegar.md`):
- Paneles que no se acoplan (docking) → activar **Virtual Desktop** en la configuración de Vinegar.
- El cursor no se bloquea al girar la cámara (XWayland, Hyprland) → usar Kombucha (el Wine que Vinegar trae por defecto) o sesión X11.
- No puede abrir/guardar archivos fuera del sandbox → `flatpak --user override --filesystem=home org.vinegarhq.Vinegar`.
- Login falla → desactivar "Web Pages" en Vinegar para usar el login por navegador.
- UI diminuta → subir DPI en "Advanced Wine Settings".
- GPU Nvidia "incompatible" tras actualizar drivers → `flatpak update`.

## Quién hace qué

**Tú (Claude Code) haces, en archivos:**
- Todo el código `.luau`, `default.project.json`, `rokit.toml`, `wally.toml`, `selene.toml`, `stylua.toml`, `.luaurc`.
- Formatear, lint y análisis de tipos (`stylua`, `selene`, `luau-lsp analyze`).
- `rojo build` para generar un `.rbxl` de prueba si hace falta.

**El usuario hace, en Studio (no puedes hacerlo tú):**
- Abrir el place, abrir el plugin Rojo y darle **Connect**.
- Construir el mapa (isla, bases, decoración) con las herramientas de Studio o del Creator Store.
- Probar: **Play** / **Start Server + N jugadores** (para probar robos hace falta multi-cliente).
- Publicar (File → Publish to Roblox), crear Passes y Developer Products en el Creator Dashboard, configurar audiencia y cuestionario de madurez.

Cuando termines un cambio, dile exactamente qué probar: "Dale Play, toca el huevo dorado, debe aparecer en tu inventario; si sale un error rojo en Output, cópiamelo".

## Elegir el flujo de sincronización

Explica al usuario en 1-2 frases la decisión antes de montarla.

1. **Rojo "parcialmente administrado" (recomendado):** Rojo maneja solo el código; el mapa vive en el place de Roblox. Es lo que la doc de Roblox recomienda para la mayoría y encaja con alguien que construye el mapa en Studio. Rojo corre nativo en Linux; solo el plugin vive dentro de Studio y habla con `rojo serve` por localhost.
2. **Script Sync nativo de Studio:** sincroniza scripts a una carpeta sin instalar nada. Bajo Wine/Flatpak la carpeta tiene que ser accesible (override de filesystem). No está documentado para Linux: úsalo solo si Rojo falla.
3. **Rojo "totalmente administrado":** todo el juego en archivos. No para este usuario: el mapa se hace en Studio.

## Montar un proyecto nuevo (paso a paso)

1. Corre `bash "${CLAUDE_SKILL_DIR}/scripts/revisar-entorno.sh" <carpeta-del-proyecto>` para ver qué falta (solo lee, no instala nada).
2. Rokit (gestor de herramientas oficial de Rojo; **Aftman está abandonado**, no lo uses):
   ```bash
   curl -sSf https://raw.githubusercontent.com/rojo-rbx/rokit/main/scripts/install.sh | bash
   ```
   Si después `rokit` no se encuentra en fish, abre una terminal nueva; si sigue, revisa `rokit self-install` y agrega su carpeta bin con `fish_add_path`.
3. En la carpeta del juego:
   ```bash
   rokit init
   rokit add rojo-rbx/rojo
   rokit add UpliftGames/wally
   rokit add JohnnyMorganz/StyLua
   rokit add Kampfkarren/selene
   rokit add JohnnyMorganz/luau-lsp
   ```
   Fija versiones en `rokit.toml` (Rokit lee también `aftman.toml`/`foreman.toml` si existen).
4. `rojo init <nombre>` crea la plantilla de place (`src/server`, `src/client`, `src/shared`). Ajusta `default.project.json` con la plantilla de `references/configs.md`.
5. Plugin de Studio: `rojo plugin install` (o desde el Creator Store). La versión mayor del plugin debe coincidir con la del servidor.
6. `rojo serve` → el usuario abre su place en Studio → plugin Rojo → Connect (puerto por defecto 34872).
7. Agrega `servePlaceIds` con el ID del place para que Rojo no sincronice al place equivocado.
8. Pon `$ignoreUnknownInstances: true` en los servicios donde el usuario también mete cosas a mano en Studio (Workspace, ReplicatedStorage si guarda modelos), para que Rojo no borre su trabajo.

## Archivos y cómo los mapea Rojo

- `nombre.server.luau` → Script (servidor) · `nombre.client.luau` → LocalScript · `nombre.luau` → ModuleScript.
- `init.luau` / `init.server.luau` / `init.client.luau` convierten la carpeta en ese script.
- `.json` → ModuleScript que devuelve la tabla; `.model.json` → instancias (útil para RemoteEvents); `.meta.json` → propiedades/atributos extra.
- Deja `emitLegacyScripts` en su valor por defecto (`true`). Con `false`, los scripts de cliente se vuelven `Script` con RunContext Client y corren donde estén, incluso en Workspace: fuente de bugs raros.

## Calidad automática (córrelo tú antes de pedir prueba)

```bash
stylua src/                 # formato (pon syntax = "Luau" en stylua.toml)
selene src/                 # lint (selene.toml con std = "roblox")
rojo sourcemap default.project.json --output sourcemap.json
luau-lsp analyze --help     # confirma flags; luego analiza src con el sourcemap y tipos de Roblox
```

`rojo sourcemap` es lo que permite a luau-lsp entender `game.ReplicatedStorage.Shared...`. Agrega `sourcemap.json` al `.gitignore`. Si el análisis da error de tipos, arréglalo antes de pedir al usuario que pruebe.

## Paquetes con Wally

- `wally init`, edita `wally.toml` (`realm = "shared"`, sección `[dependencies]`), luego `wally install` → crea `Packages/`.
- Mapea `Packages` en `default.project.json` (normalmente dentro de ReplicatedStorage).
- Antes de agregar un paquete, verifica en https://wally.run que exista con ese `scope/nombre@versión`. No inventes nombres.
- ProfileStore NO se distribuye por Wally según su doc: se obtiene del Creator Store o del repo; cópialo como ModuleScript en `src/server/`.

## MCP de Roblox Studio (descrito, no instalado)

- **Oficial actual:** Studio trae un servidor MCP integrado (Assistant → … → Manage MCP Servers → *Enable Studio as MCP server*). Transporte stdio. Herramientas: leer/editar scripts, `execute_luau`, `start_stop_play`, `get_console_output`, `screen_capture`, `search_game_tree`, `save_place`, entre otras. La doc solo da comandos para Windows (`%LOCALAPPDATA%\Roblox\mcp.bat`) y macOS (`.../StudioMCP`).
- **En Linux:** no hay instrucciones oficiales. En teoría se podría lanzar el `mcp.bat` dentro del prefijo Wine de Vinegar, pero no está documentado ni probado. No lo hagas parte del flujo; si el usuario quiere experimentar, avísale que puede no funcionar y que el MCP puede leer y modificar su place abierto.
- El repo `Roblox/studio-rust-mcp-server` está archivado (abr 2026) y reemplazado por el integrado. MCPs comunitarios (p. ej. `robloxstudio-mcp`) también fueron archivados o cambiaron de dueño: no los recomiendes sin revisar su estado.
- El flujo base sigue siendo Rojo: archivos que tú editas + el usuario prueba en Studio.

## Errores comunes que debes evitar

- Decir "listo" sin que el usuario haya dado Play y te haya pasado el Output.
- Escribir código para Studio en Windows (rutas `C:\`, `.bat`) o asumir que existe Studio nativo en Linux.
- Usar Aftman o Foreman en proyectos nuevos.
- Editar en Studio un script que Rojo administra: Rojo lo sobrescribe en el siguiente cambio. Dile al usuario: "el código se cambia solo en los archivos".
- Olvidar `$ignoreUnknownInstances` y que Rojo borre el mapa del usuario.
- Instalar herramientas globales con `cargo`/`npm` cuando Rokit las maneja por proyecto.

## Fuentes (verificado nov 2026)

- https://vinegarhq.org/ · https://vinegarhq.org/Vinegar/Installation.html · https://vinegarhq.org/Vinegar/Troubleshooting.html · https://github.com/vinegarhq/vinegar
- https://www.omgubuntu.co.uk/2026/10/play-roblox-linux-sober (estado de Sober, oct 2026)
- https://rojo.space/docs/v7/getting-started/installation/ · https://rojo.space/docs/v7/project-format/ · https://rojo.space/docs/v7/sync-details/ · https://github.com/rojo-rbx/rojo/blob/master/CHANGELOG.md (v7.7.1, oct 2026)
- https://github.com/rojo-rbx/rokit · https://github.com/LPGhatguy/aftman (aviso de no mantenido)
- https://create.roblox.com/docs/projects/rojo · https://create.roblox.com/docs/projects/external-tools · https://create.roblox.com/docs/scripting/sync
- https://create.roblox.com/docs/studio/mcp · https://github.com/Roblox/studio-rust-mcp-server (archivado)
- https://github.com/UpliftGames/wally · https://github.com/JohnnyMorganz/StyLua · https://kampfkarren.github.io/selene/roblox.html · https://github.com/JohnnyMorganz/luau-lsp
- https://madstudioroblox.github.io/ProfileStore/
