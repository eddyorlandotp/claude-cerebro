---
name: homelab-y-red
description: Home lab y red de casa - IP fija o reserva DHCP, abrir puertos y firewall (ufw), CGNAT y alternativas (Tailscale, Cloudflare Tunnel, playit.gg), SSH seguro, VLAN, mini-PC como servidor (Proxmox o Linux simple), consumo eléctrico. Keywords homelab, port forwarding, router, switch, servidor casero.
---

# Home lab y red de casa

El usuario arma un home lab chico: módem del ISP (p. ej. Telmex por fibra), router propio, switch, nodos mesh, una mini-PC (laptop sin pantalla) como servidor y quizá un rack. Prioriza **estabilidad y poco mantenimiento**. Él no administra redes de oficio: cada cambio en el router o firewall explícalo en 1–2 frases y dile cómo deshacerlo.

## 0. Antes de proponer nada: mapa real de la red

En la máquina donde estés (pregunta cuál es si no es obvio y corre `cat /etc/os-release`):

```bash
ip -4 -br addr           # IP y subred de cada interfaz
ip route | grep default  # gateway (quién es el router)
resolvectl status 2>/dev/null | grep -i 'dns servers' || cat /etc/resolv.conf
```

Con eso deduce:
- **Doble NAT**: si hay módem del ISP + router propio, normalmente hay dos subredes (p. ej. la del módem y la del router). Un puerto abierto solo en el router propio **no llega desde internet**. Opciones: router propio en la DMZ del módem (o modo bridge si el ISP lo permite), o reenviar el puerto en ambos equipos.
- **CGNAT** (ver sección 3).

Nunca inventes la subred (`192.168.1.0/24`); usa la que salió.

## 1. IP fija para servidores

- **Preferido: reserva DHCP en el router** (asociar la MAC a una IP). La máquina sigue en DHCP, no hay nada que romper en Linux. MAC: `ip -br link`.
- Elige IPs fuera del rango que el router reparte automáticamente si el router lo permite.
- Solo si el router no permite reservas: IP estática con NetworkManager (`nmcli connection modify "<conexión>" ipv4.method manual ipv4.addresses IP/24 ipv4.gateway GW ipv4.dns "GW"` y `nmcli connection up "<conexión>"`). Comprueba primero que use NetworkManager: `systemctl is-active NetworkManager`. Antes de aplicarlo en una máquina remota, avisa: si te equivocas pierdes el acceso por SSH.
- Equipos por Ethernet para servidores; Wi-Fi solo si no hay de otra.

## 2. Puertos y firewall

- CachyOS trae **ufw activado por defecto** (entra todo bloqueado, sale todo permitido). Verifica siempre: `sudo ufw status verbose`. En otra distro revisa `systemctl is-active ufw firewalld`.
- Abre lo mínimo, con comentario y, si se puede, solo para la LAN:

```bash
sudo ufw allow from 192.168.X.0/24 to any port 22 proto tcp comment 'ssh solo LAN'
sudo ufw allow 19132/tcp comment 'minecraft bedrock'
sudo ufw status numbered      # para borrar: sudo ufw delete NUM
```

- **Docker se salta ufw** para puertos publicados. Un `ports: "8080:8080"` queda abierto a toda la red aunque ufw no lo permita. Si solo lo usa la propia máquina o un túnel, publica en `127.0.0.1:8080:8080`.
- Para que algo se vea **desde internet** hacen falta las tres cosas: firewall de la máquina, reenvío de puerto (port forwarding) en el router (y el módem si hay doble NAT), y que no haya CGNAT.
- Comprueba desde **fuera** de tu red (datos del celular), no desde la misma LAN.
- Qué está escuchando: `sudo ss -tulpn`.

## 3. CGNAT: cómo detectarlo y qué usar

Detectar: compara la IP WAN que muestra el módem/router con `curl -s https://api.ipify.org`. Si son distintas, o la WAN está en `100.64.0.0/10`, hay CGNAT y **ningún port forwarding va a funcionar**. Se puede pedir IP pública al ISP, pero no lo prometas: depende del ISP y del plan.

Alternativas (elige por caso, no por moda):

| Caso | Herramienta | Por qué |
|---|---|---|
| Administrar el servidor desde fuera (SSH, paneles) | **Tailscale** | VPN mesh: tus dispositivos se ven como en la LAN; no abre nada a internet. Arch: `sudo pacman -Syu tailscale`, `sudo systemctl enable --now tailscaled`, `sudo tailscale up` |
| Amigos con PC/celular entrando a un servicio | Tailscale (los invitas a tu tailnet o compartes el nodo) | funciona TCP y UDP; límites del plan gratis: verifícalos en tailscale.com/pricing |
| Sitio web / API HTTP pública | **Cloudflare Tunnel** (`cloudflared`) | HTTP/HTTPS sin abrir puertos. Para TCP no-HTTP el visitante necesita `cloudflared` en su equipo; **no sirve para UDP ni para juegos** |
| Servidor de juego para gente sin VPN (consolas, amigos casuales) | **playit.gg** u otro túnel de juegos | ver advertencia de Minecraft Bedrock en la skill `minecraft-bedrock-servidor`: desde oct 2026 Bedrock usa TCP + UDP y hay reportes de fallas por túnel |

Para Workers/Tunnel de Cloudflare a detalle usa el plugin `cloudflare`.

## 4. SSH sin sustos

- **Nunca** reenvíes el puerto 22 a internet. Usa Tailscale para entrar de fuera.
- Llaves, no contraseñas: en tu PC `ssh-keygen -t ed25519`, luego `ssh-copy-id usuario@IP`. Prueba que entras con llave **antes** de desactivar contraseñas.
- Desactiva contraseñas con un drop-in: `/etc/ssh/sshd_config.d/20-solo-llaves.conf` con `PasswordAuthentication no` y `PermitRootLogin no`. Valida con `sudo sshd -t` antes de `sudo systemctl restart sshd`. En Debian/Ubuntu el servicio se llama `ssh`.
- Deja una sesión SSH abierta mientras pruebas la nueva config, por si te quedas fuera.
- La llave privada nunca se copia al servidor ni a git (ver skill `respaldos` para guardarla).

## 5. Segmentación / VLAN (básico)

- Una VLAN real requiere **switch administrable (802.1Q) y router que entienda VLANs**. Con switch no administrable no hay VLANs; lo que hay es "modo VLAN/aislamiento de puertos" que impide que los equipos se vean entre sí (útil para cámaras, malo para un home lab: si lo activas por error, la PC deja de ver al servidor).
- Empieza simple: red de invitados del router para focos/enchufes inteligentes y dispositivos IoT; servidor y PC en la red principal.
- No propongas VLANs hasta que el usuario tenga el hardware y una necesidad concreta.

## 6. Mini-PC como servidor

| Opción | Cuándo | Costo de mantenimiento |
|---|---|---|
| **Linux simple + Docker compose** (recomendado) | 1–5 servicios (Minecraft, Jellyfin, domótica, respaldos) | Bajo. Para un servidor que debe "no tocarse", una distro estable (Debian stable o Ubuntu Server LTS) pide menos atención que una rolling como Arch |
| **Proxmox VE** | quieres varias VMs aisladas, probar sistemas, snapshots de VMs | Medio/alto. Borra el disco, ocupa la máquina completa, requiere CPU con VT-x/AMD-V y RAM para el host más cada VM |

- Si el servidor es Debian/Ubuntu, **ahí sí** se usa `apt`. Detecta la distro de la máquina en la que trabajas antes de dar comandos; no mezcles con la PC principal (CachyOS).
- Laptop como servidor: que no se suspenda al cerrar la tapa: drop-in en `/etc/systemd/logind.conf.d/` con `HandleLidSwitch=ignore` y `HandleLidSwitchExternalPower=ignore`, luego reinicia (o `sudo systemctl restart systemd-logind`, que cierra la sesión gráfica). Mantén la batería conectada y, si el fabricante lo permite, limita la carga.
- En BIOS busca "Restore on AC power loss" / "Power on after power failure" para que prenda solo tras un apagón (muchas laptops no lo tienen; dilo si no aparece).
- Servicios 24/7 en la mini-PC: skill `servicios-24-7`. Respaldos: skill `respaldos`.

## 7. Consumo eléctrico

- No inventes watts. Mide con un medidor de enchufe (wattmetro) en reposo y con carga.
- Cálculo: `kWh al mes = watts × 24 × 30 / 1000`. Multiplica por la tarifa de su recibo de luz; no supongas tarifa.
- Lo que más ahorra: una sola máquina 24/7 (no la PC gamer), discos que duerman si no se usan, apagar lo que no se usa.

## 8. Errores típicos

- Dar pasos de router genéricos como si fueran exactos: cada modelo cambia; pide captura o el modelo y busca su manual.
- Abrir puertos sin revisar CGNAT o doble NAT y luego "debuggear" el servidor.
- Probar acceso externo desde la misma red.
- Desactivar ufw "para que funcione" en vez de agregar la regla correcta.
- Publicar paneles de administración (Proxmox, router, Portainer) a internet.

## Verifica antes de confiar

Precios, límites gratis y funciones de Tailscale, Cloudflare y playit cambian. Antes de recomendarlos con números, haz WebFetch a su doc/pricing oficial. Para comandos de una distro distinta, verifica en su wiki.

## Fuentes (verificado nov 2026)

- https://wiki.cachyos.org/configuration/post_install_setup/ (ufw activado por defecto)
- https://wiki.archlinux.org/title/Uncomplicated_Firewall · https://wiki.archlinux.org/title/OpenSSH · https://wiki.archlinux.org/title/NetworkManager · https://wiki.archlinux.org/title/Power_management
- https://wiki.archlinux.org/title/Tailscale
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/protocols/ (tipos de servicio; no-HTTP requiere cloudflared en el cliente)
- https://docs.docker.com/engine/network/packet-filtering-firewalls/ (Docker y ufw)
- https://www.proxmox.com/en/products/proxmox-virtual-environment/requirements
- https://datatracker.ietf.org/doc/html/rfc6598 (100.64.0.0/10, espacio de CGNAT)
