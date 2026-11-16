---
name: servidor-multimedia
description: Netflix casero con Jellyfin - instalar en la mini-PC, transcodificación por hardware (Intel QSV, NVIDIA NVENC), carpetas y nombres, apps de TV/iPhone, acceso remoto y diagnóstico. Keywords Jellyfin, media server, Plex, Kodi, películas.
---

# Servidor multimedia con Jellyfin

Meta: que el usuario abra una app en la TV o el iPhone y vea **su propio contenido** como en Netflix, sin tocar la mini-PC. Esta skill corrige: convertir la mini-PC en "PC de escritorio pegada a la TV", transcodificar con CPU sin darse cuenta, nombrar carpetas como sea, abrir el puerto 8096 a internet y servir video por Cloudflare.

**Solo contenido propio o con licencia.** No ayudes a configurar descargas de piratería, indexadores ni torrents para conseguir contenido.

## 0. Si ya hubo un intento que falló: diagnostica primero

Pregunta al usuario qué pasó exactamente (no se veía, se trababa, no encontraba películas, se apagaba, era incómodo de usar) y compara con estas causas típicas:

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| "Era incómodo", había que usar mouse/escritorio remoto en la TV | La mini-PC hacía de **servidor y de cliente** (escritorio + autologin + Kodi + escritorio remoto): demasiadas piezas | Mini-PC **sin pantalla** como servidor; en la TV la **app de Jellyfin** (o un stick de streaming) |
| Se traba o carga mucho | Transcodificación por **CPU**, o video por Wi-Fi débil | Sección 3 (hardware) y servidor por **Ethernet** |
| Películas sin póster o mal identificadas | Nombres de carpeta/archivo | Sección 4 |
| Tras reiniciar, la biblioteca vacía | Disco externo no se monta solo o cambió de ruta | Montaje fijo por UUID (sección 2) |
| Funciona en casa pero no fuera | Sin VPN/túnel, CGNAT | Sección 5 |

No reconstruyas todo sin entender cuál de estas fue.

## 1. Arquitectura recomendada

- **Servidor**: Jellyfin en la mini-PC, conectada por **cable** al switch, encendida 24/7.
- **Clientes oficiales** (jellyfin.org/downloads/clients): Android TV/Google TV y Fire TV, Samsung (Tizen), LG (webOS), Roku, iOS/iPadOS, y el navegador. Revisa qué TV tiene el usuario y su sistema antes de recomendar.
- **Versión**: desde sept 2026 Jellyfin pasó de 10.11 a **12.0** (cambió la numeración). Para actualizar a 12 hay que estar en 10.10.7 o 10.11.x; los plugins de terceros hechos para 10.11 deben recompilarse (quítalos antes de actualizar); las rutas `/emby/*` ya no existen. Respaldo antes de un cambio de versión mayor.

## 2. Instalar

**Opción A: Docker compose** (recomendado si la mini-PC ya usa Docker). Basado en la doc oficial:

```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:12        # fija la versión mayor
    container_name: jellyfin
    restart: unless-stopped
    ports:
      - "8096:8096/tcp"                # interfaz web
      - "7359:7359/udp"                # descubrimiento en la red local
    volumes:
      - ./config:/config
      - ./cache:/cache
      - /srv/media:/media:ro           # contenido, solo lectura
    # aceleración por hardware: ver sección 3
```

**Opción B: paquete nativo en Arch**: `sudo pacman -S jellyfin-server jellyfin-web jellyfin-ffmpeg` y `sudo systemctl enable --now jellyfin.service`. En Debian/Ubuntu usa el repositorio oficial que indica jellyfin.org (no el paquete viejo de la distro).

**Disco de contenido**:
- Móntalo fijo por UUID en `/etc/fstab` con `nofail` (que la máquina arranque aunque el disco no esté): `lsblk -f` para ver el UUID. Prueba con `sudo mount -a` antes de reiniciar.
- El usuario del servicio (`jellyfin` nativo, o el del contenedor) necesita **leer** la carpeta: compruébalo con `sudo -u jellyfin ls /srv/media` (nativo).

Configuración inicial en `http://IP-DE-LA-MINIPC:8096`: crea admin con contraseña fuerte y un usuario por persona. Para que siga vivo y se levante solo: skill `servicios-24-7`.

## 3. Transcodificación por hardware

Lo ideal es **no transcodificar**: si la TV reproduce el archivo directo (Direct Play), la mini-PC casi no trabaja. La transcodificación ocurre cuando el cliente no soporta el formato, cuando se baja la calidad o con subtítulos "quemados".

Primero identifica el hardware: `lscpu | grep 'Model name'`, `ls -l /dev/dri`, `lspci | grep -iE 'vga|3d'`.

**Intel (lo más común en mini-PC/laptop)**
- **QSV** en Linux desde Broadwell (Core de 5ª gen); para más viejas usa **VA-API**. HEVC 10-bit desde 7ª gen; decodificar AV1 desde 11ª gen.
- Docker: pasa el dispositivo y el grupo `render`:
  ```yaml
      devices:
        - /dev/dri/renderD128:/dev/dri/renderD128
      group_add:
        - "GID"   # resultado de: getent group render | cut -d: -f3
  ```
- Verifica dentro del contenedor: `docker exec -it jellyfin /usr/lib/jellyfin-ffmpeg/vainfo` (debe listar perfiles, no errores).
- Nativo: el usuario `jellyfin` debe estar en el grupo `render`.

**NVIDIA**
- Soportado desde Maxwell; HEVC 10-bit codificado desde Pascal; algunos modelos (GT 1030, MX450) no tienen NVENC.
- Host: driver NVIDIA + `nvidia-container-toolkit` (en Arch: `extra/nvidia-container-toolkit`). En compose: `runtime: nvidia` y `deploy.resources.reservations.devices` con `driver: nvidia`, `count: all`, `capabilities: [gpu]`.
- Verifica: `docker exec -it jellyfin nvidia-smi`, y durante una reproducción, que aparezca el proceso de ffmpeg usando la GPU.

**Activar y comprobar**: Panel de control > Reproducción > Transcodificación > elige QSV/VA-API/NVENC y marca solo los códecs que el hardware soporta. Luego reproduce algo forzando menor calidad y revisa en el Panel que la sesión diga transcodificación por hardware y que el CPU no esté al 100 % (`htop`).

- Evita archivos **H.264 10-bit**: ninguna GPU Intel/NVIDIA/AMD los decodifica por hardware.
- Usa siempre el `jellyfin-ffmpeg` (ya viene en la imagen Docker); un ffmpeg genérico da aceleración parcial.

## 4. Carpetas y nombres (para que reconozca todo)

Bibliotecas **separadas** por tipo (Películas tipo "Movies", Series tipo "Shows"):

```
/srv/media/peliculas/
  Coco (2017)/
    Coco (2017).mkv
  Otra Película (2021) [imdbid-tt0000000]/
    Otra Película (2021) [imdbid-tt0000000] - 4K.mkv
    Otra Película (2021) [imdbid-tt0000000] - 1080p.mkv
/srv/media/series/
  Nombre de la Serie (2019)/
    Season 01/
      Nombre de la Serie S01E01.mkv
    Season 00/          # especiales
```

- El archivo de película se llama **igual que su carpeta**. El año (y el ID entre corchetes) ayuda mucho.
- Temporadas: `Season 01`, con cero a la izquierda; **no** `S01` ni `Temporada 1` como nombre de carpeta.
- Versiones múltiples: mismo nombre base exacto y luego ` - etiqueta`.
- Extras en subcarpetas `extras/`, `trailers/`, `behind the scenes/`.
- Si vas a renombrar archivos en lote: genera primero la lista "nombre actual → nombre nuevo", muéstrasela al usuario y **solo después** ejecuta. Nunca borres originales.

## 5. Acceso desde fuera de casa

- **No** reenvíes el 8096 a internet (la doc oficial lo desaconseja).
- **Tailscale** (preferido): Tailscale en la mini-PC y en el iPhone; en la app de Jellyfin usa la IP o nombre de Tailscale. Sin abrir puertos y funciona con CGNAT. Instalación y CGNAT: skill `homelab-y-red`.
- **No uses Cloudflare Tunnel/CDN para video**: los términos de Cloudflare permiten limitar cuentas que sirven video o archivos grandes sin sus servicios de pago.
- Si quiere dominio propio con HTTPS: proxy inverso; ojo, "Base URL" rompe varios clientes y requiere reiniciar.
- La subida de internet de la casa limita la calidad remota: ajusta el límite de bitrate remoto en el Panel en vez de culpar al servidor.

## 6. Mantenimiento y respaldo

- Respalda `/config` de Jellyfin (usuarios, progreso visto, metadatos); el contenido va aparte. Skill `respaldos`.
- Actualiza con la imagen fijada a la versión mayor (`jellyfin/jellyfin:12`); antes de pasar a una versión mayor nueva, respaldo y lectura de las notas.

## 7. Errores típicos

- Mezclar películas y series en una sola biblioteca.
- Montar el disco en `/run/media/usuario/...` (montaje automático del escritorio): desaparece al cerrar sesión.
- Publicar puertos y olvidar que Docker se salta `ufw` (ver `homelab-y-red`).
- Activar códecs en la transcodificación que el hardware no soporta: falla la reproducción.
- Declarar "funciona" sin probar desde la TV real y desde el celular con datos móviles.

## Verifica antes de confiar

Jellyfin cambió de numeración y rompió cosas en 12.0. Antes de dar rutas de menú, nombres de imagen o pasos de hardware, haz WebFetch a jellyfin.org/docs (o Context7 si está instalado) y revisa la versión instalada en Panel de control.

## Fuentes (verificado nov 2026)

- https://jellyfin.org/docs/general/installation/container
- https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/ (+ /intel y /nvidia)
- https://jellyfin.org/docs/general/server/media/movies · https://jellyfin.org/docs/general/server/media/shows
- https://jellyfin.org/downloads/clients/
- https://jellyfin.org/docs/general/post-install/networking/
- https://jellywatch.app/blog/jellyfin-12-release-everything-you-need-to-know (12.0: numeración, plugins, rutas)
- https://hub.docker.com/r/jellyfin/jellyfin/tags (etiquetas 12.x)
- https://archlinux.org/packages/extra/x86_64/jellyfin-server/ (incluye jellyfin.service)
- https://www.cloudflare.com/service-specific-terms-application-services/ (restricción de video en el CDN)
