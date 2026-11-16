"""Ejemplo/plantilla: árbol low-poly con colores por vértice, listo para Roblox.

Correr (sin abrir la interfaz):
  blender --background --factory-startup --python ejemplo_arbol.py -- salida/arbol
Genera salida/arbol.blend, salida/arbol.fbx y salida/arbol.glb.
Unidades: 1 unidad de Blender = 1 stud en Roblox (Unit System = None).
Para un asset nuevo copia este archivo y cambia solo la sección MODELO.
"""
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = os.path.abspath(argv[0] if argv else "arbol")
os.makedirs(os.path.dirname(out), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'NONE'
LIMITE_TRIS = 20000  # límite por malla de Roblox (verifícalo en la doc)

PALETA = {  # colores sRGB 0-1; reutiliza la paleta del juego
    "tronco": (0.36, 0.22, 0.12, 1.0),
    "hojas": (0.24, 0.62, 0.28, 1.0),
}


def pintar(obj, rgba):
    """Pinta toda la malla de un color (atributo de color por esquina)."""
    me = obj.data
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", 'BYTE_COLOR', 'CORNER')
    for d in attr.data:
        d.color = rgba
    me.color_attributes.active_color = attr


def unir(objs, nombre):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = nombre
    return o


# ---------------- MODELO (cambia esto) ----------------
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.6, depth=4, location=(0, 0, 2))
tronco = bpy.context.object
pintar(tronco, PALETA["tronco"])
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=2.5, location=(0, 0, 5.5))
copa = bpy.context.object
pintar(copa, PALETA["hojas"])
asset = unir([tronco, copa], "Arbol")
# -------------------------------------------------------

# Estilo low-poly: caras planas
for p in asset.data.polygons:
    p.use_smooth = False
# Origen en la base (para que se pare en el suelo en Studio) y transformaciones aplicadas
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

tris = sum(len(p.vertices) - 2 for p in asset.data.polygons)
dims = tuple(round(v, 2) for v in asset.dimensions)
print(f"REPORTE {asset.name}: {tris} triángulos, medidas {dims} studs (X, Y, Z-arriba)")
if tris > LIMITE_TRIS:
    sys.exit(f"ERROR: {tris} triángulos > {LIMITE_TRIS}. Reduce o divide la malla.")

bpy.ops.object.select_all(action='DESELECT')
asset.select_set(True)
bpy.ops.export_scene.fbx(
    filepath=out + ".fbx", use_selection=True,
    apply_scale_options='FBX_SCALE_UNITS', axis_forward='Z', axis_up='Y',
    mesh_smooth_type='FACE', colors_type='SRGB',
    path_mode='COPY', embed_textures=True, add_leaf_bones=False, bake_anim=False)
bpy.ops.export_scene.gltf(filepath=out + ".glb", export_format='GLB', use_selection=True,
                          export_vertex_color='ACTIVE')  # si no, con material puede omitir COLOR_0
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend")
print(f"REPORTE exportado: {out}.fbx, {out}.glb, {out}.blend")
