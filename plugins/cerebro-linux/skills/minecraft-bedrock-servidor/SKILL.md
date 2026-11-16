---
name: minecraft-bedrock-servidor
description: Servidor de Minecraft Bedrock (BDS) en Linux o Docker itzg - server.properties, puertos NetherNet (TCP 19132 + UDP), allowlist, operadores, servicio systemd, respaldos del mundo sin corromperlo, actualizaciones, consolas. Keywords minecraft, bedrock, BDS, mundo, servidor de juego.
---

# Servidor de Minecraft Bedrock

## 0. Lo que cambió en 2026 (lee esto primero)

A nov 2026 BDS (1.26.5x en adelante) usa por defecto **`transport=nethernet`**, y desde Bedrock 26.60 (27 oct 2026) los clientes **ya no aceptan RakNet** (según el README de itzg, que cita a Aternos, y varios hosts). Consecuencias:

- El jugador se conecta primero por **TCP** a `server-port` (19132) para un handshake HTTP, y después el juego va por **UDP** en los puertos de `server-udp-ports`.
- **BDS ya no escucha en UDP 19132 "a la antigua"**. Guías que dicen "abre solo UDP 19132" están desactualizadas.
- `server-portv6` se ignora con NetherNet (un solo socket dual-stack en `server-port`).
- No pongas `transport=raknet` "para que funcione": los clientes actuales no entran.
- La documentación oficial viene **dentro del zip**: `bedrock_server_how_to.html` y los comentarios de `server.properties`. Léelos en la versión que tengas antes de cambiar puertos (`grep -A12 -E '^(transport|server-udp-ports)' server.properties`).

## 1. Elige forma de instalarlo

Explícale al usuario la elección en 1–2 frases.

| Opción | Cuándo |
|---|---|
| **Docker `itzg/minecraft-bedrock-server`** (recomendado en la mini-PC) | Se actualiza solo al reiniciar el contenedor (`VERSION=LATEST`), maneja allowlist/ops por variables, trae `send-command` |
| **BDS directo + systemd** | No quieres Docker o necesitas control fino. Más pasos para actualizar |

Requisitos oficiales: Linux x86-64; Mojang solo soporta Ubuntu, pero corre en otras distros con glibc 2.35+. En CachyOS/Arch funciona; si truena por librerías, usa Docker.

## 2. Puertos y firewall (NetherNet)

Abre en el firewall de la máquina (y reenvía en el router si es para internet):
- **TCP** `server-port` (19132).
- **UDP** los puertos de `server-udp-ports`. El `server.properties` que trae BDS 1.26.63 pone `server-udp-ports=19132` (un UDP compartido por todos). Si lo dejas vacío, BDS usa puertos efímeros al azar: **imposible de reenviar**; fija siempre un valor.
- UDP 7551 solo para que aparezca en "LAN" en la misma red.

```bash
sudo ufw allow 19132/tcp comment 'bedrock handshake'
sudo ufw allow 19132/udp comment 'bedrock juego'   # o el rango que pongas en server-udp-ports
```

Detrás de NAT/port forwarding, BDS tiene que anunciar la IP pública: `server-udp-ports=IP_PUBLICA:19132:19132` (formato `IP:público:local`; los rangos deben medir lo mismo). Con CGNAT esto no funciona (ver skill `homelab-y-red`).

**Prueba de conexión desde otra máquina** (sí, es HTTP): `curl http://IP_DEL_SERVIDOR:19132/v1/join` debe regresar JSON con nombre, versión y jugadores. Si responde pero nadie entra, el problema es el UDP.

## 3. server.properties: lo que sí importa

| Clave | Valor sugerido | Nota |
|---|---|---|
| `server-name` | nombre | sin `;` |
| `gamemode` / `difficulty` | survival / normal | |
| `allow-cheats` | false | |
| `max-players` | según RAM y subida | minecraft.wiki sugiere ~5 Mbps de subida por cada 10 jugadores |
| `online-mode` | **true** | exige cuenta Xbox; no lo apagues si es accesible desde internet |
| `allow-list` | **true** | ya viene en true; con la lista vacía **nadie** entra ("You're not invited") |
| `server-port` | 19132 | TCP con NetherNet |
| `server-udp-ports` | 19132 o rango | ver sección 2 |
| `transport` | nethernet | no lo cambies |
| `level-name` / `level-seed` | | carpeta en `worlds/` |
| `default-player-permission-level` | member | visitor / member / operator |
| `view-distance` / `tick-distance` | bajar si hay lag | tick-distance 4–12 |

Edita con el servidor **apagado**; la mayoría de cambios requieren reinicio. En vivo solo `changesetting allow-cheats|difficulty`.

## 4. Allowlist y operadores

En la consola del servidor:
- `allowlist add "Gamertag"` (con comillas si tiene espacios) / `allowlist remove ...` / `allowlist reload` si editaste `allowlist.json` a mano.
- `op "Gamertag"` / `deop ...`. Se guarda en `permissions.json` solo si el jugador está autenticado con Xbox Live.
- En Docker itzg: variables `ALLOW_LIST_USERS="gamer1:XUID,gamer2:XUID"` y `OPS="XUID,..."`, o `docker exec CONTENEDOR send-command allowlist add Gamertag`.

## 5. Identidad del servidor (nuevo)

Con NetherNet el servidor tiene una llave de identidad. Si no está guardada, **cambia en cada arranque** y los jugadores tienen que volver a aceptar el servidor. Guárdala una vez: comando de consola `serveridentity save` (crea `keys/server_identity_key.pem`); comprueba con `serveridentity status`. Inclúyela en los respaldos; es una llave privada: no la subas a git ni la compartas.

## 6. Correr 24/7

- **Docker**: compose de `references/docker-compose.md`. `restart: unless-stopped`, volumen `./data:/data`, `stdin_open` y `tty` en true.
- **BDS directo**: arranque `LD_LIBRARY_PATH=. ./bedrock_server` desde su carpeta. Unidades systemd con FIFO para mandar comandos y apagado limpio en `references/systemd-bds.md`. **No lo corras como root** y no lo dejes en `tmux` como solución permanente.
- Apagado limpio = comando `stop` en la consola (guarda el mundo). Un `kill -9` puede perder progreso.

## 7. Respaldos del mundo sin corromperlo

Copiar `worlds/` con el servidor corriendo puede dar un mundo corrupto. Dos formas válidas:

1. **Simple y segura (recomendada para casa)**: timer nocturno que detiene el servidor, copia/respalda `worlds/`, `server.properties`, `allowlist.json`, `permissions.json` y `keys/`, y lo vuelve a arrancar. 1–2 minutos fuera a las 4am.
2. **En caliente** (oficial): `save hold` → repetir `save query` hasta que regrese la lista de archivos con tamaños → copiar **solo esos archivos y truncar cada copia al tamaño indicado** → `save resume`. Fácil de hacer mal; usa una herramienta probada antes que un script improvisado.

Después: el respaldo va a otro disco y fuera de casa (skill `respaldos`). **Prueba restaurar** en una carpeta aparte y abre el mundo antes de decir que el respaldo sirve.

## 8. Actualizaciones

- Los clientes se actualizan solos y un servidor viejo los rechaza ("outdated server"). Actualiza pronto tras cada release.
- Docker: `docker compose pull && docker compose up -d` (o solo reinicia con `VERSION=LATEST`).
- BDS directo: respaldo primero → detener → descomprimir la versión nueva en carpeta aparte → copiar `worlds/`, `server.properties`, `allowlist.json`, `permissions.json`, `keys/` → arrancar → revisar log. El zip nuevo trae su `server.properties`: compáralo con `diff` porque Mojang agrega claves (así llegaron `transport` y `server-udp-ports`).
- Link oficial de descarga: <https://www.minecraft.net/en-us/download/server/bedrock> (el nombre del zip trae la versión).

## 9. Consolas y crossplay

- PC, celular y tablet pueden agregar el servidor por IP:puerto.
- **Xbox, PlayStation y Switch no tienen "agregar servidor"**: solo entran por LAN o con un truco de DNS personalizado. Díselo al usuario antes de prometer crossplay con consolas; los métodos de DNS son de terceros y cambian.
- Todos los jugadores deben tener la misma versión que el servidor.

## 10. Diagnóstico rápido

| Síntoma | Revisa |
|---|---|
| "You're not invited to play on this server" | allowlist vacía o falta el gamertag |
| "Unable to connect" desde fuera, LAN sí funciona | TCP 19132 + UDP sin reenviar, doble NAT, CGNAT, `server-udp-ports` sin IP pública |
| `/v1/join` responde pero no entra | UDP bloqueado o puertos anunciados mal |
| Tienen que "aceptar" el servidor cada vez | falta `serveridentity save` |
| Lag | baja `tick-distance`/`view-distance`, revisa CPU (BDS prefiere núcleos rápidos) |
| Servidor desactualizado | actualiza (sección 8) |

## Verifica antes de confiar

NetherNet es reciente y aún se mueve. Antes de tocar puertos o transporte lee `bedrock_server_how_to.html` de la versión instalada y, para Docker, el README actual de itzg. Para playit.gg u otros túneles, revisa su doc actual: hay reportes (sep 2026) de que un túnel solo-UDP ya no sirve con NetherNet; se necesitan TCP y UDP.

## Fuentes (verificado nov 2026)

- Zip oficial BDS 1.26.63.1 (bedrock_server_how_to.html, server.properties), descargado desde https://www.minecraft.net/en-us/download/server/bedrock
- https://minecraft.wiki/w/Bedrock_Dedicated_Server · https://minecraft.wiki/w/Server.properties · https://minecraft.wiki/w/Commands/save
- https://github.com/itzg/docker-minecraft-bedrock-server (README: NetherNet, puertos, allowlist, send-command, examples/nethernet/compose.yml)
- https://supercraft.host/wiki/minecraft/bedrock_port_19132_fix/ · https://www.doomhosting.com/help/articles/minecraft-bedrock-nethernet-error-cant-join (fecha 26.60 y fin de RakNet)
- https://discuss.playit.gg/t/bedrock-clients-cannot-join-through-udp-tunnel-v1-0-9-unable-to-connect-v1-0-10-client-crashes-while-java-edition-works-normally/5693
