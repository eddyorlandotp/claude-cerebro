---
name: abrir-panel
description: Abre Telaraña, el panel local que muestra a Claude Code trabajando, a pantalla completa en el monitor que elija el usuario.
disable-model-invocation: true
argument-hint: "[monitor] [demo]"
---

# Abrir el panel (Telaraña)

El panel es una página local (`http://127.0.0.1:4317`) servida por un programa chico de Node que solo lee los registros de la sesión. No usa IA ni internet y no gasta tokens. Lo mecánico lo hace un script; tú solo decides el monitor y reportas.

Argumentos que escribió el usuario: `$ARGUMENTS` (pueden venir vacíos; si incluyen el nombre de un monitor o la palabra `demo`, úsalos y no preguntes).

## Pasos

1. Lista los monitores:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/servidor/abrir.sh" monitores
   ```
   Cada línea es `NOMBRE  ANCHOxALTO  X,Y  descripción`. Si no sale nada, no se pudo detectar (no es error): sigue sin `--monitor`.
2. Si hay **dos o más** monitores y el usuario no dijo cuál, pregúntale con AskUserQuestion en cuál lo quiere (muestra nombre y resolución; sugiere el que no esté marcado `(activo)`, porque en el activo está su terminal). Con uno solo, no preguntes.
3. Abre el panel:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/servidor/abrir.sh" abrir --monitor NOMBRE
   ```
   - Sin monitor elegido, omite `--monitor`.
   - Si pidió la demostración, agrega `--demo` (reproduce una sesión de ejemplo en bucle).
   - Si lo quiere en ventana normal y no a pantalla completa, agrega `--ventana`.
4. Dile al usuario, en dos líneas, lo que imprimió el script: la dirección, en qué monitor quedó y las teclas (`F` pantalla completa, `1`–`5` minimizar zonas, `0` restaurar). Recuérdale que se cierra con `/cerebro-panel:cerrar-panel`.

## Qué hace el script

- Arranca el servidor en segundo plano solo si no está corriendo (guarda el pid en `~/.local/state/cerebro-panel/servidor.pid` y comprueba `/salud`).
- Busca un navegador en este orden: chromium, brave, google-chrome, firefox; si no hay ninguno en el PATH, Chromium, Brave o Chrome de flatpak. Con los de Chromium abre en modo aplicación (`--app=http://127.0.0.1:4317`) con un perfil propio, para poder cerrar esa ventana sin tocar el navegador del usuario; con Firefox usa `--kiosk`.
- **Hyprland** (comprobado en Hyprland 0.57.1): busca la ventana con `hyprctl -j clients`, la mueve con `hyprctl dispatch 'hl.dsp.window.move({ window = "address:0x…", monitor = "NOMBRE" })'` y la pone a pantalla completa con `hyprctl dispatch 'hl.dsp.window.fullscreen({ window = "address:0x…", action = "set", mode = "fullscreen" })'`. Esa es la sintaxis Lua de Hyprland 0.55 en adelante; si no responde `ok`, el script reintenta con la clásica (`focuswindow address:…`, `movewindow mon:NOMBRE`, `fullscreen 0 set`).
- En X11 pasa `--window-position` con la esquina del monitor elegido y `--start-fullscreen`. En otros escritorios Wayland (GNOME, KDE) la ventana abre donde decida el escritorio.

## Si algo sale mal

- **"No pude mover la ventana" o quedó en el monitor equivocado (Hyprland):** no adivines otra sintaxis. Corre `hyprctl version`, lee la página de Dispatchers de <https://wiki.hypr.land> para esa versión y prueba el comando a mano con la dirección de la ventana que imprimió el script. Mientras tanto dile al usuario que la mueva con su atajo y pulse `F`.
- **"No encontré chromium, brave…":** dale la dirección para que la abra en su navegador y pulse `F`.
- **"El panel no respondió":** muestra las últimas líneas de `~/.local/state/cerebro-panel/servidor.log`. Si el puerto 4317 está ocupado por otra cosa, repite con `--puerto 4318`.
- **El panel abre pero dice "Sin sesión activa":** es normal si no hay ninguna sesión de Claude Code con actividad; aparece sola al siguiente mensaje.

No edites la configuración de Hyprland ni instales paquetes para esto sin que el usuario lo pida.
