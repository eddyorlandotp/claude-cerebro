#!/usr/bin/env python3
"""Valida un archivo de tarjetas para importar en Anki (texto separado por tabuladores).

Uso: python3 validar_anki.py tarjetas.txt

Comprueba: UTF-8, encabezados #clave:valor validos, separador tab, mismo numero de columnas
en cada fila, campos vacios, frente duplicado (Anki usa el primer campo para detectar
duplicados) y, si #html:true, caracteres < > & sin escapar fuera de etiquetas comunes.
Sale con codigo 1 si hay errores.
"""
import re
import sys
from collections import Counter

CLAVES = {"separator", "html", "tags", "columns", "notetype", "deck", "notetype column",
          "deck column", "tags column", "guid column"}
SEPARADORES = {"tab": "\t", "comma": ",", "semicolon": ";", "space": " ", "pipe": "|", "colon": ":"}
ETIQUETAS_OK = re.compile(r"</?(b|i|u|br|sup|sub|code|pre|ul|ol|li|div|span|img)\b[^>]*>", re.I)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        texto = open(sys.argv[1], encoding="utf-8").read()
    except UnicodeDecodeError:
        sys.exit("ERROR: el archivo no es UTF-8. Guardalo como UTF-8.")
    errores, avisos = [], []
    cab, filas, sep, html = {}, [], "\t", False
    for n, linea in enumerate(texto.splitlines(), 1):
        if not filas and linea.startswith("#"):
            m = re.match(r"#([a-z ]+):(.*)$", linea)
            if m and m.group(1) in CLAVES:
                cab[m.group(1)] = m.group(2).strip()
            continue
        if linea.strip():
            filas.append((n, linea))
    if "separator" in cab:
        sep = SEPARADORES.get(cab["separator"].lower(), cab["separator"])
    else:
        avisos.append("Sin '#separator:tab'; Anki adivinara el separador.")
    html = cab.get("html", "").lower() == "true"
    if sep != "\t":
        avisos.append("Separador distinto de tab: cuida que no aparezca dentro del texto.")
    if not filas:
        sys.exit("ERROR: no hay tarjetas.")
    cols = Counter(len(l.split(sep)) for _, l in filas)
    esperado = len(cab["columns"].split(sep)) if "columns" in cab else cols.most_common(1)[0][0]
    frentes = Counter()
    for n, linea in filas:
        campos = linea.split(sep)
        if len(campos) != esperado:
            errores.append(f"linea {n}: {len(campos)} columnas, se esperaban {esperado}")
            continue
        es_cloze = "{{c" in campos[0]  # en Cloze el segundo campo (Extra) puede ir vacio
        if not campos[0].strip() or (len(campos) > 1 and not campos[1].strip() and not es_cloze):
            errores.append(f"linea {n}: frente o reverso vacio")
        frentes[campos[0].strip().lower()] += 1
        if html:
            for c in campos:
                resto = ETIQUETAS_OK.sub("", c)
                resto = re.sub(r"&(lt|gt|amp|nbsp|quot|#\d+);", "", resto)
                if re.search(r"[<>]|&", resto):
                    avisos.append(f"linea {n}: '<', '>' o '&' sin escapar (usa &lt; &gt; &amp;)")
                    break
        if "{{c" in linea and not re.search(r"\{\{c\d+::", linea):
            errores.append(f"linea {n}: cloze mal escrito (formato: {{{{c1::texto}}}})")
    for frente, veces in frentes.items():
        if veces > 1:
            avisos.append(f"frente repetido {veces} veces: '{frente[:50]}' (Anki lo trata como duplicado)")
    print(f"Tarjetas: {len(filas)} | columnas: {esperado} | encabezados: {', '.join(cab) or 'ninguno'}")
    for a in avisos:
        print("AVISO:", a)
    for e in errores:
        print("ERROR:", e)
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
