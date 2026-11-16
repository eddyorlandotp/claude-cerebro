---
name: apps-moviles-expo
description: Flujo de app móvil con Expo desde Linux sin Mac y con iPhone - Expo Go vs development build, compilar iOS en la nube (EAS), probar en iPhone, push, deep links a billeteras y SecureStore. Usar al planear o probar una app móvil.
---

# Apps móviles con Expo desde Linux (sin Mac)

Esta skill es para **decidir el camino y no gastar builds ni dinero a ciegas**. La API (Expo Router, `eas.json`, perfiles, submit, updates) la cubre el plugin oficial `expo`: usa sus skills `expo-dev-client`, `eas-app-stores`, `eas-update` y `expo-router` para implementar. Lo que corrige: Claude asume que el usuario puede abrir el proyecto en Expo Go en su iPhone, que puede compilar iOS en local, o que las push y los deep links se prueban igual en Expo Go que en producción.

Contexto fijo del usuario: Linux (CachyOS), **sin Mac**, con **iPhone**, no programa.

## Reglas

1. **Verifica antes de confiar.** Expo cambia rápido (SDK nuevo cada pocos meses, nombres de servicios, planes). Antes de escribir código o dar un paso que dependa de un dato de aquí, abre la página con WebFetch agregando `.md` al final de la URL de docs.expo.dev (o usa Context7 si está instalado). Si el dato cambió, dilo y usa el nuevo.
2. **Nombres nuevos.** A nov 2026 "EAS" se llama **Expo Services** (EAS Build = Expo Build, EAS Submit = Expo Submit, EAS Update = Expo Update). El comando `eas`, el paquete `eas-cli` y el archivo `eas.json` **no cambiaron**. No "corrijas" comandos por esto.
3. **Explica cada decisión en 1–3 frases simples** antes de ejecutarla ("Voy a compilar en la nube de Expo porque iOS solo se compila en Mac; esto gasta 1 de tus 15 builds gratis de iOS del mes").
4. **Pide confirmación antes de gastar**: pagar Apple, pasar a plan de pago de Expo, o lanzar un build de iOS (son pocos al mes).
5. Antes de proponer app nativa, pregunta si una PWA basta (skill `pwa`). Para un panel de trading o un catálogo, casi siempre basta.

## Qué se puede hacer sin Mac (a nov 2026 — verifícalo)

| Quiero... | Sin pagar Apple | Con Apple Developer Program (99 USD/año) |
|---|---|---|
| Ver la app en el iPhone mientras desarrollo | **Casi no.** Expo Go de la App Store se quedó en **SDK 54**; SDK 55+ no está ahí. Un proyecto nuevo con SDK actual no abre en ese Expo Go | Development build instalado por ad hoc, o tu propio Expo Go vía TestFlight (`eas go`) |
| Compilar iOS | Solo en la nube de Expo. Compilar iOS en local requiere Xcode (macOS) | Igual, en la nube; los builds para iPhone físico **requieren** cuenta pagada para firmar |
| Probar en Android | Emulador de Android Studio en Linux o un teléfono Android; Expo Go de Android acepta versiones elegidas en expo.dev/go | — |
| Ver un simulador de iOS | Expo Simulators (simulador remoto en el navegador) — incluido desde el plan **Starter** de pago | Igual |
| Push en iPhone | No: las credenciales de push de iOS requieren cuenta pagada | Sí, con development build |
| Publicar en App Store | No | Sí, con `eas submit` desde Linux |

Plan gratis de Expo (a nov 2026, verifica en https://expo.dev/pricing): **15 builds de Android y 15 de iOS al mes**, cola de baja prioridad, timeout de 45 min, Expo Update hasta 1,000 usuarios activos al mes, 60 min de Workflows. Starter: 19 USD/mes + uso.

## Flujo recomendado para este usuario

1. **Prototipo sin gastar:** crea el proyecto con el SDK actual (`npx create-expo-app@latest`) y pruébalo en **web** (`npx expo start` y tecla `w`) y en el **emulador de Android** en Linux. Así validas pantallas y lógica.
   - No bajes el proyecto a SDK 54 solo para usar Expo Go en el iPhone: quedarías atado a un SDK viejo. Ofrécelo solo como demo rápida y explica el costo.
2. **Cuando ya vale la pena verlo en el iPhone:** el usuario paga Apple Developer Program (ver skill `publicar-en-tiendas`). Entonces:
   - Registra el iPhone: `eas device:create` (Apple puede tardar 24–72 h en procesar un dispositivo nuevo en cuentas nuevas; el primer build puede fallar por eso).
   - Build de desarrollo en la nube con el perfil de desarrollo (detalles en la skill `expo-dev-client` del plugin `expo`).
   - En el iPhone: activar **Modo de desarrollador** (Ajustes > Privacidad y seguridad > Modo de desarrollador; iOS 16+) después de instalar.
   - Desde ahí, los cambios de JavaScript se ven al instante con `npx expo start`; **no** hace falta otro build.
3. **Probar con otras personas:** TestFlight (hasta 100 internos del equipo; externos requieren revisión de Apple) o ad hoc (máx. 100 iPhones por año por cuenta).
4. **Publicar:** skill `publicar-en-tiendas` + `eas-app-stores` del plugin `expo`.

## No quemes builds

Cada `eas build` cuenta contra el límite del mes. Antes de lanzar uno:
- Corre `npx expo-doctor@latest` y `npx expo install --fix`; si hay errores, arréglalos primero.
- **Solo hace falta un build nuevo** si cambiaste dependencias con código nativo o `app.json`/`app.config` (nombre, ícono, `scheme`, permisos, plugins). Para cambios de JS/estilos basta el servidor de desarrollo o un update OTA.
- Compila una plataforma a la vez (`--platform ios` o `--platform android`), no `all`, mientras depuras.
- Si un build falla, lee el log completo en expo.dev antes de reintentar. Reintentar sin cambiar nada gasta otro build.

## Notificaciones push

- **Expo Go no recibe push remotas** (solo notificaciones locales). Usa development build.
- iOS: credenciales de push **requieren cuenta pagada de Apple**. Android: credenciales **FCM V1** (cuenta de servicio de Google/Firebase).
- Al pedir el token (`getExpoPushTokenAsync`), pasa el `projectId` explícito.
- El servicio de push de Expo **no cuesta**. Envía desde tu backend (p. ej. un Worker de Cloudflare), nunca desde la app.
- Un ticket `ok` solo significa que Expo lo recibió. **Revisa los receipts** ~15 min después; si dicen `DeviceNotRegistered`, deja de enviar a ese token y bórralo.
- Pide el permiso de notificaciones en contexto (cuando el usuario activa una alerta), no al abrir la app por primera vez.
- Para alertas de trading: la notificación informa, **nunca ejecuta** una compra/venta al tocarla sin una pantalla de confirmación.

## Deep links (abrir tu app y abrir otras apps)

| Tipo | Cómo | Trampa |
|---|---|---|
| Esquema propio (`miapp://ruta`) | `scheme` en app config | Cambiarlo exige build nuevo. En Expo Go la URL es `exp://...`, distinta a producción |
| Universal Links (iOS) | Archivo `apple-app-site-association` en `/.well-known/` del dominio + associated domains | Necesita Team ID de Apple (cuenta pagada) y **no funciona en Expo Go** |
| App Links (Android) | `android.intentFilters` con `autoVerify: true` + `/.well-known/assetlinks.json` | Sin `autoVerify` no se verifica |
| Abrir otra app (billetera) | `Linking.openURL(...)` | En iOS, `canOpenURL` devuelve `false` si el esquema no está en `ios.infoPlist.LSApplicationQueriesSchemes`. En Android 11+ declara `queries` con un config plugin. No se prueba en Expo Go |

- Si el dominio está en Cloudflare, sirve los archivos de `/.well-known/` con HTTPS y sin redirecciones.
- Prueba con `npx uri-scheme open miapp://ruta --ios` (o `--android`) y con un enlace real enviado por WhatsApp/Notas.
- Para conectar billeteras de Solana (Phantom, etc.) usa la skill `billetera-sin-custodia` de `cerebro-solana`: ahí está el protocolo; aquí solo la configuración de enlaces.

## Almacenamiento seguro

- Tokens de sesión y API keys del usuario: **`expo-secure-store`** (Keychain en iOS, Keystore en Android). `AsyncStorage` es texto plano: nunca para secretos.
- Límites a tener en cuenta (a nov 2026):
  - Valores grandes pueden ser rechazados (históricamente ~2048 bytes en algunos iOS). Guarda tokens, no objetos grandes.
  - En iOS los datos **pueden sobrevivir** a desinstalar y reinstalar; en Android **se borran**. No dependas de ninguno de los dos comportamientos.
  - `requireAuthentication` (Face ID) no funciona en Expo Go; y si el usuario cambia su biometría, el dato protegido queda inaccesible: ten un camino para volver a iniciar sesión.
  - No existe en web: si la app también corre en web, usa otra estrategia ahí.
- **Regla dura:** la app **nunca** genera, importa ni guarda seed phrases o llaves privadas. Firma con la billetera del usuario (deep link o Wallet Adapter). Además, Apple solo acepta apps de billetera de cuentas de **organización** (ver `publicar-en-tiendas`).

## Errores comunes de Claude

- Decir "escanea el QR con Expo Go en tu iPhone" en un proyecto SDK 55+: no va a abrir. Ofrece web, Android o development build.
- Proponer `eas build --local` para iOS: requiere Xcode/macOS. En Linux solo sirve para Android.
- Lanzar un build para probar un cambio de texto.
- Probar push, Universal Links o `canOpenURL` en Expo Go y concluir que "no funciona el código".
- Usar `eas build` sin avisar que gasta cuota o que necesita la cuenta de Apple.

## Al terminar

Dile al usuario: (1) qué camino tomaste y qué costó (builds usados del mes, pagos), (2) cómo verlo él mismo (abrir la app en el iPhone, enviar una push de prueba desde https://expo.dev/notifications, tocar un enlace), (3) cuántos builds le quedan este mes: expo.dev > tu cuenta > Usage/Billing.

## Fuentes (verificado nov 2026)

- https://expo.dev/pricing
- https://docs.expo.dev/eas-to-expo/ (cambio de nombre EAS a Expo Services)
- https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/ (Expo Go en App Store hasta SDK 54, `eas go`)
- https://docs.expo.dev/develop/development-builds/faq/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/build-reference/local-builds/
- https://docs.expo.dev/guides/ios-developer-mode/
- https://docs.expo.dev/eas/simulators/introduction/
- https://docs.expo.dev/versions/latest/ (SDK 58 a nov 2026)
- https://docs.expo.dev/push-notifications/what-you-need-to-know/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://docs.expo.dev/push-notifications/faq/
- https://docs.expo.dev/linking/into-your-app/
- https://docs.expo.dev/linking/into-other-apps/
- https://docs.expo.dev/linking/ios-universal-links/
- https://docs.expo.dev/linking/android-app-links/
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://developer.apple.com/testflight/
