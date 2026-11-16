# Plantilla: restic + timer de usuario

Léelo cuando vayas a automatizar respaldos con restic. Ajusta rutas con el usuario; no copies a ciegas.

## 1. Preparar (una vez)

```bash
sudo pacman -Syu restic
mkdir -p ~/.config/restic ~/bin
# Contraseña: genera una y que el usuario la guarde también en su gestor y en papel
openssl rand -base64 32 > ~/.config/restic/password
chmod 600 ~/.config/restic/password
```

Repositorio en disco USB (monta el disco y anota la ruta real con `findmnt`):

```bash
restic -r /run/media/USUARIO/DISCO/restic init --password-file ~/.config/restic/password
```

Para un segundo destino fuera de casa crea otro repo (backend SFTP, S3/B2 o rclone; revisa la doc de restic para su sintaxis y variables de credenciales) y córrelo en el mismo script.

## 2. Lista de rutas y exclusiones

`~/.config/restic/rutas.txt` (una por línea, absolutas):
```
/home/USUARIO/proyectos
/home/USUARIO/Obsidian
/home/USUARIO/.claude
/home/USUARIO/.config/hypr/user.lua
/home/USUARIO/.config/hypr/monitors_user.lua
/home/USUARIO/.config/fish/user.fish
/home/USUARIO/.ssh
```

`~/.config/restic/excluir.txt`:
```
node_modules
.venv
__pycache__
target
dist
.next
.cache
```

## 3. Script `~/bin/respaldo-restic.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="/run/media/USUARIO/DISCO/restic"
MONTAJE="/run/media/USUARIO/DISCO"
export RESTIC_PASSWORD_FILE="$HOME/.config/restic/password"

if ! mountpoint -q "$MONTAJE"; then
  echo "ERROR: el disco de respaldo no está montado en $MONTAJE" >&2
  exit 1
fi

restic -r "$REPO" backup \
  --files-from "$HOME/.config/restic/rutas.txt" \
  --exclude-file "$HOME/.config/restic/excluir.txt" \
  --exclude-caches \
  --tag automatico

restic -r "$REPO" forget --prune \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6

# Revisión ligera diaria; la de datos, los domingos
if [ "$(date +%u)" = "7" ]; then
  restic -r "$REPO" check --read-data-subset=5%
else
  restic -r "$REPO" check
fi
```

`chmod +x ~/bin/respaldo-restic.sh` y córrelo a mano una vez (en fish: `bash ~/bin/respaldo-restic.sh`).

## 4. Unidades de usuario

`~/.config/systemd/user/respaldo-restic.service`
```ini
[Unit]
Description=Respaldo con restic

[Service]
Type=oneshot
ExecStart=%h/bin/respaldo-restic.sh
Nice=10
IOSchedulingClass=idle
```

`~/.config/systemd/user/respaldo-restic.timer`
```ini
[Unit]
Description=Respaldo diario con restic

[Timer]
OnCalendar=*-*-* 14:00:00
Persistent=true
RandomizedDelaySec=15min

[Install]
WantedBy=timers.target
```

Hora: elige una en la que la PC suele estar prendida (con `Persistent=true` igual corre al prender si se la saltó).

```bash
systemctl --user daemon-reload
systemctl --user enable --now respaldo-restic.timer
systemctl --user start respaldo-restic.service     # prueba ahora
journalctl --user -u respaldo-restic -n 50 --no-pager
systemctl --user list-timers | grep respaldo
```

Si debe correr sin sesión abierta: `loginctl enable-linger`.

## 5. Comprobar

1. `restic -r REPO --password-file ~/.config/restic/password snapshots` muestra el snapshot con la fecha de hoy.
2. Restauración de prueba (ver SKILL.md, sección 6).
3. Desconecta el disco y corre el servicio: debe fallar con "no está montado", no respaldar al SSD interno.
