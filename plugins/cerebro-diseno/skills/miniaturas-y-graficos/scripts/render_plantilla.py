#!/usr/bin/env python3
"""Renderiza una plantilla HTML a PNG en lote, con chequeo de texto desbordado.

Uso:
  python3 render_plantilla.py plantilla.html datos.json salida/ --ancho 1920 --alto 1080 [--escala 2] [--previa 320]

- plantilla.html: un <div id="lienzo"> del tamaño exacto (ancho x alto en px) con
  marcadores {{CLAVE}}. Imágenes con ruta relativa a la plantilla (se carga como file://).
- datos.json: lista de objetos; cada uno necesita "ARCHIVO" (nombre sin extensión) y
  las claves que use la plantilla. Los valores se insertan escapados como texto.
- --escala 2: PNG al doble de pixeles (p. ej. plantilla 1920x1080 -> 3840x2160).
- --previa N: además guarda <ARCHIVO>-previa.png de N px de ancho (cómo se ve en celular).
Sale con código 1 si algún elemento con clase "texto" se desborda o sale del lienzo.
Requiere: playwright para Python + chromium (python3 -m playwright install chromium).
"""
import argparse, html, json, pathlib, sys
from playwright.sync_api import sync_playwright

JS_DESBORDE = """([w, h]) => [...document.querySelectorAll('.texto')].filter(e => {
  const r = e.getBoundingClientRect();
  return e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1
      || r.left < 0 || r.top < 0 || r.right > w || r.bottom > h; }).map(e => e.innerText.slice(0, 40))"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plantilla"); ap.add_argument("datos"); ap.add_argument("salida")
    ap.add_argument("--ancho", type=int, required=True); ap.add_argument("--alto", type=int, required=True)
    ap.add_argument("--previa", type=int, default=0)
    ap.add_argument("--escala", type=float, default=1)
    a = ap.parse_args()
    plantilla_path = pathlib.Path(a.plantilla).resolve()
    plantilla = plantilla_path.read_text(encoding="utf-8")
    datos = json.loads(pathlib.Path(a.datos).read_text(encoding="utf-8"))
    out = pathlib.Path(a.salida); out.mkdir(parents=True, exist_ok=True)
    fallas = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": a.ancho, "height": a.alto}, device_scale_factor=a.escala)
        for d in datos:
            doc = plantilla
            for k, v in d.items():
                doc = doc.replace("{{" + k + "}}", html.escape(str(v)))
            tmp = plantilla_path.with_name(f".render-{d['ARCHIVO']}.html")
            tmp.write_text(doc, encoding="utf-8")
            try:
                pg.goto(tmp.as_uri(), wait_until="networkidle")
                pg.evaluate("document.fonts.ready")
                malos = pg.evaluate(JS_DESBORDE, [a.ancho, a.alto])
                destino = out / f"{d['ARCHIVO']}.png"
                pg.locator("#lienzo").screenshot(path=str(destino))
                if a.previa:
                    pg.set_viewport_size({"width": a.previa, "height": round(a.previa * a.alto / a.ancho)})
                    pg.evaluate(f"document.body.style.zoom = {a.previa / a.ancho}")
                    pg.screenshot(path=str(out / f"{d['ARCHIVO']}-previa.png"), scale="css")
                    pg.set_viewport_size({"width": a.ancho, "height": a.alto})
                estado = "DESBORDA: " + " | ".join(malos) if malos else "ok"
                fallas += bool(malos)
                print(f"{destino} {estado}")
            finally:
                tmp.unlink(missing_ok=True)
        b.close()
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
