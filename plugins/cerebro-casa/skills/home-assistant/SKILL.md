---
name: home-assistant
description: Home Assistant en casa - instalar (HA OS vs Docker), Tuya/Smart Life/Steren (nube vs local), automatizaciones, editar configuración sin romperla, respaldos y acceso remoto seguro. Keywords domótica, smart home, HACS, Marketplace, automation.
---

# Home Assistant sin romper la casa

El usuario quiere controlar luces y aparatos desde cualquier dispositivo, con **poco mantenimiento**. No programa: tú escribes la configuración, él la usa desde la app. Esta skill corrige lo que suele salir mal: instalar en Docker y luego descubrir que faltan las apps, reiniciar con YAML inválido, editar archivos que maneja la interfaz, prometer control "local" de focos Tuya que en realidad van por la nube, y abrir el puerto 8123 a internet.

## 0. Antes de tocar nada

1. Averigua **dónde corre** y qué versión: en la interfaz, Ajustes > Acerca de. Si tienes terminal: en HA OS `ha core info`; en Docker `docker ps | grep -i home`. No des instrucciones de HA OS a una instalación Docker ni al revés.
2. Lee las **notas de la versión instalada** si vas a usar algo que cambió en 2026 (ver sección 2). Los tutoriales viejos de internet usan menús y nombres que ya no existen.
3. Haz un **respaldo** (sección 5) antes de cambios grandes: integración nueva, actualización, migración.
4. Explica al usuario en 1–3 frases qué vas a cambiar y cómo deshacerlo.

## 1. Elegir instalación

| Opción | Cuándo | Qué pierdes / qué cuesta |
|---|---|---|
| **HA OS directo en la mini-PC** (imagen genérica x86-64) | La mini-PC se dedica solo a Home Assistant | Borra todo el disco. Es la opción recomendada por el proyecto: actualizaciones y respaldos desde la interfaz, apps con un clic |
| **HA OS como VM** (KVM/virt-manager o Proxmox) | La mini-PC también corre Jellyfin, Minecraft, etc. | Más piezas. VM mínima: 2 GB de RAM y 2 vCPU, firmware **UEFI** obligatorio (OVMF sin Secure Boot). Para pasar un dongle USB (Zigbee) hay que asignarlo a la VM |
| **Container (Docker)** | Ya hay un servidor Linux con Docker y no quieres VM | **No hay apps** (antes "add-ons"): ESPHome, Zigbee2MQTT, Tailscale, etc. se instalan como contenedores aparte. Sin Thread ni Z-Wave "de fábrica". Actualizas tú con `docker compose pull` |

- **No propongas "Supervised" ni "Core"**: el proyecto los declaró obsoletos en mayo de 2025.
- Para elegir entre Linux simple y Proxmox en la mini-PC usa la skill `homelab-y-red` (cerebro-linux).
- Container según la doc oficial: imagen `ghcr.io/home-assistant/home-assistant:stable`, `network_mode: host`, `privileged: true`, volumen `./config:/config`, `/run/dbus:/run/dbus:ro` (solo si usa Bluetooth), `TZ=America/Mexico_City`, `restart: unless-stopped`, `stop_grace_period: 60s`. Requiere Docker **Engine** 23+ (Docker Desktop no sirve). Arranque y verificación: skill `servicios-24-7`.
- La laptop sin pantalla como servidor: que no se suspenda al cerrar la tapa (ver `homelab-y-red`, sección mini-PC).

## 2. Vocabulario que cambió (a nov 2026)

| Antes | Ahora | Desde |
|---|---|---|
| Add-ons | **Apps** (Ajustes > Apps) | 2026.2 |
| HACS (instalación aparte) | **Marketplace** integrado (Ajustes > Marketplace), funciona también en Container. El instalador de HACS ya no funciona en 2026.11+ | 2026.11 |
| Herramientas para desarrolladores | Ajustes > Herramientas (YAML, Acciones, Estadísticas) | verifica en la versión instalada |
| Home Assistant Cloud (Nabu Casa) | **Home Assistant Link** | anunciado para el 2 dic 2026 |

Todo lo del Marketplace es de la comunidad: **no está auditado** por Home Assistant y puede leer tus datos o conectarse a internet. Instala solo lo necesario y dile al usuario qué estás instalando.

## 3. Tuya, Smart Life y Steren

Muchos aparatos baratos en México (focos, enchufes, tiras) son Tuya. Decide así:

1. **Empieza con la integración oficial `Tuya`** (Ajustes > Dispositivos y servicios > Agregar integración). Pide la app **Smart Life o Tuya Smart** con cuenta, el **User Code** (en la app: Yo > engrane > Cuenta y seguridad) y escanear un QR. **No requiere cuenta de desarrollador.** Es **solo nube**: si se cae internet o Tuya, no responde. Tras agregar un aparato en la app, recarga la integración. Cerraduras y controles remotos no están soportados.
2. **Steren**: la doc no confirma que Steren Home sea Tuya; en el foro de Home Assistant (2023–2025) varios usuarios reportan que sus aparatos Steren funcionan **dándolos de alta en Smart Life en vez de Steren Home** y luego usando la integración Tuya. Pruébalo con un aparato antes de migrar todos y avisa que es un reporte de comunidad.
3. **Control local** (más rápido, sigue funcionando sin internet de Tuya, pero los aparatos siguen reportando a la nube):
   - Prefiere **Tuya Local** (`make-all/tuya-local`, desde el Marketplace). Necesita la *local key* de cada aparato (la puede obtener iniciando sesión con Smart Life, sin cuenta de desarrollador). **La local key cambia cada vez que re-emparejas** el aparato en la app.
   - Limitaciones: muchos aparatos aceptan **una sola conexión local** a la vez; sensores de batería sin hub no funcionan localmente; algunos necesitan pausas entre comandos.
   - **No instales el LocalTuya original** (`rospogrigio`) en una instalación nueva: hay reportes de fallas con HA 2026.2–2026.3. Sus forks usan el mismo dominio `localtuya` y no pueden convivir con él.
4. **Emparejar**: los aparatos Tuya casi siempre solo usan **2.4 GHz**; si la red mezcla 2.4 y 5 GHz con el mismo nombre, el emparejamiento puede fallar. Ver `wifi-y-red-domestica`.
5. Para compras nuevas sugiere aparatos que funcionen **local por diseño** (Matter, Zigbee con coordinador USB, o ESPHome) antes que más Tuya de nube. Explica el porqué en una frase; la decisión es del usuario.

## 4. Editar la configuración sin romperla

**Dónde editar:**
- HA OS: app **Terminal & SSH**, **File editor** o **Studio Code Server** (Ajustes > Apps). Los archivos están en `/config`.
- Container: en la carpeta del host montada como `/config`.
- **Nunca edites a mano `.storage/`** (JSON internos) ni `automations.yaml`: la doc dice que ese archivo lo maneja la interfaz y no debe editarse manualmente.

**Automatizaciones: UI o YAML**
- Para que el usuario pueda verlas y ajustarlas él solo: crea la automatización en la interfaz, menú ⋮ > **Editar en YAML**, pega tu YAML y guarda. Queda editable en el editor visual.
- Si son muchas o generadas por ti, ponlas en un archivo propio sin tocar el de la UI:

```yaml
# configuration.yaml
automation: !include automations.yaml          # el de la UI, no lo toques
automation claude: !include automatizaciones_claude.yaml
```

- Usa la sintaxis actual (`triggers:` / `- trigger: state`, `conditions:`, `actions:` / `- action: light.turn_on`). Si un ejemplo de internet usa `platform:` o `service:`, es viejo: tradúcelo.
- Cada automatización con `id:` único y `alias:` en español claro ("Apagar luces de la sala a las 11 pm").
- Antes de escribir una integración por YAML, confirma en su página de la doc (`home-assistant.io/integrations/<nombre>/`) si todavía acepta YAML; muchas ya son solo por interfaz.

**Contraseñas y tokens**: en `secrets.yaml` y referencia con `!secret nombre`. Nunca imprimas tokens de larga duración ni los pongas en un repo (ver `secretos-y-llaves` de cerebro-base).

**Checklist obligatorio después de editar YAML:**
1. Valida:
   - Interfaz: Ajustes > Herramientas > YAML > **Comprobar configuración**.
   - HA OS: `ha core check`
   - Container: `docker exec homeassistant python -m homeassistant --script check_config --config /config`
2. Si hay error, arréglalo **antes** de seguir. No reinicies "a ver si jala".
3. Aplica con **recarga** (recargar automatizaciones, o Ajustes > Sistema > ⏻ > Recarga rápida) en vez de reinicio completo. HA valida antes de reiniciar/recargar y se niega si hay error, pero tú debes haberlo detectado antes.
4. Revisa Ajustes > Sistema > Registros y la sección de Reparaciones.
5. Prueba la automatización de verdad (dispárala o usa "Ejecutar acciones") y di al usuario cómo comprobarla él.

Opcional y recomendable: `git init` dentro de `/config` con `.gitignore` que excluya `secrets.yaml`, `.storage/`, bases de datos y `backups/`, para poder ver qué cambiaste y revertir (ver `red-de-seguridad-git` de cerebro-base).

## 5. Respaldos

- Ajustes > Sistema > Respaldos > respaldos automáticos. La opción **Recomendada** respalda diario y guarda los últimos 3.
- Los respaldos van **cifrados**: el usuario debe **descargar el kit de emergencia** (contiene la llave) y guardarlo fuera de la mini-PC. Sin esa llave no se restaura nada. Si cambia la llave, los respaldos anteriores requieren el kit viejo.
- Ubicaciones: local (`/backup` en HA OS; `config/backups` en Container), almacenamiento de red, disco USB (2026.11+: Ajustes > Sistema > Almacenamiento), Google Drive/OneDrive por integración, o la nube de Nabu Casa (1 respaldo de hasta 5 GB).
- En Container el respaldo solo trae configuración e historial (no hay apps), y **restaurar no cambia la versión del contenedor**: para volver a una versión vieja, primero recrea el contenedor con esa imagen.
- Para respaldar el host completo (restic, 3-2-1, prueba de restauración) usa la skill `respaldos` de cerebro-linux.

## 6. Acceso remoto seguro

**Nunca** reenvíes el puerto 8123 del router a internet.

| Opción | Para quién | Notas |
|---|---|---|
| **Nabu Casa** (Home Assistant Cloud, pasa a llamarse Home Assistant Link) | El usuario quiere lo más fácil y apoyar el proyecto | A nov 2026: 6.50 USD/mes o 65 USD/año; incluye acceso remoto, respaldo en la nube y Alexa/Google. Verifica en nabucasa.com/pricing |
| **Tailscale** (app de Tailscale en Ajustes > Apps) | Solo él y su familia, gratis | Instala Tailscale en el celular. Para HTTPS con Serve: en Ajustes > Sistema > Red, sección servidor HTTP, activa "Confiar en X-Forwarded-For" y agrega `127.0.0.1` como proxy de confianza |
| **Cloudflare Tunnel** | Quiere un dominio propio | Agrega el proxy como proxy de confianza o habrá bloqueos; desde 2026.11, si el login dice "Invalid client id", es por eso. Ver `cloudflare-tunnel-y-dominio` (cerebro-web) |

CGNAT, doble NAT y comparación general de túneles: skill `homelab-y-red`.

## 7. Actualizaciones

- Respaldo antes de actualizar. Lee la sección **Backward-incompatible changes** de las notas de versión y busca las integraciones que usa el usuario.
- Actualiza una cosa a la vez (núcleo, luego apps, luego integraciones del Marketplace) y comprueba que todo responde entre cada una.
- Con poco tiempo de mantenimiento, conviene esperar al primer parche (`.1`) de cada versión mensual.

## 8. Errores típicos

- Dar rutas de menú de tutoriales viejos ("Supervisor", "Add-on store", "HACS > Integraciones", "Herramientas para desarrolladores").
- Prometer que Tuya oficial funciona sin internet.
- Re-emparejar un aparato en Smart Life y no avisar que hay que actualizar su local key en Tuya Local.
- Mezclar automatizaciones de la UI y escritas a mano en `automations.yaml`.
- Poner HA en la red de invitados/IoT aislada y luego no ver los aparatos locales.
- Decir "ya quedó" sin haber disparado la automatización ni revisado el registro.

## Verifica antes de confiar

Home Assistant saca versión cada mes y renombra menús seguido. Antes de dar una ruta de menú, un nombre de integración o una opción YAML, haz WebFetch a la página oficial (`home-assistant.io/integrations/<x>/`, notas de versión en `home-assistant.io/blog/`) o usa Context7 si está instalado. Si el usuario ve algo distinto en pantalla, pídele captura y créele a la captura.

## Fuentes (verificado nov 2026)

- https://www.home-assistant.io/installation/ · https://www.home-assistant.io/installation/linux
- https://www.home-assistant.io/blog/2025/05/22/deprecating-core-and-supervised-installation-methods-and-32-bit-systems/
- https://www.home-assistant.io/blog/2026/02/04/release-20262/ (add-ons pasan a llamarse apps)
- https://www.home-assistant.io/blog/2026/11/04/release-202611/ (Marketplace, almacenamiento local, cambios de autenticación con proxy, Tuya)
- https://www.hacs.xyz/docs/use/download/download/
- https://www.home-assistant.io/integrations/tuya/
- https://github.com/make-all/tuya-local · https://github.com/rospogrigio/localtuya
- https://privatehomelab.com/localtuya-broken-home-assistant-2026-what-to-do/ (reportes de fallas de LocalTuya en 2026)
- https://community.home-assistant.io/t/steren-devices-ha-integration/518888 (Steren vía Smart Life, reportes de usuarios)
- https://support.tuya.com/en/help/_detail/K9hut2v0htbez (2.4 GHz)
- https://www.home-assistant.io/docs/automation/yaml/ · https://www.home-assistant.io/docs/automation/editor/
- https://www.home-assistant.io/common-tasks/os/ · https://www.home-assistant.io/common-tasks/container/
- https://www.home-assistant.io/common-tasks/general/restarting/ · https://www.home-assistant.io/common-tasks/general/backups/
- https://www.home-assistant.io/integrations/http/ · https://www.tailscale.com/blog/remotely-access-home-assistant
- https://www.nabucasa.com/pricing/ · https://www.home-assistant.io/blog/2026/10/02/big-tech-ruined-the-cloud-so-were-renaming-ours/
