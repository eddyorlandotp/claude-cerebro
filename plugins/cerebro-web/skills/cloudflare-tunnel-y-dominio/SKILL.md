---
name: cloudflare-tunnel-y-dominio
description: Publicar una app de la casa/servidor con Cloudflare Tunnel (cloudflared) y dominio propio - túnel con nombre, ingress, servicio systemd, DNS, SSL, proteger /admin con Cloudflare Access, errores 502/1033/websocket. Usa al decir tunnel, cloudflared, dominio, subdominio, 502.
---

# Cloudflare Tunnel y dominio

Esta skill corrige lo que Claude suele hacer mal: usar `trycloudflare` en producción, inventar flags de `cloudflared`, editar un `config.yml` que el servicio ni siquiera lee, y "proteger" el panel admin escondiendo la URL.

## Antes de tocar nada

1. **Verifica antes de confiar.** Antes de escribir un comando o una opción de `cloudflared` que no aparezca aquí, confírmala con `cloudflared <subcomando> --help`, con Context7 (MCP `context7`, si está instalado) o con WebFetch a `https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/`. Las páginas de Cloudflare se leen limpias añadiendo `index.md` al final de la URL.
2. **Haz inventario de lo que ya existe** (el usuario ya tiene un túnel funcionando; no crees otro encima):

```bash
cloudflared --version
cloudflared tunnel list                    # túneles locales (necesita cert.pem)
systemctl status cloudflared --no-pager    # ¿corre como servicio?
systemctl cat cloudflared                  # QUÉ comando y QUÉ config usa el servicio
ls -la ~/.cloudflared /etc/cloudflared 2>/dev/null
```

   - Si `systemctl cat` muestra `--token` o `tunnel run --token`, es un túnel **gestionado desde el dashboard**: sus rutas se editan en el dashboard, no en `config.yml`.
   - Si muestra `--config /ruta/config.yml`, es **gestionado localmente**: edita ESE archivo, no otro.
3. Explica al usuario en 1–3 frases qué vas a cambiar y qué URL puede dejar de responder mientras tanto.

## Decide el tipo de túnel

| Opción | Cuándo | Notas (a nov 2026) |
|---|---|---|
| Túnel gestionado desde el dashboard (token) | **Default.** Cloudflare lo recomienda "para la mayoría de los casos" | Rutas en Networking > Tunnels > Routes. Se administra desde cualquier PC |
| Túnel local con `config.yml` | Si ya existe así, o se quiere la config versionada en git | `cloudflared tunnel create`, ingress en YAML |
| Quick tunnel (`trycloudflare.com`) | **Solo pruebas de 5 minutos** | Máx. 200 requests en vuelo (luego 429), sin SSE, sin SLA. Nunca para la terminal en producción |

Instalar en CachyOS/Arch: `sudo pacman -S cloudflared` (está en el repo `extra`). En Debian/Ubuntu usa el `.deb` de la página de descargas oficial.

## Ruta A: túnel desde el dashboard (recomendada)

1. Dashboard > **Networking > Tunnels > Create a tunnel** > nombre descriptivo (`terminal-casa`).
2. Elige Linux, **copia el comando de instalación que da el dashboard** y córrelo en el servidor. No reescribas ese comando de memoria.
3. Pestaña **Routes > Add route > Published application**: subdominio + dominio + Service URL (`http://localhost:3000`).
4. El estado debe quedar `Healthy`. Si queda `Inactive`/`Down`, ve a la sección de errores.

El token (`eyJ...`) **es un secreto**: quien lo tenga puede correr tu túnel. Nunca lo imprimas en el chat, ni en un README, ni lo commitees.

## Ruta B: túnel local con config.yml

```bash
cloudflared tunnel login                      # abre navegador, guarda cert.pem
cloudflared tunnel create terminal            # guarda <UUID>.json (credencial: secreto)
cloudflared tunnel route dns terminal app.midominio.com   # crea CNAME a <UUID>.cfargotunnel.com
```

`~/.cloudflared/config.yml` (ejemplo para terminal + API + catch-all obligatorio):

```yaml
tunnel: <UUID>
credentials-file: /home/<usuario>/.cloudflared/<UUID>.json

ingress:
  - hostname: app.midominio.com
    service: http://localhost:3000
  - hostname: api.midominio.com
    service: http://localhost:8787
  - service: http_status:404      # obligatorio: la última regla sin hostname
```

Valida SIEMPRE antes de reiniciar:

```bash
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://api.midominio.com   # dice qué regla atrapa esa URL
cloudflared tunnel run terminal                            # prueba en primer plano
```

### Como servicio systemd

```bash
sudo cloudflared --config /home/<usuario>/.cloudflared/config.yml service install
sudo systemctl start cloudflared
systemctl is-enabled cloudflared      # debe decir enabled (arranca al prender)
sudo systemctl restart cloudflared    # después de CADA cambio de config
journalctl -u cloudflared -n 50 --no-pager
```

Trampa: con `sudo`, `$HOME` es `/root`, así que sin `--config` el servicio no encuentra tu config. Después de instalar, confirma con `systemctl cat cloudflared` qué archivo usa. Para servicios systemd en general (logs, reinicio automático) usa la skill de servicios 24/7 de `cerebro-linux` si está instalada.

## DNS y SSL

- Cada hostname publicado es un **CNAME proxied (nube naranja)** a `<UUID>.cfargotunnel.com`. Si `route dns` falla con "record already exists", borra o edita el registro viejo en el dashboard; no crees otro.
- Usa **un solo nivel de subdominio** (`app.midominio.com`). El certificado gratuito Universal SSL no cubre `api.app.midominio.com`; eso exige un Advanced Certificate de pago y da `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`.
- El modo SSL/TLS de la zona **nunca en Off**: rompe websockets por el túnel. Para orígenes `http://localhost` detrás del túnel, el tráfico público ya va cifrado hasta Cloudflare y de ahí por el túnel.
- `ERR_TOO_MANY_REDIRECTS`: tu app redirige HTTP→HTTPS pero la ruta usa `http://`. Quita la redirección en la app (Cloudflare ya fuerza HTTPS) o apunta la ruta al puerto HTTPS correcto.
- No pongas **Workers Routes** sobre el mismo hostname del túnel salvo que el Worker reenvíe con `return fetch(request)`; si no, se come el tráfico (incluidos websockets).

## Proteger /admin con Cloudflare Access

Esconder la URL no es seguridad. Usa Access (Zero Trust):

- Plan **Zero Trust Free: hasta 50 usuarios, $0** (a nov 2026 — verifícalo en https://www.cloudflare.com/plans/sase-zero-trust.md antes de depender de esto). El alta puede pedir método de pago aunque no cobre.
- Lo más simple y robusto: pon el panel en **su propio subdominio** (`admin.midominio.com`) y protégelo completo. Proteger rutas sueltas es frágil: `midominio.com/admin/*` **no** cubre `midominio.com/admin` (la doc lo dice explícito).
- Pasos: Zero Trust > Access controls > Applications > Create new application > Self-hosted and private > Add public hostname > política **Allow** solo con el correo del usuario. Todo app de Access es "deny" por defecto.
- Login: activa **One-time PIN** (código al correo) en Integrations > Identity providers si no hay otro proveedor.
- **Protege también la API del admin** (`/api/admin/...`), no solo la página. Error típico: el HTML pide login pero el endpoint que borra usuarios queda abierto.
- Defensa en profundidad: en el backend valida el header `Cf-Access-Jwt-Assertion` contra `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (busca el `kid` en `public_certs`). Así, si alguien llega directo al origen, no entra.

## Errores comunes (y qué significan)

| Síntoma | Significa | Revisa |
|---|---|---|
| **1033** | El túnel NO está conectado a Cloudflare | `systemctl status cloudflared`, logs, que el CNAME apunte al UUID correcto |
| **502 Bad Gateway** | El túnel sí conecta, pero `cloudflared` no alcanza tu app | ¿La app corre? `curl -v http://localhost:PUERTO`, `ss -tlnp \| grep PUERTO`, http vs https, puerto correcto |
| `x509: certificate is valid for ..., not localhost` | Origen HTTPS con cert de otro nombre | `originRequest.originServerName`; `noTLSVerify: true` solo temporal |
| Respuesta en streaming llega de golpe | El túnel bufferea | El origen debe mandar `Content-Type: text/event-stream` |
| Websockets se caen al estar quietos | Timeout por inactividad | Heartbeat ping/pong en cliente y servidor; probar `protocol: http2` |
| `websocket: bad handshake` | Ingress mal, origen caído, SSL en Off o Bot Fight Mode bloqueando | Logs de `cloudflared` primero |

Los websockets funcionan por el túnel sin configuración extra en todos los planes; Cloudflare puede cortarlos cuando reinicia servidores, así que el cliente **debe reconectar solo** con backoff.

## Al terminar (no declares "listo" sin esto)

```bash
cloudflared tunnel ingress validate                 # si es túnel local
curl -sSI https://app.midominio.com | head -5       # espera 200/30x, no 502/1033
curl -sSI https://admin.midominio.com | head -5     # espera redirección a cloudflareaccess.com
```

Dile al usuario cómo comprobarlo él: abrir la URL en el celular con datos móviles (fuera de su wifi), y abrir el admin en una ventana de incógnito para ver que pide el código.

## Fuentes (verificado nov 2026)

- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/ (Cloudflare recomienda túneles gestionados remotamente)
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/common-errors/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/remote-tunnel-permissions/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/network/websockets/
- https://www.cloudflare.com/plans/sase-zero-trust.md
- https://archlinux.org/packages/extra/x86_64/cloudflared/
