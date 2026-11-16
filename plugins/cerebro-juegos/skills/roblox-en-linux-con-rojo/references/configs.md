# Plantillas de configuración (Rojo parcialmente administrado)

Léelo cuando crees o repares un proyecto. Antes de copiar, confirma con `rojo --version` y la doc de https://rojo.space/docs/v7/project-format/ que los campos sigan existiendo.

## default.project.json

Basado en la plantilla de `rojo init` (place). Rojo administra solo las carpetas de código; el mapa vive en el place.

```json
{
  "name": "mi-juego",
  "servePlaceIds": [0],
  "globIgnorePaths": ["**/*.spec.luau"],
  "tree": {
    "$className": "DataModel",

    "ReplicatedStorage": {
      "$ignoreUnknownInstances": true,
      "Shared": { "$path": "src/shared" },
      "Packages": { "$path": "Packages" },
      "Remotes": { "$path": "src/remotes" }
    },

    "ServerScriptService": {
      "$ignoreUnknownInstances": true,
      "Server": { "$path": "src/server" }
    },

    "StarterPlayer": {
      "StarterPlayerScripts": {
        "$ignoreUnknownInstances": true,
        "Client": { "$path": "src/client" }
      }
    },

    "Workspace": {
      "$ignoreUnknownInstances": true
    }
  }
}
```

- Reemplaza `0` en `servePlaceIds` por el Place ID real (el usuario lo copia del Creator Dashboard o de la URL del juego).
- `servePort` por defecto es 34872; solo cámbialo si está ocupado.
- Quita `Packages` si no usas Wally.

## RemoteEvents como archivos

Crea `src/remotes/` con un `.model.json` por remote, así existen antes de que corra cualquier script:

```json
{ "className": "RemoteEvent" }
```

Nombre del archivo = nombre del remote (`IntentarRobar.model.json`). Para remotes poco confiables usa `"className": "UnreliableRemoteEvent"`.

## rokit.toml (ejemplo; fija las versiones que `rokit add` haya puesto)

```toml
[tools]
rojo = "rojo-rbx/rojo@7.7.1"
wally = "UpliftGames/wally@0.3.2"
stylua = "JohnnyMorganz/StyLua@2.6.0"
selene = "Kampfkarren/selene@0.32.0"
luau-lsp = "JohnnyMorganz/luau-lsp@1.70.1"
```

Versiones = últimos tags estables vistos en GitHub en nov 2026. Deja que `rokit add` escriba la versión real; no copies estas a ciegas.

## stylua.toml

```toml
syntax = "Luau"
indent_type = "Tabs"
column_width = 120
```

`syntax = "Luau"` evita que StyLua confunda `x :: tipo` con etiquetas de Lua 5.2.

## selene.toml

```toml
std = "roblox"
```

La primera corrida genera el estándar de Roblox automáticamente; se actualiza solo.

## .luaurc (modo estricto por defecto)

```json
{
  "languageMode": "strict"
}
```

Igual pon `--!strict` en la primera línea de cada archivo: Studio no lee `.luaurc`.

## .gitignore mínimo

```
sourcemap.json
Packages/
*.rbxl
*.rbxl.lock
*.rbxlx.lock
```

No commitees el `.rbxl` si el mapa vive en Roblox: la fuente de verdad del mapa es el place publicado.

## wally.toml

```toml
[package]
name = "usuario/mi-juego"
version = "0.1.0"
registry = "https://github.com/UpliftGames/wally-index"
realm = "shared"

[dependencies]
# Verifica cada paquete en https://wally.run antes de agregarlo
```
