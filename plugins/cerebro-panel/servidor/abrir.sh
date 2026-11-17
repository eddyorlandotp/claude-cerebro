#!/usr/bin/env bash
# Telaraña (cerebro-panel): arranca/detiene el servidor local y abre el panel en el navegador.
# Lo llaman las skills abrir-panel y cerrar-panel. Todo es local (127.0.0.1); no usa internet.
#
#   abrir.sh estado
#   abrir.sh iniciar [--demo] [--puerto N]
#   abrir.sh monitores
#   abrir.sh abrir [--monitor NOMBRE] [--demo] [--puerto N] [--ventana]
#   abrir.sh cerrar
set -u

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATOS="${XDG_STATE_HOME:-$HOME/.local/state}/cerebro-panel"
ARCHIVO_PID="$DATOS/servidor.pid"
ARCHIVO_NAV="$DATOS/navegador.pid"
PERFIL="$DATOS/perfil-navegador"
PUERTO="${TELARANA_PUERTO:-4317}"
DEMO=""
MONITOR=""
VENTANA=""

decir() { printf '%s\n' "$*"; }
fallar() { printf 'abrir.sh: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fallar "hace falta Node 20 o más nuevo en el PATH"
mkdir -p "$DATOS" || fallar "no pude crear $DATOS"

# Imprime el pid del panel si /salud responde en ese puerto; si no, nada.
salud() {
  node -e '
    const c = new AbortController(); setTimeout(() => c.abort(), 1500);
    fetch("http://127.0.0.1:" + process.argv[1] + "/salud", { signal: c.signal })
      .then((r) => r.json()).then((j) => { if (j && j.ok) console.log(j.pid ?? 0); })
      .catch(() => {});
  ' "$1" 2>/dev/null
}

# Si hay un panel corriendo (según el archivo de pid), deja su puerto en PUERTO y devuelve 0.
panel_vivo() {
  [ -f "$ARCHIVO_PID" ] || return 1
  local pid puerto
  pid="$(sed -n 1p "$ARCHIVO_PID" 2>/dev/null)"
  puerto="$(sed -n 2p "$ARCHIVO_PID" 2>/dev/null)"
  case "$pid$puerto" in ''|*[!0-9]*) return 1 ;; esac
  kill -0 "$pid" 2>/dev/null || return 1
  [ "$(salud "$puerto")" = "$pid" ] || return 1
  PUERTO="$puerto"
  return 0
}

iniciar() {
  if panel_vivo; then
    decir "El panel ya estaba corriendo en http://127.0.0.1:$PUERTO"
    return 0
  fi
  if [ -n "$(salud "$PUERTO")" ]; then
    decir "Ya hay un panel respondiendo en http://127.0.0.1:$PUERTO (lo arrancó alguien más); uso ese."
    return 0
  fi
  local lanzar=(node "$AQUI/servidor.mjs" --puerto "$PUERTO")
  [ -n "$DEMO" ] && lanzar+=(--demo)
  # setsid lo separa de la terminal de Claude para que siga vivo cuando el comando termine.
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup "${lanzar[@]}" >>"$DATOS/servidor.log" 2>&1 </dev/null &
  else
    nohup "${lanzar[@]}" >>"$DATOS/servidor.log" 2>&1 </dev/null &
  fi
  local i
  for i in $(seq 1 25); do
    sleep 0.2
    if [ -n "$(salud "$PUERTO")" ]; then
      decir "Panel arrancado en http://127.0.0.1:$PUERTO${DEMO:+ (demo)}"
      return 0
    fi
  done
  decir "El panel no respondió. Últimas líneas de $DATOS/servidor.log:" >&2
  tail -n 5 "$DATOS/servidor.log" >&2 2>/dev/null
  return 1
}

en_hyprland() { [ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ] && command -v hyprctl >/dev/null 2>&1; }

# Una línea por monitor: NOMBRE <tab> ANCHOxALTO <tab> X,Y <tab> descripción
monitores() {
  if en_hyprland; then
    # VERIFICAR EN LA MÁQUINA: `hyprctl -j monitors` (bandera antes del comando, como dice la wiki).
    hyprctl -j monitors 2>/dev/null | node -e '
      let t = ""; process.stdin.on("data", (d) => (t += d)).on("end", () => {
        try {
          for (const m of JSON.parse(t)) console.log([m.name, m.width + "x" + m.height, m.x + "," + m.y, (m.description || "") + (m.focused ? " (activo)" : "")].join("\t"));
        } catch {}
      });'
    return 0
  fi
  if [ -n "${DISPLAY:-}" ] && command -v xrandr >/dev/null 2>&1; then
    # Formato: " 0: +*DP-1 2560/597x1440/336+0+0  DP-1"
    xrandr --listmonitors 2>/dev/null | sed -n 's|^ *[0-9]*: [+*]*\([^ ]*\) \([0-9]*\)/[0-9]*x\([0-9]*\)/[0-9]*+\([0-9]*\)+\([0-9]*\).*|\1\t\2x\3\t\4,\5\t|p'
    return 0
  fi
  return 0
}

navegador() {
  local n
  if [ -n "${TELARANA_NAVEGADOR:-}" ]; then
    command -v "$TELARANA_NAVEGADOR" 2>/dev/null && return 0
  fi
  for n in chromium chromium-browser brave brave-browser google-chrome-stable google-chrome thorium-browser microsoft-edge-stable firefox; do
    if command -v "$n" >/dev/null 2>&1; then
      command -v "$n"
      return 0
    fi
  done
  # Instalados con flatpak (no dejan binario en el PATH). Se imprime "flatpak:ID".
  if command -v flatpak >/dev/null 2>&1; then
    local apps
    apps="$(flatpak list --app --columns=application 2>/dev/null)"
    for n in org.chromium.Chromium com.brave.Browser com.google.Chrome io.github.ungoogled_software.ungoogled_chromium; do
      if printf '%s\n' "$apps" | grep -qx "$n"; then
        printf 'flatpak:%s\n' "$n"
        return 0
      fi
    done
  fi
  return 1
}

# Hyprland: manda un dispatcher. Primero la sintaxis Lua (Hyprland 0.55+): hyprctl dispatch 'hl.dsp....'.
# Si no responde "ok", prueba la clásica (0.54 y anteriores), que actúa sobre la ventana enfocada:
# por eso antes se enfoca la ventana del panel con `focuswindow address:0x...`.
# VERIFICAR EN LA MÁQUINA: sintaxis tomada de wiki.hypr.land (Dispatchers, Selectors y Using hyprctl; nov 2026).
hypr() {
  local lua="$1" dir="$2" clasico="$3" r
  r="$(hyprctl dispatch "$lua" 2>&1)"
  [ "$r" = "ok" ] && return 0
  hyprctl dispatch focuswindow "address:$dir" >/dev/null 2>&1
  # shellcheck disable=SC2086
  r="$(hyprctl dispatch $clasico 2>&1)"
  [ "$r" = "ok" ]
}

# Direcciones de las ventanas que ya existen (separadas por espacio), para reconocer la nueva.
ventanas_hypr() {
  hyprctl -j clients 2>/dev/null | node -e '
    let t = ""; process.stdin.on("data", (d) => (t += d)).on("end", () => {
      try { console.log(JSON.parse(t).map((x) => x.address).join(" ")); } catch {}
    });'
}

# Busca en Hyprland la ventana del panel; imprime "direccion <tab> pantallaCompleta(0|1)".
# $1 = pid que lanzamos, $2 = direcciones que ya existían antes de abrir.
# Primero por pid. Con flatpak (o si el navegador se relanza) el pid no coincide: entonces se toma
# la ventana nueva cuya clase o título son los del panel (en Wayland Chromium ignora --class y usa
# "chrome-127.0.0.1__-Default").
ventana_hypr() {
  hyprctl -j clients 2>/dev/null | node -e '
    let t = ""; process.stdin.on("data", (d) => (t += d)).on("end", () => {
      try {
        const pid = Number(process.argv[1]);
        const antes = new Set((process.argv[2] || "").split(" ").filter(Boolean));
        const todas = JSON.parse(t);
        const esPanel = (x) => /127\.0\.0\.1|telarana/i.test(x.class || "") || /127\.0\.0\.1|telarana/i.test(x.initialClass || "") || /^Telara/.test(x.title || "");
        const c = todas.find((x) => x.pid === pid) || todas.find((x) => !antes.has(x.address) && esPanel(x));
        if (c) console.log(c.address + "\t" + (c.fullscreen && c.fullscreen !== 0 ? 1 : 0));
      } catch {}
    });' "$1" "${2:-}"
}

acomodar_hyprland() {
  local pid="$1" antes="${2:-}" dato="" dir llena i
  for i in $(seq 1 40); do
    dato="$(ventana_hypr "$pid" "$antes")"
    [ -n "$dato" ] && break
    sleep 0.25
  done
  if [ -z "$dato" ]; then
    decir "Abrí el navegador pero no encontré su ventana en Hyprland; muévela a mano y pulsa F para pantalla completa."
    return 0
  fi
  dir="${dato%%$'\t'*}"
  llena="${dato##*$'\t'}"
  printf '%s\n' "$dir" >>"$ARCHIVO_NAV"
  if [ -n "$MONITOR" ]; then
    hypr "hl.dsp.window.move({ window = \"address:$dir\", monitor = \"$MONITOR\" })" "$dir" "movewindow mon:$MONITOR" \
      || decir "No pude mover la ventana al monitor $MONITOR (revisa el nombre con: abrir.sh monitores)."
  fi
  if [ -z "$VENTANA" ] && [ "$llena" = "0" ]; then
    hypr "hl.dsp.window.fullscreen({ window = \"address:$dir\", action = \"set\", mode = \"fullscreen\" })" "$dir" "fullscreen 0 set" \
      || decir "No pude poner pantalla completa desde Hyprland; pulsa F dentro del panel."
  fi
  decir "Ventana $dir${MONITOR:+ en $MONITOR}."
}

abrir() {
  iniciar || return 1
  local url="http://127.0.0.1:$PUERTO" nav
  if ! nav="$(navegador)"; then
    decir "No encontré chromium, brave, google-chrome ni firefox (tampoco en flatpak). Abre a mano: $url"
    return 0
  fi
  # Posición del monitor elegido (sirve en X11; en Wayland la ignoran casi todos los compositores).
  local posicion=""
  if [ -n "$MONITOR" ]; then
    posicion="$(monitores | awk -F'\t' -v m="$MONITOR" '$1 == m { print $3 }')"
    [ -z "$posicion" ] && decir "Aviso: no veo un monitor llamado $MONITOR."
  fi
  local args=() lanzar=("$nav") perfil="$PERFIL" nombre
  nombre="$(basename "$nav")"
  case "$nav" in
    flatpak:*)
      # El navegador de flatpak solo puede escribir dentro de su propia carpeta de datos.
      nombre="${nav#flatpak:}"
      lanzar=(flatpak run "$nombre")
      perfil="$HOME/.var/app/$nombre/cerebro-panel"
      mkdir -p "$perfil"
      ;;
  esac
  case "$(basename "$nav")" in
    firefox*)
      mkdir -p "$PERFIL-firefox"
      args=(--no-remote --profile "$PERFIL-firefox" --new-window)
      [ -z "$VENTANA" ] && args+=(--kiosk)
      args+=("$url")
      ;;
    *)
      # Perfil propio: así el proceso es nuestro (se puede cerrar sin tocar el navegador del usuario).
      args=("--app=$url" "--user-data-dir=$perfil" --no-first-run --no-default-browser-check --class=telarana)
      [ -n "$posicion" ] && args+=("--window-position=$posicion")
      # En Hyprland la pantalla completa se pone después de mover la ventana al monitor.
      if [ -z "$VENTANA" ] && ! en_hyprland; then args+=(--start-fullscreen); fi
      ;;
  esac
  local antes=""
  en_hyprland && antes="$(ventanas_hypr)"
  # Opciones extra para el navegador (para depurar; p. ej. TELARANA_NAVEGADOR_ARGS="--remote-debugging-port=9333").
  if [ -n "${TELARANA_NAVEGADOR_ARGS:-}" ]; then
    # shellcheck disable=SC2206
    args+=(${TELARANA_NAVEGADOR_ARGS})
  fi
  if command -v setsid >/dev/null 2>&1; then
    setsid "${lanzar[@]}" "${args[@]}" >/dev/null 2>&1 </dev/null &
  else
    nohup "${lanzar[@]}" "${args[@]}" >/dev/null 2>&1 </dev/null &
  fi
  local pid=$!
  # Línea 1: pid lanzado. Línea 2: carpeta del perfil. Línea 3 (Hyprland): dirección de la ventana.
  printf '%s\n%s\n' "$pid" "$perfil" >"$ARCHIVO_NAV"
  decir "Abrí $url con $nombre."
  if en_hyprland; then acomodar_hyprland "$pid" "$antes"; fi
  decir "Teclas dentro del panel: F pantalla completa, 1-5 minimizar zonas, 0 restaurar."
}

cerrar() {
  # Navegador: solo si el proceso sigue siendo el que abrimos (usa nuestro perfil).
  if [ -f "$ARCHIVO_NAV" ]; then
    local np perfil cerrada=""
    np="$(sed -n 1p "$ARCHIVO_NAV" 2>/dev/null)"
    perfil="$(sed -n 2p "$ARCHIVO_NAV" 2>/dev/null)"
    case "$perfil" in */cerebro-panel|*/perfil-navegador*) ;; *) perfil="$PERFIL" ;; esac
    case "$np" in
      ''|*[!0-9]*) ;;
      *)
        if tr '\0' ' ' <"/proc/$np/cmdline" 2>/dev/null | grep -qF -- "$perfil"; then
          kill "$np" 2>/dev/null && cerrada=1
        fi
        ;;
    esac
    # Con flatpak el pid lanzado es el envoltorio: se cierran los procesos que usan nuestro perfil
    # (nunca el navegador normal del usuario, que usa otro perfil).
    if command -v pkill >/dev/null 2>&1 && pkill -f -- "--user-data-dir=$perfil" 2>/dev/null; then cerrada=1; fi
    [ -n "$cerrada" ] && decir "Cerré la ventana del panel."
    rm -f "$ARCHIVO_NAV"
  fi
  if panel_vivo; then
    local pid i
    pid="$(sed -n 1p "$ARCHIVO_PID")"
    kill "$pid" 2>/dev/null
    for i in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    rm -f "$ARCHIVO_PID"
    decir "Panel detenido."
  else
    rm -f "$ARCHIVO_PID"
    decir "El panel no estaba corriendo."
  fi
}

accion="${1:-estado}"
[ $# -gt 0 ] && shift
while [ $# -gt 0 ]; do
  case "$1" in
    --demo) DEMO=1 ;;
    --ventana) VENTANA=1 ;;
    --puerto) shift; PUERTO="${1:-}" ;;
    --monitor) shift; MONITOR="${1:-}" ;;
    *) fallar "opción desconocida: $1" ;;
  esac
  shift
done
case "$PUERTO" in ''|*[!0-9]*) fallar "el puerto debe ser un número" ;; esac
case "$MONITOR" in *[!A-Za-z0-9_.:-]*) fallar "nombre de monitor inválido" ;; esac

case "$accion" in
  estado)
    if panel_vivo; then decir "corriendo http://127.0.0.1:$PUERTO (pid $(sed -n 1p "$ARCHIVO_PID"))"; else decir "detenido"; fi
    ;;
  iniciar) iniciar ;;
  monitores) monitores ;;
  abrir) abrir ;;
  cerrar) cerrar ;;
  *) fallar "uso: abrir.sh estado|iniciar|monitores|abrir|cerrar [--monitor NOMBRE] [--demo] [--puerto N] [--ventana]" ;;
esac
