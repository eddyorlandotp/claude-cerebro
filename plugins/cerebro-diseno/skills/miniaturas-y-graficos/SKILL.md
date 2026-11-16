---
name: miniaturas-y-graficos
description: Miniaturas y gráficos promocionales para YouTube, Roblox y Steam a tamaño oficial, legibles en celular, en lote desde plantillas HTML/SVG a PNG con chequeo de texto desbordado. Usa al decir miniatura, thumbnail, cápsula, ícono.
---

# Miniaturas y gráficos por plantilla

El error que corrige: Claude adivina tamaños ("1280×720 siempre"), mete frases larguísimas que en un celular no se leen, hace cada miniatura a mano distinta y no revisa cómo se ve a 320 px. Aquí cada pieza sale de **una plantilla + datos**, se renderiza al tamaño oficial y se revisa en chico.

Formatos de video vertical y zonas tapadas de TikTok/Reels: skill `contenido-para-redes` de `cerebro-negocio`. Proceso de lanzamiento en Steam: `steam-lanzamiento` de `cerebro-juegos`. Colores y fuentes: `marca/marca.json` (skill `branding-y-logos`).

## Reglas

1. **Verifica el tamaño antes de hacer la plantilla**: abre la página oficial de la tabla de abajo con WebFetch. Cambian (YouTube subió su recomendación a 3840×2160).
2. **Una plantilla por tipo de pieza** (`graficos/plantillas/miniatura-youtube.html`), datos en JSON, render con script. Nunca edites un PNG final a mano para "corregir un texto".
3. **Siempre revisa la previa chica** (`--previa 320`) mirándola tú con la herramienta de leer imágenes. Si no se entiende a 320 px, no sirve.
4. **No inventes contenido**: Roblox y Steam rechazan arte que muestre cosas que no están en el juego. Usa capturas reales del juego que te pase el usuario.
5. Explica en 1–3 frases la idea de cada miniatura ("Personaje grande a la derecha con cara de susto, 2 palabras en amarillo a la izquierda").

## Tamaños oficiales (a nov 2026 — verifícalos en las URLs de Fuentes)

| Pieza | Tamaño | Reglas que importan |
|---|---|---|
| YouTube miniatura | 16:9; recomendado **3840×2160**, mínimo 640 de ancho | JPG/PNG; máx. **2 MB si se sube desde el celular**, 50 MB desde computadora; requiere cuenta verificada |
| YouTube Shorts miniatura | 9:16; recomendado 2160×3840 | Requiere cuenta verificada |
| Roblox ícono | cuadrado, **512×512** | Se muestra a ~150×150: revisa que se lea así; pasa moderación |
| Roblox miniaturas | **1920×1080** (16:9; otras proporciones se estiran) | Hasta 10 imágenes/videos; nada importante abajo (ahí va el contador de jugadores); texto mínimo; prohibido mostrar cosas que no están en el juego, "gratis" o descuentos |
| Steam header capsule | 920×430 | Solo el título como texto, logo legible |
| Steam small capsule | 462×174 | El logo casi llena la cápsula |
| Steam main capsule | 1232×706 | Arte clave + logo |
| Steam vertical capsule | 748×896 | Ventas de temporada |
| Steam library capsule | 600×900 | Solo el título como texto |
| Steam library hero | 3840×1240 | **Sin texto**; lo importante en la zona centrada de 860×380 |
| Steam library logo | 1280 de ancho y/o 720 de alto, PNG transparente | Solo el logotipo |
| Steam screenshots | mín. 1920×1080, mínimo 5 | Solo gameplay real |

## Composición que se lee en celular

- **Máximo 3 elementos**: un sujeto (personaje, cara, objeto del juego) grande, **1–4 palabras** de texto, y un fondo que contraste. Si necesitas explicar, eso va en el título, no en la miniatura.
- Texto grueso (peso 800–900), con contorno o sombra dura, altura de letra de al menos ~1/8 de la imagen. No repitas el título del video palabra por palabra.
- Contraste fuerte entre sujeto y fondo; satura un poco más que la captura original, sin mentir sobre cómo se ve el juego.
- Zonas a evitar: abajo a la derecha en YouTube (ahí se pone la duración), abajo en Roblox (metadatos). Deja ~5 % de margen en todos los bordes.
- **Serie consistente**: misma posición del texto, misma tipografía y paleta; cambia sujeto y palabras. Así el canal se reconoce.
- Revisa la previa a 320 px junto a 2–3 miniaturas reales de la competencia (que el usuario te pase capturas) para comparar.

## Generar en lote con plantilla HTML (recomendado)

La plantilla es HTML con un `<div id="lienzo">` del tamaño exacto y marcadores `{{CLAVE}}`. Los elementos de texto llevan `class="texto"` con ancho y alto fijos y `overflow:hidden`, para que el script detecte si se desbordan:

```html
<div id="lienzo" style="width:1920px;height:1080px;position:relative;overflow:hidden">
  <img src="capturas/{{CAPTURA}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
  <h1 class="texto" style="position:absolute;left:96px;top:96px;width:1000px;height:420px;margin:0;
      font:900 170px/1 'Inter';color:#fff;-webkit-text-stroke:12px #000;paint-order:stroke fill;overflow:hidden">{{TITULO}}</h1>
</div>
```
`datos.json`: `[{"ARCHIVO": "ep01", "TITULO": "Robé todo", "CAPTURA": "ep01.png"}, ...]`

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/render_plantilla.py" graficos/plantillas/miniatura-youtube.html \
  graficos/datos/youtube.json graficos/salida/youtube --ancho 1920 --alto 1080 --escala 2 --previa 320
```
- `--escala 2` da 3840×2160 desde una plantilla de 1920×1080 (probado). Para Roblox usa `--escala 1`.
- Imprime `ok` o `DESBORDA: <texto>` por pieza y sale con código 1 si alguna se desborda: acorta el texto o baja el tamaño, no cambies el `overflow`.
- Los valores del JSON se insertan **escapados** (no puedes meter HTML en los datos); para resaltar una palabra usa dos claves (`{{LINEA1}}`, `{{LINEA2}}`) con estilos distintos.
- Rutas de imágenes relativas a la plantilla. Fuentes: instaladas en el sistema (`fc-list`) o con `@font-face` a un archivo local; el script espera `document.fonts.ready`.
- Probado con Playwright 1.63 para Python. Si falta, crea un venv como dice la skill `ui-ux-basico`.

Alternativa sin navegador: plantilla **SVG** con marcadores, reemplazo con `sed` o Python y `rsvg-convert -w 1920 -h 1080`. Es más rápida, pero el texto no hace salto de línea solo: úsala para piezas con texto fijo (cápsulas de Steam, banners).

## Después del render

```bash
# JPG para subir (YouTube desde celular pide <= 2 MB; Roblox personalizadas < 3 MB)
magick graficos/salida/youtube/ep01.png -strip -quality 88 graficos/salida/youtube/ep01.jpg
magick identify -format "%f %wx%h %b\n" graficos/salida/youtube/*.jpg
# hoja de contacto para revisar toda la serie de un vistazo
magick montage graficos/salida/youtube/*-previa.png -tile 4x -geometry +6+6 -background '#222' graficos/salida/youtube/serie.png
```
Más comandos (recortar, WebP, quitar metadatos): skill `imagenes-por-terminal`.

## Lo que hace el usuario a mano

- **Capturas del juego**: Claude no puede jugar ni abrir Roblox Studio o el juego de Steam. Pídele capturas a resolución completa (1920×1080 o más), sin interfaz si se puede, con poses o escenas concretas que tú le describas.
- Quitar fondo de un personaje: no hay herramienta verificada aquí; pide el PNG con fondo transparente (desde Studio o un editor) o diseña sin recorte.
- Subir las piezas en YouTube Studio, el Creator Hub de Roblox o Steamworks.
- A/B en YouTube: "Test & compare" prueba hasta 3 miniaturas/títulos, gana la de **más tiempo de visualización** (no la de más clics), solo desde computadora en YouTube Studio, con funciones avanzadas activadas; no aplica a Shorts. Genera 3 variantes con la plantilla (`ep01-a`, `ep01-b`, `ep01-c`).

## Al terminar

Entrega: rutas de los PNG/JPG finales, la hoja `serie.png` o las previas a 320 px, la salida del script sin `DESBORDA`, y el tamaño y peso de cada archivo. Dile cómo comprobarlo: "súbela como borrador y mírala desde tu celular en la página de inicio".

## Fuentes (verificado nov 2026)

- https://support.google.com/youtube/answer/72431 (miniaturas: 3840×2160, mínimo 640, 2 MB celular / 50 MB computadora)
- https://support.google.com/youtube/answer/16391400 (Test & compare: hasta 3, gana tiempo de visualización)
- https://create.roblox.com/docs/production/promotion/game-icons (ícono 512×512, se ve a ~150 px)
- https://create.roblox.com/docs/production/promotion/thumbnails (1920×1080, 16:9, hasta 10, < 3 MB, reglas de contenido)
- https://partner.steamgames.com/doc/store/assets/standard (cápsulas y screenshots)
- https://partner.steamgames.com/doc/store/assets/libraryassets (library capsule, hero, logo)
- `render_plantilla.py`, `magick montage` e `identify` probados aquí con plantillas generadas.
