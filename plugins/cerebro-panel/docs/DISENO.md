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
