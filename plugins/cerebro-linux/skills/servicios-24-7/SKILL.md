---
name: servicios-24-7
description: Cómo dejar un programa corriendo 24/7 en Linux y comprobar que sigue vivo - systemd (servicios de usuario y de sistema, Restart, linger, journalctl), timers en vez de cron, Docker/Podman compose con restart. Úsala para bots, servidores, scripts programados, daemon, always on, autostart.
---

# Servicios 24/7 en Linux (systemd y contenedores)

Objetivo: que el programa **arranque solo al prender la máquina, se levante solo si truena, deje logs consultables y se pueda comprobar en un comando**. Nada de `nohup`, `&`, `screen`/`tmux` "y lo dejas abierto", ni `@reboot` en cron.

## 0. Decide el tipo antes de escribir nada

Explícale al usuario en 1–2 frases cuál eliges y por qué.

| Situación | Usa |
|---|---|
| Script o binario propio (Node, Python, Go) en la PC o mini-PC | **servicio systemd** |
| Software que ya publica imagen Docker (bases de datos, Jellyfin, Minecraft itzg) | **Docker/Podman compose** con `restart: unless-stopped` |
| Tarea periódica (respaldo, limpieza, consulta cada hora) | **timer de systemd** + servicio `Type=oneshot` |
| Algo que solo debe vivir mientras el usuario tiene sesión gráfica | servicio de usuario sin linger |
| Algo en Cloudflare Workers | no aplica: eso ya es 24/7 en la nube (usa el plugin `cloudflare`) |

### ¿De usuario o de sistema?

- **De usuario** (`~/.config/systemd/user/`, `systemctl --user`): sin sudo, corre como el usuario, ideal para bots y scripts personales. **Necesita linger** para arrancar sin iniciar sesión y no morir al cerrarla: `loginctl enable-linger` (una vez). Verifica: `loginctl show-user "$USER" -p Linger` → `Linger=yes`.
- **De sistema** (`/etc/systemd/system/`, `sudo systemctl`): para servidores de la máquina (Minecraft, servicios de red). Córrelo con un usuario dedicado (`User=`), **nunca como root** si no hace falta.

## 1. Plantilla de servicio (usuario)

`~/.config/systemd/user/mi-bot.service`:

```ini
[Unit]
Description=Mi bot
After=network-online.target
Wants=network-online.target
# Si reinicia más de 5 veces en 10 min, se rinde (evita loops infinitos)
StartLimitIntervalSec=600
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=%h/proyectos/mi-bot
ExecStart=/usr/bin/node %h/proyectos/mi-bot/index.js
EnvironmentFile=%h/.config/mi-bot/env
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Reglas:
- `ExecStart` con **rutas absolutas** (`command -v node` para saberla). systemd no lee `config.fish` ni `.bashrc`: el PATH, nvm, mise, venv **no existen** ahí. Para Python usa el binario del venv: `%h/proyecto/.venv/bin/python main.py`.
- `%h` = home del usuario. No uses `~`.
- Secretos en `EnvironmentFile` con permisos `chmod 600`, formato `CLAVE=valor` por línea, sin `export`. Nunca en el `.service`, nunca en git.
- `Restart=always` + `RestartSec=5`. Si el programa sale con 0 a propósito y no debe volver, usa `Restart=on-failure`.
- Servicio de sistema: mismo formato en `/etc/systemd/system/x.service`, agrega `User=nombre` y `WantedBy=multi-user.target`; `%h` no sirve ahí, usa rutas completas.
- `network-online.target` en servicios de **usuario** no siempre espera a la red real (es un target del sistema). Si el programa truena por no tener red al arrancar, `Restart=always` lo resuelve; no agregues `sleep 30`.

Activar (usuario; para sistema quita `--user` y usa `sudo`):

```bash
systemctl --user daemon-reload
systemctl --user enable --now mi-bot.service
systemctl --user status mi-bot.service
```

Cada vez que edites el `.service`: `daemon-reload` + `restart`.

## 2. Timers en vez de cron

Arch no trae cron por defecto. Usa timers. Par de archivos con el mismo nombre:

`respaldo.service`
```ini
[Unit]
Description=Respaldo diario

[Service]
Type=oneshot
ExecStart=%h/bin/respaldo.sh
```

`respaldo.timer`
```ini
[Unit]
Description=Respaldo diario a las 3am

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

- Se habilita **el timer**, no el servicio: `systemctl --user enable --now respaldo.timer`.
- `Persistent=true`: si la PC estaba apagada a las 3am, corre al prender.
- Valida la expresión antes: `systemd-analyze calendar '*-*-* 03:00:00'`.
- Ver próximos disparos: `systemctl --user list-timers`.
- Probar ya, sin esperar: `systemctl --user start respaldo.service` y revisa el log.
- Tarea cada 15 min: `OnCalendar=*:0/15`.

## 3. Logs

```bash
journalctl --user -u mi-bot -f              # en vivo
journalctl --user -u mi-bot -n 100 --no-pager
journalctl --user -u mi-bot --since "1 hour ago"
journalctl -u minecraft -b -p err           # sistema, solo errores del arranque actual
```

El programa debe escribir a stdout/stderr; systemd lo guarda. No inventes archivos de log propios salvo que se pidan.

## 4. Docker / Podman

En Arch: `sudo pacman -Syu docker docker-compose` y `sudo systemctl enable --now docker.service`. El comando es `docker compose` (con espacio; el paquete trae el plugin).

- Agregar al usuario al grupo `docker` (`sudo usermod -aG docker $USER`, luego cerrar sesión) **equivale a darle root**. Avísale antes. Alternativa: Podman sin root (`podman`, `podman-compose`).
- En `compose.yaml` pon `restart: unless-stopped` en cada servicio (no `always`: `unless-stopped` respeta que lo hayas detenido a mano, incluso tras reiniciar Docker).
- Datos en volúmenes o carpetas montadas (`./data:/data`), nunca solo dentro del contenedor.
- Fija versión de imagen cuando importe (`imagen:1.2.3`), o documenta que `latest` se actualiza al recrear.
- Arranque al boot: con `docker.service` habilitado y `restart: unless-stopped` basta; no hace falta un `.service` extra.
- **Docker se salta `ufw`**: un puerto publicado (`-p 8080:8080`) queda abierto a toda la red aunque ufw diga lo contrario. Para que solo lo vea la máquina: `127.0.0.1:8080:8080`.
- Comandos: `docker compose up -d`, `docker compose ps`, `docker compose logs -f --tail=100`, `docker compose pull && docker compose up -d` (actualizar).

## 5. ¿Sigue vivo? (verificación obligatoria)

No digas "ya quedó corriendo" sin mostrar esto:

1. `systemctl --user is-active mi-bot` → `active` (o `docker compose ps` → `running`/`healthy`).
2. Que **haga su trabajo**: el log muestra actividad reciente, el puerto responde (`ss -tulpn | grep PUERTO`, `curl -sS localhost:PUERTO/health`), o el archivo/salida esperado existe.
3. Prueba de resurrección: `systemctl --user kill -s KILL mi-bot` y a los segundos vuelve a `active`. En Docker simula un crash matando el proceso desde el host: `sudo kill -9 (docker inspect -f '{{.State.Pid}}' contenedor)` y revisa que `docker compose ps` lo muestre otra vez arriba (`docker stop` es detención manual y la política de reinicio lo ignora, así que no sirve para esta prueba).
4. Si es crítico, prueba de reinicio: `sudo reboot` y confirma que arrancó solo (`systemctl --user status`, `loginctl show-user`).
5. Fallas globales: `systemctl --failed` y `systemctl --user --failed`.

Opcional para que el usuario se entere si algo cae: `OnFailure=` apuntando a un servicio que mande notificación (`notify-send`, Telegram, ntfy). Pregunta antes de agregar servicios externos.

## 6. Errores típicos

- Usar `~`, `$HOME` sin `Environment=` o rutas relativas en `ExecStart`.
- Olvidar `daemon-reload` tras editar.
- Habilitar el `.service` de un timer en vez del `.timer`.
- Servicio de usuario sin linger: "funciona hasta que cierro sesión / reinicio".
- `Type=forking` para un programa que no hace fork (se queda en "activating"). Casi siempre es `simple`.
- Poner `sudo` dentro de `ExecStart`.
- Bucles `while true; sleep` dentro de un script para "hacerlo periódico": usa un timer.
- En la terminal fish del usuario: `systemctl` y `journalctl` funcionan igual; para editar con `sudoedit` también.

## Verifica antes de confiar

Para opciones que no estén aquí consulta `man systemd.service`, `man systemd.timer`, `man systemd.exec` o Context7/WebFetch a la doc oficial antes de escribirlas. No inventes directivas.

## Fuentes (verificado nov 2026)

- https://wiki.archlinux.org/title/Systemd/User (linger, entorno de unidades de usuario)
- https://wiki.archlinux.org/title/Systemd/Timers (OnCalendar, Persistent, RandomizedDelaySec, systemd-analyze calendar)
- https://wiki.archlinux.org/title/Systemd/Journal
- https://man.archlinux.org/man/systemd.exec.5.en · https://man.archlinux.org/man/systemd.socket.5.en
- https://wiki.archlinux.org/title/Docker (docker.service, grupo docker = root, docker-compose)
- https://docs.docker.com/engine/containers/start-containers-automatically/ (restart policies)
- https://docs.docker.com/engine/network/packet-filtering-firewalls/ (Docker y ufw incompatibles)
- https://archlinux.org/packages/extra/x86_64/docker-compose/ (plugin en /usr/lib/docker/cli-plugins)
