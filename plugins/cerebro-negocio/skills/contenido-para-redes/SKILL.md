---
name: contenido-para-redes
description: Crear contenido para TikTok, Reels, Shorts y X de un proyecto - ganchos, guiones cortos, calendario semanal en archivo, reciclar videos, métricas de retención, hilos de X cripto sin prometer ganancias. Usa al decir contenido, guion, gancho, hook, calendario, post, hilo, Reels.
---

# Contenido para redes

Objetivo: que Claude entregue **archivos listos para grabar y publicar** (guiones, calendario, captions,
registro de métricas) y no listas de "tips". Si el usuario pide "ideas", entrega guiones.

## Antes de escribir nada

1. Pregunta (o saca del contexto) en una sola tanda: proyecto, **a quién le habla** (una persona concreta:
   "trader de memecoins en Solana que ya usa Axiom", no "gente interesada en cripto"), qué acción quieres
   que haga (seguir, visitar link, lista de espera, comprar) y cuánto tiempo real tiene para grabar a la semana.
2. Revisa si existe `contenido/` en el proyecto (calendario, `registro.csv`). Si hay datos de videos pasados,
   **léelos primero** y basa la siguiente semana en lo que retuvo, no en lo que "suena viral".
3. Para textos en pantalla, captions y posts aplica la skill `copy-espanol-mx`.

## Entregables (crea estos archivos)

```
contenido/
  calendario-AAAA-semNN.md      tabla de la semana (plantilla abajo)
  guiones/AAAA-MM-DD-slug.md    un guion por video
  registro.csv                  métricas por video (se llena a las 48-72 h)
```

Plantillas exactas en `references/plantillas.md` (guion, calendario, registro.csv, hilo de X). Úsalas tal cual.

## Gancho (primeros 1–2 s)

El gancho es **lo que se ve y se oye a la vez** en el segundo 0: texto en pantalla + primera frase + imagen
en movimiento. Reglas:
- Empieza con la acción o el resultado, nunca con "Hola, hoy les voy a...". Corta los primeros 0.5 s muertos.
- Texto en pantalla ≤ 8 palabras, dentro de la zona segura (ver tabla), legible sin audio.
- Una sola promesa concreta que el video sí cumple. Si el gancho promete algo que no llega, la retención cae
  y la cuenta pierde confianza.
- Escribe **3 variantes de gancho por guion** (el usuario graba solo el inicio 3 veces; el resto se reutiliza).

Patrones (con ejemplos de este tipo de proyectos):
| Patrón | Ejemplo |
|---|---|
| Resultado primero | "Mi terminal detectó este token 40 s antes que Twitter" (solo si es verificable; nada de ganancias) |
| Error / dolor | "Perdí 3 días por este bug de Roblox" |
| Contraste | "Esto lo hice con IA sin saber programar" + pantalla del resultado |
| Proceso en curso | "Día 12 construyendo una terminal de trading. Hoy: alertas." |
| Pregunta específica | "¿Por qué tu bot compra tarde? Es esto." |
| Demo directa | Pantalla grabada haciendo la acción, texto: "Así se ve comprar en 1 clic" |

## Estructura de guion corto (15–45 s)

1. **Gancho (0–2 s)**: texto + frase + movimiento.
2. **Contexto (2–5 s)**: por qué importa, en una frase.
3. **Cuerpo**: 2–4 pasos/beats, cada uno con algo nuevo en pantalla cada 2–4 s (corte, zoom, texto).
4. **Payoff**: el resultado prometido, visible.
5. **CTA (1 frase)**: una sola acción. "Link en el perfil para la lista de espera" o "Sígueme para el día 13".

Formatos que sirven para un producto/proyecto propio:
- **Demo** (15–30 s): la app haciendo una cosa útil, grabación de pantalla vertical con zoom a la zona clave.
- **Build in public**: "Día N" con un avance real y un número real (usuarios, bugs, tiempo). Serie = razón para seguir.
- **Antes/después**: versión fea vs. versión nueva (UI, juego, página).
- **Fallo y arreglo**: qué salió mal y cómo se resolvió. Genera confianza y comentarios.
- **Responder comentario**: video que responde una pregunta real de un comentario.
- **Tutorial de 1 cosa**: un solo truco aplicable, no "todo sobre X".

## Especificaciones (a nov 2026, verifica si esto tiene más de 3 meses)

| | TikTok | Instagram Reels | YouTube Shorts | X |
|---|---|---|---|---|
| Formato | 9:16, 1080x1920 | 9:16, 1080x1920 | vertical o cuadrado; 16:9 cuenta como video largo | 1:2.39 a 2.39:1 (9:16 entra) |
| Duración máx. | 10 min en app (algunas cuentas suben hasta 60 min) | 3 min (desde ene 2025) | 3 min (desde 15 oct 2024) | 140 s sin Premium |
| Zona tapada (1080x1920) | arriba ~240 px, abajo ~660 px, columna derecha ~180 px (medido de plantillas, TikTok no lo publica) | arriba 14 % (~269 px), abajo 35 % (~672 px), lados 6 % | — | — |

- Shorts de más de 1 min con un reclamo de copyright se **bloquean en todo el mundo**: si usas música o clips
  ajenos, quédate ≤ 60 s.
- Exporta un **master** 1080x1920, H.264, 30 fps, subtítulos quemados, audio a -14 LUFS (skill
  `video-ffmpeg-y-clipping`). Sube ese mismo archivo a las 3 plataformas verticales; no subas uno descargado
  de otra app con marca de agua.

## Reciclar un video en varias plataformas

Por cada master genera en `guiones/...md` una sección "Publicación" con:
- TikTok: caption corta + 3–5 hashtags específicos del nicho.
- Reels: misma caption adaptada; primera línea fuerte (se corta en la vista previa).
- Shorts: título ≤ 60 caracteres con la palabra clave que la gente buscaría.
- X: post con el video + 1 frase de contexto; o hilo si hay más que contar (plantilla de hilo).
Publica el mismo día o escalonado; no cambies el video entre plataformas salvo el texto.

## Métricas que importan (y cuáles ignorar)

Mide a las 48–72 h y anota en `registro.csv`:
- **Retención del inicio**: YouTube "Stayed to watch" (% que se quedó después de los primeros segundos);
  TikTok "Average watch time" vs. duración y "Watched full video". Esto califica el **gancho**.
- **Retención total / vistas completas**: califica el **cuerpo** y la duración.
- **Compartidos y guardados**: califican el **valor**.
- **Visitas al perfil, clics al link, registros**: califican si el contenido **vende**. Es la métrica final.
- Likes y vistas totales solas: no sirven para decidir (dependen de a cuántos se les mostró).

## Cómo iterar (regla de 1 variable)

1. Publica mínimo 3 videos por semana durante 3 semanas antes de concluir algo de un formato.
2. Cambia **una variable** a la vez: gancho, duración, formato o tema. Nunca todo junto.
3. Diagnóstico rápido:
   - Retención del inicio baja → el gancho falla (cámbialo, mismo cuerpo).
   - Inicio bien pero se van a la mitad → cuerpo lento: corta 30 %, más cortes.
   - Buena retención pero cero clics → CTA débil o el contenido atrae a un público que no compra.
   - Pocas vistas Y baja retención en todos → no concluyas "la idea no sirve"; el canal aún no tiene datos
     (ver skill `validar-idea`, sección canal vs. idea).
4. Cada domingo: lee `registro.csv`, escribe 3 líneas de aprendizajes al inicio del siguiente calendario y
   repite lo que funcionó con variaciones.

## X y producto cripto: escribir sin prometer ganancias

Reglas duras (Claude las aplica aunque el usuario pida otra cosa; explica por qué):
1. **Cero promesas de rendimiento**: nada de "gana", "x10", "ingresos pasivos", "señales ganadoras", ni
   capturas de PnL presentadas como resultado típico. Habla de **funciones** (velocidad, alertas, datos,
   comisiones transparentes) y de **riesgo** ("las memecoins pueden irse a cero").
2. "No es consejo financiero" **no arregla** una promesa de ganancias; quita la promesa.
3. Nunca recomiendes comprar un token específico ni muestres llamadas a comprar.
4. **Graba demos sin datos sensibles**: nada de llaves privadas, seed phrase, API keys (ej. en URLs de RPC),
   direcciones de billetera ni saldos reales. Usa una billetera de demo o difumina. Revisa el frame antes de publicar.
5. **Si alguien paga o recibe algo por promocionar** (influencer, afiliado, intercambio): en X debe usar la
   etiqueta "Paid Partnership"; desde mar 2026 X permite promociones pagadas de cripto con esa etiqueta,
   **excepto en Reino Unido, UE y Australia**.
6. **Anuncios pagados**: X exige certificación y licencia por país para exchanges/wallets/DeFi y, en México,
   solo permite anunciantes con negocio basado ahí; Meta exige permiso escrito previo + licencia para anunciar
   plataformas de trading cripto. Sin licencia: no hagas ads, solo orgánico.
7. **TikTok**: su política de contenido de marca prohíbe "virtual currencies", "trading platforms" e
   "investment services". Nunca hagas colaboraciones pagadas ni afiliados del producto cripto ahí. La política
   no habla explícitamente de promocionar tu propio negocio: en TikTok enfoca el contenido en el proceso de
   construir (build in public, programación, diseño) y evita CTAs tipo "tradea con mi terminal".

Para hilos de X usa la plantilla de `references/plantillas.md`: post 1 = gancho + por qué leer; posts 2–6 =
un punto por post con captura/video; último = qué es el producto, para quién, link, riesgo en una línea.
Sin Premium cada post tiene límite de 280 caracteres: cuéntalos.

## Verifica antes de confiar

Duraciones, zonas seguras, requisitos de monetización y reglas de publicidad cambian varias veces al año. Si
vas a basar una decisión en uno de estos datos (ej. "¿puedo subir 5 min a Reels?", "¿puedo anunciar mi
terminal?"), haz WebFetch a la fuente oficial de la sección Fuentes y dile al usuario la fecha de lo que leíste.

## Fuentes (verificado nov 2026)

- Shorts 3 min y copyright: https://support.google.com/youtube/answer/15424877
- Métricas de Shorts ("Stayed to watch", "Engaged views"): https://support.google.com/youtube/answer/12220281
- Métricas de TikTok (terceros, sep 2026): https://buffer.com/library/tiktok-analytics/
- Reels 3 min (anuncio de Adam Mosseri, ene 2025): https://lindseygamble.com/blog/instagram-three-minute-reels
- Zona segura Reels (cita la guía de anuncios de Meta, oct 2026): https://www.socialync.io/tools/safe-zones/instagram-reels
- Zona segura TikTok medida en plantillas (nov 2026): https://www.manypixels.co/blog/social-media-design/tiktok-ad-specs
- Duración TikTok (terceros): https://sociality.io/blog/tiktok-video-length/
- Video en X: https://help.x.com/en/using-x/x-videos
- X política de servicios financieros y cripto en anuncios: https://business.x.com/en/help/ads-policies/ads-content-policies/financial-services
- X permite promociones pagadas de cripto con etiqueta (mar 2026): https://cointelegraph.com/news/x-lifts-crypto-promo-ban-for-paid-partnerships y https://paymentexpert.com/2026/03/03/x-bans-crypto-partnerships/
- Meta anuncios de cripto: https://transparency.meta.com/policies/ad-standards/content-specific-restrictions/cryptocurrency-products-and-services/
- TikTok Branded Content Policy: https://www.tiktok.com/legal/page/global/bc-policy/en
