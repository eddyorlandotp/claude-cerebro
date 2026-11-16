---
name: deploy-y-monitoreo
description: Publicar sin romper producción - checklist (build, tests, secrets, migraciones, rollback), smoke test real, logs y monitoreo gratis con alertas para servicios 24/7 (bots, Workers, servidores). Usar con deploy, publicar, producción, rollback, uptime, monitoreo, logs, "se cayó".
---

# Deploy y monitoreo

"Ya está desplegado" no significa "funciona en producción". Y un bot 24/7 que se cae en silencio a las 3 a.m. es peor que uno que nunca arrancó. Esta skill cubre el antes, el después y el "avísame si se cae".

Para detalles de APIs de Cloudflare usa el plugin oficial `cloudflare` si está instalado; aquí solo va el proceso.

## Antes de publicar (checklist; muéstrala con estado real)

1. **Código guardado**: `git status --short` limpio y commit hecho. Anota el hash: es tu punto de regreso.
2. **Build**: el comando de build termina con código 0 (cópialo del `CLAUDE.md` del proyecto).
3. **Tests**: pasan. Si no hay tests, di "sin tests" y haz el smoke test local (paso 4) con más cuidado.
4. **Smoke test local**: levanta en local (`npx wrangler dev`, `npm run dev`, etc.) y prueba el flujo principal de verdad (una petición real, no solo que arranque).
5. **Variables y secrets**: compara lo que el código lee contra lo que existe en producción, solo por NOMBRE:
   ```bash
   npx wrangler secret list          # Workers: muestra nombres, no valores
   ```
   Falta uno → el deploy "funciona" y la primera petición truena.
6. **Migraciones de base de datos**: si hay:
   - Cloudflare D1: revisa pendientes con `npx wrangler d1 migrations list <db> --remote`. Antes de aplicar, recuerda que Time Travel permite restaurar D1 a cualquier minuto de los últimos 30 días en Workers Paid / 7 días en Free (a nov 2026; verifícalo en https://developers.cloudflare.com/d1/platform/limits/). Para algo crítico, exporta además: `npx wrangler d1 export <db> --remote --output respaldo-AAAA-MM-DD.sql`.
   - Aplicar (`npx wrangler d1 migrations apply <db> --remote`) requiere confirmación del usuario.
   - Una migración que borra o renombra columnas rompe el rollback del código: el código viejo ya no entiende la tabla. Prefiere migraciones que solo agregan.
7. **Plan de rollback escrito ANTES de publicar**, en una línea al usuario:
   - Workers: `npx wrangler deployments list` para ver el despliegue actual; si algo sale mal, `npx wrangler rollback [VERSION_ID]` (sin ID regresa a la versión anterior). Solo cubre las últimas 100 versiones y **no revierte datos, KV, D1, R2 ni bindings**.
   - Otros (servidor propio, Roblox, Steam): cuál es la versión anterior y el comando o pasos exactos para volver.
8. **Confirmación del usuario** para publicar a producción (skill `modo-mentor`). Evita publicar cambios grandes justo antes de que el usuario se desconecte: nadie verá las alertas.

Si el proyecto tiene entorno de staging, publica ahí primero y repite el smoke test.

## Publicar

- Usa el comando documentado del proyecto, no uno improvisado.
- Lee la salida completa: URL publicada, ID de versión, advertencias. Anota el ID de versión.
- Después de que funcione en producción, marca la versión: `git tag -a vX.Y.Z -m "..."` y súbela (skill `red-de-seguridad-git`).

## Después de publicar (obligatorio, no opcional)

1. **Smoke test real contra producción**, no contra local:
   ```bash
   curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://<dominio>/health
   curl -sS https://<dominio>/<ruta-principal> | head -c 500
   ```
   Para una web: abre la URL y prueba el flujo principal (si el plugin `playwright` está instalado, úsalo para hacerlo de verdad). Para un bot: confirma que procesó al menos un ciclo (log o heartbeat).
2. **Logs en vivo** unos minutos:
   ```bash
   npx wrangler tail --format pretty               # todo
   npx wrangler tail --status error --format pretty # solo errores
   ```
   Máximo 10 clientes viendo logs en tiempo real por Worker (incluye el dashboard); con mucho tráfico entra en muestreo y se pierden mensajes.
3. **Workers Logs persistentes**: actívalos una vez en la config y redepliega:
   ```jsonc
   // wrangler.jsonc
   "observability": { "enabled": true }
   ```
   A nov 2026, el plan Free incluye 200,000 eventos de log por día con 3 días de retención (Paid: 7 días). Verifícalo en https://developers.cloudflare.com/workers/observability/logs/workers-logs/
4. Reporta al usuario con estado real: "Publicado versión <id>. `/health` responde 200 en 0.3 s. Sin errores en 5 min de logs." o "Publicado pero /api/precio da 500: hago rollback?".

Si el smoke test falla: propón rollback inmediato, no "arreglarlo en caliente" mientras producción está rota.

## Monitoreo gratis para servicios 24/7

### 1. Endpoint `/health`
Todo servicio web o Worker expone `GET /health` que responde rápido:
```json
{ "ok": true, "version": "1.3.0", "commit": "abc1234", "checks": { "rpc": "ok", "db": "ok" } }
```
- Status 200 solo si lo esencial funciona; 503 si no.
- Revisiones baratas (un ping al RPC, un `SELECT 1`), sin gastar créditos de APIs de pago en cada chequeo.
- Nunca incluyas secretos, saldos ni direcciones en la respuesta.

### 2. Uptime externo (¿responde desde internet?)
UptimeRobot, plan Free a nov 2026: 50 monitores, intervalo de 5 minutos, 5 integraciones, uso comercial permitido; alertas por email y app móvil (Telegram y Discord están entre sus integraciones). Verifícalo en https://uptimerobot.com/pricing/ antes de depender de esto. Configura un monitor HTTP a `https://<dominio>/health`.

### 3. Heartbeat (¿sigue VIVO el bot o cron?)
Para cosas que no reciben tráfico (bots de trading, Cron Triggers, backups, servidor de Minecraft), el uptime no sirve: necesitas un "avísame si NO me reporto".
- healthchecks.io, plan Hobbyist gratis a nov 2026: 20 checks. Integraciones incluyen email, Telegram, Discord, Signal y ntfy. Verifícalo en https://healthchecks.io/pricing/
- El servicio hace ping al terminar cada ciclo exitoso: `https://hc-ping.com/<uuid>`. Si falla, `https://hc-ping.com/<uuid>/fail`. Configura periodo = frecuencia del ciclo y un margen (grace time).
- En un Worker con Cron Trigger: al final del handler `scheduled(controller, env, ctx)`, `ctx.waitUntil(fetch(env.HEALTHCHECK_URL))`. La URL de ping va como secret (cualquiera con ella puede falsear el heartbeat).
- En Linux (home lab): en el servicio systemd usa `Restart=on-failure` para que se levante solo, y un timer o cron que haga `curl -fsS -m 10 --retry 3 https://hc-ping.com/<uuid> > /dev/null`.

### 4. Alertas de negocio (bots con dinero)
Además de "está vivo", alerta cuando:
- el saldo de la billetera del bot baja de un umbral;
- se alcanza el límite de pérdida diaria (y el bot se pausa solo);
- hay N errores seguidos de RPC o de swap;
- el bot lleva X horas sin operar cuando normalmente sí opera.
Manda la alerta por el mismo canal que el usuario ve en el celular (Telegram, Discord). Las reglas de riesgo del bot están en el plugin `cerebro-solana`.

### Prueba la alerta
Un monitor que nunca probaste no existe. Después de configurarlo: apaga el servicio o pausa el ping, confirma que llega la alerta al celular del usuario, y vuelve a encenderlo.

## Errores comunes

- Decir "desplegado" sin haber hecho una petición a la URL de producción.
- Publicar con un secret faltante o con el valor de desarrollo.
- Migración destructiva sin respaldo y sin pensar en el rollback.
- Monitorear solo "responde 200" en un bot que no recibe tráfico.
- Healthcheck que siempre responde `ok: true` aunque el RPC esté caído.
- Configurar alertas a un correo que el usuario no revisa.
- Dejar `wrangler tail` como único monitoreo: no guarda nada.

## Verifica antes de confiar

Comandos de Wrangler, límites de planes gratuitos y precios cambian. Antes de dar un comando o un límite, confírmalo con Context7 (MCP `context7`, si está instalado), con `npx wrangler <comando> --help` o WebFetch a la doc oficial.

## Fuentes (verificado nov 2026)

- `wrangler rollback`, `deployments list/status`, `versions list`, `secret list`, `tail` (`--format`, `--status`, `--search`): https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Rollbacks (100 versiones, no cambia recursos ni datos): https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Workers Logs (`observability.enabled`, límites Free/Paid): https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- Logs en tiempo real (10 clientes, muestreo): https://developers.cloudflare.com/workers/observability/logs/real-time-logs/
- D1 migraciones y export (`--remote`): https://developers.cloudflare.com/d1/wrangler-commands/
- D1 Time Travel (30 días Paid / 7 días Free): https://developers.cloudflare.com/d1/platform/limits/ y https://developers.cloudflare.com/d1/reference/time-travel/
- Handler `scheduled` y `ctx.waitUntil`: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- UptimeRobot plan Free: https://uptimerobot.com/pricing/ ; integraciones: https://uptimerobot.com/integrations/
- healthchecks.io (ping URLs, `/fail`, grace time; plan Hobbyist): https://healthchecks.io/docs/ y https://healthchecks.io/pricing/
- systemd `Restart=`: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
