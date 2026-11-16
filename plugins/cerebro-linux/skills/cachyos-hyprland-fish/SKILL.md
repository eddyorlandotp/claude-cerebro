---
name: cachyos-hyprland-fish
description: Reglas para operar en la PC del usuario con Ryoku (edición CachyOS, Arch), Hyprland en Lua, fish y NVIDIA. Úsala antes de instalar paquetes, actualizar, tocar drivers, Hyprland, monitores, config.fish o dar comandos para la terminal. Keywords pacman, paru, yay, AUR, hyprctl, fish, update.
---

# CachyOS + Ryoku + Hyprland + fish

El usuario usa **Ryoku** (escritorio sobre CachyOS, que es Arch) con Hyprland, fish y una NVIDIA RTX 5070 con dos monitores. **No es Ubuntu**: nada de `apt`, `snap`, `add-apt-repository`, `ufw` "porque Ubuntu lo trae", ni rutas de Debian.

## 0. Antes de tocar nada: diagnostica

Corre el script incluido (es bash, solo lee):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/diagnostico.sh"
```

Te dice: distro, shell, helper de AUR, versión de Hyprland y formato de config, filesystem, snapper, bootloader, firewall y driver NVIDIA. **No asumas ninguno de esos datos; léelos.**

## 1. Hay DOS shells: el tuyo y el del usuario

- **Tu herramienta Bash corre en bash o zsh, nunca en fish** (Claude Code no soporta fish para su Bash tool; `CLAUDE_CODE_SHELL` solo acepta bash o zsh). Lo que tú ejecutas va en sintaxis bash.
- **Lo que le pidas al usuario que pegue en su terminal corre en fish.** Escríbelo en sintaxis fish, o envuélvelo: `bash -c '...'`, o guárdalo en un `.sh` con `#!/usr/bin/env bash` y que lo corra con `bash script.sh`.
- Los alias y funciones de `config.fish` **no existen** en tu Bash tool. Las variables que el usuario exportó en fish antes de abrir `claude` sí las heredas.

Diferencias reales de fish (versión 4.x, nov 2026):

| bash | fish | Nota |
|---|---|---|
| `export VAR=x` | `set -gx VAR x` | `export VAR=x` **sí funciona** (función de compatibilidad), pero escribe `set -gx` |
| `VAR=x comando` | igual | soportado desde fish 3.1 |
| `$(cmd)` / `` `cmd` `` | `(cmd)` o `$(cmd)` | backticks **no**; `$(...)` desde 3.4 |
| `a && b`, `a \|\| b` | igual | desde 3.0 (también `and` / `or`) |
| `{ a; b; }` | `begin; a; b; end` | llaves desde 4.1; `begin/end` funciona en todas |
| `cat <<EOF` (heredoc) | **no existe** | usa `printf '%s\n' ...` o un archivo |
| `$?` | `$status` | |
| `$((1+2))` | `math 1 + 2` | |
| `${VAR:-def}`, `${x%.txt}` | **no existen** | `set -q VAR; or set VAR def`, `string replace` |
| `if ...; then ... fi` | `if ...; ...; end` | lo mismo con `for`/`while` (`end`, no `done`) |
| `source ~/.bashrc`, `source .env` | **no** | un `.env` de bash no se puede `source` en fish |
| `<(cmd)` | `(cmd \| psub)` | |
| `!!` | no existe | |

Regla práctica: si el comando para el usuario tiene más de una línea o cualquier cosa de la columna "no existe", **dáselo como script bash**, no como pegado en fish.

## 2. Paquetes

- Repos oficiales: `sudo pacman -S paquete`. Buscar: `pacman -Ss texto`. ¿Qué paquete trae un archivo?: `pacman -F nombre`.
- **Nunca** `pacman -Sy paquete` ni `pacman -Sy` solo: es *partial upgrade* y Arch no lo soporta. Para instalar algo nuevo: `sudo pacman -Syu paquete`.
- AUR: desde jun 2026 el instalador de CachyOS **ya no trae paru**; Ryoku instala `yay-bin`. Detecta cuál hay con `command -v paru yay`. No instales otro helper "por costumbre". El helper se corre **sin sudo**.
- Antes de instalar del AUR, di al usuario qué paquete es, que no es oficial, y revisa el PKGBUILD si es poco conocido. Prefiere repos oficiales o Flatpak si existen.
- Nombres de paquetes son los de Arch (`base-devel`, `python-pip` casi nunca: usa `pipx` o venv; pip global está bloqueado por PEP 668).
- No uses Discover/GNOME Software para paquetes del sistema (la wiki de CachyOS lo desaconseja).

## 3. Actualizar sin romper (checklist)

1. Lee noticias: <https://archlinux.org/news/>, anuncios del foro de CachyOS y releases de Ryoku. Si hay "intervención manual", hazla **antes**.
2. Confirma que hay snapshots: `sudo snapper list | tail -5`. CachyOS trae `snap-pac`, que crea snapshot pre/post en cada transacción de pacman.
3. Sistema base: `sudo pacman -Syu`. Lee la salida completa: errores de DKMS/NVIDIA, `.pacnew`, "conflicting files".
4. Escritorio Ryoku: `ryoku update` (re-aplica la config de Ryoku y corre `ryoku doctor`; respeta los overrides del usuario).
5. AUR después: `yay` (o `paru`).
6. `.pacnew`: `sudo pacdiff` (paquete `pacman-contrib`). No los ignores en archivos de sistema.
7. Si se actualizó kernel o NVIDIA, **reinicia** antes de diagnosticar cualquier cosa rara.
8. Si `pacman -Syu` falla a medias, resuelve el error y termina el `-Syu` antes de instalar nada más.

**Rollback en Ryoku**: reinicia, en el menú de Limine elige *Ryoku Linux → Snapshots → <id>*, entra y corre `sudo limine-snapper-restore`, luego reinicia. **No uses `snapper rollback`**: Ryoku monta `@` fijo con `subvol=` y `snapper rollback` no lo restaura. `ryoku rollback` lista y guía. Para el escritorio solo: `ryoku rollback --to <versión>`; último recurso `ryoku recovery`.

## 4. NVIDIA (RTX 5070 = Blackwell)

- Blackwell **solo** funciona con los módulos abiertos: `nvidia-open` / `linux-cachyos-nvidia-open` / `nvidia-open-dkms`. **Nunca** instales `nvidia` (cerrado) ni `nvidia-580xx-dkms` para esta tarjeta.
- En CachyOS los drivers los maneja `chwd`. Para reparar: `sudo chwd -a` (autoconfigura). No mezcles paquetes a mano encima de chwd.
- Cada kernel instalado necesita su módulo NVIDIA. Si mkinitcpio dice `module not found: 'nvidia'`, falta el módulo para algún kernel; revisa `pacman -Qs nvidia` contra `pacman -Qs linux-cachyos`.
- Wayland necesita `nvidia_drm.modeset=1` (viene activo por defecto en drivers actuales). Verifica: `cat /sys/module/nvidia_drm/parameters/modeset` → `Y`.
- Pantalla negra tras update: arranca el snapshot anterior o el kernel de respaldo desde Limine; luego revisa `journalctl -b -1 -p err`.

## 5. Hyprland: ahora es Lua

- A nov 2026: Hyprland usa `~/.config/hypr/hyprland.lua` (Lua desde 0.55; **0.57, oct 2026, eliminó `hyprland.conf`**). Verifica con `hyprctl version` y `ls ~/.config/hypr`.
- **No copies snippets viejos** tipo `monitor=DP-1,2560x1440@165,0x0,1` o `bind = SUPER, Q, ...`: eso es hyprlang y ya no carga. Equivalente Lua: `hl.monitor({ output = "DP-1", mode = "2560x1440@165", position = "0x0", scale = 1 })`.
- Para la API exacta no adivines: lee los stubs en `/usr/share/hypr/stubs/`, los módulos que Ryoku ya trae en `~/.config/hypr/modules/` como ejemplo, y <https://wiki.hypr.land> (elige la versión que muestra `hyprctl version`).
- Recarga: se recarga sola al guardar; manual `hyprctl reload` (o `ryoku reload`, que también reinicia el shell de Ryoku). Errores: `hyprctl configerrors`. Monitores: `hyprctl monitors all`. Probar Lua en vivo: `hyprctl eval '...'`.

### Dónde editar en Ryoku (crítico)

`ryoku update` **re-escribe todos los archivos que Ryoku trae**. Si editas uno de esos, Ryoku lo convierte en "fork" y deja de recibir arreglos. Edita solo:

| Qué | Archivo del usuario (nunca se pisa) |
|---|---|
| Keybinds, reglas de ventana, cualquier ajuste de Hyprland | `~/.config/hypr/user.lua` (se carga al final, gana) |
| Monitores fijados a mano (vertical, posición, modo) | `~/.config/hypr/monitors_user.lua` (ver `monitors_user.lua.example`) |
| Ajustes desde la GUI | Ryoku Hub (`Super + ,`) escribe `settings.lua` |
| fish (abbr, PATH, variables) | `~/.config/fish/user.fish` |
| Kitty | `~/.config/kitty/user.conf` |

No edites `hyprland.lua`, `modules/*.lua`, `monitors.lua` ni `gpu.lua` (los generan Ryoku o sus herramientas). `ryoku reset <ruta>` regresa un archivo al default.

## 6. fish: configuración

- En Ryoku, `~/.config/fish/config.fish` es de Ryoku: tus cambios van en `~/.config/fish/user.fish` (Ryoku lo carga al final). En fish sin Ryoku: `config.fish` o `~/.config/fish/conf.d/*.fish`.
- PATH: `fish_add_path ~/.local/bin` (idempotente). Variables persistentes: `set -gx VAR valor` en `user.fish`. Evita `set -U` (universales) para cosas que quieras ver en un archivo.
- Atajos: `abbr -a gs 'git status'` (se expande al escribir; mejor que alias). Funciones: `~/.config/fish/functions/nombre.fish`, o `funcsave nombre`.
- Recargar: abre otra terminal o `exec fish`.

## 7. Errores típicos de un asistente aquí

- Dar `sudo apt install`, rutas `/etc/apt`, o paquetes con nombre Debian (`build-essential`, `python3-venv`).
- Pegar heredocs o `export A=b && ...` complejo directo en fish. Usa script bash.
- Editar `~/.config/hypr/hyprland.lua` o `hyprland.conf` en vez de `user.lua`.
- Sugerir `snapper rollback` o `grub-mkconfig` (Ryoku usa Limine).
- Instalar `nvidia` cerrado o seguir guías de NVIDIA para Ubuntu.
- `sudo yay`/`sudo paru`, o `pacman -Sy`.
- Asumir firewall: CachyOS habilita `ufw` por defecto, pero verifica (`sudo ufw status`).
- Decir "listo" sin comprobar: después de cada cambio corre el comando de verificación (`hyprctl configerrors`, `systemctl status`, `nvidia-smi`) y muéstrale el resultado.

## 8. Cómo hablarle al usuario

No programa. Antes de algo que toque el sistema, explica en 1–2 frases qué vas a hacer y si es reversible (hay snapshot). Al terminar, dale **un** comando para comprobarlo él mismo y qué debería ver.

## Verifica antes de confiar

Las herramientas cambian rápido (Hyprland cambió de formato en 2026, CachyOS quitó paru). Antes de escribir config o comandos para algo que no esté en esta skill, consulta Context7 (si está instalado) o WebFetch a la doc oficial, y compara con la versión instalada.

## Fuentes (verificado nov 2026)

- https://github.com/ryoku-dev/ryoku (README, docs/cli.md, docs/updates.md, docs/structure.md, docs/kernels.md)
- https://wiki.cachyos.org/configuration/post_install_setup/ · https://wiki.cachyos.org/cachyos_basic/faq/ · https://wiki.cachyos.org/features/chwd/chwd/ · https://wiki.cachyos.org/configuration/btrfs_snapshots/ · https://wiki.cachyos.org/installation/filesystem/
- https://discuss.cachyos.org/t/announcement-cachyos-june-2026-release/32124 (paru removido del instalador)
- https://wiki.archlinux.org/title/System_maintenance · https://wiki.archlinux.org/title/NVIDIA · https://wiki.archlinux.org/title/Pacman/Pacnew_and_Pacsave
- https://wiki.hypr.land/configuring/core/ · https://wiki.hypr.land/configuring/core/monitors/ · https://wiki.hypr.land/configuring/core/advanced-configuration/using-hyprctl/
- https://www.warp2search.net/story/hyprland-0570-released-legacy-conf-dropped-window-wobble-arrives/ (0.57 elimina hyprland.conf)
- https://fishshell.com/docs/current/fish_for_bash_users.html · https://fishshell.com/docs/current/relnotes.html · https://fishshell.com/docs/current/cmds/export.html
- https://code.claude.com/docs/en/env-vars (CLAUDE_CODE_SHELL: solo bash/zsh)
