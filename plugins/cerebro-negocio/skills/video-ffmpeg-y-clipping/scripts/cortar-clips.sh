#!/usr/bin/env bash
# Corta varios clips de un video a partir de una lista de tiempos.
#
# Uso:
#   bash cortar-clips.sh VIDEO LISTA.csv [CARPETA_SALIDA] [--vertical blur|crop|no] [--calidad]
#
# LISTA.csv: una linea por clip -> inicio,fin,nombre
#   00:01:05,00:01:42,gancho-precio
#   125.5,170,demo-alertas
#   # las lineas que empiezan con # se ignoran
#
# --vertical blur  -> 1080x1920 con fondo desenfocado (default si el video es horizontal)
# --vertical crop  -> 1080x1920 recortando el centro (pierdes los lados)
# --vertical no    -> deja la proporcion original
# --calidad        -> preset slow + crf 18 (mas lento, solo si piden maxima calidad)
#
# Re-codifica (corte exacto al frame). Audio normalizado a -14 LUFS (1 pasada).
set -euo pipefail

if [[ $# -lt 2 ]]; then
  sed -n '2,18p' "$0"; exit 1
fi

VIDEO="$1"; LISTA="$2"; shift 2
SALIDA="clips"
if [[ $# -gt 0 && "$1" != --* ]]; then SALIDA="$1"; shift; fi
MODO="auto"; PRESET="veryfast"; CRF=21
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vertical) MODO="${2:?falta blur|crop|no}"; shift 2 ;;
    --calidad)  PRESET="slow"; CRF=18; shift ;;
    *) echo "Opcion desconocida: $1" >&2; exit 1 ;;
  esac
done

command -v ffmpeg >/dev/null || { echo "Falta ffmpeg (Arch/CachyOS: sudo pacman -S ffmpeg)" >&2; exit 1; }
[[ -f "$VIDEO" ]] || { echo "No existe el video: $VIDEO" >&2; exit 1; }
[[ -f "$LISTA" ]] || { echo "No existe la lista: $LISTA" >&2; exit 1; }
mkdir -p "$SALIDA"

IFS=x read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$VIDEO")
if [[ "$MODO" == "auto" ]]; then
  if (( W > H )); then MODO="blur"; else MODO="no"; fi
fi

case "$MODO" in
  blur) FILTRO="[0:v]split=2[bg][fg];[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,scale=1080:1920[bg];[fg]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]" ;;
  crop) FILTRO="[0:v]crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920,setsar=1,format=yuv420p[v]" ;;
  no)   FILTRO="[0:v]format=yuv420p[v]" ;;
  *) echo "--vertical debe ser blur, crop o no" >&2; exit 1 ;;
esac

n=0; fallos=0
while IFS=, read -r INI FIN NOMBRE || [[ -n "${INI:-}" ]]; do
  INI="${INI//[[:space:]]/}"; FIN="${FIN//[[:space:]]/}"
  [[ -z "$INI" || "$INI" == \#* ]] && continue
  NOMBRE="$(echo "${NOMBRE:-clip}" | tr -d '\r' | tr ' /' '-_')"
  n=$((n + 1))
  OUT="$SALIDA/$(printf '%02d' "$n")-${NOMBRE}.mp4"
  echo ">> [$n] $INI -> $FIN  =>  $OUT"
  # -nostdin: sin esto ffmpeg se come el resto de la lista dentro del while
  if ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$INI" -to "$FIN" -i "$VIDEO" \
      -filter_complex "$FILTRO" -map "[v]" -map "0:a?" \
      -c:v libx264 -preset "$PRESET" -crf "$CRF" -r 30 \
      -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 48000 \
      -movflags +faststart "$OUT"; then
    DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" || true)
    if [[ ! "$DUR" =~ ^[0-9] ]] || awk "BEGIN{exit !($DUR < 0.5)}"; then
      echo "   FALLO: clip vacio (el tiempo esta fuera del video?)" >&2
      rm -f "$OUT"; fallos=$((fallos + 1))
    else
      echo "   OK (${DUR} s)"
    fi
  else
    echo "   FALLO este clip" >&2; fallos=$((fallos + 1))
  fi
done < "$LISTA"

echo "Listo: $n clips en $SALIDA/ ($fallos con error)"
[[ $fallos -eq 0 ]]
