"""Ejemplo: varios colores en UNA malla con una textura-paleta (atlas de colores planos).

Usa esto en vez de colores por vértice cuando quieras cambiar colores editando un PNG,
o compartir la misma paleta (una sola textura) entre muchos assets del juego.
Correr:
  blender --background --factory-startup --python-exit-code 1 --python ejemplo_paleta_atlas.py -- salida/casa
Genera salida/casa.fbx (textura embebida), salida/casa.blend y salida/casa-paleta.png.
"""
import os
import bpy, bmesh, sys
out = os.path.abspath(sys.argv[sys.argv.index("--")+1]); os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'NONE'
# Paleta 4x4 (16 colores) como imagen de 64x64; cada color ocupa 16x16 px
PALETA = ["#5b3a1e","#3d9e47","#e8c547","#d94f3d","#4a7bd1","#f2f2f2","#2b2b2b","#8a5cd1",
          "#f08c2e","#7fd1e8","#c2c2c2","#6b8f3a","#ffb3c7","#3a2b5b","#a8743f","#1f6f5c"]
N, CEL = 4, 16
img = bpy.data.images.new("Paleta", N*CEL, N*CEL)
px = [0.0] * (N*CEL*N*CEL*4)
for i, hx in enumerate(PALETA):
    r, g, b = (int(hx[k:k+2], 16)/255 for k in (1, 3, 5))
    cx, cy = i % N, N - 1 - i // N   # fila 0 arriba
    for y in range(cy*CEL, (cy+1)*CEL):
        for x in range(cx*CEL, (cx+1)*CEL):
            j = (y*N*CEL + x)*4; px[j:j+4] = (r, g, b, 1)
img.pixels = px
img.filepath_raw = out + "-paleta.png"; img.file_format = 'PNG'; img.save()
mat = bpy.data.materials.new("Paleta")
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = 'Closest'
nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
def uv_color(obj, indice):
    """Manda todas las caras de obj al centro del cuadro `indice` de la paleta."""
    u = ((indice % N) + 0.5) / N; v = 1 - ((indice // N) + 0.5) / N
    bm = bmesh.new(); bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops: l[uv].uv = (u, v)
    bm.to_mesh(obj.data); bm.free()
    obj.data.materials.clear(); obj.data.materials.append(mat)
bpy.ops.mesh.primitive_cube_add(size=4, location=(0,0,2)); caja = bpy.context.object; uv_color(caja, 3)
bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=3, depth=3, location=(0,0,5.5)); techo = bpy.context.object; uv_color(techo, 4)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = caja; bpy.ops.object.join()
casa = bpy.context.object; casa.name = "Casa"
print("REPORTE materiales", len(casa.data.materials))
bpy.ops.export_scene.fbx(filepath=out+".fbx", use_selection=True, apply_scale_options='FBX_SCALE_UNITS', axis_forward='Z', axis_up='Y', mesh_smooth_type='FACE', path_mode='COPY', embed_textures=True, add_leaf_bones=False, bake_anim=False)
bpy.ops.wm.save_as_mainfile(filepath=out+".blend")
print("REPORTE ok")
