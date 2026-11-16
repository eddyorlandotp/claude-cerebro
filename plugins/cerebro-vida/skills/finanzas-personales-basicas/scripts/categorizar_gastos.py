#!/usr/bin/env python3
"""Categoriza movimientos de un CSV exportado del banco. Solo stdlib, todo local.

Uso:
  python3 categorizar_gastos.py movimientos.csv [--reglas reglas.csv] [--salida carpeta]
                                [--gastos-positivos] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]

Genera en la carpeta de salida:
  <nombre>_categorizado.csv   fecha, mes, descripcion, monto, categoria, ambito
  <nombre>_resumen.md         totales por mes, categoria y ambito + lo que quedo sin categoria

Convencion de signo: gasto = negativo, ingreso = positivo. Si el banco exporta los
cargos como positivos en una sola columna de monto, usa --gastos-positivos.
Reglas: CSV con columnas patron,categoria,ambito. El patron es una expresion regular
(sin distinguir mayusculas ni acentos) que se busca en la descripcion. Gana la primera.
"""
import argparse
import csv
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

COL_FECHA = ["fecha", "fecha operacion", "fecha de operacion", "fecha movimiento", "date", "dia"]
COL_DESC = ["descripcion", "concepto", "description", "detalle", "movimiento", "comercio", "referencia"]
COL_MONTO = ["monto", "importe", "amount", "cantidad", "valor"]
COL_CARGO = ["cargo", "cargos", "retiro", "retiros", "debito", "debe", "salida"]
COL_ABONO = ["abono", "abonos", "deposito", "depositos", "credito", "haber", "entrada"]
FORMATOS_FECHA = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d",
                  "%d.%m.%Y", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S"]
MESES = {"ene": 1, "jan": 1, "feb": 2, "mar": 3, "abr": 4, "apr": 4, "may": 5, "jun": 6, "jul": 7,
         "ago": 8, "aug": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12, "dec": 12}


def normaliza(texto):
    texto = unicodedata.normalize("NFKD", texto or "")
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto).strip().lower()


def lee_csv(ruta):
    datos = None
    for cod in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            datos = Path(ruta).read_text(encoding=cod)
            break
        except UnicodeDecodeError:
            continue
    lineas = [l for l in datos.splitlines() if l.strip()]
    try:
        dialecto = csv.Sniffer().sniff("\n".join(lineas[:20]), delimiters=",;\t|")
    except csv.Error:
        dialecto = csv.excel
    filas = list(csv.reader(lineas, dialecto))
    # Algunos bancos ponen lineas de titulo antes del encabezado: busca la primera fila que
    # tenga columna de fecha y de descripcion.
    for i, fila in enumerate(filas[:30]):
        nombres = [normaliza(c) for c in fila]
        if busca(nombres, COL_FECHA) is not None and busca(nombres, COL_DESC) is not None:
            return nombres, filas[i + 1:]
    sys.exit("No encontre encabezados de fecha y descripcion. Columnas vistas: " + ", ".join(filas[0]))


def busca(nombres, candidatos):
    for cand in candidatos:
        for i, n in enumerate(nombres):
            if n == cand:
                return i
    for cand in candidatos:
        for i, n in enumerate(nombres):
            if n.startswith(cand) or cand in n.split():
                return i
    return None


def a_numero(texto):
    t = (texto or "").strip().replace("$", "").replace("MXN", "").replace(" ", "")
    if not t or t in ("-", "--"):
        return 0.0
    negativo = t.startswith("(") and t.endswith(")")
    t = t.strip("()")
    if "," in t and "." in t and t.rfind(",") > t.rfind("."):
        t = t.replace(".", "").replace(",", ".")  # formato 1.234,56
    elif "," in t and "." not in t and re.search(r",\d{2}$", t):
        t = t.replace(",", ".")
    else:
        t = t.replace(",", "")
    valor = float(t)
    return -abs(valor) if negativo else valor


def a_fecha(texto):
    t = (texto or "").strip()
    for fmt in FORMATOS_FECHA:
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    m = re.match(r"(\d{1,2})[\s/-]+([A-Za-z]{3})[a-z]*\.?[\s/-]+(\d{2,4})", normaliza(t))
    if m and m.group(2)[:3] in MESES:
        anio = int(m.group(3))
        anio += 2000 if anio < 100 else 0
        return datetime(anio, MESES[m.group(2)[:3]], int(m.group(1))).date()
    return None


def carga_reglas(ruta):
    reglas = []
    if not ruta:
        return reglas
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            patron = (r.get("patron") or "").strip()
            if not patron or patron.startswith("#"):
                continue
            reglas.append((re.compile(normaliza(patron)), r.get("categoria", "").strip() or "otros",
                           (r.get("ambito") or "personal").strip().lower()))
    return reglas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada")
    ap.add_argument("--reglas", default=str(Path(__file__).with_name("reglas-ejemplo.csv")))
    ap.add_argument("--salida", default=".")
    ap.add_argument("--gastos-positivos", action="store_true")
    ap.add_argument("--desde")
    ap.add_argument("--hasta")
    a = ap.parse_args()

    nombres, filas = lee_csv(a.entrada)
    i_f, i_d = busca(nombres, COL_FECHA), busca(nombres, COL_DESC)
    i_m, i_c, i_a = busca(nombres, COL_MONTO), busca(nombres, COL_CARGO), busca(nombres, COL_ABONO)
    if i_m is None and i_c is None and i_a is None:
        sys.exit("No encontre columna de monto, ni de cargo/abono. Columnas: " + ", ".join(nombres))
    reglas = carga_reglas(a.reglas)
    desde = datetime.strptime(a.desde, "%Y-%m-%d").date() if a.desde else None
    hasta = datetime.strptime(a.hasta, "%Y-%m-%d").date() if a.hasta else None

    movs, descartadas = [], 0
    for fila in filas:
        if len(fila) <= max(x for x in (i_f, i_d, i_m, i_c, i_a) if x is not None):
            descartadas += 1
            continue
        fecha = a_fecha(fila[i_f])
        try:
            if i_c is not None or i_a is not None:
                monto = (a_numero(fila[i_a]) if i_a is not None else 0.0) - \
                        abs(a_numero(fila[i_c]) if i_c is not None else 0.0)
            else:
                monto = a_numero(fila[i_m])
                if a.gastos_positivos:
                    monto = -monto
        except ValueError:
            descartadas += 1
            continue
        if fecha is None and monto == 0:
            descartadas += 1  # filas de totales o notas
            continue
        if (desde and fecha and fecha < desde) or (hasta and fecha and fecha > hasta):
            continue
        desc = re.sub(r"\s+", " ", fila[i_d]).strip()
        cat, amb = ("ingreso sin categoria", "sin definir") if monto > 0 else ("sin categoria", "sin definir")
        for patron, c, am in reglas:
            if patron.search(normaliza(desc)):
                cat, amb = c, am
                break
        mes = fecha.strftime("%Y-%m") if fecha else "sin-fecha"
        movs.append({"fecha": fecha.isoformat() if fecha else fila[i_f], "mes": mes, "descripcion": desc,
                     "monto": round(monto, 2), "categoria": cat, "ambito": amb})

    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    base = Path(a.entrada).stem
    csv_out = salida / f"{base}_categorizado.csv"
    with open(csv_out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["fecha", "mes", "descripcion", "monto", "categoria", "ambito"])
        w.writeheader()
        w.writerows(movs)

    por_mes = defaultdict(lambda: {"ingresos": 0.0, "gastos": 0.0})
    por_cat = defaultdict(float)
    por_amb = defaultdict(float)
    sin_cat = defaultdict(lambda: [0, 0.0])
    transferencias = defaultdict(float)
    for m in movs:
        if m["ambito"] == "transferencia":
            # Movimientos entre cuentas propias o pago de tarjeta: no son ingreso ni gasto real.
            transferencias[m["mes"]] += m["monto"]
            continue
        clave = "ingresos" if m["monto"] > 0 else "gastos"
        por_mes[m["mes"]][clave] += m["monto"]
        if m["monto"] < 0:
            por_cat[(m["mes"], m["categoria"])] += m["monto"]
            por_amb[(m["mes"], m["ambito"])] += m["monto"]
        if m["categoria"] in ("sin categoria", "ingreso sin categoria"):
            s = sin_cat[m["descripcion"][:40]]
            s[0] += 1
            s[1] += m["monto"]

    md = [f"# Resumen de {Path(a.entrada).name}", "",
          f"Movimientos: {len(movs)} | filas descartadas (totales, notas, mal formadas): {descartadas}", "",
          "Signo: gasto negativo, ingreso positivo. Revisa que coincida con tu estado de cuenta.", "",
          "## Por mes", "", "| Mes | Ingresos | Gastos | Neto |", "|---|---:|---:|---:|"]
    for mes in sorted(por_mes):
        v = por_mes[mes]
        md.append(f"| {mes} | {v['ingresos']:,.2f} | {v['gastos']:,.2f} | {v['ingresos'] + v['gastos']:,.2f} |")
    if transferencias:
        md += ["", "Excluido de los totales (ambito transferencia: entre cuentas propias o pago de tarjeta): " +
               ", ".join(f"{mes}: {tot:,.2f}" for mes, tot in sorted(transferencias.items()))]
    md += ["", "## Gastos por categoria", "", "| Mes | Categoria | Total |", "|---|---|---:|"]
    for (mes, cat), tot in sorted(por_cat.items(), key=lambda x: (x[0][0], x[1])):
        md.append(f"| {mes} | {cat} | {tot:,.2f} |")
    md += ["", "## Gastos personal vs negocio", "", "| Mes | Ambito | Total |", "|---|---|---:|"]
    for (mes, amb), tot in sorted(por_amb.items()):
        md.append(f"| {mes} | {amb} | {tot:,.2f} |")
    md += ["", "## Sin categoria (agrega reglas para estos)", "", "| Descripcion | Veces | Total |", "|---|---:|---:|"]
    for desc, (n, tot) in sorted(sin_cat.items(), key=lambda x: x[1][1])[:25]:
        md.append(f"| {desc.replace('|', '/')} | {n} | {tot:,.2f} |")
    md_out = salida / f"{base}_resumen.md"
    md_out.write_text("\n".join(md) + "\n", encoding="utf-8")

    total_sin = sum(1 for m in movs if m["categoria"] in ("sin categoria", "ingreso sin categoria"))
    print(f"OK {len(movs)} movimientos, {total_sin} sin categoria, {descartadas} filas descartadas")
    print(f"CSV: {csv_out}")
    print(f"Resumen: {md_out}")


if __name__ == "__main__":
    main()
