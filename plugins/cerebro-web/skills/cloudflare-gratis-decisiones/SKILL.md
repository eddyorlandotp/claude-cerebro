---
name: cloudflare-gratis-decisiones
description: Decidir qué producto de Cloudflare usar y si cabe en el plan gratis o el de 5 USD - Workers vs Pages, KV vs D1 vs Durable Objects vs R2 vs Queues, Cron Triggers, límites de CPU/requests/subrequests, procesos 24/7 y cuándo conviene un servidor en casa. Usa al planear arquitectura en Cloudflare.
---

# Cloudflare gratis: qué usar y cuándo pagar

Esta skill es para **decidir**, no para escribir código. La API de Workers/Wrangler/DO la cubre el plugin oficial `cloudflare`: úsalo para la implementación. El error que corrige: Claude elige KV para todo, asume que un Worker puede "quedarse corriendo", y no hace cuentas contra los límites hasta que algo falla en producción.

## Reglas

1. **Verifica antes de confiar.** Los límites cambian. Antes de una decisión que dependa de un número de esta tabla, ábrelo con WebFetch (agrega `index.md` al final de la URL de developers.cloudflare.com) o con Context7 si está instalado. Si el número cambió, dilo y usa el nuevo.
2. **Haz la cuenta en voz alta.** Antes de recomendar, estima: requests/día, escrituras/día, CPU por request, subrequests por request (cada `fetch` a Helius/Jupiter/Telegram cuenta). Compáralo con la tabla y di qué margen queda.
3. **Explica la decisión al usuario en 1–3 frases simples** ("Lo guardo en D1 porque son datos de usuarios con relaciones; KV solo aguanta 1,000 escrituras al día gratis").
4. **Prefiere gratis**, pero di claramente cuándo los $5 USD/mes del plan Workers Paid ahorran trabajo o riesgo.

## Límites clave (a nov 2026 — verifícalos antes de depender de ellos)

Fuentes: https://developers.cloudflare.com/workers/platform/limits/ y https://developers.cloudflare.com/workers/platform/pricing/ (ambas actualizadas nov 2026).

| Concepto | Workers Free | Workers Paid ($5 USD/mes mínimo) |
|---|---|---|
| Requests | 100,000/día (reset 00:00 UTC) | 10 M/mes incluidos, luego $0.30/M |
| CPU por request HTTP | **10 ms** | 30 s por defecto, configurable hasta 5 min |
| CPU por Cron Trigger | 10 ms | 30 s (intervalo menor a 1 h) / 15 min (1 h o más) |
| Duración (wall clock) | HTTP sin límite; Cron, alarma de DO y consumidor de Queue: 15 min | Igual |
| Subrequests por invocación | **50** | 10,000 (configurable) |
| Memoria | 128 MB por isolate | 128 MB |
| Cron Triggers por cuenta | **5** | 250 |
| Conexiones salientes simultáneas | 6 esperando headers (websockets salientes cuentan) | Igual |
| Workers por cuenta | 100 | 500 |
| **KV** | 100k lecturas/día, **1,000 escrituras/día**, 1 GB | 10 M lecturas + 1 M escrituras/mes |
| **D1** | 5 M filas leídas/día, 100k filas escritas/día, 500 MB por base, 5 GB total, 10 bases, 50 queries por invocación | 25 B leídas + 50 M escritas/mes, 10 GB por base |
| **Durable Objects** (solo backend SQLite en Free) | 100k requests/día, **13,000 GB-s/día**, 5 GB | 1 M requests + 400,000 GB-s/mes |
| **Queues** | 10,000 operaciones/día, retención fija 24 h | 1 M ops/mes, retención hasta 14 días |
| **R2** | 10 GB-mes, 1 M ops clase A, 10 M clase B/mes, egress gratis | $0.015/GB-mes después |
| Static assets | Requests gratis; 20,000 archivos por versión, 25 MiB por archivo | 100,000 archivos |

Al pasarte de un límite diario en Free, las operaciones **fallan** (no te cobran): planea qué ve el usuario cuando eso pase.

## Workers vs Pages

- **Proyecto nuevo → Workers con static assets.** La doc de Pages dice textual: "Start new projects with Workers". Workers tiene Cron Triggers, Durable Objects y mejor observabilidad; Pages no.
- Si ya existe en Pages y funciona, no migres por migrar. Migra solo si necesitas algo que Pages no tiene (cron, DO directo).

## ¿Dónde guardo esto?

| Dato / necesidad | Usa | Por qué / trampa |
|---|---|---|
| Configuración, feature flags, caché leído mucho y escrito poco | **KV** | Eventualmente consistente y 1 escritura/seg por llave. **No** para contadores ni logs (1,000 escrituras/día gratis se acaban rápido) |
| Usuarios, suscripciones, referidos, pagos, historial | **D1** | SQL relacional, índices, migraciones. Ver skill `base-de-datos-practica` |
| Estado que exige orden estricto: rate limit por usuario, contador exacto, sala de websockets, "un solo ejecutor" | **Durable Object** | Una instancia única por ID, almacenamiento transaccional |
| Imágenes, archivos de usuario, respaldos `.sql` | **R2** | Egress gratis |
| Procesar algo después y con reintentos (webhooks de pago, notificaciones) | **Queues** | En Free los mensajes viven solo 24 h |
| Tarea periódica (cada minuto o más) | **Cron Trigger** | Hora en **UTC**. Cambios tardan hasta 15 min en propagarse. Máx. 5 en Free |

## Procesos 24/7: Worker, Durable Object o servidor en casa

Un Worker **no es un proceso que se queda corriendo**: despierta con un request, un cron o un mensaje, y termina. Antes de diseñar un bot 24/7 responde estas preguntas:

1. **¿Basta con revisar cada minuto o más?** → Cron Trigger (la granularidad mínima es 1 minuto). Barato y simple. Cuida los 10 ms de CPU y 50 subrequests en Free.
2. **¿Necesita escuchar un websocket externo (p. ej. un RPC de Solana) sin parar y reaccionar en milisegundos?** Un Durable Object puede abrir ese websocket, pero:
   - Los websockets **salientes no hibernan**: el DO cobra duración todo el tiempo. Estimación con la fórmula de la doc: 128 MB × 86,400 s ≈ **11,059 GB-s/día** por un DO siempre despierto. Cabe en los 13,000 GB-s/día gratis **solo si es uno** (y en Paid, ≈ 332k GB-s/mes de 400k incluidos). Dos DOs así ya no caben gratis.
   - Un websocket saliente abierto solo evita que el DO sea desalojado por **hasta 15 minutos**; necesitas alarmas o I/O periódico y **lógica de reconexión**.
   - Cloudflare reinicia servidores al desplegar código y corta websockets: el código debe reconectar con backoff y no perder eventos.
3. **¿Latencia y conexión permanente son críticas, o el proceso usa mucha CPU/memoria?** → **Servidor en casa** (mini-PC) con systemd, y Cloudflare Tunnel solo si hay que exponer HTTP. Costo: luz e internet de la casa; riesgo: apagones y cortes de internet (necesita reinicio automático y alerta). Ver `cloudflare-tunnel-y-dominio` y la skill de servicios 24/7 de `cerebro-linux`.

Regla práctica: **cron si alcanza; servidor en casa si necesita escuchar en tiempo real; DO si necesitas coordinación global o websockets entrantes** (los entrantes sí hibernan con la Hibernation API y no cobran duración en reposo).

Para la lógica del bot de trading en sí (RPC, envío de transacciones, riesgos) usa el plugin `cerebro-solana`; esta skill solo decide dónde corre.

## Cuándo recomendar los $5 USD/mes

Recomienda Workers Paid si se cumple alguno:
- Más de ~70k requests/día sostenidos (deja margen sobre 100k).
- Algún request necesita más de 10 ms de CPU (verificación de firmas, parseo de JSON grande, cálculo de indicadores).
- Más de 50 `fetch` en una sola invocación o más de 5 crons.
- Retención de cola mayor a 24 h.
Si nada de eso aplica, quédate en Free y dilo.

## Al terminar

Entrega al usuario: (1) qué producto elegiste para cada cosa, (2) la cuenta estimada contra el límite, (3) dónde ver el consumo real: Dashboard > Workers & Pages > el Worker > Metrics, y para D1/KV su página en el dashboard. Pídele revisar esa pantalla una semana después del lanzamiento.

## Fuentes (verificado nov 2026)

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/storage-options/
- https://developers.cloudflare.com/pages/ ("Start new projects with Workers")
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/queues/platform/limits/
