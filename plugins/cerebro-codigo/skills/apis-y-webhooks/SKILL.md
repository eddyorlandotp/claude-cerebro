---
name: apis-y-webhooks
description: Diseñar y consumir APIs - REST, validación, códigos de estado, paginación, auth (API key, sesión, JWT), CORS, rate limit, webhooks entrantes (firma, idempotencia) y llamadas externas con timeout y backoff. Usa con API, endpoint, webhook.
---

# APIs y webhooks que no fallan en silencio

Corrige esto de Claude: endpoints que devuelven 200 con `{ error }`, sin validar el body, `Access-Control-Allow-Origin: *` para "arreglar" CORS, JWT en `localStorage` para todo, webhooks que se procesan dos veces o sin verificar firma, y `fetch` sin timeout que cuelga un bot por horas.

Cobros con Stripe/Mercado Pago tienen detalle propio en `cobros-y-suscripciones` (`cerebro-web`) y en los plugins `stripe` y `mercadopago`. Esta skill da las reglas generales.

## Antes de escribir código

1. **Verifica antes de confiar**: para cualquier API externa, lee su doc actual con Context7 (MCP `context7`) o WebFetch: endpoints, formato de firma de webhooks, límites y códigos de error. No adivines nombres de headers ni campos. Prueba una llamada real mínima con `curl` antes de escribir el cliente (skill `investigar-antes-de-codear` de `cerebro-base`).
2. **Explica al usuario en 1–3 frases** qué endpoints vas a crear y cómo se protegen.

## Diseñar una API REST simple

- Recursos en plural y métodos HTTP con su significado: `GET /pedidos`, `GET /pedidos/:id`, `POST /pedidos`, `PATCH /pedidos/:id`, `DELETE /pedidos/:id`. Acciones que no encajan: `POST /pedidos/:id/cancelar`.
- **Valida todo body, query y params en el borde** con zod (TS) o pydantic (Python) antes de tocar la base. Nunca confíes en lo que manda el cliente (precio, rol, user id): tómalo de la sesión o de la base.
- Un solo formato de error en toda la API, con mensaje que sirva para arreglar el problema:

```json
{ "error": { "code": "validation_failed", "message": "monto debe ser entero positivo", "details": [{ "path": "monto" }] } }
```

### Códigos de estado (no todo es 200 ni 500)

| Código | Cuándo |
|---|---|
| 200 / 201 / 204 | OK / creado (devuelve el recurso) / OK sin cuerpo |
| 400 | JSON malformado o parámetros imposibles de leer |
| 401 | No autenticado (falta o es inválida la credencial) |
| 403 | Autenticado pero sin permiso sobre ese recurso |
| 404 | No existe (o no quieres revelar que existe) |
| 409 | Conflicto: duplicado, versión vieja, estado no permite la acción |
| 422 | Se entendió el JSON pero no pasa la validación |
| 429 | Demasiadas peticiones; incluye `Retry-After: <segundos>` |
| 500 / 502 / 503 / 504 | Error tuyo / falló un servicio del que dependes / no disponible / timeout de ese servicio |

Nunca mandes stack traces ni mensajes de la base al cliente: lógalos con un id de request y devuelve ese id.

### Paginación

- Siempre pagina listas que pueden crecer y pon un **máximo** a `limit` (ej. 100).
- **Cursor** (`?limit=50&cursor=<opaco>` → respuesta con `next_cursor`) para feeds, trades, logs o cualquier lista donde se insertan filas mientras alguien pagina. Implementa con `WHERE (creado_en, id) < (?, ?) ORDER BY creado_en DESC, id DESC` y un índice en esas columnas.
- **Offset** (`?page=3`) solo para tablas chicas de admin; con datos que cambian repite o salta filas.

## Autenticación: cuál usar

| Caso | Usa | Reglas |
|---|---|---|
| Tu web app con login (mismo dominio) | **Sesión con cookie** | Cookie `HttpOnly`, `Secure`, `SameSite=Lax` o `Strict`; id de sesión aleatorio guardado en la base; se puede revocar al instante |
| Bot, script o servidor que llama tu API | **API key** | Genera aleatoria larga con prefijo (`sk_live_...`) para reconocerla; guarda solo su hash; permite revocar y rotar; va en header `Authorization: Bearer`, nunca en la URL |
| Otro servicio debe verificar identidad sin consultar tu base, o tokens cortos entre servicios | **JWT** | Vida corta (minutos), verifica firma y `exp` con una librería; no se revoca fácil; no lo guardes en `localStorage` |
| Panel interno solo para el usuario | Cloudflare Access delante (skill `cloudflare-tunnel-y-dominio`) | Sin código de auth propio |

- **No implementes login con contraseñas desde cero** si la plataforma ya trae auth (Supabase Auth, ver plugin `supabase`). Si no hay otra: hash con Argon2id (OWASP), nunca SHA-256.
- Autorización en **cada** endpoint y cada Server Action: "¿este usuario es dueño de este recurso?". Un 404/403 por recurso ajeno es obligatorio, no opcional.

## CORS

- CORS solo importa cuando **un navegador** llama a tu API desde otro origen. No protege nada contra bots ni `curl`: la protección es la auth.
- Responde con la lista exacta de orígenes permitidos (`https://tuapp.com`), agrega `Vary: Origin` y contesta el preflight `OPTIONS` con los métodos y headers que usas.
- `Access-Control-Allow-Origin: *` está prohibido con cookies o credenciales (el navegador lo rechaza) y es mala idea en APIs privadas. Si el frontend y la API pueden vivir en el mismo dominio, ponlos juntos y CORS desaparece.

## Rate limiting

- Limita por API key o usuario (por IP solo para endpoints anónimos como login o formularios). Responde 429 con `Retry-After`.
- En Cloudflare usa lo que diga el plugin `cloudflare` (rate limiting o un Durable Object por clave; KV no sirve para contadores exactos). Login y endpoints caros (IA, envío de correos) primero.

## Webhooks entrantes (recibir)

Checklist obligatorio:

1. **Verifica la firma con el cuerpo crudo**, antes de parsear el JSON. Usa la librería oficial del proveedor si existe; si no, HMAC-SHA256 con comparación de tiempo constante (`crypto.timingSafeEqual` en Node, `hmac.compare_digest` en Python). Cualquier middleware que parsee el body antes rompe la firma.
2. **Rechaza timestamps viejos** (Stripe usa 5 minutos por defecto) para frenar replays. Reloj del servidor con NTP.
3. **Idempotencia**: el mismo evento puede llegar varias veces. Guarda el ID del evento (Stripe: `event.id`; GitHub: `X-GitHub-Delivery`; Standard Webhooks: `webhook-id`) con restricción única en la misma transacción que el efecto. Si ya existe, responde 200 sin hacer nada.
4. **Responde 2xx rápido** (GitHub corta a los 10 s) y procesa lo pesado después: cola (Cloudflare Queues), `ctx.waitUntil` o una tabla de pendientes.
5. **No dependas del orden**: los eventos pueden llegar desordenados. Ante la duda, vuelve a pedir el objeto a la API del proveedor.
6. **Reintentos del proveedor**: si respondes error, reintentan (Stripe hasta 3 días en modo live con backoff). Un 500 por un bug tuyo = el mismo evento llegando muchas veces: por eso el punto 3.
7. Exenta la ruta del webhook de CSRF si el framework lo aplica, solo esa ruta.
8. Muchos proveedores siguen **Standard Webhooks** (headers `webhook-id`, `webhook-timestamp`, `webhook-signature` con formato `v1,<base64>`) y tienen librerías oficiales.

Probar en local: el CLI del proveedor (`stripe listen --forward-to localhost:4242/webhook`) o un túnel (skill `cloudflare-tunnel-y-dominio`).

## Llamar APIs externas (salientes)

1. **Siempre timeout**: `fetch(url, { signal: AbortSignal.timeout(10_000) })` en Node; en Python `httpx` con `timeout=10`. Sin timeout, un bot se queda colgado.
2. **Revisa el status antes de parsear** (`if (!res.ok)`), y **valida la respuesta** con zod/pydantic: las APIs cambian.
3. **Reintenta solo lo reintentable**: errores de red, timeouts, 408, 429 y 5xx. Nunca 400/401/403/404/422 (fallará igual).
4. **Backoff exponencial con jitter** y tope de intentos (3–5); si viene `Retry-After`, respétalo.
5. **POST que crea o mueve dinero**: no lo reintentes a ciegas. Usa la llave de idempotencia de la API si existe (Stripe: header `Idempotency-Key`) o consulta el estado antes de repetir.
6. Loguea método, URL sin secretos, status y milisegundos de cada llamada: así se depura (skill `depurar-rendimiento`).

Código probado de `fetchConReintentos`, verificación HMAC en TS y Python, y tabla SQL de idempotencia: lee `references/codigo-probado.md` cuando vayas a implementarlo.

## Al terminar

Prueba con `curl` cada endpoint: un caso feliz, un body inválido (espera 422), sin credencial (401), recurso ajeno (403/404). Para webhooks: manda el mismo evento dos veces y comprueba que el efecto ocurrió una sola vez, y uno con firma mala (espera 400/401). Muestra la salida y dale al usuario los comandos para repetirlo.

## Fuentes (verificado nov 2026)

- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status (422, 429) y https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS y https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://docs.stripe.com/webhooks (cuerpo crudo, tolerancia 5 min, reintentos 3 días, duplicados, orden)
- https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks (10 s, `X-GitHub-Delivery`)
- https://docs.stripe.com/api/idempotent_requests (`Idempotency-Key`)
- https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md y https://www.standardwebhooks.com/
