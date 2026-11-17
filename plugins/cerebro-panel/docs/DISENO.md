# Diseño de Telaraña (cerebro-panel)

## Qué es y para quién

Una pantalla completa, en un segundo monitor, que deja **ver a Claude Code trabajar** mientras el usuario está en la terminal. Modo de diseño: **Operar** (se mira de reojo, a 1–2 m, muchas horas). Gana lo que se entiende de un vistazo; el espectáculo va en momentos puntuales, no en todo.

Una sola pregunta responde cada zona:

| Zona | Pregunta que responde |
|---|---|
| **Pensamiento** (centro) | ¿Qué está haciendo Claude ahora mismo y en qué piensa? |
| **Biblioteca** (izquierda) | ¿Qué skills tiene, cuáles le recomendó la araña y cuáles usó? |
| **Flujo** (abajo) | ¿Qué pasos lleva este turno y dónde se atoró? |
| **Contexto** (derecha arriba) | ¿Cuánta ventana y cuántos tokens lleva gastados? |
| **Hilo** (derecha medio) | ¿Cuál es el objetivo, qué archivos tocó y qué falta? |
| **Actividad** (derecha abajo) | ¿Qué fue lo último que pasó, línea por línea? |

## Lo que NO debe parecer

El usuario mostró referencias. Las que le gustan (la araña cian sobre nube de puntos, el flujo de bloques) comparten: fondo casi negro, **un** color de señal, líneas finas, etiquetas pequeñas, mucho aire, nada de degradados. La que le parece "hecha con IA" (el tablero de trading arcoíris) tiene: seis colores neón a la vez, resplandores, tarjetas redondeadas apiladas, todo gritando. Reglas duras:

- **Tres colores con significado y ninguno más**: cian = Claude/actividad normal, rosa = error/atención, ámbar = te toca a ti. Nada de arcoíris, nada de morado, nada de verde "éxito" (éxito es simplemente cian tenue o blanco).
- Sin degradados, sin texto con degradado, sin vidrio/blur decorativo, sin `box-shadow` de resplandor, sin bordes redondeados en paneles (radio 0; solo la cara y las burbujas son curvas porque son personajes).
- Sin tarjetas. Las zonas se separan con **líneas de 1 px y espacio**, no con cajas rellenas. El fondo es uno solo y continuo.
- Sin emoji. Íconos propios en SVG de trazo 1.5 px, un solo estilo.
- La luz sale de **muchos puntos pequeños sumados en el canvas** (mezcla aditiva), no de filtros CSS.
- Nada se mueve porque sí. Movimiento constante solo en: respiración de la nube de puntos, patas de la araña, pulsos del flujo y parpadeo de la cara.

## Tokens visuales

```css
--fondo: #06090b;        /* casi negro con tinte azul-verde */
--fondo-2: #0b1013;      /* cabeceras de bloque, pestañas */
--linea: #18222a;        /* separadores de 1 px */
--linea-2: #263540;      /* bordes de bloques y etiquetas */
--tinta: #dfe8ea;        /* texto principal */
--tinta-2: #8a9aa1;      /* texto secundario (tintado, nunca gris puro) */
--tinta-3: #4d5c64;      /* texto terciario, ejes, apagado */
--cian: #86d5ea;         /* señal principal */
--cian-tenue: #2f5d6b;
--rosa: #ff4f72;         /* error, bandera, atención */
--ambar: #f0b54a;        /* espera al usuario */
--cara: #e9f0ef;         /* disco de la cara */
```

Contraste: `--tinta` sobre `--fondo` ≥ 13:1; `--tinta-2` ≥ 5.5:1; `--tinta-3` solo para adornos y ejes, nunca para información que haya que leer.

**Tipografía** (archivos locales en `ui/fuentes/`, licencia OFL; nada de CDN):
- `IBM Plex Sans Condensed` 500/600: rótulos de zona en versalitas con tracking 0.08em, números grandes.
- `IBM Plex Mono` 400/500: todo dato, rutas, comandos, pensamientos, registro.
- Escala fluida ligada al tamaño de pantalla: base `clamp(11px, 0.62vw + 4px, 15px)`; rótulos 0.85×; números grandes 3.2×; pensamientos 1.15×. Numerales tabulares (`font-variant-numeric: tabular-nums`) en todo número que cambie.

**Medidas**: rejilla de 4 px; padding de zona 16–24 px; todo alineado a las mismas líneas verticales (los bordes izquierdos de Biblioteca, Flujo y la barra superior coinciden).

## Composición

Un **canvas único a pantalla completa** debajo de todo dibuja la nube de puntos, las arañas, los hilos y los paquetes que vuelan. Encima va el DOM (textos, bloques, medidores) con fondo transparente. Por eso la interfaz se siente **unificada sin estar revuelta**: cada zona tiene su lugar y su rótulo, pero la araña y sus hilos cruzan de una a otra.

### Horizontal (ancho ≥ alto), p. ej. 1920×1080, 2560×1440, 3440×1440

```
┌ BARRA: TELARAÑA · proyecto · rama · modelo · turno · ⏱ · [pestañas minimizadas] · estado ─┐
│ BIBLIOTECA 26%          │ PENSAMIENTO 44%                 │ CONTEXTO      30%            │
│                         │      (burbujas de pensamiento)  ├──────────────────────────────┤
│  cúmulos de puntos,     │            ( o   o )            │ HILO                         │
│  uno por plugin,        │              cara               ├──────────────────────────────┤
│  y la araña             │   (caritas de subagentes)       │ ACTIVIDAD                    │
├─────────────────────────┴─────────────────────────────────┴──────────────────────────────┤
│ FLUJO 26% de alto: bloques conectados de izquierda a derecha                              │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

En ultrawide (relación ≥ 2.1) Biblioteca y la columna derecha crecen; el centro no pasa de 1100 px.

### Vertical (alto > ancho), p. ej. 1440×2560

De arriba a abajo: barra · Pensamiento (34%) · Biblioteca (24%) · Flujo (16%, los bloques hacen wrap en 2 filas) · Contexto + Hilo lado a lado (14%) · Actividad (resto).

### Pantallas chicas (< 1200 px de ancho)

Empiezan con Hilo y Actividad minimizados.

## Minimizar zonas (no cerrar)

- Cada rótulo de zona tiene a la derecha un botón `–`. Al pulsarlo, la zona se pliega y aparece como **pestaña** en la barra superior (estilo pestañas de navegador: rótulo + punto de actividad que parpadea en cian cuando ahí pasa algo, en rosa si hubo error). Clic en la pestaña la restaura a su lugar.
- La rejilla se recalcula sola: las zonas vecinas ocupan el espacio (transición de `grid-template` de 220 ms, `cubic-bezier(0.77, 0, 0.175, 1)`); el canvas reubica cúmulos y arañas con una interpolación de 400 ms.
- Pensamiento no se puede minimizar (es el corazón). Si se minimiza Biblioteca, la araña se muda a un rincón del centro y sigue entregando skills.
- Teclas: `1`–`5` alternan Biblioteca, Flujo, Contexto, Hilo, Actividad; `F` pantalla completa; `0` restaura todo. Las acciones por teclado no se animan.
- El acomodo se recuerda en `localStorage` (con try/catch).

## Personajes

### La cara (Claude)

Disco `--cara` de diámetro ≈ 18% del alto de su zona, con dos ojos: pastillas verticales oscuras (`--fondo`), sin boca. Un anillo fino alrededor muestra la ventana de contexto usada (arco cian que crece; pasa a ámbar > 75% y rosa > 90%). Estados (los ojos se mueven con resortes suaves, sin rebote exagerado):

| Estado | Cuándo | Ojos y cuerpo |
|---|---|---|
| `dormida` | sin sesión o > 2 min sin eventos | ojos = dos rayas; respira lento; todo el panel baja a 60% de brillo |
| `atenta` | llega un prompt | ojos se abren, miran al frente, un parpadeo |
| `pensando` | evento `pensamiento` | ojos arriba a un lado, deriva lenta; salen burbujas |
| `leyendo` | herramienta `leer`/`buscar`/`web` | ojos barren de izquierda a derecha en renglones |
| `escribiendo` | `editar` | ojos abajo, pequeños saltos |
| `ejecutando` | `comando` | ojos entrecerrados, fijos; el anillo gira un segmento |
| `delegando` | `agente` | mira hacia la carita del subagente activo |
| `hablando` | `dicho` | ojos al frente; una burbuja de diálogo (no de pensamiento) con el texto |
| `esperando` | `espera` | mira al espectador, anillo ámbar pulsando lento, burbuja "te toca" |
| `tropezó` | herramienta con `ok: false` | ojos se cierran fuerte 300 ms, sacudida de 4 px, destello rosa en el anillo |

Parpadea cada 3–7 s al azar. Respeta `prefers-reduced-motion`: sin deriva ni sacudidas, solo cambios de pose.

### Burbujas de pensamiento

Nubes de cómic dibujadas con **línea de 1 px cian, sin relleno** (contorno festoneado) y dos o tres circulitos que bajan hacia la cara. Dentro, una frase corta del pensamiento real (primera oración, máx ~90 caracteres, Plex Mono). Máximo 3 a la vez: la nueva nace junto a la cara (escala 0.95→1, opacidad 0→1, 220 ms ease-out), sube y las viejas se atenúan y salen (160 ms). Lo que Claude **dice** va en burbuja de diálogo (rectángulo con pico), para distinguir pensar de hablar. Al lado de la burbuja activa va un **monito**: pictograma animado de lo que hace (lupa que barre, hoja que pasa, cursor de terminal que parpadea, lápiz, globo, reloj de arena en ámbar).

### Subagentes

Caritas pequeñas (30% del tamaño de la principal), en arco debajo de la cara, cada una con su etiqueta (`Explore · límites de websockets`). Tienen los mismos estados reducidos. Al terminar, la carita viaja hasta la principal, le entrega un punto de luz y desaparece.

### La araña de la biblioteca

Dibujada por código en el canvas, estilo de la referencia: cuerpo de dos elipses con retícula, **ocho patas de dos segmentos con cinemática inversa** y paso alternado (las patas se plantan y el cuerpo avanza), trazo cian de 1 px, puntas con un punto. Tamaño ≈ 9% del alto de la zona.

- **Biblioteca** = cúmulos de puntos, uno por plugin (nube de 150–400 puntos con distribución gaussiana y líneas tenues entre vecinos), con el nombre del plugin como rótulo flotante. Cada skill es un punto más brillante dentro de su cúmulo. Plugins apagados: cúmulo en `--tinta-3`, sin líneas.
- **Reposo**: la araña pasea lento entre cúmulos; a su paso los puntos cercanos se iluminan (está "leyendo").
- **Llega un prompt** (`sugeridas`): corre hacia cada skill sugerida, la marca con una etiqueta recuadrada (nombre de la skill, como las etiquetas de la referencia), la envuelve en un paquete (cuadrito cian), y cuando tiene todas baja por un hilo hasta el borde de la zona y **se las avienta a la cara**: los paquetes vuelan en arco (600 ms, ease-in-out) y la cara parpadea al recibirlos. Bajo la cara quedan las etiquetas de "skills sugeridas" durante el turno.
- **Claude usa una skill** (`skill_usada`): esa etiqueta se rellena (fondo cian, texto oscuro) y un pulso viaja por el hilo de la cara al punto de la skill en la biblioteca.
- **Sugerida pero apagada**: etiqueta en ámbar con el texto `apagada`.

### La araña del hilo

Más pequeña, vive en la zona Hilo. Teje una telaraña radial: cada archivo tocado es un nudo; cuantas más veces se toca, más cerca del centro. La densidad de la telaraña refleja cuánto contexto se ha llenado. En `compactacion` la telaraña se recoge (los hilos se retraen 500 ms) y vuelve a empezar con solo los nudos del resumen.

## Zonas en detalle

**Barra superior** (alto 36 px): `TELARAÑA` · proyecto · rama · modelo · `turno 3` · cronómetro del turno · pestañas minimizadas · a la derecha, estado en una palabra (`pensando`, `esperándote`, `dormida`) con su punto de color y la hora.

**Flujo**: bloques rectangulares de borde 1 px `--linea-2`, cabecera `--fondo-2` con el nombre a la izquierda y la clase a la derecha en versalitas (`LEER`, `COMANDO`, `SKILL`…); debajo una línea con el resumen (ruta o comando truncado al medio) y una con `duración · tamaño`. Conectados por una línea de 1 px sobre la que corren puntos (pulsos) mientras el paso está en curso. Orden: `PROMPT` → `ARAÑA` (n skills) → pasos… → `RESPUESTA`. Pasos consecutivos de la misma clase se agrupan (`LEER ×3`). Bloque en curso: borde cian y cabecera con barra de progreso indeterminada de 1 px. Bloque fallido: borde y rótulo rosa. Subagentes: fila secundaria que se bifurca hacia abajo y regresa. Cuando no caben, los más viejos se comprimen a la izquierda en una pila `+7`. Los turnos anteriores quedan como una línea resumen sobre el flujo (`turno 2 · 9 pasos · 41 s`).

**Contexto**: número grande con el % de ventana usada y debajo `92.7k / 200k`; barra segmentada de 40 celdas; tres cifras: entrada, salida, caché leída (con una línea que explica "la caché cuesta ~10×menos"); barras por turno (mini histograma); costo equivalente en USD si se conoce, con la nota `equivalente API` (en planes de suscripción no es cobro real).

**Hilo**: objetivo (una línea), último pedido, archivos tocados con contador, pendientes con casilla (`hecho` tachado tenue), errores recientes en rosa. Es lo mismo que la araña guarda para que Claude retome tras compactar.

**Actividad**: registro de una línea por evento, hora a la izquierda en `--tinta-3`, verbo en versalitas de ancho fijo (`LEER`, `EDITAR`, `CORRER`, `BUSCAR`, `WEB`, `SKILL`, `ERROR`), detalle truncado. Lo nuevo entra arriba; máximo 200 líneas.

## Estados vacíos y de error

- **Sin sesión**: cara dormida, biblioteca viva y la araña paseando; texto bajo la cara: `Sin sesión activa. Abre Claude Code en cualquier proyecto y aquí aparece.`
- **Servidor desconectado**: banda rosa de 1 línea bajo la barra: `Se perdió la conexión con el panel. Reintentando…` y reintento con espera creciente.
- **Biblioteca vacía**: `No encontré skills instaladas. Corre /cerebro-base:actualizar-cerebro.`

## Rendimiento

- 60 fps en una GPU integrada a 2560×1440; presupuesto ≤ 4 ms por cuadro. Máx ~6,000 puntos; canvas a `devicePixelRatio` con tope de 2.
- Pausar el bucle cuando `document.hidden`. Bajar a 30 fps cuando la cara lleva dormida > 1 min.
- Solo `transform` y `opacity` en animaciones DOM. Nada de `transition: all`.

## Verificación de diseño (obligatoria antes de entregar)

Capturas con Playwright en 1920×1080, 2560×1440, 3440×1440 y 1440×2560, en tres momentos del demo (reposo, araña entregando skills, turno a medias con error) y con dos zonas minimizadas. Revisar contra este documento: colores fuera de la paleta, textos cortados o encimados, zonas desalineadas, cualquier cosa que parezca plantilla.

## Versión 2: profundidad, color y vida (pedido del usuario tras verla en su pantalla)

El usuario la vio en sus dos monitores: "está al 80–90 %, le falta el toque que la diferencie". Esto **sustituye** lo que contradiga de arriba.

### Color: una familia por cúmulo

La regla de "solo tres colores" se relaja **solo para la biblioteca y lo que sale de ella**. Cada plugin tiene un tono propio; todo lo demás (marco, texto, cara, actividad de Claude) sigue en tinta + cian, y rosa/ámbar siguen significando error y "te toca".

Paleta de cúmulos (misma claridad y saturación, pensada para sumarse en aditivo sin gritar):

```css
--c1: #86d5ea; /* cian   */  --c2: #7aa8ff; /* azul   */  --c3: #b79cf5; /* lila   */
--c4: #e58ad0; /* orquídea */ --c5: #f29b7e; /* coral  */  --c6: #e6cf8a; /* arena  */
--c7: #b9e07a; /* lima   */  --c8: #7fe0b0; /* menta  */
```

- Los plugins `cerebro-*` reciben tonos fijos y distintos entre vecinos; los de terceros, un tono por hash del nombre. Apagados: sin tono (`--tinta-3`).
- El tono **viaja con la skill**: su etiqueta, el paquete que lanza la araña, su ficha bajo la cara, su satélite en la órbita, el filo superior de su bloque en el Flujo y su verbo en Actividad usan el tono del cúmulo de origen. Así se lee de un vistazo de dónde vino cada cosa.
- Nada de degradados entre tonos ni arcoíris en una misma pieza: cada pieza, un tono.

### Biblioteca en 3D

- Los cúmulos son nubes **volumétricas** (puntos con x, y, z; caída gaussiana en las tres) repartidas en un espacio con profundidad. Proyección en perspectiva hecha a mano en el canvas 2D (o WebGL solo para la capa de puntos si hace falta, con respaldo 2D); cero dependencias.
- Profundidad legible: los puntos lejanos son más chicos y tenues, los cercanos más grandes y brillantes; los rótulos de plugins siguen al cúmulo y se atenúan con la distancia.
- **Cámara viva**: órbita lenta y continua (un giro completo en 2–3 min, con leve cabeceo). Cuando la araña marca y lanza skills, la cámara **se acerca y la encuadra** (500–700 ms, ease-in-out), y al terminar regresa a la órbita. Con `prefers-reduced-motion`: cámara fija.
- **La araña en 3D**: camina sobre los cúmulos, se descuelga y **salta de uno a otro** con arco y un hilo que deja atrás (el hilo queda unos segundos y se desvanece). Las patas siguen con cinemática inversa; su tamaño cambia con la profundidad.

### La araña con más libertad (a quién le avienta qué)

| Lo que pasa | La araña lanza a… |
|---|---|
| Skills sugeridas para el mensaje | la cara (como ahora) |
| Hilo guardado / resumen de sesión actualizado | la araña del Hilo, que lo atrapa y lo teje |
| Sugerencias que no se usaron al terminar el turno | las recoge y las regresa a su cúmulo |
| Claude usa una skill | un pulso del tono del cúmulo corre de la cara al cúmulo y la araña voltea |
| Fin de turno | lanza un hilo al Flujo que "cose" el turno terminado a la historia |

### La cara ya no está sola: la órbita

Alrededor de la cara giran, en elipses inclinadas (profundidad real: pasan por detrás y por delante), los **satélites de lo que Claude tiene en la cabeza ahora**:

- skills cargadas (cuadro del tono de su cúmulo, con nombre al acercarse),
- archivos en juego en este turno (punto con el nombre corto; más grande cuanto más se tocó; un destello cuando se edita),
- subagentes (caritas pequeñas; reemplaza la fila de subagentes bajo la cara),
- el pedido actual como un arco de texto tenue en la órbita exterior.

La órbita ocupa los lados de la zona (en horizontal se ensancha; en vertical se achata). Vacía = solo los anillos tenues. Es información, no adorno: cada satélite corresponde a un evento real.

### El Flujo ya no está solo

- **Araña del Flujo** (pequeña): cose con hilo cada bloque al siguiente cuando termina un paso, y espera en el bloque en curso.
- **Historia**: los turnos anteriores quedan debajo como filas compactas (una tira de celdas por turno, cada celda un paso con el color de su clase; rosa donde falló), de modo que la zona se llena con el trabajo de la sesión.
- **Regla de tiempo**: eje fino bajo los bloques con la duración de cada paso a escala; se ve dónde se fue el tiempo.
- Si hay pocos bloques, crecen (más alto y con el resumen completo) en vez de dejar hueco.

### Vida en reposo (nada se queda tieso)

- **Cara**: mira de vez en cuando a la araña que pasa o a un satélite; bosteza (ojos que se entrecierran) antes de dormirse; dormida, respira. Cada 3–6 min dormida **despierta un momento**, mira al frente y suelta una burbuja corta ("¿sigues ahí?", "aquí ando", "cuando quieras") y vuelve a dormirse. Frases en un archivo aparte, fáciles de editar. Nunca en ámbar (ámbar es solo cuando de verdad espera permiso o respuesta).
- **Araña del Hilo**: nunca quieta más de unos segundos: recorre la tela, repara un rayo, se descuelga de un hilo y sube, se acicala.
- **Araña de la biblioteca**: además de pasear, a ratos se queda en un cúmulo "leyendo" (los puntos cercanos laten).
- Todo movimiento de reposo es lento y de baja amplitud; se pausa con `document.hidden` y respeta `prefers-reduced-motion`.

### Momentos (el "toque")

Pocos y con motivo, cada uno atado a un evento real:

1. **Llega un mensaje**: una onda recorre la biblioteca desde la araña y los cúmulos que coinciden se encienden un instante antes de que ella salga hacia ellos.
2. **Entrega**: acercamiento de cámara + paquetes de colores en arco con estela.
3. **Error**: la tela del Hilo vibra y un rayo se rompe (se repara al corregirse).
4. **Fin de turno**: los satélites se recogen hacia la cara, la araña cose el turno a la historia.
5. **Compactación**: la tela se recoge y los satélites se reducen a los del resumen.

### Límites que siguen firmes

- Sin degradados de relleno, sin vidrio, sin sombras de resplandor CSS, sin esquinas redondeadas en paneles.
- 60 fps con tope (el usuario midió 165 Hz y CPU alta sin tope): presupuesto ≤ 6 ms por cuadro a 3440×1440; degradar puntos antes que perder cuadros.
- Legibilidad primero: ningún efecto tapa texto que haya que leer.
