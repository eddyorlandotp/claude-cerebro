# BDS directo con systemd — plantilla

Léelo cuando el usuario quiera BDS sin Docker. Es un patrón (FIFO de systemd para mandar comandos a la consola); pruébalo completo antes de darlo por bueno: arrancar, mandar un comando, detener, revisar que guardó.

## Instalación

```bash
sudo useradd --system --create-home --home-dir /opt/bedrock --shell /usr/bin/nologin bedrock
# Descarga el zip de Linux desde https://www.minecraft.net/en-us/download/server/bedrock
sudo -u bedrock unzip bedrock-server-VERSION.zip -d /opt/bedrock/server
sudo -u bedrock mkdir -p /opt/bedrock/server/keys
```

Prueba manual una vez: `cd /opt/bedrock/server && sudo -u bedrock env LD_LIBRARY_PATH=. ./bedrock_server`, espera `Server started`, escribe `stop`. En fish usa `env LD_LIBRARY_PATH=. ./bedrock_server` o `LD_LIBRARY_PATH=. ./bedrock_server` (fish ≥3.1 acepta `VAR=x cmd`).

## Unidades

`/etc/systemd/system/bedrock.socket`
```ini
[Unit]
Description=Consola de Bedrock (FIFO)
PartOf=bedrock.service

[Socket]
ListenFIFO=/run/bedrock.stdin
SocketUser=bedrock
SocketMode=0600
RemoveOnStop=true
```

`/etc/systemd/system/bedrock.service`
```ini
[Unit]
Description=Minecraft Bedrock Dedicated Server
After=network-online.target
Wants=network-online.target
Requires=bedrock.socket
After=bedrock.socket

[Service]
Type=simple
User=bedrock
WorkingDirectory=/opt/bedrock/server
Environment=LD_LIBRARY_PATH=/opt/bedrock/server
ExecStart=/opt/bedrock/server/bedrock_server
Sockets=bedrock.socket
StandardInput=socket
StandardOutput=journal
StandardError=journal
# Apagado limpio: manda "stop" y ESPERA a que el proceso salga.
# ExecStop debe ser síncrono: al terminar, systemd mata lo que quede.
# $$ = "$" literal para sh; MAINPID lo exporta systemd a ExecStop.
ExecStop=/bin/sh -c 'echo stop > /run/bedrock.stdin; while [ -n "$$MAINPID" ] && kill -0 "$$MAINPID" 2>/dev/null; do sleep 1; done'
TimeoutStopSec=90
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bedrock.service
journalctl -u bedrock -f                         # espera "Server started"
echo "serveridentity save" | sudo tee /run/bedrock.stdin >/dev/null
echo "allowlist add \"Gamertag\"" | sudo tee /run/bedrock.stdin >/dev/null
```

Comprobar: `systemctl status bedrock`, `sudo ss -tulpn | grep bedrock` (TCP 19132 y el UDP configurado), `curl http://IP:19132/v1/join` desde otra máquina, y `sudo systemctl stop bedrock` seguido de `journalctl -u bedrock -n 20` para ver que se detuvo guardando (sin "killed").

## Respaldo con el servicio

Timer nocturno con un servicio `Type=oneshot` que corre (como root o con sudo configurado):

```bash
#!/usr/bin/env bash
set -euo pipefail
echo 'say Respaldo en 30 segundos' > /run/bedrock.stdin
sleep 30
systemctl stop bedrock.service
trap 'systemctl start bedrock.service' EXIT
fecha=$(date +%F_%H%M)
tar -czf /srv/respaldos/bedrock_"$fecha".tar.gz -C /opt/bedrock/server worlds server.properties allowlist.json permissions.json keys
ls -1t /srv/respaldos/bedrock_*.tar.gz | tail -n +15 | xargs -r rm --
```

## Actualizar

1. Respaldo (arriba). 2. `sudo systemctl stop bedrock`. 3. Descomprime la versión nueva en `/opt/bedrock/server-nuevo`. 4. Copia `worlds/`, `server.properties`, `allowlist.json`, `permissions.json`, `keys/` del viejo al nuevo; `diff` entre el `server.properties` nuevo y el tuyo para ver claves nuevas. 5. Renombra carpetas (deja la vieja como respaldo), `chown -R bedrock:bedrock`. 6. `sudo systemctl start bedrock` y revisa el log.
