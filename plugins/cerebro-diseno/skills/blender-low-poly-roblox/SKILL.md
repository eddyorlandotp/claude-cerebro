---
name: blender-low-poly-roblox
description: Modelar assets low-poly para Roblox con scripts de Blender sin interfaz (blender --background), revisar triángulos y medidas, colores por vértice o paleta, exportar FBX/glTF a escala e importar en Studio. Usa al decir Blender, mesh, modelo 3D.
---

# Blender low-poly para Roblox, por script

Claude Code no puede mover el mouse en Blender, pero **sí** puede escribir un script de Python, correr Blender sin ventana, revisar el resultado y renderizar una vista previa PNG para mirarla. El error que corrige esta skill: Claude escribe un `.py` de Blender "de memoria", no lo corre, exporta con escala/ejes al azar y entrega un FBX que en Studio sale gigante, acostado o negro.

## Reglas

1. **Todo asset sale de un script versionado** (`assets/scripts/<asset>.py`), nunca de pasos manuales que no se puedan repetir. Para cambiar un modelo se edita el script y se vuelve a correr.
2. **Corre siempre así** (sin `--python-exit-code`, Blender sale con código 0 aunque el script truene; probado en Blender 5.3):
   ```bash
   blender --background --factory-startup --python-exit-code 1 --python assets/scripts/arbol.py -- assets/out/arbol
   ```
   Lo que va después de `--` le llega al script en `sys.argv`. `--factory-startup` evita que la configuración personal del usuario cambie el resultado.
3. **No declares un modelo terminado sin**: (a) el reporte de triángulos y medidas, (b) la vista previa PNG renderizada **y mirada por ti** con la herramienta de leer imágenes, (c) decirle al usuario qué revisar en Studio.
4. **Verifica antes de confiar**: la API `bpy` cambia entre versiones (p. ej. el exportador OBJ ahora es `bpy.ops.wm.obj_export`, los colores son `color_attributes`). Antes de usar un operador que no esté en los scripts de esta skill, consulta la doc de la versión instalada (`blender --version`) en docs.blender.org/api/current o con Context7, o prueba en un script mínimo.
5. Explica al usuario en 1–3 frases qué vas a modelar y con qué estilo antes de empezar ("Árbol de 40 triángulos, tronco hexagonal y copa de icosaedro, colores planos").

## Instalar y comprobar (CachyOS/Arch)

```bash
sudo pacman -S --needed blender     # a nov 2026 el repo extra trae Blender 5.3
blender --version
```
Si no hay Blender, dilo y no escribas scripts sin poder correrlos.

## Scripts de esta skill (probados con Blender 5.3.0)

Están en `${CLAUDE_SKILL_DIR}/scripts/`:

- `scripts/ejemplo_arbol.py` — plantilla completa: escena con `Unit System = None`, modelo con colores por vértice, caras planas, origen en la base, transformaciones aplicadas, chequeo de 20k triángulos y exportación a `.fbx` + `.glb` + `.blend`. **Copia este archivo para cada asset nuevo y cambia solo la sección MODELO.**
- `scripts/ejemplo_paleta_atlas.py` — varios colores en una malla usando una textura-paleta de 64×64 (16 colores) y UVs apuntando al centro de cada cuadro. Exporta FBX con la textura embebida.
- `scripts/revisar_y_previa.py` — abre `.blend/.fbx/.glb/.obj`, imprime por malla triángulos, medidas, aristas abiertas y caras de área cero, y renderiza `-frente.png` y `-34.png` (Workbench, 512 px) con encuadre automático.

```bash
S="${CLAUDE_SKILL_DIR}/scripts"
blender -b --factory-startup --python-exit-code 1 --python assets/scripts/arbol.py -- assets/out/arbol
blender -b --factory-startup --python-exit-code 1 --python $S/revisar_y_previa.py -- assets/out/arbol.fbx assets/out/previa/arbol
```
Revisa el FBX exportado (no solo el `.blend`): así compruebas lo que de verdad va a Studio.

## Límites de Roblox para mallas (a nov 2026 — verifícalos en create.roblox.com/docs/art/modeling/specifications)

| Regla | Valor / detalle |
|---|---|
| Triángulos por malla | **20,000** máximo. Para low-poly apunta a decenas o cientos por prop |
| Geometría | Cerrada (watertight), sin caras de grosor cero, quads cuando se pueda, sin N-gons |
| Materiales | **Un material por malla** (si necesitas varios colores: colores por vértice o paleta) |
| Textura | Doc: hasta 1024×1024 para mapas UV (otra parte dice 4096). Guía: 256 px para objetos de 5×5 studs, 512 para 10×10, 1024 para 20×20 |
| UVs | Un solo set de UV, dentro de 0–1; se permiten traslapes |
| Formatos | `.fbx`, `.obj`, `.gltf/.glb`. La doc lista colores por vértice, varias mallas y jerarquía para **FBX y glTF**; no lo garantiza para OBJ |
| Tamaño | Los foros reportan tope de 2048 studs por eje en partes; no lo encontré en la doc oficial. Divide mapas grandes en piezas |
| Nombres reservados | Mallas que terminan en `_Att`, `_InnerCage`, `_OuterCage` se convierten en otros objetos al importar: no nombres así un prop |

## Escala y ejes (lo que más falla)

- En Blender: Scene > Units > **Unit System = None** (lo hace la plantilla). Trabaja con **1 unidad de Blender = 1 stud**. Referencia de la doc: 1 stud = 28 cm.
- FBX (recomendado por Roblox): `apply_scale_options='FBX_SCALE_UNITS'`, `axis_forward='Z'`, `axis_up='Y'`, `path_mode='COPY'`, `embed_textures=True`, `add_leaf_bones=False`, `bake_anim=False` (salvo animación).
- glTF/GLB: según la doc de Roblox no necesita ajustes de escala. En Blender 5.x pasa `export_vertex_color='ACTIVE'`: el valor por defecto (`MATERIAL`) puede omitir los colores si la malla tiene un material que no los usa.
- **Calibra una vez por proyecto**: exporta un cubo de 4×4×4 unidades, impórtalo y pide al usuario que confirme en Studio que el `Size` del MeshPart diga `4, 4, 4` y que no salga acostado. Anota el resultado en las notas del proyecto. No adivines factores de escala.
- Pon el **origen en la base** del objeto y aplica transformaciones (`transform_apply`) antes de exportar.

## Color: por vértice vs paleta (atlas)

| | Colores por vértice | Textura-paleta (atlas) |
|---|---|---|
| Cómo | Atributo de color `BYTE_COLOR` por esquina (`color_attributes`) | Una imagen chica de cuadros de color; UVs al centro del cuadro; interpolación `Closest` |
| Ventaja | Sin archivos extra; ideal para estilo bloque/flat | Cambias colores editando un PNG; muchos assets comparten una sola textura |
| Riesgo | Si el importador o el juego no los muestra, sale todo blanco o negro | Un píxel mal puesto mezcla colores en los bordes: usa cuadros de 16 px y UVs en el centro |
| Studio | 3D Importer tiene la opción **Ignore Vertex Colors** (apagada por defecto) | Se sube con la malla si va embebida en el FBX |

Empieza con colores por vértice para props sencillos. Si en Studio se ven mal, prueba la paleta. Cómo combina Roblox los colores por vértice con `MeshPart.Color`/`TextureID` no lo pude confirmar en la doc oficial: pruébalo con un asset y que el usuario lo mire.

Estilo low-poly que se lee bien en Roblox: caras planas (`use_smooth = False`), pocas piezas grandes, siluetas claras, 4–6 colores por asset sacados de una sola paleta del juego, bisel solo si se ve a distancia.

## Lo que hace el usuario a mano en Roblox Studio

Claude no puede manejar Studio (en Linux corre con Vinegar; ver `roblox-en-linux-con-rojo` de `cerebro-juegos`). Dale estos pasos exactos:

1. **File > Import** y elige el `.fbx` o `.glb` (el 3D Importer muestra vista previa y marca errores).
2. Ajustes: **Import Only As Model** encendido si son varias piezas; **Upload to Roblox** encendido para tener asset ID; **World Forward = Front**, **World Up = Top**, **Scale Unit = Studs**; **Anchored** encendido para escenografía; **Merge Meshes** solo si quieres una sola pieza.
3. Si el modelo sale negro o blanco, reimporta probando **Ignore Vertex Colors** y avísale a Claude qué pasó.
4. En cada MeshPart: `CollisionFidelity` = **Box** para props chicos o decorativos, **Hull** para formas convexas, **Default** si tiene huecos donde el jugador entra; **PreciseConvexDecomposition** solo si es indispensable (es la más cara). `RenderFidelity` en Automatic.
5. Muchos assets a la vez: **Asset Manager** (importación en lote), que no acepta mallas con rig, skinning o animación.
6. Que te mande una captura o el `Size` que muestra Studio para comparar con el reporte del script.

## Errores comunes

- Exportar con `Scale` en 0.01 **y** FBX Unit Scale a la vez: escala doble. Usa solo FBX Unit Scale.
- Olvidar `transform_apply`: el objeto entra rotado o escalado raro.
- Unir piezas con `join` y dejar normales invertidas: el reporte no lo detecta; mira la previa (caras oscuras o faltantes) y usa `bpy.ops.mesh.normals_make_consistent()` en modo edición.
- Revisar aristas abiertas en un `.glb` sin fusionar vértices: el script ya fusiona en una copia, porque glTF separa vértices por cara plana.
- Personajes con rig (R15) y ropa por capas tienen reglas aparte (cages, huesos): esta skill no las cubre; lee la doc de avatares antes.

## Al terminar

Entrega: ruta del `.fbx`/`.glb`, el reporte (triángulos, medidas en studs, problemas=0), las vistas previas PNG y los pasos de Studio de arriba. Dile cómo comprobarlo él mismo: "en Studio, selecciona la pieza y mira que Size coincida con las medidas del reporte".

## Fuentes (verificado nov 2026)

- https://create.roblox.com/docs/art/modeling/specifications (20,000 triángulos, watertight, quads)
- https://create.roblox.com/docs/art/modeling/texture-specifications (un material, UVs 0–1, tamaños de textura)
- https://create.roblox.com/docs/art/modeling/export-requirements (opciones de FBX)
- https://create.roblox.com/docs/art/blender (Unit System None, FBX Unit Scale, Z Forward / Y Up, glTF sin ajuste)
- https://create.roblox.com/docs/art/modeling/3d-importer (formatos, ajustes, Ignore Vertex Colors)
- https://create.roblox.com/docs/parts/meshes (CollisionFidelity, RenderFidelity, Asset Manager, sufijos reservados)
- https://create.roblox.com/docs/physics/units (1 stud = 28 cm)
- https://download.blender.org/release/ y paquete `blender` 5.3.0 en archlinux.org (versión)
- Scripts probados aquí con Blender 5.3.0 en modo background: exportación FBX/GLB, reimportación, colores por vértice y paleta conservados.
