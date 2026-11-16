#!/usr/bin/env bash
# Exporta un logo SVG cuadrado a todos los tamaños de web y redes + hoja de revisión.
# Uso: bash exportar_logo.sh logo.svg [carpeta_salida] [color_fondo_para_iconos_opacos]
# Requiere: rsvg-convert (paquete librsvg) e ImageMagick (magick o convert).
set -euo pipefail
SVG="${1:?Uso: exportar_logo.sh logo.svg [salida] [#fondo]}"
case "$SVG" in -h|--help) sed -n '2,4p' "$0"; exit 0;; esac
[ -f "$SVG" ] || { echo "No existe el SVG: $SVG" >&2; exit 1; }
OUT="${2:-marca-export}"
FONDO="${3:-#ffffff}"
if command -v magick >/dev/null; then IM=magick; ID="magick identify"   # ImageMagick 7
elif command -v convert >/dev/null; then IM=convert; ID=identify        # ImageMagick 6
else echo "Falta ImageMagick" >&2; exit 1; fi
command -v rsvg-convert >/dev/null || { echo "Falta rsvg-convert (librsvg)" >&2; exit 1; }
mkdir -p "$OUT"

png() { rsvg-convert -w "$1" -h "$1" ${3:+-b "$3"} "$SVG" -o "$OUT/$2"; }

# Web (favicon set moderno)
cp "$SVG" "$OUT/icon.svg"
png 16 tmp-16.png; png 32 tmp-32.png
"$IM" "$OUT/tmp-16.png" "$OUT/tmp-32.png" "$OUT/favicon.ico"
png 180 apple-touch-icon.png "$FONDO"    # iOS no respeta transparencia: fondo sólido
png 192 icon-192.png
png 512 icon-512.png
# Maskable: logo dentro del círculo seguro (409/512 = 80 %) sobre fondo sólido
rsvg-convert -w 400 -h 400 "$SVG" -o "$OUT/tmp-400.png"
"$IM" -size 512x512 "xc:$FONDO" "$OUT/tmp-400.png" -gravity center -composite "$OUT/icon-mask.png"

# Redes (avatares cuadrados; la red los recorta en círculo)
png 400 avatar-400-x.png "$FONDO"
png 800 avatar-800-youtube.png "$FONDO"
png 1080 avatar-1080.png "$FONDO"
# Vista previa del recorte circular (solo para revisar, no se sube)
"$IM" "$OUT/avatar-400-x.png" \( +clone -alpha transparent -fill white -draw "circle 200,200 200,0" \) \
  -compose copyopacity -composite "$OUT/revision-circulo.png"

# Hoja de revisión: ¿se lee a 16, 32, 48 y 98 px (avatar de YouTube)?
for s in 16 32 48 98; do png "$s" "tmp-r$s.png"; done
"$IM" -background '#888888' "$OUT/tmp-r16.png" "$OUT/tmp-r32.png" "$OUT/tmp-r48.png" "$OUT/tmp-r98.png" \
  -gravity center +append -bordercolor '#888888' -border 8 "$OUT/revision-tamanos.png"
rm -f "$OUT"/tmp-*.png
echo "Listo en $OUT/:"; ls -1 "$OUT"
$ID -format "%f %wx%h\n" "$OUT"/*.png
