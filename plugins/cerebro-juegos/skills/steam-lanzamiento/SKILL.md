---
name: steam-lanzamiento
description: Lanzar un juego indie en Steam - Steam Direct (cuota y recuperación), página Coming Soon temprano, wishlists, cápsulas, tráiler, demo, Steam Next Fest, precios regionales, revisión de Valve, SteamPipe y GodotSteam. Usar al planear fechas, preparar la página de tienda o integrar Steamworks.
---

# Lanzar en Steam

El usuario va a vender su primer juego indie (hecho en Godot) en Steam con una meta de ingresos modesta. El error típico es construir en silencio y abrir la página de Steam al final: sin wishlists, el lanzamiento no se ve. Esta skill marca el orden y los plazos reales.

## Regla 0: verifica antes de confiar

- Plazos, tamaños de imagen, fechas de festivales y cuotas cambian. Antes de dar una fecha o un número, WebFetch a la página de `partner.steamgames.com/doc/...` correspondiente (Fuentes al final). Las fechas de eventos están en https://partner.steamgames.com/doc/marketing/upcoming_events.
- Para la API de Steam en Godot, revisa la doc de GodotSteam de la versión exacta que se use.
- Todo lo que implique pagar (cuota, precios) o publicar (botón Release, Post as Coming Soon) lo hace el usuario con su cuenta. Tú preparas y le das la checklist; nunca le pidas contraseñas ni códigos de Steam Guard.

## Steam Direct: costos y tiempos (a nov 2026)

- **USD 100 por juego** (cuota por app). No es reembolsable, pero se **recupera** en el pago después de que el juego llega a **USD 1,000** de ingreso bruto ajustado. Se paga con métodos de pago de Steam, no con saldo de Steam Wallet. Valve puede cobrar IVA sobre la cuota.
- Papeleo inicial (banco, impuestos, verificación de identidad): **15-30 días**. La cuenta bancaria debe estar a nombre de la persona de la identificación.
- Pagos de Valve: mensuales, por transferencia SWIFT en USD (fuera de EE.UU.), hasta el día 30 del mes siguiente, con mínimo de USD 100 acumulado. Hay retención fiscal según el cuestionario de impuestos (el usuario está en México: que lo responda con cuidado; no des asesoría fiscal, recomienda contador).
- Reparto de ingresos: Valve paga según el Steam Distribution Agreement y tiene "Additional Revenue Share" por tramos para juegos que venden mucho. El porcentaje exacto está en el acuerdo que el usuario firma: léelo ahí, no lo supongas. Para estimar mientras tanto: la prensa reporta desde 2018 un 30% para Valve en el primer tramo (fuente periodística, no doc de Steamworks).

## Línea de tiempo mínima obligatoria

1. Pagar la cuota → empieza una espera de **21 días** antes de poder lanzar el primer juego.
2. Página de tienda lista → enviarla a revisión (típicamente 3-5 días hábiles; Valve pide enviarla **al menos 7 días hábiles** antes de quererla pública).
3. Página publicada como **Coming Soon** al menos **2 semanas** antes del lanzamiento.
4. Build enviada a revisión (3-5 días hábiles; planear **7**). Debe arrancar en todos los sistemas que dice soportar y tener todas las features listadas.
5. El usuario presiona **Release App** él mismo (no se lanza sola).

Ruta realista: página Coming Soon **meses** antes, no 2 semanas. Valve dice que tenerla mucho tiempo no tiene desventaja si el juego no cambia mucho, y quien agrega a wishlist dos años antes compra igual que quien lo hace dos semanas antes.

## Página de tienda temprana y wishlists

- Publica la página Coming Soon cuando el estilo visual y el core loop estén definidos (no antes: si el juego cambia mucho, confunde a quien lo agregó).
- Al publicarla se activa el Community Hub y las wishlists. Al lanzar, Steam avisa por correo/push a todos los que lo tienen en wishlist.
- Wishlist también avisa en descuentos de **20% o más** (más de 8 horas, aplicado al paquete más barato), y **una vez** cuando sale la demo (el desarrollador presiona el botón, dentro de 2 semanas del lanzamiento de la demo). Cooldown de correos por juego: 1-2 semanas.
- Datos de wishlist: Sales & Activation Reports → página de la app → Wishlists (se actualiza diario).
- Toda acción de marketing (video, post, festival) debe mandar a la página de Steam para sumar wishlists.

## Assets de la tienda (requisitos verificados)

| Asset | Tamaño | Nota |
|---|---|---|
| Header capsule | 920×430 | Arte clave + logo legible; sin frases ni citas |
| Small capsule | 462×174 | El logo debe casi llenarla y leerse en miniatura |
| Main capsule | 1232×706 | Carrusel de la portada |
| Vertical capsule | 748×896 | Ventas de temporada |
| Screenshots | mínimo 5, 1920×1080, 16:9 | **Solo gameplay**: nada de concept art, premios ni texto de marketing. Marca 4+ como "aptas para todo público" |
| Page background | 1438×810 | Opcional |
| Tráiler | hasta 1920×1080, 30 o 60 fps, H.264 + AAC, .mp4/.mov | Obligatorio para lanzar |

- Capsules con título/logo legible: Valve lo revisa.
- La descripción solo puede prometer lo que habrá al lanzar; si algo es futuro, debe decirlo claro.
- Valve da plantillas de tamaños: descárgalas desde la página de assets.

## Tráiler

- Primero un tráiler **de gameplay**: Valve dice que los usuarios buscan ver cómo se juega, en la perspectiva real y con HUD visible.
- Los primeros segundos importan (Discovery Queue: menos de 10 s para enganchar) y debe entenderse **sin audio**.
- El primer video visible genera el microtráiler automático de 6 s: que el primer tráiler sea el mejor.
- No se puede lanzar mientras un tráiler se está procesando: súbelo días antes.

## Demo y Steam Next Fest

- Next Fest ocurre 3 veces al año (febrero, junio, octubre). A nov 2026 las próximas fechas publicadas: **22 feb – 1 mar 2027** y **14-21 jun 2027**. Verifica en upcoming_events antes de planear.
- Requisitos: juego no lanzado, página base **pública**, demo jugable pública al iniciar el festival, no haber participado antes (**solo una vez por juego**).
- Plazos: demo enviada a revisión **5 semanas antes** (si quieres estar en el Press Preview) o **3 semanas antes** como límite. Lanzar la demo al menos 30 minutos antes del inicio.
- La demo es una app separada ligada al juego base (tipo "demo"). Si tiene página propia, vuelve a publicar la página del juego base para que queden vinculadas.
- Elegir festival: uno temprano sirve para aprender qué gusta; uno cerca del lanzamiento sirve para empujar wishlists justo antes. Para un primer juego pequeño, normalmente el más cercano al lanzamiento.
- La revisión de Valve solo confirma que arranca y tiene lo prometido; **no es QA**. Pruébala tú y el usuario.

## Precio y precios regionales

- Steam maneja 37 monedas; da herramientas de conversión (incluida una "multi-variable" que considera poder adquisitivo). Úsala como punto de partida y revisa México y Latinoamérica a mano.
- Precio mínimo base: equivalente al nivel de USD 0.99. Los descuentos no pueden bajar el precio final de ~USD 0.49.
- Valve revisa precios iniciales y cambios (1-2 días hábiles).
- Investiga precios de juegos similares (mismo género, duración, calidad). No se trata de ser el más barato.
- Descuento de lanzamiento opcional; recuerda que las wishlists se notifican con descuentos ≥ 20%.

## Integración técnica (Godot)

- **GodotSteam** agrega el Steamworks SDK a Godot. Dos formas: editor/templates precompilados, o **plugin GDExtension** (el más usado; usa las export templates normales de Godot). **No mezcles** ambas. Último tag visto: v4.24 (verifica compatibilidad con tu versión de Godot en https://godotsteam.com).
- Al exportar, incluye las librerías de Steam: `steam_api64.dll` (Windows 64-bit) y `libsteam_api.so` (Linux).
- `steam_appid.txt` sirve para probar fuera del cliente de Steam; **no lo subas** al build final (Valve lo desaconseja).
- Sin un AppID propio las pruebas son limitadas (Inventario, Workshop no funcionan con el AppID de prueba).
- Solo integra Steamworks cuando aporte: logros, guardado en la nube, overlay. Un juego puede lanzarse sin GodotSteam si no usa nada de eso; empieza simple.
- Las compras dentro del juego, si existieran, deben usar Steam Wallet.

## Subir builds (SteamPipe)

- Se suben con `steamcmd` del Steamworks SDK (hay versión Linux: `tools/ContentBuilder/builder_linux/steamcmd.sh`) y scripts `app_build_<AppID>.vdf` / `depot_build_<DepotID>.vdf`.
- La cuenta y el login los maneja el usuario. Tú puedes preparar los `.vdf` y la carpeta `content/`, y revisar rutas (`contentroot`, `LocalPath`) si la subida no incluye archivos.
- Configura opciones de lanzamiento separadas para Windows y Linux en Steamworks.

## Checklist de lanzamiento (orden)

1. [ ] Cuota pagada, papeleo bancario/fiscal/identidad aprobado.
2. [ ] Página: capsules, 5+ screenshots de gameplay, descripción honesta, tags correctas, tráiler de gameplay.
3. [ ] Página enviada a revisión ≥ 7 días hábiles antes de publicarla; publicada como Coming Soon (meses antes del lanzamiento).
4. [ ] Demo lista y revisada si se va a Next Fest (≥ 3-5 semanas antes del festival).
5. [ ] Precio base y regionales enviados a revisión.
6. [ ] Build casi final subida a la rama default; probada en Windows y Linux; sin `steam_appid.txt`.
7. [ ] Build enviada a revisión ≥ 7 días hábiles antes de la fecha.
8. [ ] ≥ 21 días desde el pago de la cuota y ≥ 2 semanas en Coming Soon.
9. [ ] Día de lanzamiento: el usuario presiona Release App; tú tienes lista la nota de anuncio para el Community Hub.
10. [ ] Semana 1: responder reseñas y bugs; parche rápido si algo grave.

## Errores comunes que debes evitar

- Proponer una fecha de lanzamiento sin contar 21 días + 2 semanas Coming Soon + revisiones.
- Screenshots con texto de marketing o arte conceptual (rechazo en revisión).
- Prometer en la página features que no estarán al lanzar.
- Usar el único Next Fest del juego con una demo floja.
- Subir `steam_appid.txt` o builds sin las librerías de Steam.
- Dar asesoría fiscal; recomienda contador para el cuestionario de impuestos.

## Fuentes (verificado nov 2026)

- https://partner.steamgames.com/steamdirect · https://partner.steamgames.com/doc/gettingstarted/appfee
- https://partner.steamgames.com/doc/store/coming_soon · https://partner.steamgames.com/doc/store/review_process · https://partner.steamgames.com/doc/store/releasing
- https://partner.steamgames.com/doc/marketing/wishlist · https://partner.steamgames.com/doc/store/assets/standard · https://partner.steamgames.com/doc/store/trailer
- https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest · https://partner.steamgames.com/doc/marketing/upcoming_events
- https://partner.steamgames.com/doc/store/pricing
- https://partner.steamgames.com/doc/finance/payments_salesreporting · https://partner.steamgames.com/doc/finance/payments_salesreporting/faq
- https://partner.steamgames.com/doc/sdk/uploading
- https://www.pcgamer.com/au/valves-new-revenue-sharing-favours-big-budget-games-and-indie-devs-arent-happy/ (reparto 2018, prensa)
- https://godotsteam.com/getting_started/introduction/ · https://godotsteam.com/tutorials/exporting_shipping/
