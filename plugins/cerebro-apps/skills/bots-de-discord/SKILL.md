---
name: bots-de-discord
description: Bot de Discord que no se cae ni lo banean - discord.js o discord.py, intents mínimos, slash commands, responder en 3 s, sin Administrator, rate limits, hosting 24/7 o Workers. Usar con bot de Discord, slash command, alertas.
---

# Bots de Discord

El error que corrige: Claude activa todos los intents (incluido Message Content) "por si acaso", pide permiso Administrator, registra los comandos en cada arranque, no responde a tiempo a la interacción ("La aplicación no respondió") y reintenta en bucle hasta que Cloudflare banea la IP. También: montar un bot con proceso 24/7 cuando un webhook o un Worker bastaba.

## Reglas

1. **Verifica antes de confiar.** Antes de escribir código, revisa la versión instalada (`npm ls discord.js` o `pip show discord.py`) y confirma la API en la doc de la librería o en docs.discord.com (WebFetch; agrega `.md` a la URL) o con Context7 si está instalado. discord.js v13 y v14 son muy distintos: no mezcles ejemplos.
2. **El token del bot es un secreto.** Va en `.env`/secret, nunca en el código, el repo, logs ni el chat. Si se filtra: Developer Portal > Bot > Reset Token, y actualiza el secret (skill `secretos-y-llaves`).
3. **Explica en 1–3 frases** qué tipo de bot armas y dónde corre ("Lo hago como Worker de Cloudflare: solo responde slash commands, no necesita estar prendido 24/7 y es gratis").
4. **Dinero real:** ningún comando de Discord ejecuta compras, ventas ni retiros. Si algún día se pide, solo para IDs de usuario permitidos, con confirmación explícita y límites; por defecto, el bot **solo informa**.

## Primero: ¿qué tipo de bot es?

| Necesidad | Solución | Dónde corre |
|---|---|---|
| Solo **enviar alertas** a un canal (señales, PnL, caídas del bot de trading) | **Webhook del canal** (Ajustes del canal > Integraciones). Un `POST` HTTP, sin bot | Desde el servicio que ya tienes |
| Responder **slash commands** y botones, sin leer mensajes | Bot por **HTTP (Interactions Endpoint URL)** | Cloudflare Worker (sin proceso 24/7). Discord tiene tutorial oficial para Workers |
| Reaccionar a eventos (miembros que entran, mensajes, voz) | Bot por **Gateway** (websocket) con discord.js o discord.py | Proceso 24/7: mini-PC con systemd (skill `servicios-24-7`) o VPS |

Recibir interacciones por Gateway o por HTTP es **excluyente**: elige uno. Por HTTP debes validar las cabeceras `X-Signature-Ed25519` y `X-Signature-Timestamp` en **cada** request y responder `401` si falla (Discord prueba esto al registrar la URL).

## Librería (a nov 2026 — verifica en npm/PyPI)

- **discord.js 14.28.1** (Node). Usa Node LTS actual; la rama siguiente (v15) está en desarrollo y pide Node 24+: no la uses salvo que el usuario lo pida.
- **discord.py 2.7.1** (Python ≥ 3.8).
- Elige el lenguaje del resto del proyecto. Si no hay preferencia, discord.js.

## Intents: lo mínimo

- Privilegiados: **`GUILD_MEMBERS`, `GUILD_PRESENCES`, `MESSAGE_CONTENT`**. Hay que activarlos en Developer Portal > Bot > Privileged Gateway Intents; si los pides en código sin activarlos, Discord cierra la conexión con código **4014**.
- Con slash commands **no necesitas `MESSAGE_CONTENT`**: el comando trae sus opciones. Sin ese intent no recibes `content`, `embeds`, `attachments`, `components` ni `poll` de los mensajes (excepto: mensajes del propio bot, DMs con el bot, mensajes que lo mencionan y el mensaje sobre el que se usa un comando de menú contextual).
- Al llegar a 100 servidores el bot debe verificarse y los intents privilegiados requieren aprobación; con más de 10,000 usuarios, revisión. Pedir de más hoy complica eso mañana.
- discord.js: empieza con `GatewayIntentBits.Guilds` y agrega solo lo que use una función concreta. discord.py: `discord.Intents.default()` y activa individualmente.

## Slash commands

- **Registra los comandos con un script aparte** (`deploy-commands`), no en cada arranque: hay límite de **200 creaciones por día por servidor**, y crear uno con nombre existente lo sobrescribe (upsert).
- **Desarrollo: comandos de servidor (guild)** — se actualizan al instante. **Producción: globales** (máx. 100 comandos de chat globales).
- Scopes al invitar: `bot` + `applications.commands`.

## Responder a tiempo

- Debes dar la **respuesta inicial en menos de 3 segundos** o la interacción se invalida ("La aplicación no respondió").
- Si vas a consultar una API (precio, RPC, base de datos), **primero `deferReply()`** (discord.js) / `interaction.response.defer()` (discord.py) y después edita la respuesta. El token de la interacción dura **15 minutos** para follow-ups.
- Respuestas con datos del usuario (saldos, configuraciones): **efímeras** (flag `EPHEMERAL`), solo las ve quien ejecutó el comando.

## Permisos del bot

- **Nunca `Administrator`.** Calcula el entero de permisos solo con lo que usa (p. ej. Ver canales, Enviar mensajes, Insertar enlaces) en Developer Portal > OAuth2 > URL Generator.
- Algunos permisos de moderación requieren que el dueño tenga 2FA si el servidor lo exige.
- Usa `allowed_mentions` cuando el texto venga de usuarios o APIs, para no pingear `@everyone` por accidente.

## Rate limits (a nov 2026)

- Límite global: **50 requests por segundo** por bot (las respuestas a interacciones no cuentan).
- Un `429` trae `retry_after` / cabecera `Retry-After`: **espera eso** antes de reintentar. Las librerías ya manejan los buckets: no las rodees con `fetch` directo en bucle.
- **Ban de Cloudflare:** **10,000 requests inválidos (401, 403, 429) en 10 minutos** bloquean temporalmente la IP. Por eso:
  - Si recibes `401` (token malo), **detén el bot** y avisa; no reintentes.
  - `403` (sin permiso en ese canal) → no repitas en ese canal; registra y sigue.
  - Reintentos con backoff y tope.
- Varios bots en la misma IP de casa comparten ese límite de inválidos.

## Hosting 24/7 (bot de Gateway)

- Mini-PC/servidor de casa con **systemd** (`Restart=always`) y logs en journal: skill `servicios-24-7`. Monitoreo y alertas: `deploy-y-monitoreo`.
- La librería reconecta sola el Gateway; tu código debe tolerar eventos repetidos o perdidos (no asumir "exactamente una vez").
- Un Worker de Cloudflare **no** puede mantener el Gateway abierto de forma práctica: para Workers usa el modo HTTP.

## Al terminar

Dile al usuario: (1) qué tipo de bot hiciste y dónde corre, (2) el link de invitación con permisos mínimos, (3) cómo comprobarlo él: invitarlo a un servidor de prueba, correr el comando y ver la respuesta; para el 24/7, `systemctl --user status <servicio>` o el dashboard del Worker.

## Fuentes (verificado nov 2026)

- https://docs.discord.com/developers/events/gateway (intents privilegiados, 4014, verificación a 100 servidores, revisión a 10,000 usuarios)
- https://docs.discord.com/developers/interactions/overview (Interactions Endpoint URL, Ed25519)
- https://docs.discord.com/developers/interactions/receiving-and-responding (3 s, 15 min, deferred, efímeras)
- https://docs.discord.com/developers/interactions/application-commands (guild vs global, 200 creaciones/día, 100 globales)
- https://docs.discord.com/developers/topics/rate-limits (50/s, 10,000 inválidos en 10 min)
- https://docs.discord.com/developers/topics/permissions y https://docs.discord.com/developers/topics/oauth2
- https://docs.discord.com/developers/tutorials/hosting-on-cloudflare-workers
- https://www.npmjs.com/package/discord.js (14.28.1) y https://discord.js.org/docs
- https://pypi.org/project/discord.py/ (2.7.1, Python ≥ 3.8)
