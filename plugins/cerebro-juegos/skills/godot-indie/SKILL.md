---
name: godot-indie
description: Hacer un juego indie en Godot 4 desde Linux con Claude Code - estructura de proyecto, GDScript tipado, escenas, nodos, señales, autoloads, guardado, exportar a Windows y Linux, editar .gd y .tscn sin romperlos, git con .gitignore correcto. Usar al crear o modificar un proyecto Godot.
---

# Godot indie desde Linux

El usuario hará un juego para Steam con Godot en CachyOS. No programa: tú escribes el GDScript y él usa el editor de Godot para ver, mover cosas y probar. Para lanzamiento ve `steam-lanzamiento`; para diseño, `diseno-de-juegos-y-retencion`.

## Regla 0: verifica antes de confiar

- Antes de usar una clase o método, confírmalo en `https://docs.godotengine.org/en/stable/classes/class_<nombre>.html` (o Context7). Godot 3 y Godot 4 son muy distintos; mucho código en internet es de Godot 3 (`yield`, `KinematicBody`, `export var`, `connect("señal", self, "metodo")`): no lo uses.
- Revisa la versión del proyecto en `project.godot` (`config/features`) y la del editor (`godot --version`) antes de escribir código.
- No digas "funciona" sin que el usuario lo haya corrido (F5) o sin un chequeo por línea de comandos (abajo).

## Por qué Godot en Linux

- Editor nativo para Linux, gratis y open source (MIT), sin regalías: nada que pagar al vender en Steam.
- A nov 2026 la versión estable es **Godot 4.7.2** (18 ago 2026). Verifícalo en https://godotengine.org/download/linux/ antes de recomendar versión.
- Usa la versión **estándar** (GDScript). La versión .NET (C#) requiere el SDK de .NET y las versiones de tiendas digitales (Steam/itch) no incluyen C#. Para este usuario: GDScript.
- Exporta a Windows y Linux desde Linux con las export templates oficiales; no hace falta Windows.

## Estructura de proyecto

```
mi-juego/
  project.godot
  export_presets.cfg        # se commitea (desde 4.1 las credenciales van aparte)
  autoload/                 # singletons: Juego.gd, Guardado.gd, Audio.gd
  escenas/
    jugador/jugador.tscn + jugador.gd
    enemigos/...
    ui/...
    niveles/nivel_01.tscn
  recursos/                 # .tres (datos: stats, items)
  arte/  audio/  fuentes/
  build/                    # salida de exportación (ignorada en git)
```

- Una carpeta por "cosa" con su escena y su script juntos.
- Nombres de archivos en `snake_case`; clases en `PascalCase` con `class_name`.
- Datos de diseño (stats de enemigos, items) como `Resource` personalizados (`class_name ItemData extends Resource`) en `.tres`, para que el usuario los ajuste en el Inspector sin tocar código.

## GDScript tipado (siempre)

```gdscript
class_name Jugador
extends CharacterBody2D

signal vida_cambio(nueva: int)

@export var velocidad: float = 200.0
@export var vida_max: int = 5

var vida: int
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func _ready() -> void:
	vida = vida_max

func _physics_process(delta: float) -> void:
	var dir := Input.get_vector("izquierda", "derecha", "arriba", "abajo")
	velocity = dir * velocidad
	move_and_slide()

func recibir_dano(cantidad: int) -> void:
	vida = max(vida - cantidad, 0)
	vida_cambio.emit(vida)
```

- Tipa variables, parámetros y retornos; usa `:=` cuando el tipo se infiere claro.
- Activa en Project Settings (con **Advanced Settings** encendido) → Debug → GDScript los warnings `UNTYPED_DECLARATION` (y opcionalmente `INFERRED_DECLARATION`) para que el editor marque lo no tipado.
- Indentación con **tabs** (estándar de Godot). No mezcles con espacios.
- Las acciones de input (`"izquierda"`, etc.) deben existir en Project Settings → Input Map; si las creas tú, agrégalas en `project.godot` o pide al usuario crearlas.

## Escenas, nodos y señales

- Una escena = un árbol de nodos reutilizable. El jugador, un enemigo, una moneda, el HUD: cada uno su escena.
- **Llama hacia abajo, señales hacia arriba:** un nodo padre llama métodos de sus hijos; un hijo avisa a su padre con una señal. Evita `get_parent().get_parent()`.
- Conecta señales **en código** (`boton.pressed.connect(_on_boton_pressed)`, `jugador.vida_cambio.connect(_on_vida_cambio)`) en vez de en el `.tscn`: es más fácil de leer y de editar para ti.
- Grupos (`add_to_group("enemigos")`, `get_tree().get_nodes_in_group(...)`) para "todos los X".
- `@onready var x = $Ruta` solo para hijos de la propia escena. Para nodos marcados como Unique Name en el editor, `%Nombre`.

## Autoloads (singletons)

Project → Project Settings → Globals → Autoload. Úsalos para estado global: `Juego` (estado de la partida), `Guardado` (save/load), `Audio`.
- Pocos y con responsabilidad clara. No metas lógica de un nivel en un autoload.
- Si los registras tú, edita la sección `[autoload]` de `project.godot` con cuidado (formato `Nombre="*res://autoload/nombre.gd"`) y pide al usuario que reabra el proyecto; o pídele que lo agregue desde el menú.

## Guardado

- Guarda en `user://` (en Linux: `~/.local/share/godot/app_userdata/<nombre del proyecto>`, o `~/.local/share/<nombre>` si se configura un directorio propio).
- Formato: **JSON** con `FileAccess` (`JSON.stringify` / `JSON.parse_string`) o `ConfigFile` para ajustes. JSON no soporta `Vector2` directo: guarda `x` y `y` por separado.
- No uses `get_var(true)` / objetos serializados con datos que podrían venir de terceros: la doc avisa que pueden ejecutar código.
- Incluye `version` en el guardado para migrar cuando cambie el formato.
- Guarda en archivo temporal y renombra, para no corromper la partida si el juego se cierra a mitad.

## Editar archivos como Claude Code (con cuidado)

**`.gd`:** edítalos libremente; respeta tabs.

**`.tscn`/`.tres`:** formato de texto, pero frágil. Reglas (detalle en `references/formato-tscn.md`):
- Prefiere que el usuario cree/arme escenas en el editor y tú escribas los scripts. Edita `.tscn` a mano solo para cambios pequeños (una propiedad, un nodo simple).
- Pide al usuario **cerrar la escena en el editor** (o todo Godot) antes de editar su `.tscn`; si no, el editor puede sobrescribir tu cambio al guardar.
- Nunca cambies ni inventes `uid="uid://..."`. Para un recurso externo nuevo, puedes omitir el `uid` y dejar `path`; Godot lo arregla al guardar.
- Los `id` de `ext_resource`/`sub_resource` deben ser únicos dentro del archivo.
- Exactamente un nodo raíz, sin `parent`. Los demás usan `parent="."` (hijo directo) o rutas como `"Brazo/Mano"` (sin el nombre de la raíz).
- `load_steps` está deprecado desde 4.6 y `unique_id` solo existe en escenas guardadas con 4.6+: no los agregues por tu cuenta.
- Al mover/renombrar archivos fuera del editor, mueve también su `.uid` (p. ej. `jugador.gd.uid`). Mejor: pide al usuario mover archivos desde el FileSystem de Godot.

## Comprobar sin abrir el editor

```bash
godot --version
godot --headless --path . --import                     # importa recursos y sale; muestra errores de carga
godot --headless --path . --check-only --script res://escenas/jugador/jugador.gd   # solo revisa sintaxis de un script
```

Revisa la salida: cualquier `SCRIPT ERROR` o `Parse Error` se arregla antes de pedir prueba. Luego pide al usuario F5 y que te pase el panel Debugger/Output si algo falla.

## Exportar a Windows y Linux

1. El usuario instala las export templates: Editor → Manage Export Templates → descargar (deben ser de la misma versión que el editor).
2. Project → Export → agregar presets "Windows Desktop" y "Linux". El ícono del `.exe` sale del ícono del proyecto.
3. Por línea de comandos (requiere el preset ya creado):
   ```bash
   godot --headless --path . --export-release "Windows Desktop" build/windows/MiJuego.exe
   godot --headless --path . --export-release "Linux" build/linux/MiJuego.x86_64
   ```
   El nombre entre comillas debe ser exactamente el del preset en `export_presets.cfg`.
4. Probar el build de Windows: pídele a alguien con Windows o úsalo con Proton/Wine solo como prueba rápida. El build de Linux se prueba nativo.
5. Firma de código en Windows es opcional (requiere certificado; desde Linux con `osslsigncode`).
6. Para Steam: GodotSteam y SteamPipe en `steam-lanzamiento`.

## Git

Al crear el proyecto, elige **Version Control: Git** en el Project Manager (o Project → Version Control → Generate Version Control Metadata): genera `.gitignore` y `.gitattributes` correctos (fuerza finales de línea LF).

`.gitignore` mínimo según la doc (Godot 4.1+):
```
.godot/
*.translation
build/
```
- Commitea los `.uid`, `export_presets.cfg` y `project.godot`. No commitees `.godot/` (caché) ni los builds.
- Assets grandes (audio, texturas, modelos): considera Git LFS desde el inicio (`git lfs install`, `git lfs track "*.png"` etc.); migrar después es más difícil.
- Commit pequeño y frecuente con mensaje en español claro; antes de cambios grandes, haz commit para poder volver.

## Errores comunes que debes evitar

- Código de Godot 3 (`yield`, `onready var` sin `@`, `export var`, `KinematicBody2D`, `connect` con strings).
- Editar un `.tscn` abierto en el editor.
- Inventar UIDs o copiar UIDs de otro archivo.
- Rutas absolutas del sistema en vez de `res://` y `user://`.
- Export templates de otra versión que el editor.
- Usar `_process` para física (usa `_physics_process`) o lógica pesada cada frame sin necesidad.

## Fuentes (verificado nov 2026)

- https://godotengine.org/download/linux/ (4.7.2, 18 ago 2026)
- https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
- https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html
- https://godotengine.org/article/uid-changes-coming-to-godot-4-4/
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html
- https://docs.godotengine.org/en/stable/tutorials/io/saving_games.html · https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html · https://docs.godotengine.org/en/stable/classes/class_fileaccess.html
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html · https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html
- https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
