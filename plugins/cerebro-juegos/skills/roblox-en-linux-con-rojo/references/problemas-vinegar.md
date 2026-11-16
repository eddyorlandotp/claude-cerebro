# Problemas de Roblox Studio con Vinegar (Linux)

Resumen de https://vinegarhq.org/Vinegar/Troubleshooting.html (nov 2026). Si el problema no está aquí, haz WebFetch a esa página antes de inventar soluciones. Tú no ves Studio: pide al usuario captura o el texto del error.

| Síntoma | Qué decirle al usuario |
|---|---|
| No abre la configuración de Vinegar | Clic derecho en el ícono de Vinegar o buscar "Manage" en el lanzador. Terminal: `flatpak run org.vinegarhq.Vinegar manage` |
| Studio se cierra al abrir tras actualizar Vinegar desde versión vieja (<1.9.1) | Borrar los datos del prefijo desde el menú de tres puntos en la configuración de Vinegar (respaldar antes los ajustes de Studio) |
| No se pueden acoplar paneles | Activar Virtual Desktops en la configuración de Vinegar |
| El cursor no se bloquea al mover la cámara | Problema de XWayland. Usar Kombucha (Wine por defecto de Vinegar) o sesión X11 |
| Error de salida 53 | Instalación de Studio corrupta: limpiar caché y reinstalar Studio desde el menú de Vinegar |
| No aparecen archivos en el diálogo de importar/exportar | `flatpak --user override --filesystem=home org.vinegarhq.Vinegar`; en el explorador expandir `/` y luego `home` |
| No puede iniciar sesión | Desactivar "Web Pages" en Vinegar para usar login por navegador (requiere XDG Desktop Portals; Hyprland usa `xdg-desktop-portal-hyprland`) |
| UI muy pequeña | Advanced Wine Settings → pestaña Graphics → subir DPI |
| "GPU incompatible" con Nvidia | Revisar `nvidia-smi`; si es Flatpak, `flatpak update` para igualar driver del host |
| Nvidia híbrida (laptop) no arranca | `flatpak --user override --nosocket=wayland org.vinegarhq.Vinegar` o instalar Vinegar no-Flatpak |
| "Failed to fetch place info" | Cerrar sesión y volver a entrar en Studio |

Requisitos mínimos según Vinegar: CPU x86-64, 3 GB RAM, OpenGL 4.4. Recomendado: kernel 6.14+ (NTSync), 8 GB RAM, Vulkan 1.4.

## Rojo y Studio bajo Wine

- `rojo serve` corre nativo en Linux; el plugin dentro de Studio (Wine) se conecta a `localhost:34872`. Si no conecta: confirmar que `rojo serve` sigue corriendo, que el puerto coincide en el plugin, y que la versión mayor del plugin es la misma que la del servidor (`rojo plugin install` la reinstala).
- Desde Rojo 7.7 el plugin usa websockets. Si una actualización rompe la conexión bajo Wine, prueba la versión anterior fijándola en `rokit.toml` y reinstalando el plugin.
