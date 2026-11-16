---
name: branding-y-logos
description: Definir la marca en un archivo reutilizable (nombre, tono, colores, tipografía) y hacer logos SVG revisados, con favicon, avatar redondo y banners de X/YouTube a tamaño correcto. Usa al decir marca, logo, branding, favicon.
---

# Branding y logos desde la terminal

El error que corrige: Claude inventa colores distintos en cada archivo, dibuja un SVG "a ciegas" sin renderizarlo, usa fuentes que no están instaladas, exporta un solo PNG gigante y no revisa si el logo se lee a 32 px o recortado en círculo. Aquí la marca vive en **un archivo** y todo se exporta con un script.

Para la dirección visual de páginas usa `frontend-design`; para comandos de imagen sueltos, `imagenes-por-terminal`.

## Reglas

1. **Una sola fuente de verdad**: `marca/marca.json` + `marca/MARCA.md`. Todo CSS, plantilla de miniatura o banner lee de ahí. Si un color no está en `marca.json`, no se usa.
2. **Nunca entregues un logo sin haberlo renderizado y mirado** (PNG grande + hoja de tamaños chicos + recorte circular). El SVG escrito a mano casi siempre tiene algo descentrado.
3. **Propón 3 opciones distintas** de logo en una sola hoja de comparación y deja que el usuario elija. No pulas una sola idea sin preguntarle.
4. **Texto del logo convertido a trazos** antes de exportar: si no, cada computadora lo dibuja con otra fuente.
5. **Verifica antes de confiar**: los tamaños de redes cambian. Si vas a publicar, abre la página de ayuda de la red (en Fuentes) con WebFetch y confirma.
6. Explica cada decisión en 1–3 frases ("Verde sobre casi-negro porque es una terminal de trading y el verde ya significa 'sube'; pasa contraste 8.4:1").

## Paso 1: el archivo de marca

Crea `marca/marca.json` (lo lee `contraste.py` de la skill `ui-ux-basico`):
```json
{
  "nombre": "MiMarca",
  "colores": {"fondo": "#0B0F14", "superficie": "#151B23", "texto": "#E5E7EB",
              "texto-suave": "#9CA3AF", "acento": "#22C55E", "peligro": "#EF4444"},
  "pares": [["texto","fondo"], ["texto-suave","fondo"], ["acento","fondo"], ["peligro","fondo"]],
  "fuentes": {"titulos": "Space Grotesk", "texto": "Inter", "numeros": "JetBrains Mono"}
}
```
Y `marca/MARCA.md` con: qué es el proyecto en una frase, público, **tono en 3 adjetivos** con 2 ejemplos de "sí decimos / no decimos", roles de cada color (acento solo para la acción principal, peligro solo para pérdidas y errores), fuentes y su licencia, y rutas de los logos.

Revisa contraste de todos los pares (sale con código 1 si alguno no llega a 4.5:1):
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ui-ux-basico/scripts/contraste.py" --marca marca/marca.json
```

Paleta: 1 color de acento, 1–2 neutros oscuros y 1–2 claros, y colores de estado (éxito/peligro). Más de 5–6 colores es un arcoíris, no una marca. Genera también las variables CSS (`--color-acento: #22C55E;`) desde el JSON para que la web no copie hex a mano.

Fuentes: usa fuentes con licencia abierta (OFL, p. ej. Google Fonts) y anótala. Comprueba que estén instaladas con `fc-list | grep -i "Inter"` antes de renderizar; si no están, el render usa otra fuente sin avisar.

## Paso 2: el logo en SVG

Reglas de un logo que funciona en avatar de 32 px:
- Un **símbolo** cuadrado (lo que va en favicon y avatar) separado del **logotipo** (nombre escrito). El nombre casi nunca cabe legible en 32 px.
- Formas geométricas simples, trazos gruesos (en un `viewBox` de 512, nada más delgado que ~24), 1–2 colores de la marca.
- Margen interno de ~10 % en el `viewBox` cuadrado; el contenido importante dentro del **círculo inscrito** (las redes lo recortan redondo).
- Debe funcionar en **una sola tinta** (todo blanco sobre el acento, todo negro sobre blanco). Haz esa variante también.
- Nada de degradados finos, sombras ni detalles chicos: desaparecen a 16 px.
- No copies logos de otras marcas ni uses personajes con derechos.

Flujo:
1. Escribe `marca/logo-opcion-{1,2,3}.svg` a mano (paths, `circle`, `rect`; `viewBox="0 0 512 512"`).
2. Valida que sea XML correcto: `python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse(sys.argv[1])" marca/logo-opcion-1.svg`.
3. Renderiza las tres juntas para compararlas y **míralas**:
   ```bash
   for i in 1 2 3; do rsvg-convert -w 512 -h 512 marca/logo-opcion-$i.svg -o /tmp/op$i.png; done
   magick /tmp/op1.png /tmp/op2.png /tmp/op3.png +append marca/comparacion.png
   ```
4. Cuando el usuario elija, convierte texto a trazos con Inkscape (probado con Inkscape 1.2; mismas opciones en 1.4):
   ```bash
   inkscape marca/logo-opcion-2.svg --export-text-to-path --export-plain-svg --export-filename=marca/logo.svg
   grep -c "<text" marca/logo.svg   # debe dar 0
   ```

## Paso 3: exportar todo

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/exportar_logo.sh" marca/logo.svg marca/export "#0B0F14"
```
El tercer argumento es el color de fondo para los íconos que deben ser opacos. Genera (probado con rsvg-convert 2.58 e ImageMagick 6 y 7):

| Archivo | Tamaño | Para qué |
|---|---|---|
| `favicon.ico` | 16 + 32 | Pestaña del navegador, raíz del sitio |
| `icon.svg` | vector | Favicon moderno |
| `apple-touch-icon.png` | 180×180, fondo sólido | Acceso directo en iPhone |
| `icon-192.png`, `icon-512.png` | 192, 512 | Manifest (PWA/Android) |
| `icon-mask.png` | 512, logo dentro del 80 % central | Ícono "maskable" de Android |
| `avatar-400-x.png` | 400×400 | Foto de perfil de X |
| `avatar-800-youtube.png` | 800×800 | Foto de perfil de YouTube |
| `avatar-1080.png` | 1080×1080 | TikTok, Discord, Telegram (TikTok no publica un tamaño oficial; cuadrado grande es lo seguro) |
| `revision-circulo.png`, `revision-tamanos.png` | — | Solo para revisar: recorte redondo y el logo a 16/32/48/98 px |

Mira las dos imágenes de revisión. Si a 32 px no se distingue el símbolo, simplifícalo y repite.

HTML para el favicon:
```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```

## Tamaños de perfil y banners (a nov 2026 — verifícalos antes de publicar)

| Red | Pieza | Tamaño | Notas oficiales |
|---|---|---|---|
| X | Foto de perfil | 400×400 | Máx. 2 MB; JPG, PNG o GIF |
| X | Header | 1500×500 | En el perfil la foto tapa parte de la esquina inferior izquierda: deja esa zona libre y revísalo en celular |
| YouTube | Foto de perfil | se muestra a 98×98 | JPG/PNG/GIF/BMP sin animación, máx. 15 MB |
| YouTube | Banner | 2560×1440 recomendado (mín. 2048×1152) | Texto y logo dentro de la zona segura **1235×338** centrada; máx. 6 MB |
| Web | Imagen al compartir (og:image) | 1200×630 | Ver skill `seo-tecnico` de `cerebro-web` |

Los banners se hacen como plantilla HTML o SVG con los colores de `marca.json` y se renderizan con `render_plantilla.py` de la skill `miniaturas-y-graficos`. Para el de YouTube marca la zona segura con un rectángulo temporal, revisa la captura y quítalo antes de exportar.

## Lo que hace el usuario a mano

- Elegir entre las 3 opciones y dar el visto bueno final.
- Revisar que el nombre esté libre: dominio, @ en cada red, y la búsqueda gratuita de marcas del IMPI (herramienta MARCia) si piensa registrarla. Claude no puede asegurar que un nombre no infrinja una marca.
- Subir avatar y banner en cada red y mandar captura de cómo quedó en celular.

## Al terminar

Entrega: `marca/marca.json`, `marca/MARCA.md`, `marca/logo.svg` (con texto en trazos), la carpeta `marca/export/`, la salida de `contraste.py` y las dos imágenes de revisión. Dile cómo comprobarlo: "abre la página y mira la pestaña: el ícono debe verse claro también en modo oscuro".

## Fuentes (verificado nov 2026)

- https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo (400×400, 2 MB, 1500×500)
- https://support.google.com/youtube/answer/10456525 (perfil 98×98 y 15 MB; banner 2048×1152 mín., 2560×1440, zona 1235×338, 6 MB)
- https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs (set de favicon, actualizado 2026)
- https://wiki.inkscape.org/wiki/Using_the_Command_Line (opciones de exportación de Inkscape 1.x)
- https://www.w3.org/TR/WCAG22/ (contraste 4.5:1 y 3:1)
- https://www.cibnor.gob.mx/images/stories/covisti/ott_cepat/Guia_de_usuario_MARCia.pdf (MARCia, buscador de marcas del IMPI)
- Comandos `rsvg-convert`, `inkscape --export-text-to-path` y `exportar_logo.sh` probados aquí con SVG generados.
