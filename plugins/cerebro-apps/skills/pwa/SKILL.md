---
name: pwa
description: Decidir si una PWA basta en vez de app nativa y hacerla bien - manifest, service worker, instalar en iPhone y Android, push web en iOS, offline y caché sin datos viejos. Usar con PWA, app instalable, agregar a inicio, manifest, service worker.
---

# PWA: la "app" que muchas veces basta

El error que corrige: Claude salta a React Native/Expo (y a pagar tiendas) cuando una web instalable resolvía el problema, o al revés, promete en iPhone cosas que una PWA no hace (prompt de instalación, push sin instalar). También: service workers que sirven precios viejos desde caché.

## Reglas

1. **Verifica antes de confiar.** Safari cambia en cada versión de iOS. Antes de prometer una capacidad en iPhone, confírmala en webkit.org/blog o en la tabla de compatibilidad de MDN (WebFetch) o con Context7 si está instalado.
2. **Explica la decisión en 1–3 frases** ("Lo hago como PWA: se instala desde Safari, no pagas los 99 USD de Apple y no pasa por revisión. Lo único que pierdes es X").
3. **Prueba en el iPhone real** del usuario antes de decir "funciona en iOS". El emulador de Chrome no es Safari.

## ¿PWA o app nativa?

| Si la app necesita... | PWA | Nativa (Expo) |
|---|---|---|
| Mostrar datos, dashboards, catálogo, formularios, panel de trading | **Sí** | Exceso |
| Que el usuario la "instale" con ícono en inicio | Sí (Android con prompt; iPhone manual desde Compartir) | Sí |
| Notificaciones push | Android: sí. iPhone: **solo si la agregó a inicio** (iOS 16.4+) | Sí |
| Aparecer en App Store / Play Store | No | Sí |
| Evitar revisión de tiendas, cuotas y comisiones | **Sí** | No |
| Producto cripto/trading (tiendas lo revisan con lupa) | **Recomendado** | Riesgo alto de rechazo (ver `publicar-en-tiendas`) |
| Bluetooth, NFC, widgets, Face ID nativo, trabajo pesado en segundo plano | No / limitado | Sí |

Regla práctica: **empieza con PWA**; pasa a nativa solo si aparece una necesidad de la columna derecha que el usuario confirme.

## Instalación: lo que pasa de verdad (a nov 2026)

**Android / Chrome de escritorio** — Chrome ofrece instalar si:
- HTTPS, y el usuario tocó la página al menos una vez y la vio 30 s o más.
- Manifest con `name` o `short_name`, `icons` de **192 px y 512 px**, `start_url`, `display` en `standalone`, `fullscreen`, `minimal-ui` o `window-controls-overlay`, y sin `prefer_related_applications: true`.
- El evento `beforeinstallprompt` (para tu propio botón "Instalar") **solo existe en Chromium**. Safari y Firefox no lo tienen: el botón debe aparecer solo si el evento llega.

**iPhone (Safari)**:
- **No hay prompt automático.** El usuario usa Compartir > Agregar a inicio. Muestra una instrucción visual para iPhone (detecta iOS y que no está ya en modo standalone).
- Desde **iOS 26**, todo sitio agregado a inicio abre como web app por defecto (el usuario puede desactivar "Abrir como app web"); ya no se exige manifest para eso, pero si existe se usan sus íconos. Antes de iOS 26 hacía falta `display: standalone` o `fullscreen`.
- Desde iOS 16.4 los navegadores de terceros que lo implementen también pueden ofrecer "Agregar a inicio" desde Compartir.

## Push web en iPhone

- Solo para web apps **agregadas a inicio** (iOS/iPadOS 16.4+). En Safari normal no hay push.
- El permiso se pide **solo como respuesta a un toque** del usuario (botón "Activar alertas"). Pedirlo al cargar falla.
- Badging (`navigator.setAppBadge`) funciona tras aceptar notificaciones.
- Flujo para el usuario: 1) agregar a inicio, 2) abrir desde el ícono, 3) tocar "Activar alertas". Escríbelo en la UI.
- El servidor que envía las push (con llaves VAPID) vive en tu backend (p. ej. un Worker); la llave privada VAPID es secreto (skill `secretos-y-llaves`).

## Manifest mínimo

```json
{
  "name": "Nombre completo",
  "short_name": "Corto",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0b0b0f",
  "theme_color": "#0b0b0f",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Enlázalo con `<link rel="manifest" href="/manifest.webmanifest">` y agrega `<link rel="apple-touch-icon" href="/icons/180.png">` como respaldo de ícono para iPhone.

## Service worker sin sorpresas

Decide la estrategia **por tipo de recurso** y escríbela en un comentario arriba del archivo:

| Recurso | Estrategia |
|---|---|
| HTML, JS, CSS, íconos versionados | Precache al instalar; cache-first |
| Imágenes de usuario / logos de tokens | Stale-while-revalidate con límite de entradas |
| **APIs con precios, saldos, órdenes** | **Network-only** (o network-first con timeout corto y aviso visible de "datos de hace X") |
| POST/PUT (órdenes, pagos) | **Nunca** cachear ni encolar para reintento automático |

- Versiona el nombre de la caché y borra las viejas en `activate`. Sin esto el usuario se queda con el JS viejo para siempre.
- Actualizaciones: cuando haya SW nuevo esperando, muestra "Hay una versión nueva — Recargar" en vez de `skipWaiting()` silencioso que rompe la página a la mitad.
- Si usas Vite, `vite-plugin-pwa` (2.x a nov 2026) genera el SW con Workbox; verifica su doc antes de configurarlo. No mezcles un SW escrito a mano con uno generado.
- El SW solo controla su `scope`: sirve `sw.js` desde la raíz.

## Offline: qué significa en cada caso

- **Catálogo / landing / juego simple:** offline completo es razonable.
- **Terminal de trading o bot:** offline = mostrar la última info **marcada como vieja** y **bloquear cualquier acción que mueva dinero** hasta que vuelva la red. Nunca encolar una compra/venta "para cuando haya internet".
- Detecta red con `navigator.onLine` + fallo real de `fetch`; `onLine` solo no es confiable.

## Almacenamiento en iPhone

- Safari borra el almacenamiento escribible por script (localStorage, IndexedDB, caché del SW) de un sitio tras **7 días de uso de Safari sin interacción** con ese sitio. Las web apps de inicio llevan su propio conteo, que se reinicia al usarlas.
- Pide persistencia con `navigator.storage.persist()`; WebKit decide con heurísticas (estar en inicio ayuda).
- Conclusión: el servidor es la fuente de verdad. En el dispositivo guarda solo caché y preferencias recuperables. Nada de llaves privadas ni seeds, nunca.

## Cómo probar

1. Chrome de escritorio en Linux: DevTools > Application > Manifest y Service workers (revisa errores de instalabilidad).
2. Android: abre la URL HTTPS real (Cloudflare Pages/Workers o túnel), espera el prompt o menú > Instalar app.
3. iPhone: Safari > Compartir > Agregar a inicio > abrir desde el ícono > probar push y modo avión.
4. Modo avión: confirma que las acciones de dinero quedan bloqueadas y los datos se marcan como viejos.

## Al terminar

Entrega: (1) por qué PWA y qué no hará (en iPhone: sin prompt de instalación, push solo instalada), (2) la URL y los pasos para instalarla en su iPhone, (3) cómo comprobar que actualiza: cambia un texto, publica, abre la app instalada y verifica que aparece el aviso de nueva versión.

## Fuentes (verificado nov 2026)

- https://web.dev/articles/install-criteria
- https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent y https://github.com/mdn/browser-compat-data (Safari/Firefox: no soportado)
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (iOS 26: todo sitio en inicio abre como web app)
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (borrado a 7 días)
- https://webkit.org/blog/14403/updates-to-storage-policy/ (cuotas y `persist()`)
- https://www.npmjs.com/package/vite-plugin-pwa (versión 2.0.0 a nov 2026)
