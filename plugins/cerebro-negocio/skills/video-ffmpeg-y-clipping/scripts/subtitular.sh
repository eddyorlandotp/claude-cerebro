#!/usr/bin/env bash
# Subtitulos automaticos con whisper.cpp (local, sin nube) y quemado con estilo legible.
#
# Uso:
#   bash subtitular.sh VIDEO [--modelo small|base|medium|large-v3-turbo-q5_0] [--idioma es]
#                            [--solo-srt] [--tam 76] [--margen-abajo 700] [--mayus]
#
# Flujo:
#   1) Si ya existe VIDEO.srt (misma ruta, misma base), lo reutiliza: asi puedes corregirlo a mano
#      y volver a correr el script para solo re-quemar.
#   2) Si no existe: extrae audio 16 kHz mono -> whisper-cli -> VIDEO.srt (segmentos cortos).
#   3) Convierte a .ass (estilo para vertical) y quema -> VIDEO-sub.mp4
#
# Requisitos (Arch/CachyOS): sudo pacman -S ffmpeg whisper-cpp python
# Modelos: se guardan en ~/.local/share/whisper-cpp/ y se descargan una vez de Hugging Face.
set -euo pipefail

[[ $# -ge 1 ]] || { sed -n '2,15p' "$0"; exit 1; }
VIDEO="$1"; shift
MODELO="small"; IDIOMA="es"; SOLO_SRT=0; EXTRA_ASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --modelo) MODELO="$2"; shift 2 ;;
    --idioma) IDIOMA="$2"; shift 2 ;;
    --solo-srt) SOLO_SRT=1; shift ;;
    --tam|--margen-abajo|--fuente) EXTRA_ASS+=("$1" "$2"); shift 2 ;;
    --mayus) EXTRA_ASS+=("--mayus"); shift ;;
    *) echo "Opcion desconocida: $1" >&2; exit 1 ;;
  esac
done

DIR_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$VIDEO" ]] || { echo "No existe: $VIDEO" >&2; exit 1; }
BASE="${VIDEO%.*}"
SRT="$BASE.srt"; ASS="$BASE.ass"; OUT="$BASE-sub.mp4"

if [[ -f "$SRT" ]]; then
  echo ">> Uso el SRT existente: $SRT (borralo si quieres transcribir de nuevo)"
else
  WHISPER="$(command -v whisper-cli || true)"
  [[ -n "$WHISPER" ]] || { echo "Falta whisper-cli. Arch/CachyOS: sudo pacman -S whisper-cpp" >&2; exit 1; }
  DIR_MOD="${XDG_DATA_HOME:-$HOME/.local/share}/whisper-cpp"
  MOD="$DIR_MOD/ggml-$MODELO.bin"
  if [[ ! -f "$MOD" ]]; then
    mkdir -p "$DIR_MOD"
    echo ">> Descargando modelo $MODELO (una sola vez) a $MOD"
    curl -fL --progress-bar -o "$MOD.part" \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODELO.bin"
    mv "$MOD.part" "$MOD"
  fi
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  echo ">> Extrayendo audio"
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$VIDEO" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$TMP/audio.wav"
  echo ">> Transcribiendo con whisper.cpp ($MODELO, idioma $IDIOMA)"
  # -ml 32 -sow: segmentos cortos cortados en palabra completa (mejor para leer en celular)
  "$WHISPER" -m "$MOD" -f "$TMP/audio.wav" -l "$IDIOMA" -ml 32 -sow -osrt -of "$TMP/subs" -np \
    -t "$(nproc)" >/dev/null
  # whisper deja un espacio al inicio de cada linea de texto; lo quitamos
  sed 's/^ //' "$TMP/subs.srt" > "$SRT"
  echo ">> SRT listo: $SRT  (revisalo: nombres propios y terminos tecnicos suelen salir mal)"
fi

[[ $SOLO_SRT -eq 1 ]] && exit 0

python3 "$DIR_SCRIPTS/srt-a-ass.py" "$SRT" "$ASS" "${EXTRA_ASS[@]}"
echo ">> Quemando subtitulos -> $OUT"
# ass= necesita escapar ':' y '\' en la ruta; copiamos a un nombre simple para evitar problemas
TMPA="$(mktemp -d)"; cp "$ASS" "$TMPA/s.ass"
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$VIDEO" -vf "ass=$TMPA/s.ass" \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT"
rm -rf "$TMPA"
echo ">> Listo: $OUT"
