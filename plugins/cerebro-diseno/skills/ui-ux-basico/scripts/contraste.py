#!/usr/bin/env python3
"""Contraste WCAG 2.x entre pares de colores hex.

Uso:
  python3 contraste.py "#E5E7EB" "#0B0F14"            # un par: texto fondo
  python3 contraste.py --marca marca.json             # revisa los pares de marca.json

marca.json debe tener {"colores": {...}, "pares": [["texto","fondo"], ...]}
Sale con código 1 si algún par de texto normal queda debajo de 4.5:1.
"""
import json, sys


def lum(hexcolor):
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    canales = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        canales.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = canales
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def veredicto(r):
    if r >= 7:
        return "AAA texto normal"
    if r >= 4.5:
        return "AA texto normal"
    if r >= 3:
        return "solo texto grande (>=24px o >=18.66px bold) e iconos/bordes"
    return "NO PASA: no lo uses para texto ni iconos"


def main():
    args = sys.argv[1:]
    pares = []
    if len(args) == 2 and args[0] == "--marca":
        datos = json.load(open(args[1], encoding="utf-8"))
        col = datos["colores"]
        pares = [(t, f, col[t], col[f]) for t, f in datos["pares"]]
    elif len(args) == 2:
        pares = [(args[0], args[1], args[0], args[1])]
    else:
        print(__doc__)
        sys.exit(2)
    falla = False
    for nt, nf, t, f in pares:
        r = ratio(t, f)
        falla |= r < 4.5
        print(f"{nt} sobre {nf}: {r:.2f}:1 -> {veredicto(r)}")
    sys.exit(1 if falla else 0)


if __name__ == "__main__":
    main()
