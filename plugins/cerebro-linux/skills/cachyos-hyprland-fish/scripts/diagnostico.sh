#!/usr/bin/env bash
# Diagnóstico de solo lectura del sistema (Ryoku / CachyOS / Arch + Hyprland + fish).
# No modifica nada. Comandos que piden sudo se omiten si no hay sudo sin contraseña.
set -u

sec() { printf '\n== %s ==\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }
run() { "$@" 2>/dev/null || echo "(no disponible)"; }

sec "Distro"
if [ -r /etc/os-release ]; then
  grep -E '^(NAME|ID|ID_LIKE|VERSION_ID|BUILD_ID)=' /etc/os-release
else
  echo "(sin /etc/os-release)"
fi
have ryoku && { echo "ryoku: sí"; run ryoku status | head -n 5; } || echo "ryoku: no"
echo "kernel: $(uname -r)"

sec "Shell"
echo "SHELL del usuario: ${SHELL:-desconocido}"
have fish && echo "fish: $(fish --version 2>/dev/null)" || echo "fish: no instalado"
for f in "$HOME/.config/fish/config.fish" "$HOME/.config/fish/user.fish"; do
  [ -e "$f" ] && echo "existe: $f"
done

sec "Paquetes"
have pacman && echo "pacman: $(pacman --version 2>/dev/null | grep -o 'Pacman v[0-9.]*' | head -n1)"
for h in paru yay; do have "$h" && echo "AUR helper: $h"; done
have paru || have yay || echo "AUR helper: ninguno"
have flatpak && echo "flatpak: sí"
have apt && echo "AVISO: existe apt; no es lo normal en Arch"
if have checkupdates; then
  n=$(checkupdates 2>/dev/null | wc -l)
  echo "actualizaciones pendientes (repos oficiales): $n"
fi

sec "Hyprland"
if have hyprctl; then
  run hyprctl version | head -n 3
  for f in hyprland.lua hyprland.conf user.lua monitors_user.lua; do
    [ -e "$HOME/.config/hypr/$f" ] && echo "existe: ~/.config/hypr/$f"
  done
  if [ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
    echo "-- errores de config:"; run hyprctl configerrors
    echo "-- monitores:"; hyprctl monitors 2>/dev/null | grep -E '^Monitor|^\s+[0-9]+x[0-9]+@|transform:|scale:' || true
  else
    echo "(no hay sesión de Hyprland en este shell; hyprctl no puede consultar)"
  fi
else
  echo "hyprctl: no encontrado"
fi

sec "Disco y snapshots"
echo "filesystem de /: $(findmnt -no FSTYPE / 2>/dev/null)"
echo "opciones de /: $(findmnt -no OPTIONS / 2>/dev/null)"
findmnt -no FSTYPE /home >/dev/null 2>&1 && echo "/home: $(findmnt -no SOURCE,FSTYPE /home 2>/dev/null)"
have snapper && echo "snapper: sí" || echo "snapper: no"
pacman -Q snap-pac limine-snapper-sync btrfs-assistant 2>/dev/null || true
if have snapper && sudo -n true 2>/dev/null; then
  sudo -n snapper list-configs 2>/dev/null
  sudo -n snapper list 2>/dev/null | tail -n 3
else
  echo "(snapper list requiere sudo; córrelo a mano: sudo snapper list | tail -5)"
fi
df -h / /home 2>/dev/null | awk 'NR==1 || !seen[$0]++'

sec "Bootloader"
[ -d /boot/EFI/limine ] || [ -d /boot/efi/EFI/limine ] || ls /boot/limine* >/dev/null 2>&1 && echo "Limine detectado"
have bootctl && bootctl is-installed >/dev/null 2>&1 && echo "systemd-boot instalado"
[ -d /boot/grub ] && echo "GRUB detectado"

sec "Firewall"
for s in ufw firewalld; do
  printf '%s: %s\n' "$s" "$(systemctl is-active "$s" 2>/dev/null || true)"
done

sec "GPU"
have lspci && lspci -nn 2>/dev/null | grep -Ei 'vga|3d|display' || true
pacman -Q 2>/dev/null | grep -E '^(nvidia|linux-cachyos[^ ]*-nvidia|lib32-nvidia)' || echo "(sin paquetes nvidia)"
[ -r /sys/module/nvidia_drm/parameters/modeset ] && echo "nvidia_drm.modeset=$(cat /sys/module/nvidia_drm/parameters/modeset)"
have nvidia-smi && nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>/dev/null

sec "Servicios con fallas"
systemctl --failed --no-legend 2>/dev/null || true
systemctl --user --failed --no-legend 2>/dev/null || true

echo
echo "Fin del diagnóstico (no se modificó nada)."
