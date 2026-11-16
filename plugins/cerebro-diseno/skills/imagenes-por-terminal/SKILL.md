---
name: imagenes-por-terminal
description: Editar imágenes por comandos con ImageMagick 7 (magick) - redimensionar, recortar, WebP/AVIF, quitar EXIF y GPS antes de publicar, sprites/atlas, lotes y optimizar para web. Usa al decir imagen, foto, resize, webp, comprimir, metadatos.
---

# Imágenes por terminal (ImageMagick 7 + exiftool)

El error que corrige: Claude mezcla sintaxis de ImageMagick 6 y 7, sobrescribe originales con `mogrify`, "limpia" metadatos y deja la foto acostada o con el GPS todavía dentro, y nunca comprueba el resultado (tamaño, peso, que se vea bien).

## Reglas

1. **Nunca toques los originales.** Trabaja de `originales/` a `salida/` (o la carpeta que diga el usuario). `mogrify` sin `-path` **sobrescribe**: siempre con `-path salida/`.
2. **Después de cada lote, comprueba**: `magick identify -format "%f %wx%h %b\n" salida/*` (medidas y peso) y abre 1–2 resultados con la herramienta de leer imágenes. Para privacidad, confirma con `exiftool` que no quedó GPS.
3. **Detecta la versión antes de escribir comandos**: `magick -version` (IM7) o `convert -version` (IM6). En IM7 usa `magick`, `magick identify`, `magick mogrify`, `magick montage`; **no** uses `magick convert`. En IM6 (Ubuntu/Debian viejos) son `convert`, `identify`, etc.
4. **Pon los comandos largos en un script `.sh`** y córrelo con `bash`. El usuario usa fish: en fish `( )` es sustitución de comandos y rompe los paréntesis de ImageMagick. Cita siempre geometrías con `^`, `>` o `!` (`'1280x720^'`).
5. **Verifica antes de confiar**: si usas una opción que no está aquí, revisa https://imagemagick.org/script/command-line-options.php o pruébala con una imagen generada (`magick -size 800x600 plasma: prueba.png`) antes de correrla sobre fotos reales.
6. Dile al usuario en 1–2 frases qué hiciste y cuánto pesaba antes y después.

## Instalar y comprobar (CachyOS/Arch)

En Arch muchos formatos de ImageMagick son dependencias **opcionales**: sin ellas no lee JPG ni escribe WebP/AVIF.
```bash
sudo pacman -S --needed imagemagick libjpeg-turbo libwebp libheif librsvg perl-image-exiftool libavif
magick -list format | grep -E "^ *(JPEG|WEBP|AVIF|HEIC|SVG)"   # la columna debe decir rw (lee y escribe)
```
Si AVIF sale solo `r--`, usa `avifenc` (paquete `libavif`), como se muestra abajo.

## Recetas probadas

Probadas aquí con ImageMagick 6.9 (`convert`), exiftool 12, cwebp 1.3 y avifenc 1.0, con imágenes generadas. La sintaxis de estas opciones es la misma en IM7 cambiando `convert` → `magick`.

**Información**
```bash
magick identify -format "%f %wx%h %m %b\n" foto.jpg
exiftool -s -GPSPosition -Model -Orientation -DateTimeOriginal foto.jpg
```

**Redimensionar**
```bash
magick in.jpg -resize 1200x out.jpg                 # 1200 de ancho, alto proporcional
magick in.jpg -resize '1920x1080>' out.jpg          # solo achica si es más grande (nunca agranda)
magick in.jpg -resize '1280x720^' -gravity center -extent 1280x720 out.jpg   # llena y recorta al centro
magick in.png -filter point -resize 400% out.png    # pixel art sin difuminar (igual que -scale 400%)
```

**Recortar**
```bash
magick in.jpg -crop 800x450+100+50 +repage out.jpg  # ancho x alto + x + y; +repage limpia el lienzo virtual
magick in.png -trim +repage out.png                 # quita bordes del color/transparencia de fondo
```

**Privacidad: quitar EXIF y GPS antes de publicar**
```bash
magick foto.jpg -auto-orient -strip limpia.jpg      # primero endereza, luego borra metadatos
exiftool -s -GPS:all -Model limpia.jpg              # no debe imprimir nada
```
- **Trampa probada**: `exiftool -all= foto.jpg` borra también la etiqueta de orientación **sin rotar los pixeles**: la foto del celular queda acostada. Si usas exiftool, endereza antes con `magick -auto-orient`.
- `-strip` vuelve a codificar el JPG (pierde algo de calidad). Para no recodificar: `exiftool -all= -o limpia.jpg foto.jpg` sobre una foto ya enderezada.
- Fotos del celular, capturas con datos de la billetera o del perfil: revisa también lo que **se ve** (nombres, saldos, ubicación en el fondo), no solo el EXIF.

**WebP y AVIF para web**
```bash
magick in.jpg -strip -resize 1600x -quality 80 -define webp:method=6 out.webp   # fotos
magick sprite.png -define webp:lossless=true out.webp                            # UI, pixel art, logos
avifenc -q 60 -s 6 in.png out.avif                  # AVIF si magick no lo escribe (q 0-100, s 0-10 = lento-rápido)
```
- En WebP, `-quality 100` activa **sin pérdida** (archivo mucho más grande). Para "casi perfecto" usa 90.
- Sin pérdida conserva exacto solo imágenes de 8 bits; un PNG de 16 bits cambia mínimamente (invisible).
- Qué formato: WebP para todo en web (soporte universal); AVIF pesa menos en fotos grandes pero codifica lento; PNG solo para fuentes editables y pixel art; JPG para subir a redes que no aceptan WebP (X, YouTube, Roblox).

**Tamaños responsivos para web**
```bash
for w in 480 960 1440; do magick in.jpg -resize ${w}x -strip -quality 80 out-$w.webp; done
```
Y en HTML `<img src="out-960.webp" srcset="out-480.webp 480w, out-960.webp 960w, out-1440.webp 1440w" sizes="(max-width: 600px) 100vw, 960px" width="960" height="..." alt="...">` con `width`/`height` reales para que no salte el layout.

**Sprites y atlas**
```bash
magick montage frames/*.png -tile 4x -geometry +0+0 -background none sheet.png   # hoja 4 columnas, sin espacio
magick a.png b.png c.png +append tira.png           # en fila (horizontal)
magick a.png b.png -append columna.png              # en columna (vertical)
```
- Todos los cuadros del mismo tamaño; nombra con ceros (`f00.png`, `f01.png`) para que el orden sea correcto.
- `-background none` conserva la transparencia. Anota en un JSON el tamaño de cuadro y el orden para quien programe la animación.

**Hoja de revisión (para que tú y el usuario vean muchas a la vez)**
```bash
magick montage salida/*.png -tile 4x -geometry 256x256+8+8 -label '%f' -background '#222' -fill white revision.png
```

**Lotes**
```bash
mkdir -p salida && magick mogrify -path salida -resize '1600x>' -strip -quality 80 -format webp originales/*.jpg
```

**Logo o marca de agua en esquina**
```bash
magick foto.jpg \( logo.png -resize 120x120 \) -gravity southeast -geometry +24+24 -composite foto-marca.jpg
```

**Íconos y avatares**: `favicon.ico` multi-tamaño, avatar redondo y exportación de SVG están resueltos en `exportar_logo.sh` de la skill `branding-y-logos`.

## Errores comunes

- `convert identify ...` o `magick convert`: en IM6 `convert identify` toma "identify" como archivo de entrada y escribe archivos basura. Usa `identify` / `magick identify`.
- En IM7 las operaciones van **después** de la imagen de entrada (`magick in.jpg -resize ...`), no antes.
- `plasma:fire` no existe: para imágenes de prueba usa `plasma:red-yellow`, `gradient:red-blue` o `xc:white`.
- Usar `-resize 1280x720` esperando tamaño exacto: conserva proporción. Exacto con recorte = `^` + `-extent`; exacto deformando = `!` (casi nunca lo quieres).
- Texto con `-annotate`: elige una fuente que exista (`magick -list font | grep -i dejavu`) y prueba con ñ y acentos.
- Para video y GIF animados usa `video-ffmpeg-y-clipping` de `cerebro-negocio`, no ImageMagick.

## Al terminar

Reporta: archivos generados, medidas, peso antes → después, y si se quitaron metadatos, la salida vacía de `exiftool -GPS:all`. Dile cómo comprobarlo él: "abre la imagen en el visor y revisa propiedades: no debe decir ubicación".

## Fuentes (verificado nov 2026)

- https://imagemagick.org/porting/ (IM7: `magick`, no usar `magick convert`, orden estricto de opciones; versión estable 7.1.2-35)
- https://imagemagick.org/webp/ (defines de WebP; quality 100 = sin pérdida)
- https://imagemagick.org/script/command-line-options.php (referencia de opciones)
- https://exiftool.org/ (exiftool)
- Paquetes de Arch consultados en archlinux.org (API JSON): imagemagick 7.1.2.35 con libwebp, libheif, libjpeg-turbo y librsvg como dependencias opcionales; perl-image-exiftool; libavif.
- Recetas probadas aquí con ImageMagick 6.9.12 y exiftool sobre imágenes generadas (incluida la trampa de orientación).
