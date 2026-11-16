---
name: seo-tecnico
description: SEO técnico y vistas previas al compartir - title y meta, Open Graph y X cards (link bonito en X y WhatsApp), canonical, sitemap.xml, robots.txt, JSON-LD schema.org, Core Web Vitals, Search Console, SPA vs SSR, con script de revisión. Usa al decir SEO, Google, preview, og:image.
---

# SEO técnico

Lo que corrige: Claude pone las meta tags con JavaScript en una SPA y el link se ve vacío en WhatsApp/X; bloquea páginas en `robots.txt` creyendo que así no se indexan; inventa ratings en schema.org; y da por hecho el SEO sin revisar el HTML que realmente reciben los bots.

Para la estética de la página usa `frontend-design`; para la estructura que convierte, `landing-que-convierte`; para rendimiento web a fondo, el plugin `cloudflare` tiene skills de web performance.

## Reglas

1. **Verifica antes de confiar.** Si vas a usar una propiedad de schema.org, un tipo de rich result o una regla de Google que no esté aquí, confírmala con WebFetch en `developers.google.com/search/docs` (o Context7 si está instalado). Los requisitos de rich results cambian.
2. **Revisa lo que ve un bot sin JavaScript**, no lo que ves en el navegador. Corre el script de esta skill (abajo) o `curl -s URL | grep -iE '<title|og:|twitter:|canonical|robots'`.
3. **Los bots de vista previa (X, WhatsApp, Facebook, Telegram) no deben depender de JS**: Google mismo advierte que "no todos los bots pueden ejecutar JavaScript". Title, description, canonical y Open Graph van en el **HTML inicial** de cada URL pública.
4. **Nunca inventes reseñas, ratings ni números** en datos estructurados ni en la página.
5. Explica al usuario en 1–3 frases qué vas a cambiar y por qué ("El link se veía vacío en WhatsApp porque la imagen se ponía con JavaScript; ahora va en el HTML").

## Qué indexar y qué no (terminal web + landing)

- **Indexar:** home/landing, precios, FAQ, docs públicas, blog. Deben ser HTML estático o prerenderizado.
- **No indexar:** la app detrás de login, el panel admin, páginas de checkout/éxito. Usa `<meta name="robots" content="noindex">` o el header `X-Robots-Tag: noindex` (en Workers static assets puedes ponerlo con el archivo `_headers`). Responde `401`/`403` en rutas privadas, no un 200 vacío.
- `robots.txt` **no evita la indexación** (Google puede indexar una URL bloqueada si alguien la enlaza). Y si bloqueas una URL en robots.txt, Google no puede leer su `noindex`. Usa `noindex`, no `Disallow`, para sacar páginas de Google.

## Plantilla de `<head>` para cada página pública

```html
<html lang="es-MX">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Producto — beneficio principal en pocas palabras</title>
  <meta name="description" content="Qué es, para quién y por qué elegirlo, en 1–2 frases.">
  <link rel="canonical" href="https://midominio.com/">

  <!-- Open Graph: og:title, og:type, og:image y og:url son obligatorios -->
  <meta property="og:title" content="Producto — beneficio principal">
  <meta property="og:description" content="Misma idea que la description.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://midominio.com/">
  <meta property="og:image" content="https://midominio.com/og/home.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Captura de la terminal mostrando ...">
  <meta property="og:locale" content="es_MX">

  <!-- X usa sus propias etiquetas; summary_large_image = imagen grande -->
  <meta name="twitter:card" content="summary_large_image">
</head>
```

- **Title y description únicos por página.** Nada de la misma description en todo el sitio.
- **Canonical absoluto con https**, uno solo por página, igual en HTML inicial y después de hidratar.
- **Imagen OG:** URL absoluta https, que descargue con `Content-Type: image/*`, sin protección de Cloudflare Access ni login. 1200×630 px es la convención habitual (proporción ~1.91:1); verifica la vista previa real en vez de confiar en la medida.
- WhatsApp y X **guardan en caché** la vista previa: después de corregir, prueba con una URL nueva (`?v=2`) o espera.
- Ojo con Cloudflare: si la landing está detrás de Access o un challenge que bloquea bots, la vista previa sale vacía.

## sitemap.xml y robots.txt

- Sitemap: solo URLs **canónicas, públicas, absolutas** (`https://...`), máximo 50,000 URLs o 50 MB sin comprimir por archivo. Google **ignora** `<priority>` y `<changefreq>`; usa `<lastmod>` solo si es exacto (cambio real de contenido).
- `robots.txt` mínimo:

```text
User-agent: *
Allow: /
Sitemap: https://midominio.com/sitemap.xml
```

- Si es un sitio chico estático, genera el sitemap en el build (o escríbelo a mano) y revisa que no incluya `/app`, `/admin` ni URLs con parámetros.

## Datos estructurados (JSON-LD)

- En la home: `Organization` (nombre, url, logo, sameAs con redes oficiales) y `WebSite`.
- `SoftwareApplication` da rich result **solo** si incluyes `aggregateRating` o `review` reales (además de `name` y `offers.price`). Si el producto es nuevo y no hay reseñas reales, **no lo agregues** para forzarlo.
- `FAQPage` solo si las preguntas y respuestas están visibles en la página.
- Valida con la **Prueba de resultados enriquecidos** de Google y corrige errores antes de publicar.

## Core Web Vitals (umbral "bueno", percentil 75, móvil y escritorio)

| Métrica | Bueno | Causas típicas y arreglo |
|---|---|---|
| LCP (carga) | ≤ 2.5 s | Imagen hero pesada → AVIF/WebP, tamaño correcto, `fetchpriority="high"`, sin lazy-load en la del hero. JS que bloquea → diferir |
| INP (respuesta) | ≤ 200 ms | JS pesado en el hilo principal → partir tareas, cargar widgets (charts, wallets) después de la interacción |
| CLS (estabilidad) | ≤ 0.1 | `<img>` sin `width`/`height`, banners que empujan contenido, fuentes que cambian de tamaño |

Mide con PageSpeed Insights (datos de campo + laboratorio) o Lighthouse en Chrome DevTools; los datos reales aparecen en Search Console > Core Web Vitals cuando hay tráfico suficiente.

## SPA vs SSR

- Google renderiza JS, pero en una cola aparte (puede tardar) y otros bots no. Para páginas que deben posicionarse o compartirse: **HTML estático o SSR/prerender**.
- Si es SPA: rutas con History API y `<a href>` reales (nunca `#/ruta`), un título/description por ruta, y para rutas inexistentes devuelve un **404 real** o pon `noindex` (si no, Google las marca como soft 404).
- No pongas `noindex` en el HTML inicial esperando quitarlo con JS: Google puede ni ejecutar el JS.
- Para una terminal de trading: landing estática separada (`midominio.com`) y la app SPA en `app.midominio.com` con `noindex`. Es lo más simple y robusto.

## Google Search Console

1. Agrega una propiedad **de dominio** (cubre todos los subdominios y http/https). Se verifica con un registro **TXT en DNS**: en Cloudflare, DNS > Records > Add record > TXT con el valor que da Google. Espera y verifica.
2. Envía el sitemap en **Sitemaps** (también queda declarado en robots.txt). Enviarlo es una sugerencia, no garantía.
3. Usa **Inspección de URLs** para ver el HTML renderizado que vio Google y pedir indexación de páginas nuevas.
4. Revisa una semana después: **Páginas** (qué está indexado y por qué no) y **Core Web Vitals**.

## Checklist ejecutable (al terminar, con evidencia)

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/seo-tecnico/scripts/revisar-seo.py" https://midominio.com/
```

El script (solo librería estándar de Python) descarga la página **sin JS** y revisa: status 200, title, description, canonical único y absoluto, noindex, viewport, lang, h1, imágenes sin medidas, og:title/type/image/url, que og:image descargue como imagen, twitter:card, JSON-LD válido, robots.txt y sitemap. Sale con código 1 si hay algún `FALTA`. Córrelo en cada página pública importante y muéstrale la salida al usuario.

Dile cómo comprobarlo él: pegar el link en un chat de WhatsApp consigo mismo y en un borrador de X para ver la vista previa, y correr PageSpeed Insights (https://pagespeed.web.dev/) con su URL.

## Fuentes (verificado nov 2026)

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://support.google.com/webmasters/answer/34592 (propiedades de dominio y verificación DNS)
- https://web.dev/articles/vitals
- https://ogp.me/
- https://developers.cloudflare.com/workers/platform/limits/ (`_headers` en static assets)
- No verificado en doc oficial (sitio de X no accesible hoy): medidas exactas de imagen para `summary_large_image`. Comprueba con la vista previa real.
