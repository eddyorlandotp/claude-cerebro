---
name: chatbots-whatsapp-telegram
description: Bots de WhatsApp (Cloud API, plantillas, ventana de 24 h, costo por mensaje) y Telegram (BotFather, webhook vs polling, alertas de trading) con arquitectura webhook, cola, LLM, memoria y paso a humano. Usa con bot, WhatsApp, Telegram.
---

# Chatbots de WhatsApp y Telegram

El error que corrige: Claude arma un bot que responde dentro del webhook (y Meta reintenta y el cliente recibe la respuesta dos veces), ignora la ventana de 24 h de WhatsApp, cotiza sin saber que los mensajes de servicio ya se cobran, y deja el token del bot en el código.

## Regla 0: verifica antes de confiar

- Meta cambia precios y reglas **cada trimestre** (1 de enero, abril, julio, octubre). Antes de cotizar o codear, abre la doc oficial (URLs en Fuentes). Busca la fecha "Updated" arriba de cada página.
- Para la Bot API de Telegram revisa el changelog en https://core.telegram.org/bots/api (a nov 2026 va en Bot API 10.4).
- Prueba cada endpoint con una llamada mínima real antes de construir encima (skill `investigar-antes-de-codear` de `cerebro-base`).

## 1. ¿WhatsApp o Telegram?

| Necesidad | Usa |
|---|---|
| Negocio que atiende clientes en México (citas, pedidos, catálogo) | **WhatsApp** (ahí están sus clientes) |
| Alertas para ti o para una comunidad (trading, monitoreo, reportes) | **Telegram**: gratis, sin plantillas, sin verificación |
| Prototipo para enseñar a un cliente en un día | Telegram, y luego portar a WhatsApp |

## 2. WhatsApp Business Platform (Cloud API) — a nov 2026

### Reglas de política que bloquean proyectos

- **Desde el 15 de enero de 2026 los "asistentes de IA de propósito general" (tipo ChatGPT en WhatsApp) están prohibidos** en la plataforma, salvo en países donde Meta está obligada por ley (México no está en esa lista a nov 2026). Un bot que atiende **los productos y servicios de un negocio** sí está permitido. Si el cliente pide "un ChatGPT por WhatsApp", dilo antes de cotizar.
- Solo puedes escribir a usuarios que dieron su **opt-in** para recibir mensajes de ese negocio.

### Ventana de 24 h y plantillas

- Cuando el usuario escribe (o llama), se abre una **ventana de servicio de 24 h** que se reinicia con cada mensaje suyo. Dentro de ella puedes mandar mensajes libres (texto, imagen, botones).
- Fuera de la ventana **solo plantillas aprobadas** (`"type":"template"`), de 3 categorías: marketing, utility (transaccional: confirmación de pedido, recordatorio de cita) y authentication (códigos).
- Diseña el bot pensando en esto: el humano que responde al día siguiente ya no puede mandar texto libre; necesita una plantilla utility.

### Costos (Meta cobra por mensaje entregado, no por conversación)

Tarifas USD para números de México (+52), vigentes desde el 1 oct 2026 (verifícalas en el rate card antes de cotizar):

| Categoría | USD por mensaje entregado |
|---|---|
| Marketing | 0.0397 |
| Utility | 0.0085 (baja con volumen) |
| Authentication | 0.0085 (baja con volumen) |
| Service (respuesta libre dentro de la ventana) | 0.0085 — **las primeras 1,000 al mes por número son gratis** |

- Los mensajes **del usuario al negocio no se cobran**.
- Desde el 1 oct 2026 Meta **volvió a cobrar los mensajes de servicio** después de 1,000 al mes por número. Sin método de pago en Billing Hub, después del mensaje 1,000 **dejan de entregarse**. Pídele al cliente que agregue tarjeta antes de lanzar.
- Si el usuario llegó por un anuncio Click-to-WhatsApp (desde la app móvil), se abre una ventana de entrada gratis de hasta 7 días.
- Meta ofrece su propio agente ("Meta Business Agent") a $2 USD por millón de tokens; tu bot con Claude se cobra como mensaje de servicio + tu costo de LLM.

Haz la cuenta para el cliente: mensajes de servicio esperados al mes − 1,000 gratis × tarifa + plantillas + costo de LLM (skill `apps-con-llms`).

### Requisitos y límites

- Necesitas: cuenta de Meta, app en el App Dashboard con el caso de uso "Connect with customers through WhatsApp", un portafolio de negocio y un número que no esté registrado en WhatsApp (si ya lo está, hay que borrar esa cuenta primero; o usar el modo "Coexistence" si el cliente quiere seguir usando la WhatsApp Business app: verifica requisitos en la doc).
- Límite de mensajería: un portafolio nuevo solo puede iniciar conversación (fuera de ventana) con **250 usuarios únicos por 24 h**. Sube a 2,000 **verificando el negocio** o enviando 2,000 plantillas de buena calidad en 30 días; luego escala automáticamente.
- El token temporal del dashboard caduca: para producción usa un token de **usuario de sistema** del portafolio. Guárdalo como secret.

### Webhook de WhatsApp

1. **Verificación (GET)**: Meta manda `hub.mode`, `hub.verify_token`, `hub.challenge`. Compara el token con el tuyo y responde 200 con el `hub.challenge`.
2. **Eventos (POST)**: valida la firma `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo con el **app secret**) antes de procesar. Usa el cuerpo crudo, no el JSON re-serializado.
3. Responde 200 **rápido**. Si falla, Meta reintenta durante hasta 7 días: **deduplica por ID de mensaje**.
4. Los eventos de `statuses` (entregado/leído) también llegan al webhook: no los mandes al LLM.

Considera un proveedor (BSP como Twilio o 360dialog) solo si el cliente quiere que alguien más maneje alta, soporte y facturación; agrega su cuota encima de la de Meta (revisa su página de precios).

## 3. Telegram Bot API

- Crea el bot con **@BotFather** (`/newbot`) y guarda el token como secret. Si se filtra, revócalo en BotFather.
- Registra comandos con BotFather o `setMyCommands`: empiezan con `/`, hasta 32 caracteres, minúsculas, números y guion bajo. Implementa siempre `/start` y `/help`.
- **Polling (`getUpdates`) vs webhook (`setWebhook`)**:
  - Polling: lo más simple para un proceso en tu PC o servidor de casa (no necesita URL pública). Ver skill `servicios-24-7` de `cerebro-linux`.
  - Webhook: para Cloudflare Workers o un servidor con HTTPS. Puertos permitidos: 443, 80, 88, 8443. Pasa `secret_token` y verifica el header `X-Telegram-Bot-Api-Secret-Token` en cada request.
  - No puedes usar ambos: con webhook activo, `getUpdates` no funciona. Las actualizaciones pendientes se guardan máximo 24 h.
- En grupos, el bot tiene **modo privacidad** activado por defecto: solo ve comandos, menciones y respuestas a sus mensajes.
- Límites para no recibir 429: ~1 mensaje por segundo por chat, 20 por minuto en un grupo, ~30 por segundo en difusión masiva. Respeta el `retry_after` del error 429.

### Alertas de trading por Telegram

- Manda a tu propio `chat_id` (lo obtienes escribiéndole al bot y leyendo el update).
- Una alerta = un mensaje con: qué pasó, token/par, precio, hora en UTC y un ID de señal. Agrupa ráfagas (máx. 1 por segundo) en vez de mandar 50 mensajes.
- El bot de alertas **solo avisa**: no le des botones que ejecuten compras sin confirmación y límites (ver `cerebro-solana`, skills `bot-copy-trading` y `riesgo-memecoins`).

## 4. Arquitectura que aguanta

```
Webhook (valida firma/secret, deduplica, responde 200 en < 1 s)
   → Cola (Cloudflare Queues, tabla de trabajos en SQLite/D1, o Redis)
   → Worker: carga memoria del usuario → LLM → herramientas → respuesta
   → Envía por la API (con reintentos y backoff) → guarda en historial
```

- **Nunca llames al LLM dentro del handler del webhook**: si tarda, la plataforma reintenta y duplicas respuestas.
- **Memoria por usuario**: tabla `conversaciones(usuario_id, rol, texto, creado_en)` con `usuario_id` = número de WhatsApp o `chat_id`. Manda al modelo los últimos N turnos + un resumen corto de lo anterior. Borra o anonimiza según el aviso de privacidad del cliente.
- **Paso a humano (handoff)**: si el usuario lo pide ("quiero hablar con alguien"), si el modelo no está seguro, o si hay queja/pago: marca `atiende_humano = true`, el bot deja de contestar en esa conversación y notifica al encargado (por Telegram, por ejemplo). Un comando o botón del encargado regresa el control al bot.
- **Herramientas del bot**: solo las que el negocio necesita (consultar catálogo, horarios, crear cita). Nada que cobre o cancele sin confirmación.
- Dónde correrlo: ver `cloudflare-gratis-decisiones` (Workers + Queues) o `servicios-24-7` (servidor de casa).

## Antes de decir "listo"

- [ ] Webhook verifica firma/secret y deduplica (prueba: reenvía el mismo payload dos veces → una sola respuesta).
- [ ] El LLM corre fuera del handler del webhook.
- [ ] Probado fuera de la ventana de 24 h con una plantilla aprobada (WhatsApp).
- [ ] Handoff probado de ida y vuelta.
- [ ] Tokens y app secret solo en secrets; método de pago y límite de gasto configurados.
- [ ] Estimación mensual escrita para el cliente (Meta + LLM + hosting).

## Cómo comprobarlo tú mismo

Escríbele al bot desde tu teléfono: pregunta algo normal, algo fuera de tema y "quiero hablar con un humano". Revisa en WhatsApp Manager (o en el log) que cada mensaje aparezca una sola vez y que el costo del día coincida con la estimación.

## Fuentes (verificado nov 2026)

- https://developers.facebook.com/docs/whatsapp/pricing/ (actualizada 30 sep 2026; rate card USD vigente desde 1 oct 2026)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers/ (política de proveedores de IA, términos del 15 ene 2026)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/ (token de usuario de sistema)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers/ (números ya usados en WhatsApp)
- https://core.telegram.org/bots/api (setWebhook, getUpdates, secret_token)
- https://core.telegram.org/bots/faq (límites de envío)
- https://core.telegram.org/bots/features (comandos, modo privacidad)
