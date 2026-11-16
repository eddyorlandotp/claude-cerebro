# Recetas ffmpeg probadas

Todas se ejecutaron en nov 2026 (ffmpeg 6.1, x264) sobre un video de prueba generado con `lavfi`;
Arch/CachyOS trae ffmpeg 9.x (`extra/ffmpeg`), las opciones usadas existen en ambas versiones.
Variables que se repiten (pégalas tal cual en bash; en fish usa `bash -c '...'` o corre el script):

```bash
X264="-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p"
AAC="-c:a aac -b:a 160k -ar 48000"
```

`-preset veryfast` es el default. Solo si el usuario pide máxima calidad: `-preset slow -crf 18`.

## 0. Generar video de prueba (para probar sin tocar el original)

```bash
ffmpeg -y -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=40" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=40" \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -shortest prueba.mp4
```

## 1. Revisar qué es el archivo antes de tocarlo

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,color_transfer,color_primaries:format=duration -of compact entrada.mov
```
- `color_transfer=arib-std-b67` (HLG) o `smpte2084` (PQ) = video HDR del iPhone → receta 8.
- `r_frame_rate` raro (ej. `30000/1001` está bien; números extraños = frame rate variable) → fuerza `-r 30`.

## 2. Recortar un tramo

Exacto al frame (re-codifica). Probado: 5 s → 15 s da 10.000 s exactos.
```bash
ffmpeg -y -ss 00:00:05 -to 00:00:15 -i entrada.mp4 $X264 $AAC -movflags +faststart tramo.mp4
```
Rápido sin re-codificar (corta en keyframe, puede quedar ±0.1–2 s; probado: 10.1 s):
```bash
ffmpeg -y -ss 5 -to 15 -i entrada.mp4 -c copy tramo.mp4
```
Con `-ss` y `-to` ANTES de `-i`, `-to` es el tiempo absoluto del original.

## 3. Horizontal → vertical 9:16 con fondo desenfocado (no pierdes nada del cuadro)

El fondo se desenfoca a 270x480 y se vuelve a escalar: mucho más rápido que desenfocar a 1080x1920.
```bash
ffmpeg -y -i horizontal.mp4 -filter_complex \
 "[0:v]split=2[bg][fg];[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,scale=1080:1920[bg];[fg]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]" \
 -map "[v]" -map "0:a?" $X264 $AAC -movflags +faststart vertical.mp4
```
Resultado probado: 1080x1920, SAR 1:1.

## 4. Horizontal → vertical con crop centrado (llena la pantalla, pierdes los lados)

```bash
ffmpeg -y -i horizontal.mp4 -vf "crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920,setsar=1" $X264 $AAC vertical.mp4
```
Si lo importante no está al centro, mueve el recorte en x (positivo = a la derecha):
```bash
-vf "crop=trunc(ih*9/16/2)*2:ih:(iw-ow)/2+300:0,scale=1080:1920,setsar=1"
```
Úsalo para gameplay/pantalla solo si la acción está al centro; para demos de una app de escritorio
(texto chico en toda la pantalla) usa la receta 3 o haz zoom a la zona importante.

## 5. Quemar subtítulos

Preferido: .ass con tamaños en píxeles reales (lo genera `scripts/srt-a-ass.py`):
```bash
python3 scripts/srt-a-ass.py subs.srt subs.ass --tam 76 --margen-abajo 700 --mayus
ffmpeg -y -i vertical.mp4 -vf "ass=subs.ass" $X264 -c:a copy con-subs.mp4
```
Directo desde .srt con `force_style` (ojo: en .srt FontSize y MarginV van en una escala de 288 px de alto,
NO en píxeles del video; FontSize=14 se ve grande en 1080x1920):
```bash
ffmpeg -y -i vertical.mp4 -vf "subtitles=subs.srt:force_style='FontName=DejaVu Sans,FontSize=14,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=90'" $X264 -c:a copy con-subs.mp4
```
- Colores ASS son `&HAABBGGRR` (al revés que HTML). Amarillo = `&H0000FFFF`.
- Si la ruta del archivo tiene `:` o `'`, cópialo a un nombre simple antes (el filtro los interpreta).
- La fuente debe estar instalada (`fc-list | grep -i dejavu`); si no, libass usa otra sin avisar.
- Acentos y ¿¡ probados OK con archivos UTF-8.

## 6. Texto de gancho en los primeros segundos

`textfile=` evita pelearte con el escape de `:` y comillas. `fc-match` da la ruta real de la fuente
(en Arch: `/usr/share/fonts/TTF/DejaVuSans-Bold.ttf`, paquete `ttf-dejavu`).
```bash
printf 'Esto me costó 3 días:\nnadie te lo dice' > gancho.txt
F=$(fc-match -f '%{file}' 'DejaVu Sans:bold')
ffmpeg -y -i vertical.mp4 -vf "drawtext=textfile=gancho.txt:fontfile=$F:fontsize=78:fontcolor=white:borderw=6:bordercolor=black:line_spacing=12:x=(w-text_w)/2:y=h*0.18:enable='lt(t,2.5)'" $X264 -c:a copy con-gancho.mp4
```
`y=h*0.18` lo deja debajo de la zona superior que tapa la interfaz. `font='Nombre\:bold'` no garantizó
negritas en la prueba; `fontfile=` sí.

## 7. Normalizar audio (loudnorm)

-14 LUFS integrados es el objetivo de facto para redes (no es especificación publicada por TikTok/IG).
Una pasada (suficiente para clips; probado: -21.8 → -14.0 LUFS):
```bash
ffmpeg -y -i entrada.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 160k salida.mp4
```
`-ar 48000` es obligatorio: loudnorm sube internamente a 192 kHz.
Dos pasadas (más natural en voz, para videos largos): mide y reusa los valores.
```bash
ffmpeg -i entrada.mp4 -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p' > medida.json
# toma input_i, input_tp, input_lra, input_thresh, target_offset de medida.json:
ffmpeg -y -i entrada.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-21.77:measured_TP=-17.75:measured_LRA=0.10:measured_thresh=-31.77:offset=0.03:linear=true" -ar 48000 -c:a aac -b:a 160k salida.mp4
```
Comprobar: `ffmpeg -i salida.mp4 -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1`

## 8. Video HDR del iPhone → SDR (si no, se ve lavado/gris en otras apps)

Mejor prevenir: en el iPhone, Ajustes > Cámara > Grabar video > desactiva "Video HDR" para contenido de redes.
Si ya está grabado en HDR (probado con un HLG bt2020 10-bit simulado → sale bt709 yuv420p):
```bash
ffmpeg -y -i iphone.mov -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" $X264 $AAC sdr.mp4
```
Requiere ffmpeg con zimg (el de Arch lo trae).

## 9. Comprimir / dejar listo para subir

```bash
ffmpeg -y -i entrada.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 23 -profile:v high -maxrate 8M -bufsize 16M \
  -c:a aac -b:a 128k -ar 48000 -movflags +faststart listo.mp4
```
Probado: 9.2 MB → 5.8 MB en 40 s a 1080x1920. Sube CRF (25–26) si aún pesa mucho; no bajes de 1080 de ancho.
`+faststart` hace que empiece a reproducirse antes de descargarse completo.

## 10. Varios clips de una lista de tiempos

`scripts/cortar-clips.sh` (probado con tiempos `hh:mm:ss`, `mm:ss` y segundos con decimales, fin de línea
Windows `\r\n`, video sin audio, y un tiempo fuera del video → lo marca como FALLO y sale con código 1).

## 11. Sacar un frame para miniatura / revisar

```bash
ffmpeg -y -ss 3 -i video.mp4 -frames:v 1 miniatura.png
```
Úsalo también para VERIFICAR subtítulos y textos: abre el PNG (Claude puede leer la imagen) antes de decir
que quedó bien.
