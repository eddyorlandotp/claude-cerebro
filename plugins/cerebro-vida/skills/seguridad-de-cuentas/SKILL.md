---
name: seguridad-de-cuentas
description: Proteger cuentas personales - gestor de contraseñas, 2FA con passkey/llave/app en vez de SMS, SIM swap y portabilidad en México (NIP 051), correo de recuperación, phishing y qué hacer si te hackean. Usa con contraseña, 2FA, hackeo.
---

# Seguridad de cuentas personales

El error que corrige: Claude da una lista genérica ("usa contraseñas fuertes"), pide o escribe contraseñas en archivos, deja el SMS como segundo factor de todo y, cuando hay un hackeo, no da un orden de respuesta. Aquí se hace un inventario sin secretos, se suben las cuentas por prioridad y hay un plan de emergencia escrito antes de necesitarlo.

Para llaves de API, `.env` y llaves privadas de Solana usa `secretos-y-llaves` de cerebro-base; esta skill cubre las cuentas de la persona.

## Reglas duras

1. **Nunca pidas, muestres ni escribas** contraseñas, códigos 2FA, códigos de respaldo, NIP, tokens bancarios ni frases semilla, ni en el chat ni en archivos. El usuario los teclea él mismo en el sitio oficial. Si los pega en el chat, dile que esa credencial ya debe considerarse expuesta y que la cambie.
2. **Enlaces solo oficiales**: escribe tú la URL del sitio (o pide que la abra desde la app oficial); nunca sigas ni recomiendes un enlace que llegó por SMS, correo o DM.
3. **El usuario hace los cambios** en sus cuentas; tú guías paso a paso y confirmas con él cada uno. Antes de desactivar un método de recuperación, confirma que el nuevo ya funciona (si no, se queda fuera de su cuenta).
4. **Explica en 1–3 frases** por qué cada cambio importa ("Tu correo es la llave maestra: quien lo controla puede resetear casi todo lo demás").

## Entregables (por defecto `~/vida/seguridad/`, fuera de repos)

- `inventario-cuentas.md`: tabla **sin secretos**:

```markdown
| Cuenta | Prioridad | Correo de recuperación | Teléfono de recuperación | 2FA | Códigos de respaldo (dónde, físico) | Revisado |
|---|---|---|---|---|---|---|
| Correo principal | 1 | correo secundario propio | sí | passkey + app | impresos, cajón X | 2026-11-16 |
```

- `plan-si-me-hackean.md`: la sección "Si te hackean" adaptada a sus cuentas, con los teléfonos oficiales de su banco y operador (los copia él de la tarjeta o del sitio oficial).

## Orden de trabajo (por prioridad)

1. **Correo principal** (recupera todo lo demás).
2. **Gestor de contraseñas**.
3. **Banco, fintechs y tarjetas**.
4. **Exchanges y billeteras cripto**.
5. **Línea celular** (recibe SMS de recuperación).
6. **WhatsApp y redes**.
7. **Cuentas del negocio**: GitHub, Cloudflare, registrador de dominios, Google Workspace, pasarelas de pago.

Una sesión por bloque; no intentes todo en un día.

## Gestor de contraseñas

- Un gestor y **una contraseña distinta por sitio**, generada por el gestor. La contraseña maestra: frase larga que nunca uso en otro lado, memorizada, con una copia en papel guardada físicamente.
- Opciones verificadas (a nov 2026, no es recomendación de compra):
  - **Bitwarden**: el plan gratis incluye contraseñas y dispositivos ilimitados y passkeys; el autenticador integrado (TOTP) es Premium, 19.80 USD/año. Ver https://bitwarden.com/pricing/.
  - **KeePassXC**: libre (GPLv3), base de datos local cifrada, nativo en Linux, guarda TOTP, extensión de navegador. El usuario se encarga del respaldo del archivo (ver `respaldos` de cerebro-linux).
- Migración: exporta las contraseñas guardadas en el navegador, impórtalas al gestor y **borra el archivo exportado** al terminar (está en texto plano). Luego desactiva el guardado de contraseñas del navegador.
- Revisa si el correo aparece en filtraciones en https://haveibeenpwned.com/ y cambia primero las contraseñas de esos sitios.

## Segundo factor (2FA): de mejor a peor

Según CISA, la única autenticación ampliamente disponible resistente a phishing es **FIDO/WebAuthn** (passkeys y llaves físicas); los códigos de app pueden ser robados en una página falsa; SMS y voz son el último recurso (vulnerables a phishing, SIM swap y SS7).

1. **Passkey o llave física FIDO2** donde exista (correo, GitHub, Google, gestores). Registra **dos** (por ejemplo, teléfono + llave física o dos llaves) para no quedarte fuera si pierdes una.
2. **App de autenticación** (TOTP). Guarda los códigos de respaldo **impresos**; si los TOTP viven en el mismo gestor que las contraseñas, un solo robo abre todo: decide con el usuario y anótalo.
3. **SMS** solo si el sitio no ofrece otra cosa. En cuanto agregues 1 o 2, quita el número como método de 2FA (déjalo como recuperación solo si el sitio lo exige).
- **WhatsApp**: activa la verificación en dos pasos (Ajustes > Cuenta > Verificación en dos pasos, PIN de 6 dígitos y correo). Nadie legítimo te pide el código de 6 dígitos que te llega por SMS.

## Línea celular: SIM swap y portabilidad en México

- **Portabilidad**: el NIP se obtiene llamando o enviando "NIP" al **051** desde la línea; dura 5 días naturales. Quien tenga tu NIP puede llevarse tu número a otra compañía. **Nunca lo dictes** a quien te llame, aunque diga ser de tu compañía.
- Si te llega un NIP que no pediste: comunícate de inmediato con tu operador. Si portaron tu número sin permiso: acude a tu compañía anterior con carta firmada (nombre, número de 10 dígitos, explicación) e identificación y pide la **reversión**; el plazo es de 15 días hábiles desde la portabilidad (Telcel, nov 2026).
- **Registro de líneas con CURP** (2026): la línea debe estar vinculada al titular; la compañía receptora pide CURP al portar. Tener la línea a tu nombre facilita que tú mismo hagas los trámites de recuperación. Ver `tramites-mexico`.
- Pregunta a tu operador (Telcel, AT&T u otro) si ofrece contraseña o NIP de cuenta para cambios de SIM/eSIM y cómo activarlo. **No verificado** en esta skill: no afirmes que existe.
- Reducción de daño: que el SMS no sea el único factor de banco, correo ni exchanges.

## Phishing típico (México, bancos y cripto)

Señales comunes en ambos: urgencia, enlace en mensaje, piden un código o que "confirmes" algo, cambian el canal (de SMS a llamada, de Discord a DM).

- **Banco**: llamada "del área de fraudes" que pide el código que te llegó, el token o tu NIP; o que muevas tu dinero a una "cuenta segura". Cuelga y llama tú al número impreso en tu tarjeta.
- **SMS/correo** de paquetería, multa, SAT o banco con enlace: entra escribiendo tú la dirección o desde la app oficial.
- **Cripto**: "soporte" que te escribe por DM en Discord/Telegram; airdrops o sitios clon que piden conectar la billetera y firmar; "valida tu billetera" pidiendo la frase semilla. Nadie legítimo pide la frase semilla, nunca. Firmar una transacción o permiso en un sitio falso puede vaciar la billetera: usa billeteras separadas con poco saldo para probar (ver `billetera-sin-custodia` y `riesgo-memecoins` de cerebro-solana).
- **Empleo falso**: piden pago o documentos antes de entrevistarte (ver `cv-y-entrevistas`).
- Si el usuario te pasa un mensaje sospechoso, analízalo sin abrir los enlaces: dominio real, remitente, qué pide.

## Si te hackean (orden de respuesta)

1. **Desde un dispositivo limpio**, recupera el **correo**: cambia contraseña, cierra todas las sesiones, revisa reenvíos automáticos, filtros, correo y teléfono de recuperación, y apps conectadas.
2. **Dinero**: llama al banco por el número de la tarjeta; bloquea tarjetas y pide aclaración de cargos no reconocidos. En cripto, si la frase semilla o llave pudo filtrarse, crea billetera nueva con semilla nueva y mueve lo que quede (tú no firmas nada; sigue `secretos-y-llaves`).
3. **Línea**: si perdiste señal sin razón, llama a tu operador desde otro teléfono (posible SIM swap).
4. **Gestor de contraseñas** y luego las cuentas de prioridad 3–7: cambia contraseñas, cierra sesiones, revisa 2FA.
5. **Avisa** a tus contactos si robaron WhatsApp o redes (piden dinero haciéndose pasar por ti).
6. **Evidencia y denuncia**: capturas con fecha, números, enlaces. Ciberdelitos: **088** (Atención Ciudadana, Guardia Nacional). Fraude bancario: aclaración con el banco y, si no se resuelve, Condusef.
7. **Revisa el equipo**: extensiones del navegador, programas instalados recientemente y, en la PC, cualquier script o "bot" descargado que pidiera llaves.
8. Actualiza `inventario-cuentas.md` y anota qué pasó y qué cambió en `plan-si-me-hackean.md`.

## Al terminar

Di qué cuentas quedaron revisadas (fecha en el inventario), cuáles faltan y en qué orden, y cómo comprobarlo él mismo: cerrar sesión y entrar de nuevo con el 2FA nuevo; probar que un código de respaldo impreso existe y es legible.

## Verifica antes de confiar

Menús de apps, planes de gestores y reglas de portabilidad cambian. Antes de dar pasos de un sitio concreto, abre su ayuda oficial con WebFetch; si no puedes, dilo y describe el paso de forma general.

## Fuentes (verificado nov 2026)

- https://www.cisa.gov/sites/default/files/publications/fact-sheet-implementing-phishing-resistant-mfa-508c.pdf (FIDO/WebAuthn resistente a phishing; SMS último recurso)
- https://bitwarden.com/pricing/ (plan gratis y Premium)
- https://keepassxc.org/docs/ (TOTP, local, Linux, GPLv3)
- https://haveibeenpwned.com/
- https://faq.whatsapp.com/1920866721452534 (verificación en dos pasos)
- https://www.telcel.com/personas/politicas-y-codigos/derechos-en-la-portabilidad (NIP 051, 5 días, reversión 15 días hábiles)
- https://www.infobae.com/mexico/2026/07/25/registro-de-lineas-con-curp-fechas-limite-de-la-crt-en-2026-segun-el-ultimo-digito-del-numero/ (registro de líneas)
- https://ruptura360.mx/periodismo-de-servicio/registro-lineas-celular-crt-portabilidad-2026/ (CURP al portar)
- https://www.gob.mx/gncertmx/articulos/en-caso-de-ser-victima-de-algun-ciberdelito-llama-al-088-atencion-ciudadana (088)
