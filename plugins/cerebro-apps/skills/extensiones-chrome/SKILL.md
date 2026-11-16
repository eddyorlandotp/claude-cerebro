---
name: extensiones-chrome
description: Extensiones de Chrome Manifest V3 - service worker que se apaga, content scripts, permisos mínimos, storage, sin código remoto y revisión en Chrome Web Store. Usar con extensión de Chrome, manifest.json, content script.
---

# Extensiones de Chrome (Manifest V3)

El error que corrige: Claude escribe extensiones como si el background fuera una página que vive siempre (variables globales, `setInterval`), pide `<all_urls>` "por si acaso", carga librerías desde un CDN y luego la Chrome Web Store la rechaza. Caso típico del usuario: herramientas para su terminal de trading (overlay sobre una página de tokens, atajos, alertas).

## Reglas

1. **Verifica antes de confiar.** Antes de usar una API `chrome.*`/`browser.*`, confirma firma y permisos en developer.chrome.com/docs/extensions/reference (WebFetch) o con Context7 si está instalado. No inventes nombres de permisos.
2. **Explica en 1–3 frases** qué permisos pide y por qué ("Pide acceso solo a dexscreener.com porque ahí dibuja el botón; no puede leer tus otras pestañas").
3. **Permisos mínimos siempre** (es política de la tienda, no solo buena práctica).
4. **Todo el código va dentro del paquete.** Nada de `<script src="https://...">`, `eval`, `new Function` ni descargar JS para ejecutarlo.
5. **Dinero real:** la extensión nunca pide, lee ni guarda seed phrases o llaves privadas, no se inyecta en páginas de billeteras y no firma ni envía transacciones por su cuenta. Si interactúa con una dApp, el usuario confirma en su billetera.

## Estructura mínima

```
mi-extension/
  manifest.json        ("manifest_version": 3)
  background.js        (service worker: "background": {"service_worker": "background.js", "type": "module"})
  content.js           (corre dentro de las páginas permitidas)
  popup.html / popup.js
  icons/16.png 48.png 128.png
```

Desde Chrome 148 todas las APIs existen también como `browser.*` además de `chrome.*` (equivalentes). Usa una sola forma en todo el proyecto; si el usuario tiene Chrome viejo, `chrome.*`.

## El service worker se apaga (a nov 2026)

Chrome termina el service worker de la extensión:
- tras **30 s sin actividad** (cada evento o llamada a una API de extensión reinicia el contador),
- si un solo evento o llamada tarda **más de 5 min**,
- si un `fetch()` tarda **más de 30 s** en responder.

Consecuencias que debes aplicar:
- **Nada de estado en variables globales**: se pierde. Guarda en `chrome.storage.session` (memoria, se borra al reiniciar el navegador) o `chrome.storage.local`.
- Registra los listeners **en el nivel superior** del archivo, de forma síncrona, no dentro de promesas.
- Para tareas periódicas usa `chrome.alarms` (mínimo 30 s), no `setInterval`.
- Un WebSocket activo en el service worker lo mantiene vivo mientras haya mensajes (Chrome 116+), pero diseña para reconectar: puede morir igual.
- Para algo que deba correr 24/7 (vigilar billeteras, bot), **no uses una extensión**: va en un servidor o Worker (skills `servicios-24-7`, `cloudflare-gratis-decisiones`). La extensión solo muestra.

## Content scripts

- Corren en un "mundo aislado": comparten el DOM con la página, no sus variables JS.
- Trata todo lo que lees de la página como **no confiable**: no lo metas en `innerHTML`; usa `textContent`.
- Para pedir datos a una API, manda un mensaje al service worker (`chrome.runtime.sendMessage`) y que él haga el `fetch` con sus `host_permissions`.
- Limita `matches` a los dominios exactos (`https://dexscreener.com/*`), no `<all_urls>`.

## Permisos: cuál elegir

| Necesito... | Usa | Evita |
|---|---|---|
| Actuar en la pestaña actual cuando el usuario hace clic | `activeTab` (+ `scripting`) | `tabs` + `<all_urls>` |
| Funcionar siempre en 1–3 sitios | `host_permissions` con esos dominios | `<all_urls>` |
| Función opcional en más sitios | `optional_host_permissions` y pedirlo con `chrome.permissions.request` al usarla | Pedirlo al instalar |
| Guardar configuración | `storage` | `localStorage` |

Muchos permisos muestran advertencias al instalar y alargan la revisión. La política dice: pide el más estrecho y no "a futuro".

## Almacenamiento (a nov 2026)

| Área | Límite | Notas |
|---|---|---|
| `storage.local` | 10 MB (más con `unlimitedStorage`) | Se borra al desinstalar. Visible a content scripts por defecto (cámbialo con `setAccessLevel`) |
| `storage.session` | 10 MB, en memoria | Se borra al recargar/actualizar la extensión o reiniciar el navegador. **No** visible a content scripts por defecto: úsalo para datos sensibles de sesión |
| `storage.sync` | ~100 KB total, 8 KB por elemento | Para preferencias del usuario entre computadoras |

No uses `localStorage`: en content scripts es el de la página (la página lo puede leer).

## Código remoto: lo que causa rechazo

- Prohibido: scripts remotos, `eval`, ejecutar texto descargado. Aplica también a dependencias (p. ej. SDKs que cargan código de su CDN).
- Permitido: descargar **datos** (JSON, CSS) y usarlos.
- Ofuscar está prohibido; minificar está permitido.
- Si te rechazan con código "Blue Argon", es por código remoto: busca en el bundle `eval`, `new Function`, `import("https://`, `<script src=`.
- Afiliados: inyectar códigos de referido o links de afiliado sin acción del usuario y sin beneficio claro **viola la política**. No "agregues tu ref" a URLs de exchanges/terminales en silencio.

## Probar en Linux

1. `chrome://extensions` > Modo de desarrollador > **Cargar descomprimida** > carpeta del proyecto.
2. Tras cada cambio: botón de recargar en la tarjeta de la extensión y recargar la pestaña.
3. Logs del service worker: enlace "service worker" en la tarjeta (abre DevTools). Logs del content script: DevTools de la página.
4. Prueba que sobrevive: espera 1 min sin tocar nada, luego usa la función (el SW se habrá dormido y debe despertar bien).

## Publicar en Chrome Web Store

- Registro de desarrollador con **pago único** (la doc no publica el monto; la pantalla de registro lo muestra — confírmalo ahí). El correo de desarrollador **no se puede cambiar** después.
- Llena el campo **"single purpose"** con un propósito claro y único.
- Si maneja **cualquier** dato de usuario: política de privacidad publicada y declaraciones de uso limitado.
- Sube un `.zip` del contenido de la carpeta (con `manifest.json` en la raíz).
- Revisión: normalmente unos días, puede tardar semanas. Se alarga con permisos amplios, desarrolladores/extensiones nuevos y cambios grandes. Si pasa de 3 semanas, contacta soporte.

## Al terminar

Dile al usuario: qué permisos pide y por qué, cómo cargarla él mismo (pasos de "Probar en Linux"), y qué revisar en el dashboard de la tienda (estado de revisión y motivo si la rechazan).

## Fuentes (verificado nov 2026)

- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace (Chrome 148)
- https://developer.chrome.com/docs/webstore/register
- https://developer.chrome.com/docs/webstore/review-process
- https://developer.chrome.com/docs/webstore/program-policies/policies (permisos mínimos, privacidad, afiliados)
