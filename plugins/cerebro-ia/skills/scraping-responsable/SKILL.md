---
name: scraping-responsable
description: Sacar datos de sitios web sin meterse en problemas - API primero, httpx con selectolax o BeautifulSoup, Playwright solo con JavaScript, robots.txt, términos, límites, sin evadir bloqueos, guardar crudo. Usa con scraping, scraper.
---

# Scraping responsable

El error que corrige: Claude abre Playwright para una página que era HTML simple (o que tenía API), manda 50 requests por segundo, rota proxies y user agents para "saltarse" un bloqueo, parsea directo sin guardar el HTML y, cuando el sitio cambia, el scraper devuelve vacío sin avisar a nadie.

## Regla 0: verifica antes de confiar

- Revisa la versión instalada y la doc actual de cada librería (Context7 o la doc oficial) antes de escribir código; a nov 2026: httpx 0.28, selectolax 1.0, beautifulsoup4 4.15, playwright 1.65.
- Antes de scrapear un sitio, lee sus **términos de uso** y su `robots.txt`, y dile al usuario en 1–3 frases qué encontraste y qué vas a hacer.

## 1. Orden de preferencia (detente en el primero que sirva)

1. **API oficial** (aunque sea de pago o con registro). Para datos de tokens: DexScreener, Birdeye, Helius, Jupiter, etc. (ver `riesgo-memecoins` y `helius-rpc-y-tiempo-real` en `cerebro-solana`).
2. **Exportaciones, RSS, sitemap.xml, datos abiertos**.
3. **HTML estático**: `httpx` + `selectolax` (rápido, selectores CSS) o `BeautifulSoup` (tolera HTML roto).
4. **Navegador (Playwright)**: solo si el contenido lo genera JavaScript y no hay otra vía. Es 10–100 veces más pesado.

Cómo saber si hace falta JavaScript: descarga la página con httpx y busca el dato en el HTML. Si está, no uses navegador.

## 2. Reglas legales y de respeto (no negociables)

- **Términos de uso**: si prohíben extracción automatizada, no lo hagas; busca API o permiso por escrito del dueño.
- **robots.txt** (RFC 9309): respétalo con `urllib.robotparser` de la librería estándar. El RFC aclara que no es un mecanismo de autorización, pero ignorarlo es mala fe y suele violar los términos.
- **Nada detrás de login** sin permiso explícito del dueño del sitio, aunque tengas cuenta.
- **Datos personales** (nombres, teléfonos, correos de personas): en México aplica la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (nueva ley publicada el 20 de marzo de 2025). Si el proyecto es "sacar contactos para venderles", detente y dilo al usuario: necesita base legal y aviso de privacidad; consulta a un abogado.
- **Derechos de autor**: extraer datos para analizarlos no es lo mismo que republicar textos, fotos o reseñas. No republiques contenido ajeno.
- **Sin evasión**: no rotes IPs, proxies ni user agents para saltarte bloqueos o límites, no resuelvas CAPTCHAs con servicios, no burles retos anti-bots. Un bloqueo es un "no": se detiene el scraper y se busca otra vía.

## 3. Límites de velocidad

- Un dominio a la vez, **1 request por segundo o más lento**, concurrencia máxima 1–2 por dominio. Si `robots.txt` trae `Crawl-delay`, úsalo.
- Ante **429 o 503**: respeta `Retry-After`; si no viene, backoff exponencial con tope y luego detente.
- **Caché**: no vuelvas a bajar lo que no cambió. Usa `ETag`/`If-None-Match` o `Last-Modified`/`If-Modified-Since`.
- User-Agent honesto que identifique al proyecto (sin datos personales; una URL del proyecto basta). No te hagas pasar por Googlebot.
- Corre en horarios de poco tráfico si es una carga grande, y calcula cuántos requests serán en total antes de empezar.

## 4. Arquitectura: guardar crudo, parsear después

```
descargar → guardar crudo (comprimido) + metadatos → parsear (otro paso) → validar → guardar limpio
```

- **Crudo**: `raw/<dominio>/<fecha>/<hash_url>.html.gz` con un registro de URL, hora UTC, status, headers relevantes. Si el parser falla o cambias de idea sobre qué campos sacar, re-parseas sin volver a pegarle al sitio.
- **Parser** como función pura `parse(html) -> list[dict]`, con tests usando HTMLs guardados como fixtures (`tests/fixtures/`).
- **Validación**: esquema (Pydantic o similar), campos obligatorios no vacíos, rangos lógicos (precio > 0).
- **Alerta de cambio de sitio**: si un parseo devuelve 0 registros o más del X% de campos vacíos, manda alerta (Telegram) y **no** sobrescribas los datos buenos.
- Idempotencia: llave única por registro (URL canónica o ID del sitio) para no duplicar.

## 5. Código base (httpx)

```python
import httpx, time, urllib.robotparser

UA = "mi-proyecto-datos/1.0 (+https://mi-proyecto.example)"
rp = urllib.robotparser.RobotFileParser("https://sitio.example/robots.txt"); rp.read()

with httpx.Client(headers={"User-Agent": UA}, timeout=20, follow_redirects=True) as c:
    for url in urls:
        if not rp.can_fetch(UA, url):
            continue
        r = c.get(url)
        if r.status_code in (429, 503):
            espera = int(r.headers.get("Retry-After", "60"))
            time.sleep(espera); continue      # y cuenta reintentos; tras N, detente
        r.raise_for_status()
        guardar_crudo(url, r)
        time.sleep(1.0)
```

Parsear con selectolax: `from selectolax.parser import HTMLParser; HTMLParser(html).css("div.producto")`. Prefiere selectores por atributos estables (`data-*`, ids) sobre clases generadas.

## 6. Playwright (cuando sí hace falta)

- Instalar en el venv del proyecto: `uv add playwright` y `uv run playwright install chromium`.
- Arch/CachyOS **no es plataforma oficial** de Playwright (oficiales: Debian 12/13, Ubuntu 22.04/24.04/26.04). Si el Chromium descargado falla por dependencias, usa la imagen Docker oficial `mcr.microsoft.com/playwright/python` con el **mismo número de versión** que tu paquete.
- Espera elementos (`page.wait_for_selector`, `locator`) en lugar de `sleep` fijos.
- Muchas páginas cargan sus datos con una llamada JSON: puedes leer esa respuesta desde Playwright (`page.on("response", ...)`) en vez de parsear el DOM. Si es una API interna no documentada, revisa los términos antes de llamarla directamente.
- Bloquea imágenes y fuentes con `page.route` para gastar menos ancho de banda (el tuyo y el del sitio).
- Mismo límite de velocidad que con httpx.

## 7. Correrlo seguido

- Programado con timer de systemd (skill `servicios-24-7`) o Cron Trigger de Cloudflare si es liviano (`cloudflare-gratis-decisiones`).
- Log por corrida: URLs pedidas, status, registros parseados, errores. Alerta si falla dos corridas seguidas.

## Antes de decir "listo"

- [ ] Revisados términos y robots.txt; decisión explicada al usuario.
- [ ] Se intentó API/exportación antes que HTML, y HTML antes que navegador.
- [ ] Límite de velocidad, manejo de 429/503 y caché implementados.
- [ ] Crudo guardado; parser con tests sobre fixtures.
- [ ] Alerta cuando el parseo sale vacío.
- [ ] Sin rotación de IPs/UA, sin CAPTCHAs, sin login no autorizado, sin datos personales innecesarios.

## Cómo comprobarlo tú mismo

Corre el scraper con 5 URLs y abre la carpeta `raw/`: deben estar los 5 HTML. Luego mira el resultado limpio y compara 2 registros a mano contra la página en tu navegador.

## Fuentes (verificado nov 2026)

- https://www.rfc-editor.org/rfc/rfc9309 (Robots Exclusion Protocol)
- https://docs.python.org/3/library/urllib.robotparser.html
- https://www.python-httpx.org/
- https://github.com/rushter/selectolax
- https://www.crummy.com/software/BeautifulSoup/bs4/doc/
- https://playwright.dev/python/docs/intro (instalación, sistemas soportados)
- https://playwright.dev/python/docs/docker (imagen `mcr.microsoft.com/playwright/python`)
- https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf (LFPDPPP, DOF 20 mar 2025)
- PyPI (versiones a nov 2026): httpx 0.28.1, selectolax 1.0.2, beautifulsoup4 4.15.0, playwright 1.65.2
