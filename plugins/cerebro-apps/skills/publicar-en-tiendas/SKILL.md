---
name: publicar-en-tiendas
description: Publicar en App Store y Google Play desde México - cuentas y cuotas, prueba cerrada obligatoria en Play, políticas que rechazan (cripto, pagos, privacidad, borrar cuenta) y checklist. Usar antes de pagar cuenta o enviar a revisión.
---

# Publicar en App Store y Google Play

El error que corrige: Claude dice "ya está lista, súbela" sin revisar si la app **puede** pasar la revisión (cripto, pagos, privacidad), sin avisar de la prueba cerrada obligatoria de Google (que retrasa semanas el lanzamiento) ni de que una cuenta individual de Apple **no puede** publicar una billetera cripto. Los comandos de build y submit los cubre el plugin `expo` (skill `eas-app-stores`); aquí va lo que decide si te aprueban.

## Reglas

1. **Verifica antes de confiar.** Cuotas, comisiones y políticas cambian varias veces al año. Antes de afirmar una regla, ábrela con WebFetch en la fuente oficial (abajo) y cita el número de sección. Si cambió, dilo.
2. **Revisa políticas ANTES de construir**, no al enviar. Si la idea choca con una política, dilo en la etapa de diseño y propone alternativa (normalmente PWA, skill `pwa`).
3. **Pide confirmación** antes de pagar cualquier cuenta y antes de enviar a revisión. Explica en 1–3 frases qué se paga y qué falta.
4. Nada de trucos para "pasar" la revisión (ocultar funciones al revisor, cambiar comportamiento después): termina en baja de la cuenta.

## Cuentas y costos (a nov 2026 — verifícalo)

| | Apple Developer Program | Google Play Console |
|---|---|---|
| Costo | **99 USD por año** (se muestra en moneda local al inscribirte) | **25 USD una sola vez**; no aceptan tarjetas prepagadas |
| Edad | Mayoría de edad en tu país | 18 años o más |
| Cuenta individual | Apple Account con 2FA y **nombre legal real**; tu nombre aparece como vendedor en la App Store | Verificación de identidad con ID oficial; si los datos no son válidos no devuelven la cuota |
| Cuenta de organización | Entidad legal (no nombre comercial), **D-U-N-S**, sitio web propio funcional | Requisitos aparte |
| Se puede inscribir desde | Web o la app Apple Developer (sirve el iPhone) | Web |
| Comisión | 15% en Small Business Program (menos de 1 M USD al año) | 15% el primer 1 M USD al año; suscripciones 15% |

### Requisito clave de Google Play para cuentas personales nuevas

Cuentas **personales creadas después del 13 nov 2023**: antes de publicar en producción necesitas una **prueba cerrada con al menos 12 testers inscritos de forma continua durante 14 días** (si alguien sale y vuelve, los días deben ser consecutivos). Luego, en Play Console > Panel > "Solicitar acceso a producción", contestas preguntas sobre la prueba, la app y qué cambiaste con la retroalimentación.

- Planéalo en el calendario: **mínimo ~2–3 semanas** entre tener el primer build y poder lanzar.
- Consigue 15 o más testers (margen por si alguien se sale) con cuentas de Google reales que **usen** la app; Google pregunta por el engagement.
- Además debes verificar acceso a un dispositivo Android físico.
- Aviso aparte: Google está exigiendo verificación de desarrollador también para apps fuera de Play (desde sept 2026 en Brasil, Indonesia, Singapur y Tailandia; global en 2027). Si piensan repartir APKs directo, verifiquen el estado en México.

## Políticas que más rechazan (lee la sección completa antes de diseñar)

### Cripto y trading
- **Apple 3.1.5(i): las apps de billetera solo se aceptan de cuentas de organización.** Con cuenta individual, una app que guarde cripto se rechaza.
- Apple 3.1.5(iii–iv): exchanges solo donde tengas licencia; trading de futuros o "cuasi-valores" solo de instituciones financieras aprobadas. 3.1.5(v): no dar cripto por tareas (descargar, compartir). 3.1.5(ii) y 2.4.2: nada de minar en el dispositivo.
- Apple 3.1.1: no se puede **desbloquear funciones** pagando con cripto, license keys o QR; para funciones digitales es In-App Purchase.
- Google: si la app tiene funciones financieras, llena el **formulario de declaración de funciones financieras**. Exchanges y billeteras de software requieren licencia en los países listados (EE. UU., UE, Reino Unido, Canadá, Japón, Corea del Sur y otros; **México no está en la lista** a oct 2026). Hay casilla para declarar billetera **no custodial**. Opciones binarias: prohibidas.
- **Recomendación por defecto para la terminal de trading o el bot: PWA**, no app de tienda. Si insiste en tienda, que sea un visor sin custodia y sin ejecutar operaciones, y revisa las secciones de arriba en voz alta con él.

### Pagos
- **Apple 3.1.1:** suscripciones, funciones premium, monedas de juego = In-App Purchase. Fuera de EE. UU. no puedes poner botones o links a otros métodos de pago (excepto con entitlements especiales por región). **En la tienda de EE. UU. sí se permiten** links externos.
- **Apple 3.1.3(e):** bienes físicos o servicios fuera de la app **no** usan IAP (usa Stripe/Mercado Pago, skill `cobros-y-suscripciones`).
- **Google Play:** contenido digital usa Google Play Billing; prohibido dirigir a otro método salvo programas de facturación alternativa en países elegibles. Bienes físicos quedan exentos.

### Privacidad y cuentas
- **Política de privacidad pública** (URL) obligatoria en ambas tiendas, aunque no recolectes datos. Apple 5.1.1(i) la pide en los metadatos **y dentro de la app**, fácil de encontrar.
- **Google: formulario Data safety** obligatorio para toda app publicada, aun sin datos.
- **Apple:** etiquetas de privacidad en App Store Connect; deben coincidir con lo que hacen tus SDKs (analítica, crash reporting).
- **Borrar cuenta:** si la app permite crear cuenta, debe permitir **eliminarla desde la app** (Apple 5.1.1(v)); Google además pide un **enlace web** para solicitar el borrado.
- No exijas login si la app no tiene funciones de cuenta (Apple 5.1.1(v)).

### Calidad mínima
- **Apple 4.2:** una app que solo envuelve un sitio web (WebView) se rechaza por "funcionalidad mínima". Si es solo tu web, haz PWA.
- **Apple 2.1:** nada de textos de relleno ni links rotos; si hay login, da **cuenta demo** al revisor en las notas.
- Pruébala en un dispositivo real antes de enviar.

## Checklist antes de "Enviar a revisión"

- [ ] La idea pasa las secciones de arriba (cripto, pagos, 4.2) — revisado contra la versión actual de las guías.
- [ ] Ícono, nombre, capturas reales de la app, descripción sin promesas de ganancias.
- [ ] URL de política de privacidad y de soporte funcionando (pueden vivir en Cloudflare Pages/Workers).
- [ ] Etiquetas de privacidad (Apple) y Data safety (Google) llenas y coherentes con los SDKs usados.
- [ ] Borrado de cuenta dentro de la app (+ enlace web para Google), si hay cuentas.
- [ ] Cuenta demo y notas para el revisor si hay login o funciones ocultas tras pago.
- [ ] Clasificación de contenido (cuestionario de edad) contestada.
- [ ] Versión y número de build incrementados.
- [ ] Probada en TestFlight (Apple: hasta 100 internos; externos requieren revisión beta) y en la prueba cerrada de Play.
- [ ] Google personal nueva: 12+ testers por 14 días cumplidos y acceso a producción solicitado.

## Si te rechazan

1. Lee el mensaje completo y la sección citada; copia ambos a un archivo `REVISION.md` del proyecto.
2. Explica al usuario en simple qué pidieron. Corrige **solo** eso.
3. Responde en el centro de resolución (Apple) o en Play Console con lo que cambiaste. Si crees que es un error del revisor, apela con calma y evidencia.

## Al terminar

Dile al usuario: qué cuenta necesita y cuánto cuesta, qué políticas revisaste y con qué resultado, cuánto tiempo falta (prueba cerrada, revisión), y dónde ver el estado: App Store Connect > Mi app > Distribución, y Play Console > Panel.

## Fuentes (verificado nov 2026)

- https://developer.apple.com/programs/enroll/ (99 USD/año, requisitos individual y organización)
- https://developer.apple.com/support/purchase-activation/
- https://developer.apple.com/app-store/review/guidelines/ (última actualización 16 oct 2026; 2.1, 3.1.1, 3.1.1(a), 3.1.3, 3.1.5, 4.2, 5.1.1)
- https://developer.apple.com/app-store/small-business-program/
- https://developer.apple.com/testflight/
- https://support.google.com/googleplay/android-developer/answer/6112435 (25 USD, 18+, identidad)
- https://support.google.com/googleplay/android-developer/answer/14151465 (12 testers, 14 días)
- https://support.google.com/googleplay/android-developer/answer/9876821 (servicios financieros)
- https://support.google.com/googleplay/android-developer/answer/16329703 (licencias de exchanges y billeteras, oct 2026)
- https://support.google.com/googleplay/android-developer/answer/9858738 (pagos)
- https://support.google.com/googleplay/android-developer/answer/10787469 (Data safety)
- https://support.google.com/googleplay/android-developer/answer/13327111 (borrado de cuenta)
- https://support.google.com/googleplay/android-developer/answer/112622 (comisiones)
- https://developer.android.com/developer-verification
