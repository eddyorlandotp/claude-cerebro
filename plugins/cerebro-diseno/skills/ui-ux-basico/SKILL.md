---
name: ui-ux-basico
description: Que una app, dashboard o terminal de trading se entienda - jerarquía, estados de carga/vacío/error, densidad de números, móvil primero, contraste y foco, revisión con capturas de Playwright. Usa al hacer o revisar pantallas, UX, usabilidad.
---

# UI/UX básico: que se entienda y no falle en la cara del usuario

Esta skill es de **usabilidad y verificación**, no de estética. Para dirección visual, tipografía y que no se vea genérico usa `frontend-design`; para manejar el navegador a mano usa el plugin `playwright`. El error que corrige: Claude arma pantallas que solo funcionan "con datos bonitos", sin estados de carga/error, con números que bailan, botones de 16 px y foco invisible, y las declara listas sin haberlas visto en un celular.

## Reglas

1. **Antes de diseñar una pantalla escribe 3 líneas** (en el plan o como comentario): qué quiere lograr el usuario aquí, cuál es **la** acción principal, y cuál es el dato más importante. Todo lo demás es secundario y se ve secundario.
2. **Cada bloque que carga datos tiene 5 estados**, y los implementas todos antes de decir "listo": cargando, vacío, error, desactualizado/parcial y con datos. Haz la tabla de abajo por componente.
3. **Móvil primero**: diseña a 390 px de ancho y luego amplía. Nada puede provocar scroll horizontal de la página.
4. **No digas que una pantalla está terminada sin capturas** (escritorio y móvil) que tú hayas mirado, y sin correr `revisar_ui.py`. Usa la skill `verification-before-completion` de `superpowers` si está disponible.
5. Explica al usuario en 1–3 frases simples cada decisión que cambie cómo se usa la app ("Puse el botón Comprar fijo abajo en celular para que siempre esté a la mano").

## Jerarquía en 30 segundos

- Una sola acción principal por vista (botón sólido); el resto, secundarias (borde o texto). Acciones destructivas o que mueven dinero: separadas de las demás y con confirmación.
- Tamaño y peso para ordenar: el número clave grande, la etiqueta chica y gris encima. No pongas todo en negritas.
- Agrupa con espacio antes que con bordes y cajas. Alinea a una cuadrícula; los números siempre a la derecha en tablas.
- **Prueba de 5 segundos**: mira la captura móvil y contesta: ¿qué es esta pantalla?, ¿qué hago aquí?, ¿cuál es el número importante? Si dudas en alguna, la jerarquía está mal.

## Estados obligatorios (tabla por componente)

| Estado | Qué mostrar | Error común |
|---|---|---|
| Cargando | Esqueleto con la **misma forma y tamaño** que el contenido final | Spinner centrado que luego empuja todo (salto de layout) |
| Vacío | Qué va a aparecer aquí y la acción para llenarlo ("Aún no sigues wallets. Agrega una") | Tabla vacía sin texto o con "No data" |
| Error | Qué pasó en lenguaje simple + qué hacer + botón Reintentar. Conserva los últimos datos si los hay | Pantalla en blanco o el error técnico crudo |
| Desactualizado / sin conexión | Datos viejos marcados (gris, "actualizado hace 2 min", icono de reconexión) | Seguir mostrando precios viejos como si fueran en vivo |
| Con datos | Lo normal, probado también con textos largos, números enormes y 1 vs 500 filas | Probar solo con 3 filas cortas |

Para probar estados sin backend real, agrega un parámetro de URL de desarrollo (`?estado=error`, `?estado=vacio`) o datos simulados, y saca captura de cada uno.

## Dashboards y terminal de trading: densidad sin caos

- **Números que no bailan**: `font-variant-numeric: tabular-nums` en todo número que se actualiza, alineado a la derecha, ancho fijo de columna. Si el ancho cambia con cada tick, la tabla tiembla.
- **Decimales consistentes por tipo de dato**: precio de memecoin con dígitos significativos (`maximumSignificantDigits: 4`), porcentajes con 2 decimales, montos en USD con 2. Muestra siempre la unidad (USD, SOL, %).
- **Formato con `Intl.NumberFormat`**, nunca a mano. Ojo, probado: en `es-MX` la notación compacta da `1.2 k`, `1.2 M` y **`2500 M`** para 2.5 mil millones, y la moneda sale `USD 1,234.50`. Si el público lee en inglés o espera `2.5B`, usa `en-US`. Decide un locale y úsalo en toda la app.
- **No solo color**: sube/baja con signo y flecha además de verde/rojo (`+3.45 %` ▲). Hay daltonismo rojo-verde; el color solo refuerza.
- **Tiempo real visible**: indicador de conexión (en vivo / reconectando / desconectado) y "hace X s" en datos críticos. Si el websocket se cae, la UI lo dice.
- **Destellos al cambiar precio**: cortos y sutiles, y desactivados con `@media (prefers-reduced-motion: reduce)`.
- **Acciones con dinero** (comprar, vender, retirar): antes de confirmar muestra monto, comisión, slippage y lo que recibe el usuario; deshabilita el botón mientras envía (evita doble envío) y muestra el resultado con enlace a la transacción. Las reglas de riesgo están en `cerebro-solana`.
- Densidad: en escritorio una terminal puede ser densa (filas de 28–32 px), pero con jerarquía: 1 zona principal (gráfica o lista), 1 panel de acción, el resto colapsable. En móvil: pestañas o tarjetas; una tabla ancha va dentro de su propio contenedor con scroll horizontal y la primera columna fija, nunca la página entera.

## Accesibilidad mínima (WCAG 2.2 nivel AA)

| Criterio | Regla concreta |
|---|---|
| 1.4.3 Contraste | Texto normal **4.5:1**; texto grande (≥24 px, o ≥18.66 px en negrita) **3:1** |
| 1.4.11 Contraste no textual | Bordes de inputs, iconos y estados de foco **3:1** contra lo de al lado |
| 2.4.7 Foco visible | Nunca `outline: none` sin reemplazo. Usa `:focus-visible { outline: 2px solid <color de acento>; outline-offset: 2px }` |
| 2.4.11 Foco no tapado | Un header o barra fija no debe tapar el elemento con foco |
| 2.5.8 Tamaño de objetivo | Mínimo **24×24 px** CSS (o suficiente espacio alrededor). Para botones principales en móvil usa más |
| 1.4.10 Reflow | Usable a **320 px** de ancho sin scroll horizontal (salvo tablas/gráficas) |
| 1.4.4 Texto al 200 % | Al hacer zoom a 200 % no se corta ni se encima texto |

Además: cada input con `<label>` (el placeholder no cuenta), botones de solo icono con `aria-label`, y todo lo que se clickea se puede usar con teclado (Tab, Enter, Espacio).

Contraste: no lo estimes a ojo. Corre:
```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/contraste.py" "#9CA3AF" "#0B0F14"
```
Imprime la razón y si pasa AA/AAA (probado: negro/blanco 21:1, `#767676`/blanco 4.54:1). Con `--marca marca.json` revisa todos los pares de la marca (ver `branding-y-logos`).

## Revisar con capturas

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/revisar_ui.py" http://localhost:5173 capturas-ui
```
Genera `escritorio.png` (1440×900), `movil.png` (390×844 a escala 1, página completa) y `movil-foco.png` (tras 3 Tab), y avisa de: scroll horizontal en móvil, objetivos táctiles menores a 24 px, foco sin indicador y errores de consola. Sale con código 1 si hay avisos. Probado con Playwright 1.63 para Python.

- Si falta Playwright: crea un venv (`python -m venv .venv-ui && .venv-ui/bin/pip install playwright && .venv-ui/bin/python -m playwright install chromium`) y corre el script con ese Python. En CachyOS no uses `pip install` global.
- Los avisos automáticos **no sustituyen mirar las capturas**. Ábrelas con la herramienta de leer imágenes y aplica la prueba de 5 segundos y la tabla de estados.
- Si emulas un iPhone con `p.devices["iPhone 13"]`, la captura sale 3× más grande (escala de dispositivo 3). Usa `screenshot(scale="css")` o escala 1 para no gastar contexto.
- Para flujos (login, comprar) usa el plugin `playwright` o escribe un test que haga los clics y saque capturas en cada paso.

## Microtexto

- Errores: qué pasó + qué hacer ("No pudimos cargar los precios. Revisa tu conexión y toca Reintentar"). Nada de "Error 500" a secas.
- Botones con verbo y objeto ("Comprar 0.5 SOL"), no "Aceptar".
- Confirmaciones solo para lo irreversible; para lo demás, deshacer.
- Tono y términos según el público: si no son cripto-nativos, explica "slippage" con un tooltip.

## Al terminar

Entrega al usuario: las capturas (escritorio, móvil, estados de error y vacío), la salida de `revisar_ui.py` sin avisos o con los avisos justificados, y cómo comprobarlo él: "abre la página en tu celular, pon el modo avión y mira qué pasa".

## Fuentes (verificado nov 2026)

- https://www.w3.org/TR/WCAG22/ (1.4.3, 1.4.11, 2.4.7, 2.4.11, 1.4.10, 1.4.4; fórmula de contraste)
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (24×24 px y excepciones)
- https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric (tabular-nums)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat (formato probado en Node 22)
- https://playwright.dev/python/docs/screenshots y https://playwright.dev/python/docs/emulation (capturas y emulación; scripts probados con Playwright 1.63)
