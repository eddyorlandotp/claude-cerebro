#!/usr/bin/env python3
"""Convierte un .srt en un .ass con estilo legible para video vertical (redes).

Uso:
  python3 srt-a-ass.py entrada.srt salida.ass [--ancho 1080] [--alto 1920]
         [--tam 76] [--margen-abajo 700] [--fuente "DejaVu Sans"] [--mayus]

- Tamanos en pixeles reales (PlayRes = resolucion del video), no en la escala
  rara de 288 px que usa ffmpeg con .srt + force_style.
- --margen-abajo: distancia del texto al borde inferior. 700 en 1920 deja el
  subtitulo arriba de la zona que tapan los botones/descripcion de TikTok/Reels.
- Solo usa la libreria estandar de Python.
"""
import argparse
import re
import sys

TIEMPO = re.compile(r"(\d+):(\d{2}):(\d{2})[,.](\d{3})")


def a_ass(t: str) -> str:
    m = TIEMPO.match(t.strip())
    if not m:
        raise ValueError(f"tiempo invalido: {t!r}")
    h, mi, s, ms = (int(x) for x in m.groups())
    cs = round(ms / 10)
    if cs == 100:  # 999 ms redondea a 100 cs
        s, cs = s + 1, 0
        if s == 60:
            mi, s = mi + 1, 0
            if mi == 60:
                h, mi = h + 1, 0
    return f"{h}:{mi:02d}:{s:02d}.{cs:02d}"


def leer_srt(ruta: str):
    with open(ruta, encoding="utf-8-sig") as f:
        bloques = re.split(r"\n\s*\n", f.read().replace("\r\n", "\n").strip())
    for b in bloques:
        lineas = [l for l in b.split("\n") if l.strip()]
        idx = next((i for i, l in enumerate(lineas) if "-->" in l), None)
        if idx is None:
            continue
        ini, fin = (x.strip().split(" ")[0] for x in lineas[idx].split("-->"))
        texto = " ".join(l.strip() for l in lineas[idx + 1:])
        if texto:
            yield a_ass(ini), a_ass(fin), texto


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("entrada")
    p.add_argument("salida")
    p.add_argument("--ancho", type=int, default=1080)
    p.add_argument("--alto", type=int, default=1920)
    p.add_argument("--tam", type=int, default=76, help="tamano de letra en px (default 76)")
    p.add_argument("--margen-abajo", type=int, default=700)
    p.add_argument("--fuente", default="DejaVu Sans")
    p.add_argument("--mayus", action="store_true", help="todo en mayusculas")
    a = p.parse_args()

    eventos = list(leer_srt(a.entrada))
    if not eventos:
        sys.exit(f"No encontre subtitulos en {a.entrada}")

    # Colores ASS: &HAABBGGRR. Texto blanco, contorno negro grueso, sombra suave.
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {a.ancho}
PlayResY: {a.alto}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Redes,{a.fuente},{a.tam},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,{max(3, a.tam // 14)},2,2,{a.ancho * 13 // 100},{a.ancho * 13 // 100},{a.margen_abajo},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(a.salida, "w", encoding="utf-8") as f:
        f.write(cab)
        for ini, fin, txt in eventos:
            txt = txt.replace("{", "(").replace("}", ")")
            if a.mayus:
                txt = txt.upper()
            f.write(f"Dialogue: 0,{ini},{fin},Redes,,0,0,0,,{txt}\n")
    print(f"OK: {len(eventos)} subtitulos -> {a.salida}")


if __name__ == "__main__":
    main()
