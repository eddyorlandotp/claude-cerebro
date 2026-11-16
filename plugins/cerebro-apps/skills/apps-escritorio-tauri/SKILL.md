---
name: apps-escritorio-tauri
description: Decidir si hace falta app de escritorio y hacerla con Tauri 2 (o Electron) desde Linux - AppImage/deb/rpm y Windows, glibc en CachyOS, firma, SmartScreen y updater firmado. Usar con app de escritorio, Tauri, Electron, .exe.
---

# Apps de escritorio con Tauri 2

El error que corrige: Claude arma una app de escritorio cuando una PWA instalada en Chrome bastaba; compila el AppImage en CachyOS (que no arranca en otras distros por glibc); promete un `.exe` "listo" sin firma (SmartScreen lo bloquea); o pierde la llave del updater y ya no puede actualizar a nadie.

## Reglas

1. **Verifica antes de confiar.** Tauri saca versiones menores seguido. Antes de configurar algo, abre la página en v2.tauri.app (WebFetch) o usa Context7 si está instalado, y revisa la versión instalada (`npm ls @tauri-apps/cli`, `cargo tree -i tauri`). No mezcles ejemplos de Tauri 1.
2. **Explica la decisión en 1–3 frases** ("Hago app de escritorio porque necesitas un atajo global de teclado y leer archivos locales; una web no puede").
3. **Pide confirmación** antes de comprar un certificado de firma o publicar una actualización (llega a todos los usuarios).

## ¿Hace falta app de escritorio?

**No hace falta** si solo es mostrar datos, formularios o un panel: una PWA se instala en Chrome/Edge de escritorio con ventana propia e ícono (skill `pwa`). Tampoco si el "escritorio" es para correr un bot 24/7: eso es un servicio (skill `servicios-24-7`).

**Sí hace falta** si necesita: ícono en la bandeja del sistema, atajos globales, leer/escribir archivos o carpetas locales libremente, lanzar procesos locales, autoarranque con el sistema, o distribuir un instalador.

## Tauri 2 vs Electron (a nov 2026: Tauri 2.12.x, Electron 45.x)

| | Tauri 2 | Electron |
|---|---|---|
| Motor de la UI | WebView **del sistema**: WebKitGTK 4.1 en Linux, WebView2 en Windows | Chromium **incluido** (+ Node.js) |
| Tamaño | Una app mínima puede pesar menos de 600 KB | Mucho mayor (lleva el navegador) |
| Backend | Rust (comandos llamados desde JS) | Node.js |
| Riesgo típico | La UI se ve/comporta distinto entre Linux y Windows: **prueba en ambos** | Tamaño, memoria; mantener la versión al día (solo las 3 últimas mayores reciben soporte) |
| Elige si... | Quieres app ligera y segura por permisos | Necesitas render idéntico en todos lados o librerías de Node sin reemplazo |

Por defecto: **Tauri 2**. Elige Electron solo por una razón concreta de la última fila, y dila.

## Preparar CachyOS (Arch)

Dependencias según la guía oficial de prerrequisitos (verifícalas, cambian):

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Rust con rustup (la doc oficial recomienda revisar el script antes de ejecutarlo). Usa la skill `cachyos-hyprland-fish` antes de instalar paquetes.

## Empaquetar

### Linux (AppImage, .deb, .rpm)
- **No distribuyas lo compilado en CachyOS.** Es rolling release con glibc muy nueva; el binario falla en distros más viejas con errores tipo `GLIBC_2.xx not found`. La doc pide compilar en el sistema **más viejo** que quieras soportar que tenga WebKitGTK 4.1, p. ej. **Ubuntu 22.04 o Debian 12**.
- Solución práctica: compila los paquetes de Linux en **GitHub Actions** con `ubuntu-22.04` (o un contenedor de esa versión). En CachyOS solo desarrollas y pruebas.
- AppImage para ARM no se puede compilar cruzado: necesita máquina ARM (hay runners ARM de GitHub).
- Si la app reproduce audio/video, revisa `bundleMediaFramework` en la doc de AppImage.

### Windows
- `.msi` (WiX) **solo se genera en Windows**.
- Desde Linux se puede generar el instalador NSIS (`-setup.exe`) con `cargo-xwin`, pero la doc lo marca como **último recurso** (menos probado). Preferido: runner `windows-latest` de GitHub Actions.
- **Firma:** sin firmar, Windows muestra la advertencia de SmartScreen al descargar; con **Smart App Control** activo en Windows 11 se bloquea sin opción de permitir esa app. Desde 2024 un certificado EV ya no da reputación inmediata: firmado o no, una app nueva puede mostrar aviso al principio.
- Explícale al usuario este costo antes de prometer "un .exe que cualquiera instala".

### macOS
- No hay Mac: no prometas `.dmg`. Solo sería posible con runner macOS en CI y cuenta de Apple para firmar/notarizar.

## Actualizaciones automáticas (plugin updater)

- Las actualizaciones **deben ir firmadas**; no se puede desactivar.
- Genera las llaves una vez: `npm run tauri signer generate -- -w ~/.tauri/miapp.key`.
- La **llave privada** nunca va al repo ni a un chat. Respáldala cifrada (skill `respaldos`). **Si se pierde, no podrás actualizar a los usuarios que ya instalaron la app.**
- Al compilar, la llave va en variables de entorno `TAURI_SIGNING_PRIVATE_KEY` (y `..._PASSWORD`); **un `.env` no funciona**. En CI, como secret del repo.
- `bundle.createUpdaterArtifacts: true` genera los `.sig`; la llave **pública** va en `tauri.conf.json`.
- `endpoints` deben ser HTTPS (obligatorio en producción). Lo simple: JSON estático en GitHub Releases generado por `tauri-action`.
- Antes de publicar una versión: prueba actualizar desde la versión anterior instalada, no solo instalar limpio.

## Seguridad

- Tauri 2 usa **capabilities/permisos**: da a cada ventana solo los permisos de plugins que usa (fs con rutas acotadas, shell solo con comandos permitidos). No habilites todo "para que jale".
- Configura una CSP en `tauri.conf.json`; no cargues JS remoto en la ventana.
- Valida en Rust los argumentos de cada comando que llega desde la UI.
- Si toca dinero real: la app **no** guarda seed phrases ni llaves privadas; firma con la billetera del usuario. Secretos de API, fuera del binario (se pueden extraer).

## Al terminar

Dile al usuario: (1) por qué escritorio y no PWA, (2) qué archivos se generaron y en qué sistemas los probaste, (3) cómo instalarla él (AppImage: `chmod +x` y doble clic), (4) dónde está respaldada la llave del updater.

## Fuentes (verificado nov 2026)

- https://v2.tauri.app/start/ (WebView del sistema, menos de 600 KB)
- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/distribute/appimage/ , /distribute/debian/ , /distribute/rpm/ (glibc y Ubuntu 22.04/Debian 12)
- https://v2.tauri.app/distribute/windows-installer/ (MSI solo en Windows, NSIS con cargo-xwin)
- https://v2.tauri.app/distribute/sign/windows/ (SmartScreen, Smart App Control, EV desde 2024)
- https://v2.tauri.app/plugin/updater/
- https://crates.io/crates/tauri (2.12.6) y https://www.npmjs.com/package/@tauri-apps/cli (2.12.5)
- https://www.electronjs.org/docs/latest/ y https://www.electronjs.org/docs/latest/tutorial/electron-timelines ; https://www.npmjs.com/package/electron (45.3.3)
