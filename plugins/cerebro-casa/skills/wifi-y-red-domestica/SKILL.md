---
name: wifi-y-red-domestica
description: Wi-Fi de la casa - routers extra en modo AP vs router (doble NAT), mesh, bandas y canales 2.4/5/6 GHz, Wi-Fi 7 MLO, ubicación, red para IoT, DNS con filtro (AdGuard Home, Pi-hole) y diagnosticar lentitud (iperf3, ping, mtr).
---

# Wi-Fi y red de la casa

Esta skill es para **la cobertura y el Wi-Fi de una casa de varios pisos**. Puertos, firewall, CGNAT, IP fija, SSH y VLAN los cubre `homelab-y-red` (cerebro-linux): úsala para eso. Errores que corrige: suponer que "Wi-Fi 7" trae 6 GHz y 320 MHz, dejar routers secundarios en modo router (triple NAT), cambiar canales a ciegas, emparejar focos en 5 GHz y "medir" el Wi-Fi solo con un speedtest.

El usuario no es técnico de redes: antes de cada cambio en un router, di en 1–2 frases qué cambia, qué se puede caer un momento y cómo regresar.

## 0. Mapa real antes de opinar

- Pide **modelo exacto** de cada equipo y, si hace falta, captura de su panel. No inventes menús: cada marca los cambia.
- Desde una laptop Linux conectada a cada Wi-Fi:
  ```bash
  ip route | grep default                         # quién es la puerta de enlace en esta red
  nmcli -f IN-USE,SSID,BSSID,CHAN,SIGNAL,RATE dev wifi list
  iw dev                                           # nombre de la interfaz (wlan0, wlp2s0...)
  iw dev <interfaz> link                           # señal en dBm y velocidad real del enlace
  ```
- **Equipos típicos de este usuario** (confírmalos, pueden cambiar):
  - Router Steren **COM-BE3600**: Wi-Fi 7 **de doble banda (2.4 + 5 GHz), sin 6 GHz**, 3 puertos RJ-45 según el distribuidor.
  - Xiaomi **Mesh System AX3000 NE**: **Wi-Fi 6** doble banda (2.4 + 5 GHz), 4 puertos Gigabit WAN/LAN autodetectables, mesh **por cable, inalámbrico o híbrido**, configuración con la app **Xiaomi Home / Mi Home** (hasta 10 routers en la malla).
  - Módem del ISP (p. ej. Telmex) delante de todo: la doble NAT módem ↔ router se trata en `homelab-y-red`.

## 1. Routers secundarios: modo AP, no router

Regla: **una sola** caja hace router (NAT + DHCP). Las demás solo dan Wi-Fi.

| Modo del equipo extra | Qué pasa | Úsalo |
|---|---|---|
| **Router** (por defecto en muchos) | Crea otra subred y otra NAT: los aparatos conectados a él no se ven bien con los de la red principal (Home Assistant no encuentra focos, el celular no ve la TV ni Jellyfin) | Casi nunca |
| **Punto de acceso (AP) / modo cableado / "relé por cable"** | Mismo DHCP y misma subred que el router principal; solo extiende el Wi-Fi | **Sí**, conectado por cable al switch |
| **Repetidor inalámbrico** | Sin cable; cada salto pierde velocidad | Solo si no hay forma de llevar cable |

- **Cómo detectar la doble NAT interna**: conecta el celular o la laptop al Wi-Fi del equipo secundario y revisa la puerta de enlace (`ip route`). Si la subred es distinta a la del router principal, ese equipo está en modo router. Con `mtr` o `traceroute` verías **dos saltos privados** (192.168.x / 10.x) antes de internet.
- **Mesh entre marcas distintas**: no supongas que un Steren y un Xiaomi hacen malla entre sí. Sin compatibilidad documentada en ambos manuales, trátalos como **APs separados**. Los Xiaomi sí forman malla entre ellos; si están cableados al switch, usa su **mesh por cable** (backhaul cableado).
- **Mismo nombre y contraseña en todos los APs** permite moverse por la casa sin reconfigurar el celular, pero el **celular decide** cuándo cambiar de AP: si se "pega" a uno lejano, apaga y prende el Wi-Fi del celular para probar. Nombres distintos por piso es más manual pero más predecible; deja que el usuario elija.
- Antes de cambiar el modo de un equipo: anota su configuración actual (o captura) y ten a la mano cómo resetearlo de fábrica.

## 2. Bandas, canales y Wi-Fi 7

| Banda | Para qué | Reglas |
|---|---|---|
| **2.4 GHz** | Alcance y paredes; focos, enchufes y sensores (Tuya casi siempre **solo** 2.4 GHz) | Canales **1, 6 u 11** únicamente; ancho de **20 MHz** |
| **5 GHz** | Velocidad cerca del AP (TV, celulares, laptops) | 80 MHz suele ser buen equilibrio. Si hay cortes cada cierto tiempo, prueba canales no-DFS (los DFS pueden apagarse si detectan radar) |
| **6 GHz** | Wi-Fi 6E/7 con poca interferencia, poco alcance | **Los equipos de este usuario no tienen 6 GHz.** En México solo 5925–6425 MHz es de uso libre (IFT, 2023) |

- **Wi-Fi 7 MLO** (Multi-Link Operation) usa varias bandas a la vez para un mismo dispositivo: solo sirve si **el cliente también es Wi-Fi 7**. En un router de doble banda, MLO combina 2.4 + 5 GHz. Los canales de 320 MHz son solo de 6 GHz: no aplican aquí.
- Si equipos viejos se desconectan después de activar MLO/Wi-Fi 7, prueba desactivar MLO o crear una red aparte sin esas funciones (si el router lo permite) y compara.
- **Elegir canal con datos**: `nmcli -f SSID,CHAN,SIGNAL dev wifi list` desde cada piso (o una app de análisis Wi-Fi en Android). Los APs de la **misma casa** deben ir en canales distintos que no se encimen. No cambies canales "por si acaso".
- El plan de internet pone el techo: si es de 100 Mbps, ningún router lo hará más rápido hacia internet. Un mejor Wi-Fi sí mejora la red **dentro** de la casa (Jellyfin, copiar archivos).

## 3. Ubicación

- AP **alto, al centro de la zona** que debe cubrir, fuera de muebles metálicos y lejos de microondas, espejos, peceras y del módem/otros routers pegados.
- Las **losas y muros de concreto o block** frenan mucho la señal: para otro piso, lo mejor es **un AP por piso conectado por cable**, no un repetidor inalámbrico.
- Si el nodo tiene que ser inalámbrico, ponlo **a medio camino** (donde todavía llega buena señal del principal), no dentro de la zona muerta.
- Mide antes y después de mover: señal con `iw dev <interfaz> link` (más cerca de 0 dBm es mejor; por debajo de ~-70 dBm espera problemas) y prueba de velocidad interna (sección 6).

## 4. Red para dispositivos IoT

- Opción simple: **red de invitados o SSID aparte de 2.4 GHz** para focos/enchufes, si el router lo tiene.
- **Trampa**: las redes de invitados suelen **aislar clientes**. Si usas control **local** (Tuya Local, ESPHome, Chromecast, Matter), Home Assistant debe poder hablar con esos aparatos: el descubrimiento por broadcast/mDNS **no cruza subredes**. En ese caso, déjalos en la red principal o haz VLAN con reglas (requiere hardware compatible; ver `homelab-y-red`).
- Con la integración Tuya **de nube**, la red de invitados no estorba.
- Para emparejar aparatos Tuya: si la red tiene 2.4 y 5 GHz con el mismo nombre y falla, separa temporalmente las bandas o usa la red de 2.4 GHz. Detalles en `home-assistant`.

## 5. DNS con filtro (anuncios, rastreadores, control parental)

| | AdGuard Home | Pi-hole v6 |
|---|---|---|
| Instalar | Arch: `sudo pacman -S adguardhome` (`adguardhome.service`). Docker: `adguard/adguardhome` | Docker: `pihole/pihole`; contraseña con `FTLCONF_webserver_api_password` |
| Puertos | 53 TCP/UDP, 3000 (asistente inicial), 80 (panel) | 53 TCP/UDP, 80/443 (panel) |

1. Necesita **IP fija** (reserva DHCP: `homelab-y-red`).
2. Si el host usa `systemd-resolved`, el puerto 53 ya está ocupado (127.0.0.53). Solución de la doc de AdGuard: drop-in en `/etc/systemd/resolved.conf.d/` con `[Resolve]`, `DNS=127.0.0.1` y `DNSStubListener=no`; luego `/etc/resolv.conf` como enlace a `/run/systemd/resolve/resolv.conf` (respalda el original) y reinicia `systemd-resolved`. Explica el cambio antes de hacerlo.
3. **Prueba con un solo equipo** antes de cambiar el router: `dig @IP-DEL-SERVIDOR google.com` (en Arch `dig` viene en el paquete `bind`), luego pon ese DNS a mano en la PC un día.
4. Solo después cambia el DNS que reparte el **DHCP del router**.
5. Riesgo: si el servidor se apaga, **toda la casa se queda sin internet** (no resuelve nombres). Ten un plan B escrito: volver a poner el DNS del ISP en el router. Un DNS secundario público evita el apagón pero se salta el filtro: explícale el trueque y que él decida.
6. Si algo de la casa deja de funcionar (app del banco, tele), revisa el registro de consultas y agrega a lista blanca; no apagues todo el filtro.

## 6. "El internet está lento": diagnóstico ordenado

Separa **internet** vs **Wi-Fi** vs **el dispositivo**. Cambia **una cosa a la vez** y anota resultados en una tabla (lugar, banda, señal, velocidad).

1. **Internet**: prueba de velocidad en la PC **por cable**. Si por cable ya está bajo comparado con el plan, el problema es el ISP/módem, no el Wi-Fi.
2. **Wi-Fi interno** con `iperf3` (Arch: `sudo pacman -S iperf3`):
   ```bash
   iperf3 -s                         # en un equipo por cable (mini-PC o PC)
   iperf3 -c IP-SERVIDOR -t 20       # desde la laptop por Wi-Fi: subida
   iperf3 -c IP-SERVIDOR -t 20 -R    # bajada (servidor -> cliente)
   iperf3 -c IP-SERVIDOR -t 20 -P 4  # 4 flujos en paralelo
   ```
   Repite en cada cuarto problemático. Si el servidor tiene `ufw`, abre el 5201/tcp solo para la LAN mientras pruebas (ver `homelab-y-red`) y ciérralo al terminar.
3. **Latencia y pérdida**:
   ```bash
   ping -c 50 IP-DEL-ROUTER          # pérdida o picos aquí = problema de Wi-Fi/local
   mtr -rwc 100 1.1.1.1              # reporte por salto (Arch: paquete mtr)
   ```
   Pérdida en el **primer salto** = Wi-Fi o red local. Pérdida en un salto intermedio que **no** llega al destino final suele ser que ese router limita ICMP: no es falla.
4. **Señal** en el punto: `iw dev <interfaz> link`. Señal mala → ubicación o AP extra (secciones 1 y 3), no "otro router más caro".
5. Si solo un dispositivo va lento: olvidar la red y reconectar, actualizar, revisar que use 5 GHz cerca del AP.

## 7. Errores típicos

- Prometer funciones de Wi-Fi 7 (6 GHz, 320 MHz) en un router de doble banda.
- Conectar un router secundario por su puerto WAN en modo router y crear doble/triple NAT.
- Mover varios ajustes a la vez y no saber cuál arregló o rompió algo.
- Meter Home Assistant o los APs en la red de invitados.
- Apuntar el DHCP de toda la casa a un DNS que nunca se probó.
- Medir el Wi-Fi solo con un speedtest a internet.

## Verifica antes de confiar

Las especificaciones y menús de cada router cambian por versión de firmware y región. Antes de afirmar qué modo o función tiene un equipo, busca su ficha o manual oficial (WebFetch) o pide captura. Para comandos de Linux, confirma el paquete en archlinux.org/packages.

## Fuentes (verificado nov 2026)

- https://www.mi.com/mx/product/xiaomi-mesh-system-ax3000-ne/ y /specs/ (Wi-Fi 6, 4 puertos Gigabit, mesh cableado/inalámbrico/híbrido)
- https://manualslib.mx/manual/908513/Xiaomi-Ax3000-Ne.html (manual: mesh por cable de red)
- https://www.cyberpuerta.mx/Computo-Hardware/Redes/Router/Steren-Router-COM-BE3600-MU-MIMO-Wi-Fi-7-3-x-RJ-45-2882-Mbit-s-WLAN-Alambrico-Inalambrico-Doble-Banda-2-4-5-GHz-4-Antenas-Externas-de-6-8-dBi.html (Steren COM-BE3600 doble banda)
- https://www.wi-fi.org/discover-wi-fi/wi-fi-certified-7 (MLO, 320 MHz en 6 GHz)
- https://www.eluniversal.com.mx/cartera/libera-ift-banda-de-espectro-para-wifi7/ · https://dplnews.com/?p=182814 (5925–6425 MHz uso libre en México)
- https://support.tuya.com/en/help/_detail/K9hut2v0htbez (Tuya solo 2.4 GHz)
- https://privatehomelab.com/tuya-devices-iot-vlan-localtuya-cross-subnet-explained/ (descubrimiento no cruza subredes)
- https://github.com/AdguardTeam/AdGuardHome/wiki/Docker (puertos, conflicto con systemd-resolved)
- https://docs.pi-hole.net/docker/
- https://archlinux.org/packages/ (iperf3, mtr, adguardhome, bind, iw)
- https://man.archlinux.org/man/iperf3.1 · https://man.archlinux.org/man/mtr.8
