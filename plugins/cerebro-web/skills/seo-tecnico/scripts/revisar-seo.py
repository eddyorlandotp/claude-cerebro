#!/usr/bin/env python3
"""Revisa el SEO tecnico basico de una URL tal como la ve un bot SIN JavaScript.

Uso:  python3 revisar-seo.py https://midominio.com/
Solo usa la libreria estandar. Imprime OK / FALTA / OJO por cada punto y
termina con codigo 1 si hay algun FALTA.
"""
import sys
import json
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser

UA = "Mozilla/5.0 (compatible; revisar-seo/1.0)"


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(2_000_000).decode("utf-8", errors="replace")
            return r.status, dict(r.headers), body, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), "", url
    except Exception as e:  # noqa: BLE001
        return None, {}, str(e), url


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.links = []
        self.title = None
        self._in_title = False
        self.jsonld = []
        self._in_jsonld = False
        self._buf = ""
        self.h1 = 0
        self.imgs_sin_medidas = 0
        self.html_lang = None

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.html_lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
            self.title = ""
        elif tag == "meta":
            key = (a.get("property") or a.get("name") or "").lower()
            if key:
                self.meta.setdefault(key, a.get("content", ""))
        elif tag == "link":
            self.links.append(a)
        elif tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self._in_jsonld = True
            self._buf = ""
        elif tag == "h1":
            self.h1 += 1
        elif tag == "img" and not (a.get("width") and a.get("height")):
            self.imgs_sin_medidas += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            self.jsonld.append(self._buf)

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_jsonld:
            self._buf += data


fallas = 0


def ok(msg):
    print(f"  OK     {msg}")


def falta(msg):
    global fallas
    fallas += 1
    print(f"  FALTA  {msg}")


def ojo(msg):
    print(f"  OJO    {msg}")


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    url = sys.argv[1]
    status, headers, body, final = fetch(url)
    print(f"\n== {url}  (final: {final}, HTTP {status})")
    if status != 200:
        falta(f"la pagina debe responder 200 (respondio {status}): {body[:200] if status is None else ''}")
        sys.exit(1)

    xrobots = {k.lower(): v for k, v in headers.items()}.get("x-robots-tag", "")
    p = Head()
    p.feed(body)
    m = p.meta

    print("\n-- Basico (lo que ve Google y cualquier bot sin JS)")
    t = (p.title or "").strip()
    if not t:
        falta("<title> vacio o ausente en el HTML inicial")
    elif not (15 <= len(t) <= 65):
        ojo(f"<title> mide {len(t)} caracteres (sugerido ~15-65): {t!r}")
    else:
        ok(f"<title>: {t!r}")
    d = m.get("description", "")
    if not d:
        falta("meta description ausente")
    elif not (50 <= len(d) <= 170):
        ojo(f"meta description mide {len(d)} caracteres (sugerido ~50-170)")
    else:
        ok("meta description presente")
    canon = [lk.get("href") for lk in p.links if "canonical" in lk.get("rel", "").lower().split()]
    if len(canon) == 0:
        falta("link rel=canonical ausente")
    elif len(canon) > 1:
        falta(f"hay {len(canon)} canonical; debe haber uno solo")
    elif not canon[0].startswith("https://"):
        falta(f"canonical debe ser URL absoluta https: {canon[0]!r}")
    else:
        ok(f"canonical: {canon[0]}")
    robots = (m.get("robots", "") + " " + xrobots).lower()
    if "noindex" in robots:
        ojo(f"la pagina dice noindex ({robots.strip()}); correcto solo si NO quieres que aparezca en Google")
    else:
        ok("sin noindex")
    if not m.get("viewport"):
        falta("meta viewport ausente (mala experiencia en celular)")
    if not p.html_lang:
        ojo("<html> sin atributo lang (usa lang=\"es-MX\" o \"es\")")
    if p.h1 != 1:
        ojo(f"hay {p.h1} <h1> en el HTML inicial (lo normal es 1)")
    if p.imgs_sin_medidas:
        ojo(f"{p.imgs_sin_medidas} <img> sin width/height (riesgo de CLS)")

    print("\n-- Vista previa al compartir (X, WhatsApp, Facebook, Telegram no corren JS)")
    for k in ("og:title", "og:type", "og:image", "og:url"):
        if m.get(k):
            ok(f"{k}: {m[k][:90]}")
        else:
            falta(f"{k} ausente (requerido por Open Graph)")
    img = m.get("og:image", "")
    if img:
        if not img.startswith("https://"):
            falta("og:image debe ser URL absoluta https")
        else:
            s, h, _, _ = fetch(img)
            ctype = {k.lower(): v for k, v in h.items()}.get("content-type", "")
            if s == 200 and ctype.startswith("image/"):
                ok(f"og:image descarga bien ({ctype})")
            else:
                falta(f"og:image no descarga como imagen (HTTP {s}, {ctype or 'sin content-type'})")
    if not m.get("og:description"):
        ojo("og:description ausente (se usara la meta description o nada)")
    for k in ("og:image:width", "og:image:height", "og:image:alt"):
        if not m.get(k):
            ojo(f"{k} ausente (recomendado)")
    if m.get("twitter:card"):
        ok(f"twitter:card: {m['twitter:card']}")
    else:
        ojo("twitter:card ausente (usa summary_large_image para imagen grande en X)")

    print("\n-- Datos estructurados (JSON-LD)")
    if not p.jsonld:
        ojo("sin JSON-LD (recomendado: Organization y WebSite en la home)")
    for raw in p.jsonld:
        try:
            data = json.loads(raw)
            tipos = [x.get("@type") for x in (data if isinstance(data, list) else data.get("@graph", [data]))]
            ok(f"JSON-LD valido: {tipos}")
            if "aggregateRating" in raw or '"review"' in raw:
                ojo("hay ratings/reviews: deben ser reales y visibles en la pagina")
        except Exception as e:  # noqa: BLE001
            falta(f"JSON-LD invalido: {e}")

    print("\n-- robots.txt y sitemap")
    base = f"{urlparse(final).scheme}://{urlparse(final).netloc}"
    s, _, rb, _ = fetch(urljoin(base, "/robots.txt"))
    sitemaps = []
    if s == 200:
        ok("robots.txt existe")
        for line in rb.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemaps.append(line.split(":", 1)[1].strip())
            if line.strip().lower() in ("disallow: /", "disallow:/"):
                falta("robots.txt bloquea TODO el sitio (Disallow: /)")
    else:
        ojo(f"robots.txt no existe (HTTP {s})")
    if not sitemaps:
        ojo("robots.txt no declara 'Sitemap: https://.../sitemap.xml'")
        sitemaps = [urljoin(base, "/sitemap.xml")]
    for sm in sitemaps:
        s, _, sb, _ = fetch(sm)
        if s == 200 and ("<urlset" in sb or "<sitemapindex" in sb):
            n = sb.count("<loc>")
            rel = sb.count("<loc>/")
            ok(f"sitemap {sm} con {n} URLs")
            if rel:
                falta("el sitemap tiene URLs relativas; deben ser absolutas")
        else:
            ojo(f"sitemap {sm} no encontrado o invalido (HTTP {s})")

    print(f"\nResultado: {fallas} FALTA(s). Revisa tambien PageSpeed Insights y la Prueba de resultados enriquecidos de Google.")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
