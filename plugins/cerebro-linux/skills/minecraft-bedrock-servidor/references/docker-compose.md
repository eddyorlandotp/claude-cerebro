# Bedrock con Docker (itzg/minecraft-bedrock-server) — plantilla

Léelo cuando el usuario elija Docker. Revisa el README actual antes de usarlo: https://github.com/itzg/docker-minecraft-bedrock-server (las variables de NetherNet `TRANSPORT` y `SERVER_UDP_PORTS` requieren imágenes de sep 2026 o más nuevas).

## compose.yaml (carpeta propia, p. ej. `~/servidores/bedrock/`)

```yaml
services:
  bedrock:
    image: itzg/minecraft-bedrock-server
    container_name: bedrock
    restart: unless-stopped
    # host: BDS anuncia las IPs reales de la máquina; evita líos de NAT de Docker
    network_mode: host
    stop_grace_period: 60s
    environment:
      EULA: "TRUE"
      VERSION: "LATEST"            # se actualiza al reiniciar el contenedor
      TZ: "America/Mexico_City"
      SERVER_NAME: "Servidor de casa"
      GAMEMODE: "survival"
      DIFFICULTY: "normal"
      ONLINE_MODE: "true"
      ALLOW_LIST: "true"
      # gamertag:XUID (el XUID sale en el log cuando el jugador intenta entrar)
      ALLOW_LIST_USERS: |
        Gamertag1:XUID1
      OPS: "XUID1"
      SERVER_PORT: "19132"         # TCP, handshake NetherNet
      # Solo LAN o Tailscale: un puerto UDP fijo
      SERVER_UDP_PORTS: "19132"
      # Internet con port forwarding (sin CGNAT): anunciar IP pública
      # SERVER_UDP_PORTS: "<public_ip>:19132:19132"
      # Manda "stop" (guardado limpio) N segundos después de SIGTERM
      STOP_SERVER_ANNOUNCE_DELAY: "10"
    volumes:
      - ./data:/data
    stdin_open: true
    tty: true
```

Notas:
- Con `network_mode: host` no van `ports:`; el firewall de la máquina (ufw) sí aplica. Abre `19132/tcp` y `19132/udp` (o el rango que pongas).
- Si prefieres red bridge: quita `network_mode`, agrega `ports: ["19132:19132/tcp", "19132:19132/udp"]` y en `SERVER_UDP_PORTS` pon una IP que el cliente alcance (`IP_LAN:19132:19132`). Recuerda que con bridge Docker se salta ufw.
- `STOP_SERVER_ANNOUNCE_DELAY` debe ser menor que `stop_grace_period`.
- Datos (mundo, properties, allowlist, permisos, `keys/`) quedan en `./data`.

## Operación

```bash
docker compose up -d
docker compose logs -f --tail=100          # busca "Server started"
docker exec bedrock send-command serveridentity save
docker exec bedrock send-command allowlist add "Gamertag"
docker compose pull && docker compose up -d   # actualizar
curl http://IP_DEL_SERVIDOR:19132/v1/join      # desde OTRA máquina
```

El healthcheck del contenedor prueba por loopback: "healthy" **no** demuestra que se pueda entrar desde fuera.

## Respaldo simple (detener → copiar → arrancar)

Script bash que corre un timer de systemd (ver skill `servicios-24-7`):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/servidores/bedrock
docker exec bedrock send-command say "Respaldo en 30 segundos"
sleep 30
docker compose stop bedrock
trap 'docker compose start bedrock' EXIT    # arranca aunque falle el respaldo
fecha=$(date +%F_%H%M)
tar -czf ~/respaldos/bedrock/bedrock_"$fecha".tar.gz -C ./data worlds server.properties allowlist.json permissions.json keys
# conserva los 14 más recientes
ls -1t ~/respaldos/bedrock/bedrock_*.tar.gz | tail -n +15 | xargs -r rm --
```

Ajusta rutas, crea `~/respaldos/bedrock` antes y prueba a mano una vez. Luego súbelo con restic a un destino fuera de casa (skill `respaldos`). Verifica que el `.tar.gz` se abre y que el mundo carga en una copia del servidor.
