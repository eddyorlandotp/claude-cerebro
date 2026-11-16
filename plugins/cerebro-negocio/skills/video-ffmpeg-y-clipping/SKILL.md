---
name: video-ffmpeg-y-clipping
description: Editar video con ffmpeg en Linux y hacer clipping - recortar, horizontal a vertical 9:16, subtítulos con whisper.cpp, quemar subtítulos, normalizar audio, comprimir para redes, cortar muchos clips. Usa al decir ffmpeg, clip, clipping, vertical, subtítulos, whisper.
---

# Video con ffmpeg y clipping

Objetivo: que Claude entregue **archivos de video que de verdad funcionan** (probados con ffprobe y un frame
revisado), no comandos copiados de memoria. Las recetas completas y probadas están en
`${CLAUDE_PLUGIN_ROOT}/skills/video-ffmpeg-y-clipping/references/recetas-ffmpeg.md`: **léelo antes de escribir cualquier comando ffmpeg** que no sea trivial.

## Reglas duras

1. **Nunca sobrescribas el original.** Salida siempre a un archivo nuevo (`-sub`, `-vertical`, carpeta `clips/`).
2. **Antes de procesar, inspecciona** con ffprobe (receta 1): resolución, duración, fps, si es HDR. Decide con datos.
3. **Prueba primero con 5–10 s** (`-t 10`) si el comando es nuevo o el video es largo. Luego el video completo.
4. **Preset `veryfast`** por default. `-preset slow -crf 18` solo si el usuario pide máxima calidad.
5. **Verifica antes de decir "listo"**:
   - `ffprobe` del resultado: 1080x1920, duración esperada, tiene audio si el original tenía.
   - Saca un frame (`ffmpeg -ss 3 -i out.mp4 -frames:v 1 check.png`) y **míralo** (Read sobre el PNG):
     subtítulos legibles, nada tapado por la zona de botones, sin bandas negras raras.
   - Audio: `-af ebur128` y confirma ~-14 LUFS si normalizaste.
6. **Explica en 1–2 frases** qué vas a hacer ("voy a convertirlo a vertical con fondo borroso para no cortar
   tu pantalla") y al final di cómo comprobarlo ("ábrelo con `mpv archivo.mp4`" o súbelo como borrador).
7. **Scripts incluidos** en `${CLAUDE_PLUGIN_ROOT}/skills/video-ffmpeg-y-clipping/scripts/` (córrelos con
   `bash`/`python3` y esa ruta completa; abajo se abrevia como `scripts/`):
   - `cortar-clips.sh VIDEO lista.csv [carpeta] [--vertical blur|crop|no] [--calidad]`
   - `subtitular.sh VIDEO [--modelo small] [--idioma es] [--solo-srt] [--tam 76] [--mayus]`
   - `srt-a-ass.py entrada.srt salida.ass [--tam 76] [--margen-abajo 700] [--mayus]`
8. El usuario usa **fish**: los comandos con `VAR=$(...)` o `$X264` son de bash. Ponlos en un `.sh` y córrelo
   con `bash`, o envuélvelos en `bash -c '...'`.
9. **Verifica antes de confiar**: si vas a usar un filtro u opción que no está en las recetas, confírmalo con
   `ffmpeg -h filter=<nombre>` (y `ffmpeg -filters | grep <nombre>`) o en https://ffmpeg.org/ffmpeg-filters.html,
   y pruébalo con 5 s del video de prueba (receta 0). Lo mismo con flags de `whisper-cli --help`.

## Decisiones rápidas

| Situación | Haz esto |
|---|---|
| Video horizontal (pantalla, stream, podcast) → TikTok/Reels/Shorts | Fondo desenfocado (receta 3) si hay texto/UI en todo el cuadro; crop centrado (receta 4) si la acción está al centro |
| Grabado con iPhone en HDR (`color_transfer=arib-std-b67` o `smpte2084`) | Tonemap a SDR (receta 8) y dile que apague Ajustes > Cámara > Grabar video > Video HDR |
| fps variable o raro (iPhone, grabación de pantalla) | Agrega `-r 30` o `fps=30` |
| Subtítulos | `subtitular.sh` → revisar el .srt → re-correr para quemar |
| Un video largo → muchos clips | Escribe `clips/lista.csv` (inicio,fin,nombre) y corre `cortar-clips.sh` |
| "Pesa mucho" / la plataforma lo rechaza | Receta 9 (CRF 23, faststart, 30 fps) |
| Gancho de texto en los primeros 2 s | Receta 6 (drawtext con `textfile=` y `fontfile=`) |

Especificaciones de destino (a nov 2026): 1080x1920, 9:16, H.264 + AAC, 30 fps, MP4. Duraciones y zonas
seguras: ver la skill `contenido-para-redes` (sección Especificaciones). Para subtítulos, el default de
`srt-a-ass.py` (`--margen-abajo 700`, márgenes laterales 13%) deja el texto fuera de la franja inferior
y de la columna de botones.

## Subtítulos automáticos (whisper local)

Opción más práctica en Arch/CachyOS (verificado nov 2026): **`whisper-cpp` del repo oficial `extra`**
(versión 1.9.5, trae el binario `whisper-cli`). Sin Python, sin PyTorch, funciona en CPU.

```bash
sudo pacman -S whisper-cpp ffmpeg ttf-dejavu
# El script descarga el modelo una sola vez a ~/.local/share/whisper-cpp/
bash scripts/subtitular.sh video.mp4 --modelo small --idioma es --solo-srt
# revisa/corrige video.srt (nombres, términos técnicos, marcas) y luego:
bash scripts/subtitular.sh video.mp4 --mayus
```

- Modelos (Hugging Face `ggerganov/whisper.cpp`, verificados): `base` 148 MB (rápido, flojo en español),
  **`small` 488 MB (default razonable)**, `large-v3-turbo-q5_0` 574 MB (mejor calidad, más lento en CPU),
  `medium` 1.5 GB.
- Manual: extrae audio `ffmpeg -i v.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le a.wav` y
  `whisper-cli -m ggml-small.bin -f a.wav -l es -ml 32 -sow -osrt -of subs`.
  `-ml 32 -sow` = segmentos cortos cortados en palabra completa (mejor para leer en celular).
- Probado aquí con whisper.cpp 1.9.5 (compilado de fuente, misma versión que el paquete de Arch): ~4 s para
  11 s de audio con `base` en 2 hilos de CPU.
- Alternativas: `python-faster-whisper` (AUR, 1.2.1) o `python-openai-whisper` (extra; arrastra PyTorch,
  pesado). Úsalas solo si whisper-cpp no sirve para algo concreto.
- ffmpeg 8+ tiene filtro `whisper`, pero **el ffmpeg de Arch no está compilado con él** (no depende de
  whisper-cpp). No lo propongas sin comprobar `ffmpeg -filters | grep whisper`.
- **Siempre** pide al usuario revisar el .srt antes de quemar: whisper inventa palabras en silencios y
  escribe mal nombres de productos, tokens y jerga.

## Clipping como negocio (qué es y cómo no quemarse)

Clipping = cortar momentos de videos largos de otra persona/marca (streams, podcasts) en clips verticales y
publicarlos en tus cuentas; te pagan por vistas **dentro de una campaña** que te da permiso de usar ese
material. A nov 2026 existen (verifica términos en cada campaña antes de trabajar):

- **Whop Content Rewards**: la marca define pago por cada 1,000 vistas, mínimo y máximo por video,
  plataformas aceptadas y reglas; paga solo después de aprobar el post. Comisión reportada de 10% sobre
  pagos CPM y ~10 días de retención (fuente de terceros, sep 2026). Las campañas tienen presupuesto fijo:
  cuando se acaba, dejan de pagar aunque tu clip siga sumando vistas.
- **Vyro**: marketplace de clipping (lanzado con MrBeast); reportes de terceros dan CPM ~US$1.5–2 y retiro
  mínimo de US$10. Verifica en su sitio.
- **Fondos de creador** (pagan por tu propio contenido, no por campaña): TikTok Creator Rewards **no está
  disponible en México** según listados de terceros (jul 2026; confírmalo en la app); YouTube Partner
  Program pide 1,000 suscriptores + 10 M vistas de Shorts en 90 días (oficial).

Reglas que Claude debe aplicar al ayudar con clipping:
1. **Solo material con permiso** (campaña activa o permiso escrito). Sin permiso es infracción de derechos de
   autor, y en YouTube un Short de más de 1 min con un reclamo de Content ID queda **bloqueado en todo el
   mundo** (oficial). Mantén los clips de terceros ≤ 60 s salvo que la campaña lo pida.
2. **Nunca** sugieras comprar vistas, bots, ni pagar anuncios para inflar vistas: las campañas lo prohíben y
   descalifican la cuenta en todas las campañas.
3. **No prometas ingresos.** Si el usuario pregunta "¿cuánto puedo ganar?", calcula con sus números reales:
   `vistas aprobadas / 1000 × CPM − comisión`, y recuerda el tope por video y el presupuesto que se agota.
4. Antes de editar, copia las **reglas de la campaña** a `clips/reglas.md` (duración mínima, marca de agua o
   texto obligatorio, plataformas, prohibiciones) y revisa cada clip contra esa lista.
5. Flujo de entrega por video fuente: `clips/lista.csv` (tiempos + nombre) → `cortar-clips.sh` →
   `subtitular.sh` por clip → `clips/publicacion.md` con caption por plataforma (usa `contenido-para-redes`).

## Errores comunes

- `while read` + ffmpeg sin `-nostdin` → ffmpeg se come la lista y solo sale el primer clip.
- Subtítulos .srt con `FontSize=60` → letras gigantes (escala de 288 px). Usa .ass o `FontSize` ~14.
- `-c copy` para cortar → clip empieza en negro o dura de más. Re-codifica si importa la precisión.
- Olvidar `-map "0:a?"` con `-filter_complex` → video sin audio.
- `setsar=1` faltante → algunas apps muestran el video estirado.
- Tiempo de corte fuera del video → archivo vacío; el script lo detecta, un comando suelto no.

## Fuentes (verificado nov 2026)

- Paquetes Arch: https://archlinux.org/packages/extra/x86_64/whisper-cpp/ (1.9.5), https://archlinux.org/packages/extra/x86_64/ffmpeg/ (9.0.2), AUR RPC `python-faster-whisper` 1.2.1
- whisper.cpp: https://github.com/ggml-org/whisper.cpp — modelos: https://huggingface.co/ggerganov/whisper.cpp
- Filtro whisper en ffmpeg 8: https://linuxiac.com/ffmpeg-8-0-arrives-with-whisper-filter-vulkan-encoders
- ffmpeg filtros (subtitles, ass, drawtext, loudnorm, zscale): https://ffmpeg.org/ffmpeg-filters.html
- iPhone HDR: https://support.apple.com/guide/iphone/iph2cafe2ebc/ios
- Shorts 3 min y bloqueo por Content ID: https://support.google.com/youtube/answer/15424877
- YPP: https://support.google.com/youtube/answer/72851
- Whop Content Rewards (lado marca): https://docs.whop.com/manage-your-business/growth-marketing/content-rewards ; ejemplo de campaña: https://contentrewards.com/c/campaigns/0ea61a10-57e1-4b42-9a00-fe782fb933ac
- Comparativa de terceros (CPM, comisiones, sep 2026): https://www.clipspeed.ai/blog/get-paid-to-clip.html y https://www.clipspeed.ai/blog/whop-content-rewards-clipping-guide.html
- TikTok Creator Rewards por país (terceros, jul 2026): https://ttcalculator.net/data/reference/creator-fund-countries/
