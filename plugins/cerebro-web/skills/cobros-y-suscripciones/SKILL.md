---
name: cobros-y-suscripciones
description: Cobrar suscripciones desde México - Stripe, Mercado Pago o cripto (USDC/SOL con Solana Pay y verificación on-chain), webhooks con firma e idempotencia, estados de suscripción, cupones, descuento de lanzamiento y referidos. Usa al decir cobrar, suscripción, checkout, webhook, cupón, referido.
---

# Cobros y suscripciones (desde México)

Lo que corrige: Claude da acceso cuando el usuario llega a la página de "pago exitoso", procesa el mismo webhook dos veces, no verifica firmas, construye formularios de tarjeta propios, y "verifica" pagos en cripto confiando en lo que manda el navegador.

Para la API concreta usa los plugins oficiales `stripe` y `mercadopago` (este último trae una skill dedicada a webhooks). Esta skill decide la arquitectura y fija las reglas.

## Reglas duras (dinero real)

1. **Verifica antes de confiar.** Antes de escribir código contra Stripe, Mercado Pago o `@solana/pay`, confirma la API vigente con el plugin oficial, Context7 (si está instalado) o WebFetch a la doc. No inventes parámetros ni nombres de eventos.
2. **Todo se construye primero en modo prueba** (Stripe test mode/sandbox, cuentas de prueba de Mercado Pago, devnet de Solana). Pasar a producción requiere **confirmación explícita del usuario**.
3. **Llaves secretas** (`sk_live_...`, access tokens de MP, `whsec_...`, secreto de webhook de MP) solo como secretos (`npx wrangler secret put`). Nunca en el código, en logs, en el chat ni en git. Para cripto: **jamás** pidas, imprimas ni guardes llaves privadas o seed phrases; la billetera que recibe pagos es **dedicada**, y lo acumulado se mueve a resguardo seguido.
4. **Reembolsos, cancelaciones masivas, pagos de comisiones a afiliados y cualquier envío de fondos**: pide confirmación del usuario antes de ejecutar, mostrando monto y destino. Son irreversibles.
5. **El acceso se decide con tu base de datos, actualizada por webhooks verificados**, nunca por la URL de retorno (`success_url`, `back_url`) ni por un mensaje del frontend.
6. **Lo fiscal (facturación/CFDI, régimen, IVA, ISR) se consulta con un contador.** No des asesoría fiscal. Solo menciona que las comisiones de los procesadores se cobran **más IVA**.
7. Explica cada decisión al usuario en 1–3 frases ("Uso Stripe Checkout porque así nunca tocamos datos de tarjeta").

## Opciones (a nov 2026 — verifica comisiones y disponibilidad antes de decidir)

| | Stripe | Mercado Pago Suscripciones | Cripto directo en Solana (USDC/SOL) |
|---|---|---|---|
| Disponible para negocio en MX | Sí (tiene precios para México) | Sí | Sí, no depende de nadie |
| Comisión | Tarjeta nacional **3.6% + MXN 3**; +0.5% internacional; +2% si hay conversión; **+0.7% Billing** sobre lo cobrado en suscripciones; todo **sin IVA** | Cobros online (página de Link de pago): **3.49% + MXN 4** al instante, 3.19% a 7 días, 2.95% a 30 días, **+IVA**. Confirma en tu panel la tarifa exacta para suscripciones | Solo la fee de red. Sin contracargos |
| Cobro recurrente automático | Sí | Sí (`preapproval`; plan con `preapproval_plan`) | **No**: el cliente paga cada periodo y tú extiendes el acceso |
| Medios | Tarjetas; stablecoins (USDC) en **private preview** para MX | Dinero en cuenta MP, tarjetas, línea de crédito, CLABE, OXXO Paycash (según la página de Suscripciones) | Cualquier wallet de Solana |
| Cupones/promo codes nativos | Sí (coupons + promotion codes) | Prueba gratis sí; cupones: verifica en la doc | Los haces tú (descuento en el monto pedido) |
| Ideal para | Clientes con tarjeta, internacionales | Público mexicano sin tarjeta o que vive en MP | Usuarios cripto-nativos (como los de una terminal de trading) |

Recomendación por defecto para una terminal de trading: **un procesador de tarjeta (Stripe si aprueban la cuenta; si no, Mercado Pago) + pago en USDC on-chain** como segunda opción. Usa siempre el checkout **hospedado** del proveedor (Stripe Checkout / link de MP): nunca formularios de tarjeta propios.

Las comisiones por swaps dentro de la terminal (fee de plataforma en Jupiter, etc.) no son "suscripciones": eso está en el plugin `cerebro-solana`.

## Webhooks: firma + idempotencia (obligatorio)

Orden fijo en cada handler:
1. Lee el **body crudo** (sin parsear). Verifica la firma. Si falla → 400 y no hagas nada más.
2. Inserta el `event_id` en `webhook_events` (llave única). Si ya existía → responde 200 y termina.
3. Consulta al proveedor el estado actual del objeto (los eventos pueden llegar **desordenados**; Stripe lo dice explícito).
4. Actualiza tu base. 5. Responde **2xx rápido**; si el trabajo es pesado, encólalo (Cloudflare Queues).

**Stripe:** header `Stripe-Signature`, secreto `whsec_...` por endpoint. Usa la librería oficial (en Workers hay variante asíncrona con Web Crypto; confírmala con el plugin `stripe`). Tolerancia por defecto 5 min; no la pongas en 0. Reintenta hasta 3 días en producción. Prueba local: `stripe listen --forward-to localhost:8787/webhook` y `stripe trigger <evento>`.

**Mercado Pago:** header `x-signature` con `ts` y `v1`; arma el manifest `id:[data.id];request-id:[x-request-id];ts:[ts];` (con `data.id` de la query string, **en minúsculas** si trae letras; omite las partes que no lleguen), HMAC-SHA256 en hex con tu clave secreta, compara con `v1`. Espera **200/201 en máximo 22 s**; si no, reintenta cada 15 min. Tópicos de suscripción: `subscription_preapproval`, `subscription_authorized_payment`, `subscription_preapproval_plan`. Para el código, usa la skill de webhooks del plugin `mercadopago`.

El esquema de tablas (`webhook_events`, `payments` con id externo único) está en la skill `base-de-datos-practica` (`references/esquema-suscripciones.md`).

## Estados de suscripción (modelo interno)

Mapea los estados de cada proveedor a uno solo tuyo: `pending → trialing/active → past_due → canceled/expired`, más `paused`.

- **Tiene acceso** si `status IN ('trialing','active')` y `current_period_end > ahora`; opcional: periodo de gracia corto en `past_due` (decídelo con el usuario y escríbelo).
- Cancelar = conserva acceso hasta `current_period_end`, salvo que el usuario decida lo contrario.
- Pago fallido: deja que el proveedor reintente (Stripe y MP reintentan solos); tú solo avisas al cliente.
- Cripto: cada pago verificado crea un `payment` y extiende `current_period_end` un periodo. Sin pago → `expired` al vencer (cron diario).

## Cripto: verificación on-chain (Solana Pay)

1. Por cada orden genera un **`reference` único** (una dirección nueva) y guárdalo con monto y moneda esperados.
2. Arma la URL de transferencia (`recipient`, `amount`, `splToken` para USDC, `reference`, `label`, `message`) y muéstrala como QR/link.
3. En el backend (nunca en el navegador): busca la transacción por `reference` (`findReference`) y valídala (`validateTransfer`) contra **recipient, amount, splToken y reference**, con commitment `finalized` (o `confirmed` y re-chequeo después).
4. Guarda la **firma** de la transacción como `provider_payment_id` único: una firma nunca activa dos órdenes.
5. Mint de USDC en mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (verificado en la doc de Circle). Nunca aceptes otro mint "parecido".

Trampa de versiones: `@solana/pay` **v1.x** (nov 2026: 1.0.26) está construido sobre `@solana/kit` y usa `createMerchantClient`; los ejemplos viejos (v0.2) usan `@solana/web3.js`. Revisa `package.json` antes de copiar ejemplos y no mezcles ambos. Para RPC y montos con decimales, usa las skills de `cerebro-solana`.

## Cupones, descuento de lanzamiento y referidos

**Stripe:** crea un *coupon* (porcentaje o monto; `duration` = `once`, `repeating` con N meses, o `forever`) y encima *promotion codes* que el cliente escribe (`LANZAMIENTO`). En Checkout activa `allow_promotion_codes=true`. Restricciones útiles: `max_redemptions`, `expires_at`, `restrictions.first_time_transaction`. Descuento de lanzamiento típico: coupon `repeating` 3 meses + `max_redemptions` para crear escasez real.

**Mercado Pago:** si no hay cupón nativo para tu caso, usa un plan con precio de lanzamiento o cambia el monto de la suscripción (PUT `/preapproval/{id}` con `auto_recurring.transaction_amount`). Confírmalo en la doc antes.

**Referidos (siempre en tu base, no en el proveedor):**
- Captura `?ref=CODIGO` en la landing, guárdalo (cookie de primera parte o localStorage) y asígnalo al crear la cuenta (`users.referred_by`). El primero que refiere gana; no se cambia después.
- Genera la comisión **por cada pago confirmado por webhook**, en estado `pending`; pásala a `approved` después del periodo de reembolso/contracargo.
- Antiabuso: nada de auto-referidos (mismo email, misma tarjeta/customer, misma wallet), tope por afiliado, revisión manual antes de pagar.
- El pago de comisiones lo **aprueba el usuario** cada vez (regla dura 4).
- Si el referido también recibe descuento, impleméntalo como promotion code del proveedor ligado al código de referido.

## Qué NO construir uno mismo

Formularios de tarjeta (PCI), reintentos de cobro, portal de "cambiar tarjeta/cancelar" (Stripe Customer Portal; en MP, la gestión de la suscripción), cálculo de impuestos, facturación CFDI, custodia de cripto de clientes. Si el usuario lo pide, explica en 2 frases por qué no y qué usar.

## Al terminar (en modo prueba, con evidencia)

Demuestra y muestra al usuario la salida de cada paso:
1. Pago de prueba → webhook recibido con firma válida → `subscriptions.status = 'active'` en la base → la terminal da acceso.
2. Reenvía el mismo evento (`stripe events resend` o el simulador de MP) → **no** se duplica el pago.
3. Firma inválida (cambia un byte) → 400 y nada cambia en la base.
4. Cancelación → acceso hasta fin de periodo; luego se quita.
5. Cripto en devnet: transferencia con monto menor al pedido → **rechazada**.
Dile cómo verlo él: el panel de Stripe/MP (sección de webhooks/eventos) y la consulta `SELECT status, current_period_end FROM subscriptions ...`.

## Fuentes (verificado nov 2026)

- https://stripe.com/mx/pricing
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/payments/checkout/discounts
- https://docs.stripe.com/payments/stablecoin-payments
- https://docs.stripe.com/billing/revenue-recovery/smart-retries
- https://docs.stripe.com/customer-management
- https://www.mercadopago.com.mx/developers/es/docs/subscriptions/overview
- https://www.mercadopago.com.mx/developers/en/docs/subscriptions/integration-configuration/subscription-associated-plan.md
- https://www.mercadopago.com.mx/developers/en/docs/subscriptions/subscription-management.md
- https://www.mercadopago.com.mx/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks.md
- https://www.mercadopago.com.mx/herramientas-para-vender/link-de-pago (comisiones de cobro online)
- https://www.npmjs.com/package/@solana/pay (v1.0.26, README y tipos de `findReference`/`validateTransfer`)
- https://developers.circle.com/stablecoins/usdc-contract-addresses
