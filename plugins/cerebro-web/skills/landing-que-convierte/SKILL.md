---
name: landing-que-convierte
description: Estructura y medición de una landing que convierte - hero claro, prueba social real, demo, precios, FAQ, un solo CTA, velocidad, formularios, analítica gratis y respetuosa (Cloudflare, Umami, Plausible, PostHog) y A/B simple. Usa al hacer landing, página de ventas, conversión, CTA.
---

# Landing que convierte

Complementa a `frontend-design` (estética) sin duplicarlo: aquí va **qué secciones, en qué orden, con qué objetivo y cómo medirlo**. Para el texto en español MX usa la skill de copy de `cerebro-negocio` si está instalada; para meta tags y vistas previas, `seo-tecnico`.

Lo que corrige: Claude hace landings bonitas con cinco botones distintos, testimonios inventados, sin ninguna medición, y declara "lista" sin verla en un celular.

## Antes de construir: 4 respuestas (pregúntalas si no las tienes)

1. **¿Quién llega?** (p. ej. traders de memecoins que vienen de X o Telegram → casi todos en celular).
2. **¿Cuál es LA acción?** Una sola: "Probar gratis", "Suscribirme", "Unirme a la lista". Ese es el CTA.
3. **¿Qué prueba real existe?** Usuarios, volumen, capturas, posts de usuarios con permiso. Si no hay, no se inventa.
4. **¿Cómo vamos a saber si funcionó?** El evento de conversión y dónde se mide (ver "Medición").

Explica al usuario en 1–3 frases la estructura que propones y por qué, antes de escribir código.

## Estructura (en este orden, ajusta solo con razón)

1. **Hero** (lo que se ve sin hacer scroll en un celular):
   - Titular = resultado concreto + para quién. Nada de "La revolución del trading".
   - Subtítulo de 1 frase con el cómo.
   - **CTA primario** visible sin scroll.
   - Visual del **producto real** (captura o video corto de la terminal), no ilustraciones genéricas.
2. **Prueba social real**: números verificables, testimonios con nombre/usuario y permiso, logos o posts reales. Si aún no hay, usa "construido en público" (changelog, demo en vivo) en vez de inventar.
3. **Cómo funciona** en 3 pasos.
4. **Demo**: GIF/video de 20–40 s o demo de solo lectura. Que se vea el producto haciendo lo que promete.
5. **Beneficios** (no lista de features): cada feature traducida a "para qué te sirve".
6. **Precios**: pocos planes, el recomendado marcado; descuento de lanzamiento **con fecha o cupo real**; menciona referidos si existen. La lógica de cupones/referidos está en `cobros-y-suscripciones`.
7. **FAQ** = objeciones: ¿es seguro?, ¿custodian mis fondos?, comisiones, cancelación, soporte. Para productos cripto, responde explícitamente: "nunca te pediremos tu seed phrase ni tu llave privada".
8. **CTA final** repetido + contacto.

Reglas de la estructura:
- **Un solo CTA**, repetido. Todos los botones principales llevan a la misma acción. Los enlaces secundarios (docs, X) van discretos.
- En celular, considera un CTA fijo abajo (sticky) que no tape contenido.
- Producto de trading: **no prometas ganancias** ni muestres PnL que no sea real y representativo; incluye un aviso de riesgo visible. Si el usuario pide lo contrario, explícale el riesgo reputacional en 2 frases.

## Velocidad (convierte más la página que carga rápido)

- HTML estático o prerenderizado; la landing **no** debe cargar el bundle completo de la app.
- Imagen/video del hero optimizados (AVIF/WebP, dimensiones exactas, `width`/`height`), sin lazy-load en el hero; lazy-load en lo de abajo.
- Fuentes: 1–2 familias, `font-display: swap`.
- Scripts de terceros (chat, analítica, widgets) con `defer`, y los menos posibles.
- Meta: Core Web Vitals en verde (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1). Detalles en `seo-tecnico`.

## Formularios

- **Pide lo mínimo** (normalmente solo email). Cada campo extra cuesta conversiones.
- Etiquetas visibles (no solo placeholder), `type="email"`, `autocomplete` correcto, botón que diga la acción ("Quiero mi acceso", no "Enviar").
- Errores en línea y estado de éxito claro (qué pasa ahora y cuándo).
- Antispam: **Cloudflare Turnstile** (plan Free: hasta 20 widgets y desafíos ilimitados, a nov 2026). El token **se valida en el servidor** con `siteverify`; dura 300 s y es de un solo uso. Un honeypot oculto ayuda como segunda capa.
- Si recolectas datos personales, la página necesita aviso de privacidad; pide al usuario que lo valide con un profesional (no redactes asesoría legal).

## Medición (gratis y respetuosa)

Define primero los eventos: `cta_click`, `signup`, `checkout_start`, y **`purchase` registrado en el servidor desde el webhook de pago** (no desde el navegador, que se puede bloquear o falsear).

| Herramienta (a nov 2026, verifícalo antes) | Costo | Sirve para | Límite clave |
|---|---|---|---|
| **Cloudflare Web Analytics** | Gratis en todos los planes | Visitas, páginas, referrers, Web Vitals; sin cookies | **No** tiene eventos personalizados ni registra UTMs |
| **Umami** | Self-host gratis (MIT; Node 20.19+ y PostgreSQL 12.14+) o Cloud Hobby gratis: 100k eventos/mes, 1 sitio, 6 meses de datos | Eventos, metas, UTMs; sin cookies | Self-host = tú lo mantienes y respaldas |
| **Plausible CE** | Self-host gratis (AGPLv3); Cloud con prueba de 30 días | Analítica simple sin cookies | CE no trae funnels ni metas de ingresos |
| **PostHog Cloud** | Gratis: 1 M eventos/mes, 5k grabaciones, 1 M requests de feature flags; sin tarjeta | Eventos, funnels, grabaciones, **experimentos A/B** (usan los feature flags) | Más pesado; revisa su configuración de cookies/consentimiento |

Recomendación por defecto: **Cloudflare Web Analytics** (cero mantenimiento) + **Umami Cloud o PostHog** para eventos, UTMs y funnels. No instales tres herramientas: cada script resta velocidad.

Usa UTMs en cada link que publiques (`?utm_source=x&utm_campaign=lanzamiento`) para saber qué canal trae ventas.

## A/B simple (solo si hay tráfico)

- Con pocas visitas, un A/B no concluye nada: mejor mejora lo obvio (titular, CTA, velocidad) y mide antes/después por semanas.
- Si hay tráfico: **una sola variable** (titular o precio, no ambos), métrica y duración definidas **antes** de empezar, mínimo 1–2 semanas completas (incluye fines de semana), y no lo detengas en el primer día que "gana".
- Asigna la variante en el servidor (Worker) y guárdala en una cookie de primera parte para evitar parpadeo; registra la variante junto con cada evento de conversión. PostHog Experiments lo hace con feature flags si prefieres no programarlo.

## Al terminar (evidencia, no "ya quedó")

1. Captura en **390 px** (celular) y en escritorio con el plugin `playwright`; revisa que el CTA se vea sin scroll en el celular.
2. Corre el revisor de `seo-tecnico` (`revisar-seo.py`) y PageSpeed Insights; reporta LCP/INP/CLS.
3. Envía el formulario de verdad: llega el dato, aparece el estado de éxito, y el evento `signup` se ve en la analítica.
4. Haz clic en cada CTA: todos llevan a la misma acción.
Dile al usuario cómo comprobarlo él: abrir la página en su celular con datos móviles, llenar el formulario, y ver el evento en el panel de analítica.

## Fuentes (verificado nov 2026)

- https://developers.cloudflare.com/web-analytics/ (disponible en todos los planes)
- https://developers.cloudflare.com/web-analytics/faq/ (sin eventos personalizados ni UTMs)
- https://developers.cloudflare.com/turnstile/plans/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://posthog.com/pricing
- https://umami.is/pricing y https://github.com/umami-software/umami (licencia MIT, requisitos)
- https://docs.umami.is/docs
- https://plausible.io/self-hosted-web-analytics
- https://web.dev/articles/vitals
