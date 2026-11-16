---
name: diseno-de-juegos-y-retencion
description: Diseño de juegos y retención (Roblox y Steam) - core loop, progresión, primeros 60 segundos, retención D1/D7/D30, analíticas del Creator Dashboard, balance robar/defender, monetización ética, checklist de viabilidad. Usar antes de construir una idea, priorizar features o leer métricas.
---

# Diseño de juegos y retención

El usuario quiere ingresos modestos y constantes, no un hit viral. Tu trabajo aquí es que no construya semanas de algo que nadie va a jugar dos veces, y que cada feature tenga una razón medible. Aplica a Roblox y a Steam.

## Regla 0: verifica antes de confiar

- No inventes benchmarks de retención o conversión. Roblox muestra comparativas contra juegos similares en el Creator Dashboard cuando el juego tiene 100+ DAU; antes de eso, compara contra las propias versiones anteriores del juego.
- Para cualquier número de plataforma (tasas, límites de eventos de analíticas), WebFetch a la doc oficial (`create.roblox.com/docs/...md`, `partner.steamgames.com/doc/...`).

## Antes de construir: checklist de viabilidad (hazla con el usuario)

Respondan por escrito, en 1 línea cada una. Si 3 o más quedan en "no sé", la idea no está lista.

1. **Frase de una línea:** "Es un juego donde ___ para ___". Si no cabe, el concepto está borroso.
2. **Core loop en 3 pasos** (interacción de minuto a minuto → acción más repetida → motor de progresión). Ej. robar y defender: explorar la isla → recoger/robar animales → ganar monedas para mejorar base y comprar mejores huevos.
3. **Referencia que ya funciona:** ¿qué juegos parecidos tienen jugadores hoy? ¿Qué cambia el nuestro (un twist, no un clon exacto)?
4. **Primeros 60 segundos:** ¿qué hace el jugador sin leer nada?
5. **Por qué vuelve mañana (D1)** y **por qué vuelve en una semana (D7)**.
6. **Cómo gana dinero sin arruinar la experiencia** (ver monetización ética).
7. **Alcance:** ¿se puede tener una versión jugable en 2-4 semanas con el usuario dirigiendo a Claude? Si no, recorta.
8. **Contenido barato de producir:** ¿se pueden agregar animales/objetos/zonas nuevas solo con config + modelos, sin reescribir sistemas?
9. **Riesgo de plataforma:** ¿algo choca con reglas (items aleatorios pagados, contenido para menores, en Steam: features prometidas)?

Construye primero el **mínimo jugable**: el core loop completo con contenido feo. Nada de tienda, eventos ni 40 animales antes de que el loop sea divertido con 5.

## Los primeros 60 segundos (onboarding)

Roblox recomienda llevar al jugador "a la diversión" lo antes posible (su guía habla de 5 minutos como máximo para todo el FTUE). Para este género, apunta a:

- 0-10 s: aparece en SU base (ya asignada, con su nombre). Una flecha o camino brillante hacia la isla.
- 10-30 s: recoge su primer animal fácil cerca de la entrada. Feedback fuerte: sonido, partículas, número flotante.
- 30-60 s: lo deja en su base y ve las monedas subir solas. Primer "momento de alegría".
- Después: primer contacto con robo (ver a otro jugador robar o un tutorial guiado) y la primera compra con monedas del juego.
- Texto mínimo; nada de muros de reglas. Tooltips contextuales.
- Mide cada paso con `AnalyticsService:LogOnboardingFunnelStepEvent(player, paso, "nombre")` desde el servidor, después de que el jugador complete el paso. Usa nombres consistentes y no cambies la numeración entre versiones.

## Retención (cómo leerla en Roblox)

Creator Dashboard → Creations → el juego → Analytics → **Retention**. Cohortes por fecha de primera visita:
- **D1:** volvieron al día siguiente → depende de core loop, FTUE y rendimiento.
- **D7:** volvieron a la semana → depende de la progresión (metas cortas y largas, variedad, dificultad balanceada).
- **D30:** depende del "endgame": actualizaciones regulares y sistemas sociales.
- Los datos de D7/D30 de los últimos días salen vacíos hasta que pasa el tiempo; no los interpretes como caída.
- Un pico de usuarios nuevos (anuncio, video viral) suele bajar temporalmente la retención de esa cohorte: es normal.
- La tabla de cohortes muestra además playtime, conversión y revenue por usuario a 7 y 30 días: úsala para comparar "antes y después de una actualización".

Regla de trabajo: **un cambio grande a la vez**, anota la fecha, y compara la cohorte de esa semana con la anterior. Si cambias cinco cosas juntas, no sabrás cuál funcionó.

Otros paneles útiles: Funnels (dónde abandonan), Economy (monedas que entran y salen; registra con `LogEconomyEvent`), Monetization (conversión, ARPPU), Performance (crashes, FPS, memoria). Confirma nombres y límites de eventos en `production/analytics/event-types.md` antes de instrumentar.

## Balance de robar y defender (que no sea frustrante)

El riesgo del género: el nuevo pierde todo contra un jugador experto y se va para siempre. Reglas:

- **Protección del novato:** sus primeros minutos o su primer animal no se pueden robar; o un escudo inicial de base.
- **Cerrar base temporal** (botón con cooldown), visible para todos con un contador. Que defender sea una acción, no solo suerte.
- **Lo robado se puede recuperar:** el dueño puede perseguir y tocar al ladrón para que lo suelte, o el animal regresa si el ladrón muere.
- **El ladrón se arriesga:** velocidad reducida mientras carga, ruta larga, visible para todos (brillo/marcador).
- **No pierdas todo:** robar quita UN animal, nunca la base entera. Considera que los animales míticos se roben más difícil (más tiempo de agarre).
- **Cooldown por víctima:** el mismo jugador no puede ser robado por el mismo ladrón cada 10 s.
- **Objetos para molestar con contrajuego:** cada objeto molesto dura poco (segundos), tiene cooldown largo y tiene un contador (escudo, esquivar). Prohibido: atrapar a alguien sin salida, efectos de pantalla que impidan jugar, spam sobre un mismo objetivo.
- **Recompensa por defender:** monedas o bonificación por frustrar un robo; así defender también es divertido.
- **Prueba con humanos:** 2-4 personas en Start Server o un servidor privado. Pregunta "¿qué te dio coraje?" además de "¿te gustó?".

## Progresión

- Corta (minutos): siguiente animal, siguiente mejora de base.
- Media (horas): desbloquear zonas, rarezas nuevas, más slots.
- Larga (días): colecciones completas, "rebirth"/reinicio con multiplicador, eventos.
- Usa la distribución de jugadores por nivel (registro de eventos por nivel alcanzado): si casi todos se atoran en un nivel, ahí está el muro.

## Eventos y actualizaciones

- Ritmo que sugiere Roblox: actualizaciones pequeñas cada 2-4 semanas y features grandes cada 2-3 meses.
- Creator Dashboard → Engagement → **Events & Updates**: crea eventos con fecha (aparecen en la página del juego) y anuncios de actualización que llegan como notificación a quienes se suscribieron.
- Un evento barato y efectivo: animal de edición limitada que solo spawnea en una ventana de tiempo, con contador visible en el juego.
- Antes de cada actualización: lista de cambios, prueba con 2 jugadores, y anota la fecha para comparar cohortes.

## Monetización ética (y que además dura más)

- Vende **comodidad, cosméticos y tiempo**, no victoria garantizada: Pass de 2x monedas, slots extra, skins de base, cerrar base más tiempo.
- Ningún producto debe hacer imposible defenderse para quien no paga.
- Huevos de pago: probabilidades visibles y `PolicyService` (ver `roblox-datos-y-monetizacion`). Recuerda que muchos jugadores son menores: nada de urgencia falsa ("¡solo 10 segundos!") ni presión constante de compra.
- Primera compra pequeña y de buen valor; precios con Managed Pricing en Roblox.
- En Steam: precio justo comparado con juegos similares; nada de microtransacciones agresivas en un indie pequeño.

## Para Steam (indie)

Los mismos principios, con diferencias:
- El jugador pagó: el "primer minuto" es el menú y el primer control; si tarda en divertirse, pide reembolso.
- Valida la idea antes de construir mucho: página de Steam temprana y medir wishlists, demo para Next Fest (ver `steam-lanzamiento`).
- Alcance pequeño: un juego terminado de 2-4 horas vende más que uno ambicioso abandonado.

## Errores comunes que debes evitar

- Construir sistemas secundarios (tienda, ranking, eventos) antes de que el core loop divierta.
- Meter features porque "el juego X lo tiene" sin saber qué métrica mueven.
- Declarar que algo "va a retener" sin medirlo; propón el evento de analítica junto con la feature.
- Leer métricas con 20 jugadores como si fueran ciertas: con pocos datos, usa playtests y observación directa.

## Fuentes (verificado nov 2026)

- https://create.roblox.com/docs/production/analytics · https://create.roblox.com/docs/production/analytics/retention · https://create.roblox.com/docs/production/analytics/funnel-events
- https://create.roblox.com/docs/production/game-design/core-loops · https://create.roblox.com/docs/production/game-design/onboarding
- https://create.roblox.com/docs/production/promotion/experience-events
- https://create.roblox.com/docs/production/monetization/paid-random-items · https://create.roblox.com/docs/production/monetization/regional-pricing
- https://partner.steamgames.com/doc/store/coming_soon · https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest
