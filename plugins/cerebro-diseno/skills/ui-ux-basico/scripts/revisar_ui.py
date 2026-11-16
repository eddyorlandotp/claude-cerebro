#!/usr/bin/env python3
"""Capturas + revisiones básicas de UI con Playwright (Python).

Uso: python3 revisar_ui.py <url> [carpeta_salida]
  url puede ser http://localhost:5173 o file:///ruta/index.html

Genera escritorio.png (1440x900), movil.png (390x844, tamaño CSS) y movil-foco.png
(tras 3 Tab), e imprime avisos: scroll horizontal en móvil, botones/enlaces
menores a 24x24 px, foco sin indicador visible y errores de consola.
Requiere: pip install playwright && python3 -m playwright install chromium
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

JS_OBJETIVOS = """() => [...document.querySelectorAll('a,button,input,select,textarea,[role=button],[tabindex]')]
  .filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'inline'
      && (r.width < 24 || r.height < 24); })
  .slice(0, 10).map(e => `${e.tagName.toLowerCase()} "${(e.innerText||e.value||e.getAttribute('aria-label')||'').trim().slice(0,30)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)"""

JS_FOCO = """() => { const e = document.activeElement; if (!e || e === document.body) return 'NADA';
  const s = getComputedStyle(e);
  const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
  return `${e.tagName.toLowerCase()} ${visible ? 'con indicador' : 'SIN indicador visible (revisa la captura)'}`; }"""


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    url = sys.argv[1]
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "capturas-ui"); out.mkdir(exist_ok=True)
    avisos = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for nombre, opts in (("escritorio", {"viewport": {"width": 1440, "height": 900}}),
                             ("movil", {"viewport": {"width": 390, "height": 844}, "is_mobile": True,
                                        "has_touch": True, "device_scale_factor": 1})):
            ctx = b.new_context(**opts)
            pg = ctx.new_page()
            errores = []
            pg.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errores.append(str(e)))
            pg.goto(url, wait_until="networkidle")
            pg.screenshot(path=str(out / f"{nombre}.png"), full_page=True)
            if nombre == "movil":
                if pg.evaluate("document.documentElement.scrollWidth") > 391:
                    avisos.append("movil: hay scroll horizontal (algo se sale del ancho de 390px)")
                for t in pg.evaluate(JS_OBJETIVOS):
                    avisos.append(f"movil: objetivo táctil chico (<24px): {t}")
                for _ in range(3):
                    pg.keyboard.press("Tab")
                foco = pg.evaluate(JS_FOCO)
                pg.screenshot(path=str(out / "movil-foco.png"))
                if "SIN" in foco or foco == "NADA":
                    avisos.append(f"foco tras 3 Tab: {foco}")
            for e in errores:
                avisos.append(f"{nombre}: error de consola: {e[:150]}")
            ctx.close()
        b.close()
    print(f"Capturas en {out}/ : escritorio.png, movil.png, movil-foco.png")
    print("\n".join(avisos) if avisos else "Sin avisos automáticos. Aun así MIRA las capturas.")
    sys.exit(1 if avisos else 0)


if __name__ == "__main__":
    main()
