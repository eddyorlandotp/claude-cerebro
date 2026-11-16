---
name: respaldos
description: Respaldos reales en Linux - regla 3-2-1, snapshots btrfs/snapper (sistema) vs restic o borg (datos), qué respaldar (proyectos, Obsidian, ~/.claude, mundos, llaves cifradas), automatizar con timer y probar la restauración. Keywords backup, respaldo, restic, snapper, restore, disco externo.
---

# Respaldos que sí sirven

Un respaldo que nunca se restauró no está comprobado. Tu trabajo aquí: que el usuario tenga copias automáticas, cifradas, fuera de la PC, y que **haya visto una restauración funcionar**.

## 1. Snapshots NO son respaldos

| | Snapshots btrfs (snapper) | Respaldo real (restic/borg) |
|---|---|---|
| Para qué | deshacer una actualización o un cambio de sistema que rompió algo | recuperar archivos si muere el disco, te roban la PC, ransomware, borrado |
| Dónde viven | **en el mismo disco** | otro disco y fuera de casa |
| Qué cubren en CachyOS/Ryoku | solo `/` (config `root` de snapper). `/home` es otro subvolumen: **tus proyectos, ~/.config y ~/.claude no están en esos snapshots** | lo que tú elijas |

- CachyOS usa btrfs por defecto y trae `snap-pac` (snapshot antes/después de cada `pacman`). Ryoku además agrega los snapshots al menú de Limine.
- Snapshot manual antes de algo riesgoso: `sudo snapper create --description "antes de X"`. Lista: `sudo snapper list`.
- Limpieza: la config que trae CachyOS guarda muchos snapshots (`NUMBER_LIMIT="50"`); la wiki de CachyOS sugiere ~10. Si el disco se llena, revisa `sudo snapper list` antes de borrar nada a mano. Ryoku ya configura 10.
- Restaurar el sistema en Ryoku: Limine → Snapshots → `sudo limine-snapper-restore` (ver skill `cachyos-hyprland-fish`). No `snapper rollback`.

## 2. Regla 3-2-1 aplicada a casa

- **3 copias**: los originales + 2 respaldos.
- **2 medios**: p. ej. SSD externo USB + nube (o la mini-PC del home lab).
- **1 fuera de casa**: nube cifrada (Backblaze B2, S3 compatible, otro servidor por SFTP) o un disco que viva en otra casa. Un incendio o robo se lleva la PC y el disco externo juntos.

No recomiendes un proveedor con precios de memoria: revisa su página de precios con WebFetch antes de dar números.

## 3. Herramienta: restic (preferida) o borg

- **restic**: un binario, cifra todo siempre, deduplica, guarda en disco local, SFTP, S3/B2 y más (vía rclone). En Arch: `sudo pacman -Syu restic`.
- **borg**: igual de bueno, más eficiente en algunos casos, pero para destinos remotos necesita borg del otro lado (o un servicio que lo soporte). Úsalo si el usuario ya lo tiene.
- No uses `cp -r`/`rsync` sin versiones como "respaldo": si se corrompe o borra algo, la copia se sincroniza con el error.

**Contraseña del repositorio**: si se pierde, los datos se pierden para siempre. Guárdala en su gestor de contraseñas **y** en papel. Para automatizar, archivo con `chmod 600` (`~/.config/restic/password`) y `--password-file`. Nunca en el script, nunca en git, nunca la imprimas en la conversación.

## 4. Qué respaldar (y qué no)

Pregunta al usuario y confirma rutas con `ls` antes de escribir la lista. Típico:

| Incluir | Notas |
|---|---|
| Carpeta de proyectos (`~/proyectos`, `~/dev`, etc.) | git con remote no basta: `.env`, archivos sin commit y ramas locales no están en GitHub |
| Bóveda de Obsidian | toda la carpeta, incluido `.obsidian/` |
| `~/.claude/` | settings, CLAUDE.md, skills, memoria de proyectos. Incluye `.credentials.json` (token de login): solo en repo **cifrado** |
| Overrides de escritorio | `~/.config/hypr/user.lua`, `monitors_user.lua`, `~/.config/fish/user.fish`, `~/.config/ryoku/` |
| Mundos y config de servidores | ver skill `minecraft-bedrock-servidor` (detener o `save hold` antes) |
| Documentos, fotos, videos de trabajo | |
| `~/.ssh/` | solo en repo cifrado |

| Excluir | Por qué |
|---|---|
| `node_modules`, `.venv`, `target/`, `dist/`, `.next/`, `__pycache__` | se regeneran |
| `~/.cache`, `~/.local/share/Steam`, `~/.local/share/Trash` | enormes y regenerables |
| imágenes y volúmenes de Docker enteros | respalda los datos montados, no el motor |

### Llaves y semillas (dinero real)

- **Nunca** pidas, abras, imprimas ni copies a la conversación llaves privadas o seed phrases. Si un archivo de llave aparece en una ruta a respaldar, no lo leas: solo inclúyelo en el repo cifrado.
- La seed phrase de una billetera va **fuera de la computadora** (papel o placa metálica, en lugar seguro). No en texto plano, no en Obsidian, no en la nube sin cifrar.
- Archivos de llave de bots (keypairs) solo dentro de respaldos cifrados; usa billeteras dedicadas con poco saldo.

## 5. Automatizar

Plantilla completa (script + `.service` + `.timer` de usuario) en `references/restic-timer.md`. Puntos que debe cumplir:

- Timer de systemd con `Persistent=true` (corre al prender si la PC estaba apagada a la hora). Ver skill `servicios-24-7`.
- Si el destino es un disco USB, el script **verifica que esté montado** (`mountpoint -q`) y falla con error claro; nunca respalda "al vacío" en la carpeta de montaje.
- Retención: `restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6` (ajústalo con el usuario).
- Integridad: `restic check` semanal; de vez en cuando `restic check --read-data-subset=5%`.
- Que el fallo se note: revisa `systemctl --user list-timers` y `journalctl --user -u respaldo-restic`; si el usuario quiere, agrega notificación con `OnFailure=`.
- Servicio de usuario + `loginctl enable-linger` si debe correr sin sesión abierta.

## 6. Probar la restauración (obligatorio antes de decir "listo")

```bash
restic -r REPO --password-file ~/.config/restic/password snapshots
restic -r REPO --password-file ~/.config/restic/password restore latest --target /tmp/prueba-restore --include /home/USUARIO/proyectos
diff -rq ~/proyectos /tmp/prueba-restore/home/USUARIO/proyectos | head
```

Muéstrale al usuario un archivo restaurado abierto (una nota de Obsidian, un mundo que carga). Luego borra `/tmp/prueba-restore`. Recomiéndale repetir la prueba cada pocos meses y después de cambiar la configuración.

Para recuperar un solo archivo sin restaurar todo: `restic mount ~/mnt-restic` (necesita FUSE) y copiar desde ahí.

## 7. Errores típicos

- Llamar "respaldo" a un snapshot de snapper o a una copia en el mismo disco.
- Respaldar un mundo o base de datos mientras escribe.
- Guardar la contraseña de restic solo en la misma PC que se respalda.
- Script que respalda a `/run/media/...` cuando el disco no está conectado y llena el SSD interno.
- Excluir `.env` "por seguridad" y luego no poder levantar el proyecto: inclúyelo, el repo está cifrado.
- Declarar éxito sin restaurar nada.

## Verifica antes de confiar

Antes de usar un backend remoto (B2, S3, rclone) o una opción que no esté aquí, revisa la doc de restic (o Context7) para la sintaxis exacta del repositorio y las variables de credenciales.

## Fuentes (verificado nov 2026)

- https://wiki.cachyos.org/configuration/btrfs_snapshots/ (snap-pac, config root solo `/`, subvolúmenes, NUMBER_LIMIT)
- https://wiki.cachyos.org/installation/filesystem/ (btrfs por defecto)
- https://github.com/ryoku-dev/ryoku/blob/main/docs/updates.md y docs/cli.md (10 snapshots, limine-snapper-restore)
- https://wiki.archlinux.org/title/Restic · https://wiki.archlinux.org/title/Snapper
- https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html · https://restic.readthedocs.io/en/stable/040_backup.html · https://restic.readthedocs.io/en/stable/050_restore.html
- https://code.claude.com/docs/en/authentication (credenciales en `~/.claude/.credentials.json` en Linux)
