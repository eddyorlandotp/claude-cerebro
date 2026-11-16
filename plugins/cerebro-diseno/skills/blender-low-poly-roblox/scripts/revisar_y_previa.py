"""Revisa un asset y renderiza vistas previas PNG para que Claude las mire.

Uso:
  blender --background --factory-startup --python revisar_y_previa.py -- modelo.(blend|fbx|glb|obj) salida_prefijo
Imprime por malla: triángulos, medidas, aristas abiertas (no watertight) y caras
de área cero; y escribe <prefijo>-frente.png y <prefijo>-34.png (512x512, Workbench).
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, prefijo = os.path.abspath(argv[0]), os.path.abspath(argv[1])
ext = os.path.splitext(src)[1].lower()
if ext == ".blend":
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    {".fbx": lambda: bpy.ops.import_scene.fbx(filepath=src),
     ".glb": lambda: bpy.ops.import_scene.gltf(filepath=src),
     ".gltf": lambda: bpy.ops.import_scene.gltf(filepath=src),
     ".obj": lambda: bpy.ops.wm.obj_import(filepath=src)}[ext]()

sc = bpy.context.scene
mallas = [o for o in sc.objects if o.type == 'MESH']
problemas = 0
for o in mallas:
    bm = bmesh.new(); bm.from_mesh(o.data)
    # glTF/flat shading separa vértices por cara: se fusionan solo en esta copia para revisar
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    abiertas = sum(1 for e in bm.edges if not e.is_manifold)
    cero = sum(1 for f in bm.faces if f.calc_area() < 1e-8)
    bm.free()
    d = tuple(round(v, 2) for v in o.dimensions)
    aviso = []
    if tris > 20000: aviso.append("PASA 20k TRIS")
    if abiertas: aviso.append(f"{abiertas} aristas abiertas")
    if cero: aviso.append(f"{cero} caras de área cero")
    problemas += len(aviso)
    print(f"REPORTE {o.name}: {tris} tris, medidas {d}, colores={len(o.data.color_attributes)} "
          f"materiales={len(o.data.materials)} {'; '.join(aviso) or 'ok'}")

# Encuadre automático
pts = [o.matrix_world @ Vector(c) for o in mallas for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centro, tam = (mn + mx) / 2, max((mx - mn).length, 0.01)
objetivo = bpy.data.objects.new("Objetivo", None); sc.collection.objects.link(objetivo)
objetivo.location = centro
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); sc.collection.objects.link(cam)
cam.data.lens = 50
c = cam.constraints.new('TRACK_TO'); c.target = objetivo
c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
sc.camera = cam
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
con_textura = any(n.type == 'TEX_IMAGE' and n.image for o in mallas for m in o.data.materials if m and m.node_tree
                  for n in m.node_tree.nodes)
sc.display.shading.color_type = ('VERTEX' if any(o.data.color_attributes for o in mallas)
                                 else 'TEXTURE' if con_textura else 'MATERIAL')
print(f"REPORTE color de la previa: {sc.display.shading.color_type}")
sc.render.resolution_x = sc.render.resolution_y = 512
dist = tam * 1.6
for nombre, direccion in (("frente", Vector((0, -1, 0.25))), ("34", Vector((1, -1, 0.8)))):
    cam.location = centro + direccion.normalized() * dist
    sc.render.filepath = f"{prefijo}-{nombre}.png"
    bpy.ops.render.render(write_still=True)
    print(f"REPORTE previa: {prefijo}-{nombre}.png")
print(f"REPORTE problemas={problemas}")
