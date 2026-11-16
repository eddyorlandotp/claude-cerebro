# Formato .tscn (Godot 4.x) para editar a mano

Resumen de https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html (nov 2026). Léelo antes de tocar un `.tscn` o `.tres`. Si el cambio no es trivial, pide al usuario hacerlo en el editor.

## Secciones, en este orden

1. Descriptor: `[gd_scene format=3 uid="uid://..."]` (primera línea). Godot 4 usa `format=3`. Escenas guardadas antes de 4.6 traen `load_steps=N`: está deprecado, ignóralo; no lo agregues.
2. Recursos externos: `[ext_resource type="Script" uid="uid://..." path="res://jugador.gd" id="1_abcd"]`
3. Recursos internos: `[sub_resource type="CircleShape2D" id="CircleShape2D_x1y2"]` + propiedades debajo.
4. Nodos: `[node name="..." type="..." parent="..."]` + propiedades debajo.
5. Conexiones de señales (si las hay).

Comentarios con `;` se pierden al guardar desde el editor. Propiedades con valor por defecto no se escriben (si las escribes, el editor las borra al guardar: es normal).

## Nodos

```
[node name="Jugador" type="CharacterBody2D"]                         ; raíz: SIN parent
script = ExtResource("1_abcd")

[node name="Colision" type="CollisionShape2D" parent="."]            ; hijo directo de la raíz
shape = SubResource("CircleShape2D_x1y2")

[node name="Sprite" type="AnimatedSprite2D" parent="."]

[node name="Arma" type="Node2D" parent="Sprite"]                     ; nieto: ruta sin el nombre de la raíz
```

- Exactamente **un** nodo sin `parent` (la raíz). Si hay cero o dos, la escena no carga.
- `parent` es la ruta desde la raíz sin incluirla: `"."`, `"Sprite"`, `"Sprite/Arma"`.
- Escenas guardadas con 4.6+ tienen `unique_id=<número>` en cada nodo. Al agregar un nodo a mano puedes omitirlo; no copies el de otro nodo.
- Instanciar otra escena: primero un `ext_resource type="PackedScene"`, luego `[node name="Enemigo" parent="." instance=ExtResource("2_efgh")]` (sin `type`).
- Otros atributos válidos: `groups=["enemigos"]`, `index`, `owner`, `node_paths=PackedStringArray("propiedad")`.

## Referencias

- `ExtResource("id")` apunta a un `ext_resource` del mismo archivo; `SubResource("id")` a un `sub_resource`.
- Los `id` son strings únicos dentro del archivo. Para uno nuevo usa un sufijo inventado que no exista (`"3_nuevo"`), sin tocar los existentes.
- `uid://...` identifica archivos aunque se muevan. **Nunca** inventes uno: si agregas un `ext_resource` nuevo, deja solo `path="res://..."`; Godot agregará el uid al guardar.
- `NodePath("Ruta/Al/Nodo")` es relativo al nodo actual; `NodePath("..")` es el padre.

## Tipos de valores comunes

`Vector2(1, 2)`, `Vector3(1, 2, 3)`, `Color(1, 0.5, 0, 1)`, `Transform3D(...)`, `PackedStringArray("a", "b")`, `ExtResource("1_abcd")`, `SubResource("Tipo_id")`, strings con comillas dobles.

## Antes y después de editar

1. Pide al usuario cerrar esa escena en el editor (o Godot completo).
2. Edita.
3. Corre `godot --headless --path . --import` y revisa errores.
4. Pide al usuario abrir la escena: si Godot pregunta por recargar o muestra warnings de UID, que guarde la escena (Ctrl+S) para que Godot normalice el archivo.
5. `git diff` del `.tscn` para confirmar que solo cambió lo que querías.
