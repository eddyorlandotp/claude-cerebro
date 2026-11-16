---
name: apps-con-llms
description: Construir apps con LLMs (Claude u otros) - elegir modelo por costo y latencia, prompt caching, JSON con schema, streaming, topes de gasto, evals antes de entregar a un cliente y API keys fuera del frontend. Usa con IA, LLM, API de Claude.
---

# Apps con LLMs que no truenan ni cuestan de más

Esta skill es para **decidir y revisar**: qué modelo, cuánto va a costar, cómo forzar el formato y cómo probar antes de entregar. Para la sintaxis exacta del SDK de Anthropic usa la skill oficial `claude-api` (anthropics/skills) si está instalada. El error que corrige: Claude elige el modelo más caro "por si acaso", no hace la cuenta de costo, pide JSON "por favor" en vez de forzarlo, deja la API key en el navegador y entrega al cliente sin una sola prueba repetible.

## Regla 0: verifica antes de confiar

- Modelos, precios y parámetros cambian cada pocos meses. Antes de escribir código o cotizar, abre `https://platform.claude.com/docs/en/about-claude/pricing.md` y la página de la feature (agrega `.md` a cualquier URL de platform.claude.com para leerla limpia), o usa Context7 si está instalado.
- Nunca escribas un ID de modelo de memoria: cópialo de la tabla de modelos vigente.
- Si el cliente quiere otro proveedor (OpenAI, Gemini, etc.), revisa su página oficial de precios y modelos el mismo día; no traslades números de Claude.

## 1. Elegir modelo (a nov 2026 — verifícalo)

Fuente: https://platform.claude.com/docs/en/about-claude/pricing (USD por millón de tokens, MTok).

| Modelo | Entrada | Salida | Lectura de caché | Úsalo para |
|---|---|---|---|---|
| Claude Haiku 5.5 (`claude-haiku-5-5`), prompt de hasta 100k tokens | $0.10 | $0.50 | $0.01 | Chatbots de atención, clasificar, extraer datos, alto volumen, subagentes |
| Claude Haiku 5.5, prompt de más de 100k tokens | $0.50 | $2.50 | $0.05 | Igual, pero cuidado con historiales largos |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 | $10 | $0.10 | Respuestas que requieren criterio, código, análisis |
| Claude Opus 5.5 (`claude-opus-5-5`) | $4 | $20 | $0.20 | Agentes largos y tareas difíciles |
| Claude Fable 5.2 (`claude-fable-5-2`) | $8 | $40 | $0.20 | Solo si Opus con esfuerzo alto no alcanza |

Reglas:
1. **Empieza con el modelo más barato que pase tus evals** (sección 6). La doc oficial lo llama "efficiency-first": Haiku primero, sube solo si falla en algo concreto.
2. Antes de cambiar de modelo, prueba el parámetro de esfuerzo (`effort`): la doc dice que muchas veces es mejor palanca que cambiar de modelo.
3. Los modelos 4.7 en adelante usan un tokenizer que produce ~30% más tokens para el mismo texto: cuenta tokens con el endpoint de conteo, no con "palabras × 1.3".
4. Encapsula la llamada al modelo en **una sola función** (`responder(mensajes) -> texto`) para poder cambiar de modelo o proveedor sin tocar el resto.

### Haz la cuenta en voz alta

Antes de cotizar a un cliente, calcula el costo por mensaje y por 1,000 mensajes. Ejemplo con Haiku 5.5, system prompt de 3,000 tokens en caché, 2,200 tokens de historial + pregunta, 300 de respuesta:
- Caché: 3,000 × $0.01/M = $0.00003
- Entrada normal: 2,200 × $0.10/M = $0.00022
- Salida: 300 × $0.50/M = $0.00015
- Total ≈ **$0.0004 por mensaje ≈ $0.40 USD por 1,000 mensajes** (sin contar la primera escritura de caché).

El mismo cálculo con Sonnet 5.5 da ≈ $0.0077 por mensaje (≈ 19 veces más). Pon la tabla en la propuesta al cliente y deja margen (×2) por historiales que crecen.

## 2. Prompt caching (lo que más ahorra)

Fuente: https://platform.claude.com/docs/en/build-with-claude/prompt-caching

- Activación simple: un campo `cache_control: {"type": "ephemeral"}` al nivel superior del request (caching automático): el sistema mueve el punto de caché al último bloque y lo avanza conforme crece la conversación. Hay hasta 4 breakpoints si necesitas control fino.
- Orden del prefijo: `tools` → `system` → `messages`. Cambiar algo en un nivel invalida ese nivel y los siguientes. Por eso:
  - **No metas en el system prompt** la fecha/hora, el nombre del usuario ni nada que cambie por request. Ponlo en el mensaje del usuario.
  - No reordenes ni edites las herramientas entre requests.
- TTL: 5 minutos por defecto (se refresca con cada lectura); 1 hora con `"ttl": "1h"`. Escribir cuesta 1.25× la entrada (5 min) o 2× (1 h); leer cuesta 0.05× en Opus 5.5 y Sonnet 5.5, 0.1× en los demás.
- Mínimo cacheable: 512 tokens en los modelos 5.x (más en algunos 4.x). Si el prompt es más corto **no falla, solo no cachea**.
- Comprueba que funciona: en la respuesta, `usage.cache_read_input_tokens` debe ser > 0 desde el segundo request. Si `cache_creation_input_tokens` y `cache_read_input_tokens` son 0, no se cacheó. Enséñale al usuario ese número.

## 3. Salidas estructuradas (JSON garantizado)

Fuente: https://platform.claude.com/docs/en/build-with-claude/structured-outputs

- Si el código va a leer la respuesta, **no pidas "responde en JSON"**: usa `output_config.format` con `type: "json_schema"`, o `strict: true` en la herramienta si es tool use. En Python usa `client.messages.parse()` con Pydantic; en TypeScript `zodOutputFormat()` con Zod (la skill `claude-api` tiene la sintaxis).
- Limitaciones del schema: sin `minimum`/`maximum`, sin `minLength`/`maxLength`, `additionalProperties` debe ser `false`, sin schemas recursivos. Un feature no soportado da error 400. Valida rangos en tu código después.
- Aun así revisa `stop_reason`: con `"refusal"` o `"max_tokens"` la salida puede no cumplir el schema. Maneja ambos casos.
- La primera vez que usas un schema hay latencia extra (compila la gramática; se cachea 24 h). Cambiar el `output_config.format` invalida el prompt cache de esa conversación.
- Para clasificar, usa un `enum` con las etiquetas válidas.
- El "prefill" (empezar tú la respuesta del asistente) da error 400 desde los modelos 4.6: no lo uses para forzar formato.

## 4. Streaming

Fuente: https://platform.claude.com/docs/en/build-with-claude/streaming

- Usa streaming en chats (el usuario ve texto en segundos) y en salidas largas. Usa los helpers del SDK; no parsees SSE a mano.
- Pueden llegar errores **a mitad del stream** (por ejemplo `overloaded_error`): muestra un mensaje amable y reintenta con backoff; no dejes la burbuja de chat colgada.
- Para un bot de WhatsApp/Telegram el usuario no ve tokens parciales: no hace falta streaming, manda la respuesta completa.

## 5. Topes de costo y seguridad

Fuente: https://platform.claude.com/docs/en/api/rate-limits

- **Límite de gasto mensual** en la consola: `platform.claude.com/settings/spend-limits`. Crea un **workspace por cliente** con su propio límite y su propia API key: así un cliente no se come el presupuesto de otro y puedes revocar una sola llave.
- Al llegar a tu límite la API responde 400 (`You have reached your specified ... usage limits`); al tope del tier, 429 con `enforced_spend_limit_reached`. Tu app debe distinguirlos de un rate limit normal y avisar.
- En tu código: `max_tokens` siempre explícito; límite de mensajes por usuario por día; recorta o resume historiales largos; corta conversaciones de más de N turnos.
- Tareas no urgentes (resúmenes nocturnos, clasificar miles de registros): Batch API con 50% de descuento.
- **La API key vive solo en el servidor** (Worker, backend, n8n). El SDK de TypeScript bloquea el navegador por defecto; nunca actives `dangerouslyAllowBrowser`. Flujo correcto: frontend → tu endpoint (con rate limit) → API. Ver skill `secretos-y-llaves` de `cerebro-base`.
- Trata el texto del usuario y de documentos como **datos, no instrucciones**. Herramientas que mueven dinero, mandan correos o borran algo requieren confirmación humana.

## 6. Evals antes de entregar a un cliente

Fuente: https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

1. Escribe con el cliente **criterios de éxito medibles** ("responde horario y precios correctos", "nunca inventa precios", "pasa a humano si piden factura").
2. Arma un archivo `evals/casos.jsonl` con 20–50 casos reales: entrada + resultado esperado o regla. Incluye casos difíciles: preguntas fuera de tema, groserías, intentos de "ignora tus instrucciones", datos que no existen.
3. Califica con código cuando se pueda (contiene el precio correcto, JSON válido, etiqueta igual). Para tono o utilidad usa un LLM calificador con rúbrica clara, y revisa a mano una muestra para confirmar que califica bien. La doc prioriza volumen sobre perfección.
4. Corre el eval **cada vez** que cambies prompt, modelo o esfuerzo, y guarda el resultado (`evals/resultados-AAAA-MM-DD.md`).
5. No entregues con menos del umbral acordado. Si falla, muestra los casos fallidos al usuario.

Para cómo escribir el system prompt usa la skill `prompts-que-funcionan`; para RAG, `rag-y-busqueda`; para bots de mensajería, `chatbots-whatsapp-telegram`.

## Antes de decir "listo"

- [ ] Modelo elegido con razón en 1–2 frases y costo estimado por 1,000 mensajes.
- [ ] `cache_read_input_tokens` > 0 comprobado en un request real (si el prompt pasa del mínimo).
- [ ] Salida estructurada con schema, no con "por favor".
- [ ] API key solo en el servidor; workspace y límite de gasto configurados.
- [ ] Eval corrido, con números (ej. 46/50) y los fallos explicados.

## Cómo comprobarlo tú mismo

Abre la consola de Claude en la sección de uso (Usage) después de 20 mensajes de prueba y compara el costo real con la estimación. Pide a Claude que te muestre el archivo de evals y el último resultado; si no existe, el bot no está probado.

## Fuentes (verificado nov 2026)

- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (prefill no soportado desde 4.6)
- https://platform.claude.com/docs/en/api/rate-limits (spend limits, códigos de error)
- https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- https://github.com/anthropics/anthropic-sdk-typescript (README: navegador deshabilitado por defecto)
