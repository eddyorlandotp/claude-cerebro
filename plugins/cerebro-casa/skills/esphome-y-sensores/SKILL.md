---
name: esphome-y-sensores
description: Sensores y relevadores caseros con ESP32 y ESPHome - YAML, flashear desde Linux (puerto serial en Arch, grupo uucp), OTA, integrar a Home Assistant y seguridad eléctrica (nada de 127 V). Keywords ESP32, ESP8266, sensor DIY, firmware, relay.
---

# ESPHome y sensores con ESP32

ESPHome convierte un ESP32 de ~100 pesos en un sensor o actuador que Home Assistant ve **localmente**, sin nube. Esta skill corrige: decir "agrégate al grupo `dialout`" en Arch (no existe), inventar pines, dejar la contraseña del Wi-Fi en texto plano, olvidar la llave de cifrado de la API y, lo más grave, guiar a un no-electricista a cablear 127 V.

## 0. ¿ESPHome es lo correcto?

| Quiere | Recomienda |
|---|---|
| Medir temperatura/humedad, movimiento, puerta abierta, luz, nivel de agua | **ESPHome** con sensor de bajo voltaje (5 V / 3.3 V) |
| Botón o pantallita que dispare escenas | **ESPHome** |
| Prender/apagar un aparato o foco de **127 V** | **Enchufe o apagador inteligente comprado y certificado** (de preferencia que ya traiga ESPHome, Matter o Zigbee). No un relevador suelto |
| Tira LED de 12/24 V | ESPHome con controlador hecho para eso y fuente adecuada, o una tira comercial |

Explícale al usuario la elección en 1–2 frases antes de comprar nada.

## 1. Instalar ESPHome

- **Con Home Assistant OS**: app **ESPHome Device Builder** (Ajustes > Apps). Las configuraciones quedan en `/config/esphome/`.
- **En la PC con Arch/CachyOS**:
  - CLI: `sudo pacman -S esphome` (está en `extra`; a nov 2026 versión 2026.10.x).
  - App de escritorio (AUR, no oficial): `yay -S esphome-desktop-bin` o `paru -S esphome-desktop-bin`, según el helper que haya (`command -v yay paru`; ver `cachyos-hyprland-fish` de cerebro-linux). Sin sudo.
  - **No uses `pip install` en el Python del sistema**: Arch lo bloquea (`externally-managed-environment`).
- **Docker**: imagen `ghcr.io/esphome/esphome` con `--net=host` (sin host networking no hay mDNS y solo encuentra dispositivos con IP fija). Panel en `http://localhost:6052`.

## 2. Primer flasheo desde Linux (USB)

El **primer** flasheo es por cable; los siguientes, por Wi-Fi (OTA).

1. Cable USB **de datos** (los de solo carga, como los de power bank, no sirven). Si no aparece nada, cambia el cable primero.
2. Conecta y mira qué detecta el kernel:
   ```bash
   sudo dmesg -w     # Ctrl+C al terminar; busca "cp210x" o "ch341" y "attached to ttyUSB0" o "ttyACM0"
   ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
   ```
3. **Permisos en Arch**: el puerto pertenece al grupo **`uucp`** (Arch sustituye `dialout` por `uucp`). La doc de ESPHome dice `dialout` porque está escrita para Debian/Ubuntu; en Arch ese grupo no existe.
   ```bash
   stat -c '%G' /dev/ttyUSB0          # confirma el grupo real
   sudo usermod -aG uucp $USER        # en fish es igual
   ```
   Hay que **cerrar sesión y volver a entrar** (o reiniciar). Comprueba con `groups`. Nunca resuelvas con `chmod 777` ni corriendo ESPHome con sudo.
4. Si no entra en modo de programación: mantén presionado **BOOT** mientras se conecta o mientras empieza la subida, y suéltalo cuando empiece a escribir.
5. Valida y sube:
   ```bash
   esphome config sala.yaml    # valida sin compilar
   esphome run sala.yaml       # compila, sube (USB la primera vez, OTA después) y muestra logs
   esphome logs sala.yaml      # solo logs
   ```

## 3. YAML base

Pregunta el **modelo exacto de la placa** (ESP32 clásico, S3, C3, C6...) y busca su `board` en la doc antes de escribirlo; no lo adivines.

```yaml
esphome:
  name: sensor-sala            # minúsculas y guiones; es el nombre en la red
  friendly_name: Sensor sala

esp32:
  board: <placa-verificada>
  framework:
    type: esp-idf              # el default actual para todos los ESP32

logger:

api:
  encryption:
    key: !secret api_key_sala  # 32 bytes en base64; Home Assistant la pedirá al agregarlo

ota:
  - platform: esphome
    password: !secret ota_password

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  ap:                          # red de rescate si no logra conectarse
    password: !secret ap_password

captive_portal:
```

- `secrets.yaml` en la misma carpeta, con las claves. Nunca la imprimas completa ni la subas a git.
- Genera la llave de cifrado en la página del componente `api` de la doc (la genera tu navegador) o con `openssl rand -base64 32`.
- Para cada sensor, abre su página en `esphome.io/components/...` y copia la estructura vigente. Los nombres de opciones cambian entre versiones.

### Pines (ESP32 clásico)

- **Evita los pines de arranque (strapping)**: GPIO0, 2, 5, 12 y 15; pueden impedir que arranque. ESPHome avisa al validar: no ignores esa advertencia.
- GPIO34–39 son **solo entrada** y sin pull-up interno.
- Sensores I²C (BME280, AHT20, etc.): usa los pines I²C que indique la placa y declara el bus `i2c:`.
- Los ESP32-S3/C3/C6 tienen otros pines restringidos: revisa la tabla de pines de la placa concreta.

## 4. Integrar en Home Assistant

- Aparece solo en Ajustes > Dispositivos y servicios (descubrimiento por mDNS). Pide la **llave de cifrado** del YAML.
- Si no aparece: debe estar en la misma red/subred que Home Assistant (no en una red de invitados aislada), y si HA corre en Docker, con `network_mode: host`.
- Dale una **reserva DHCP** en el router (ver `homelab-y-red`) para que no cambie de IP.

## 5. Seguridad eléctrica (reglas duras)

1. **No des instrucciones para conectar nada a 127 V AC** (contactos, apagadores de pared, focos de casa, motores). Ni "solo es un relevador". Un error de cableado puede matar o quemar la casa. Si el usuario insiste, la respuesta es: aparato comercial certificado o **electricista**.
2. Los módulos de relevador baratos de tiendas en línea suelen exagerar su capacidad y no tienen aislamiento ni caja. No los recomiendes para cargas de 127 V.
3. Para controlar aparatos de 127 V: enchufe o apagador inteligente **certificado** (en México busca el sello NOM), instalado según su manual, de preferencia con ESPHome de fábrica, Matter o Zigbee para control local.
4. Alimenta el ESP32 por USB (5 V) con un cargador decente. No alimentes motores, servos ni tiras LED desde el pin de 3.3 V de la placa.
5. Trabaja siempre **desconectado**: arma y cambia cables sin corriente, y conecta al final.
6. Nada de baterías de litio sueltas sin protección ni cargador adecuado.

## 6. Mantenimiento

- Actualizar firmware: Device Builder > "Update all", o `esphome run` de nuevo. Haz uno, comprueba que vuelve a conectar y luego los demás.
- Si un OTA falla y el aparato no regresa: espera a su red de rescate (`ap:`) o reflashea por USB.
- Guarda la carpeta de YAML y `secrets.yaml` en el respaldo (skill `respaldos`).

## 7. Errores típicos

- `usermod -aG dialout` en Arch; o no cerrar sesión después de agregar el grupo.
- Copiar YAML de un tutorial viejo con `platform: ESP32` dentro de `esphome:` (formato antiguo) o con `api: password:`.
- Escoger GPIO12 o GPIO0 para un sensor y luego "el ESP no arranca".
- Probar con cable de solo carga y concluir que la placa está dañada.
- Declarar "listo" sin ver en `esphome logs` que el sensor publica valores y que Home Assistant muestra el dato.

## Al terminar

Dile al usuario: (1) nombre del dispositivo y dónde verlo en Home Assistant, (2) que el valor debe cambiar si sopla al sensor/abre la puerta, (3) cómo ver logs (Device Builder > LOGS).

## Verifica antes de confiar

Antes de escribir un componente, abre su página en esphome.io con WebFetch (o Context7 si está instalado) y confirma opciones y plataforma. Para pines, usa el pinout del fabricante de esa placa exacta.

## Fuentes (verificado nov 2026)

- https://esphome.io/guides/getting_started_hassio/ · https://esphome.io/guides/getting_started_command_line/
- https://esphome.io/guides/installing_esphome/ (pip bloqueado, `esphome-desktop-bin`, `--net=host`, puerto 6052)
- https://esphome.io/guides/physical_device_connection/ (cable de datos, drivers CH34x/CP2102, GPIO0 a GND)
- https://esphome.io/components/esp32/ (ESP-IDF por defecto)
- https://esphome.io/components/api/ (llave de cifrado de 32 bytes en base64)
- https://archlinux.org/packages/extra/any/esphome/ · https://aur.archlinux.org/packages/esphome-desktop-bin
- https://gitlab.archlinux.org/archlinux/packaging/packages/systemd/-/blob/main/PKGBUILD (Arch reemplaza dialout por uucp)
