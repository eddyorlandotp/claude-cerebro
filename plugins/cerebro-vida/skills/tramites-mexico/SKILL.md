---
name: tramites-mexico
description: Trámites en México para quien empieza a trabajar o emprender, verificados en fuentes oficiales - CURP, RFC, contraseña y e.firma, regímenes de personas físicas (RESICO, plataformas), CFDI 4.0, NSS del IMSS. Usa con SAT, RFC, factura, IMSS.
---

# Trámites en México (joven que empieza a trabajar o emprender)

El error que corrige: Claude contesta de memoria sobre el SAT con datos de hace años, mezcla regímenes, "recomienda" RESICO porque suena barato y no da enlaces. Los trámites cambian cada año (Resolución Miscelánea Fiscal, nuevos portales, nuevas citas). Aquí todo dato lleva fecha y enlace oficial, y las decisiones fiscales se escriben como preguntas para un contador.

## Reglas duras

1. **Todo con fecha y enlace oficial.** Cada requisito, monto o paso que des: "(verificado <fecha> en <URL>)". Fuentes válidas: sat.gob.mx, gob.mx, imss.gob.mx, renapo, DOF. Notas de prensa solo como apoyo, diciendo que lo son.
2. **Verifica el día que se usa.** Abre la página oficial con WebFetch antes de afirmar algo. Muchas páginas del SAT cargan con JavaScript y WebFetch las ve vacías: si pasa, dilo, da el enlace al usuario para que lo abra y **no rellenes de memoria**.
3. **No decides régimen ni obligaciones.** Describe opciones sin recomendar. Para elegir régimen, saber qué declarar, cuánto apartar o cómo tributan cripto, trading o ingresos del extranjero: "eso lo decide un contador". Genera la lista de preguntas para llevarle.
4. **Credenciales fiscales = llaves privadas.** Nunca pidas, leas ni escribas la contraseña del SAT, el archivo `.key` de la e.firma ni su clave. Si el usuario los tiene en la PC: carpeta privada, fuera de repos, con respaldo cifrado (ver `secretos-y-llaves` de cerebro-base y `respaldos` de cerebro-linux).
5. **No hagas trámites por él** ni llenes formularios oficiales sin que esté presente y confirme cada envío.

## Entregables

Por defecto en `~/vida/tramites/` (pregunta una vez):
- `<tramite>.md`: checklist con fecha de verificación, enlace oficial, requisitos, pasos, estado (`pendiente / cita agendada / hecho`) y dónde quedó guardado el comprobante.
- `preguntas-contador.md`: situación del usuario en 5–10 líneas (actividades, cómo cobra, montos aproximados por mes) + preguntas concretas. Llévalo a la primera consulta.
- Si el usuario quiere imprimirlo, conviértelo a PDF con las skills de documentos.

## Orden típico para alguien de 18 años que empieza

1. **CURP** correcta (todo cuelga de ella).
2. **RFC** + Constancia de Situación Fiscal (la piden al contratar y para facturar).
3. **NSS** del IMSS (la piden al contratar).
4. **Contraseña** del SAT y, si va a facturar como persona física con actividad, **e.firma**.
5. Con el contador: **régimen** y obligaciones antes de cobrar a clientes con factura.

## CURP

- Consulta y descarga gratis en https://www.gob.mx/curp/ . Revisa que nombre y fecha estén idénticos a tu acta; un error aquí se arrastra al RFC y al IMSS.
- **CURP biométrica** (a may 2026, según Infobae citando a Gobernación): el proceso es voluntario y gradual, sin fecha límite ni sanción; se tramita en persona con cita en https://citas.renapo.gob.mx/citas/ y convive con la CURP tradicional. Verifica el estado actual antes de decirle que es obligatoria.

## RFC y Constancia de Situación Fiscal

- **Consultar si ya tiene RFC**: el SAT tiene consulta de RFC con CURP (https://www54.sat.gob.mx/curp/Consult, según N+ jun 2026).
- **Inscribirse**: la ficha 3/CFF del SAT describe la inscripción en línea con CURP para mayores de 18 años; en 2026 el SAT atiende la inscripción de personas físicas por **Oficina Virtual** con cita en https://citas.sat.gob.mx/ (videollamada; documentos por correo; recibes Acuse Único de Inscripción y Constancia de Situación Fiscal). Requisitos reportados: CURP, identificación oficial vigente, comprobante de domicilio, correo. Confirma en la ficha vigente cuál vía está activa y qué documentos pide hoy.
- **Constancia de Situación Fiscal**: documento con tu RFC, régimen y código postal fiscal; la pide el patrón para timbrar tu nómina y los clientes para facturarte.
- Registrarse **con obligaciones** (actividad empresarial, por ejemplo) genera obligaciones de declarar. Antes de elegir actividad o régimen en el trámite: contador.

## Contraseña y e.firma

- **Contraseña**: acceso al portal del SAT; se puede obtener con asistencia virtual (Oficina Virtual) o con la e.firma.
- **e.firma por primera vez**: no se obtiene completamente en línea; requiere cita **presencial** por verificación biométrica. Lleva identificación oficial vigente, CURP, comprobante de domicilio reciente y una **USB** (preferentemente nueva). (El Imparcial, mar 2026; confirma en la ficha 105/CFF.)
- **Renovación**: en línea con Certifica/CertiSAT Web si está vigente o venció hace poco; con **SAT ID** si venció recientemente (sube identificación y video; revisión de hasta 5 días).
- La e.firma vence: anota la fecha de vencimiento en `tramites/e-firma.md` y crea un recordatorio un mes antes.

## Regímenes comunes de personas físicas (descripción, no recomendación)

| Régimen | Para quién (según SAT) | Datos verificados | Lo que decide el contador |
|---|---|---|---|
| Sueldos y salarios | Empleado con nómina | El patrón retiene y timbra el recibo de nómina | Si además hay otras actividades, cómo se combinan |
| Régimen Simplificado de Confianza (RESICO) | Solo actividades empresariales, profesionales o arrendamiento, con ingresos del año anterior ≤ 3.5 millones de pesos | ISR mensual con tasas de 1% a 2.5% sobre ingresos efectivamente cobrados (guía SAT dic 2024) | Si puede entrar (hay exclusiones), si le conviene, declaraciones y facturación |
| Actividades empresariales y profesionales | Comercio, servicios profesionales, venta de bienes; sin límite de ingresos | — | Deducciones, pagos provisionales, contabilidad |
| Actividades empresariales con ingresos a través de plataformas tecnológicas | Quien vende o presta servicios por apps/plataformas | La plataforma retiene ISR e IVA; si los ingresos del año (incluyendo salarios e intereses) no pasan de 300 mil pesos, puede tomarse como pago definitivo sin declaraciones mensuales. Prensa (nov 2025) reporta que en 2026 la retención de ISR de las plataformas sube de 1% a 2.5%; confirma tasas por tipo de actividad en la LISR/RMF vigente | Si sus plataformas califican (las extranjeras como Roblox, Steam o Stripe pueden ser distintas), tasas exactas 2026 |

Preguntas que casi siempre van a `preguntas-contador.md`: ¿qué régimen corresponde a cada actividad?, ¿puedo tener sueldo y actividad propia a la vez?, ¿cómo declaro ingresos de plataformas extranjeras y pagos en dólares?, ¿cómo tributan ganancias de cripto y trading?, ¿cuánto apartar al mes?, ¿qué fechas de declaración tengo?

## Factura electrónica (CFDI 4.0)

- Para que **te** facturen (o para facturar a un cliente), el receptor da: **RFC, nombre completo, código postal del domicilio fiscal, régimen fiscal y uso del CFDI** (correo opcional). Todo debe coincidir con la Constancia de Situación Fiscal; si no coincide, la factura se rechaza.
- El SAT tiene un **servicio gratuito de facturación** CFDI 4.0 en su portal (requiere estar inscrito con la actividad correspondiente y credenciales; revisa en la página del servicio qué pide hoy).
- Cuando el negocio cobre en línea (Stripe, Mercado Pago), la facturación es un tema aparte: ver `cobros-y-suscripciones` de cerebro-web y al contador.

## NSS (IMSS)

- Se obtiene o localiza en línea, gratis, con **CURP y correo**: https://serviciosdigitales.imss.gob.mx/gestionAsegurados-web-externo/asignacionNSS . Recibes tu Número de Seguridad Social.
- Tener NSS no te da servicio médico por sí solo; eso llega cuando el patrón te da de alta (o por otras vías de afiliación). Confirma tu caso en imss.gob.mx.

## Línea celular a tu nombre

- Desde ene 2026 las líneas móviles deben vincularse a la CURP del titular (Comisión Reguladora de Telecomunicaciones). Las líneas no registradas se suspenden por calendario según el último dígito, hasta el 31 dic 2026 (Infobae, jul 2026). El registro se hace en el sitio o centro de atención oficial del operador, nunca por enlaces recibidos por mensaje.
- Si la línea está a nombre de otra persona (por ejemplo, un familiar), los trámites de la línea suelen depender del titular. Para tenerla a tu nombre, pregunta al operador por cambio de titular y qué piden; no verificado aquí. Seguridad de la línea: ver `seguridad-de-cuentas`.

## Al terminar

Di al usuario: qué checklist quedó, qué datos verificaste hoy y cuáles no se pudieron abrir (con su enlace para que los revise él), y el siguiente paso con fecha (agendar cita, llevar preguntas al contador). Recuérdale: "confírmalo con la fuente oficial o con un contador antes de actuar".

## Verifica antes de confiar

Cada cambio de año se publica una nueva Resolución Miscelánea Fiscal (la de 2026 salió en el DOF a fines de dic 2025) y a veces cambian los portales. Si una ficha, URL o monto de esta skill no coincide con lo que ves hoy, gana la fuente oficial: corrígelo en el checklist del usuario y avísale.

## Fuentes (verificado nov 2026)

- https://www.sat.gob.mx/consulta/09788/emprendedor,-conoce-los-regimenes-fiscales-de-las-personas-fisicas (regímenes, límite RESICO 3.5 M, plataformas 300 mil)
- https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461176378829&ssbinary=true (guía RESICO dic 2024, tabla 1%–2.5%)
- https://www.sat.gob.mx/gobmx/Paginas/ficha_3_cff.html (inscripción RFC con CURP, 18+)
- https://www.nmas.com.mx/sociedad/como-sacar-el-rfc-link-y-paso-a-paso-consulta-curp-en-linea-inscripcion-2026/ (prensa, jun 2026: Oficina Virtual, consulta RFC)
- https://idconline.mx/fiscal-contable/2026/10/27/citas-sat-2026-cuales-son-los-nuevos-servicios-y-como-agendarlas (prensa, oct 2026: trámites por Oficina Virtual)
- https://www.elimparcial.com/dinero/2026/03/09/sat-2026-se-puede-tramitar-la-efirma-por-internet-esto-debes-saber-sobre-el-proceso-requisitos-y-renovacion/ (prensa: e.firma presencial, SAT ID)
- https://www.sat.gob.mx/gobmx/Paginas/ficha_105_cff.html (ficha e.firma)
- https://www.elcontribuyente.mx/2025/11/en-2026-vender-en-plataformas-digitales-sera-mas-caro-habra-nuevas-retenciones/ (prensa: retención 1% a 2.5% en 2026)
- https://www.sat.gob.mx/minisitio/Factura/documentos/Infografia_FacturaElectronica_Datos_Receptor.pdf (datos del receptor CFDI 4.0)
- https://wwwmat.sat.gob.mx/aplicacion/75169/servicio-de-facturacion-cfdi-version-4.0-(vigente-a-partir-del-1-de-enero-de-2022)
- https://ventanillamipymes.economia.gob.mx/obtencion-del-numero-de-seguridad-social-nss/ (NSS: CURP + correo, gratuito)
- https://www.infobae.com/mexico/2026/05/23/cuanto-tiempo-tienes-para-tramitar-la-curp-biometrica-y-en-que-fechas-se-puede-realizar/ (CURP biométrica)
- https://www.infobae.com/mexico/2026/07/25/registro-de-lineas-con-curp-fechas-limite-de-la-crt-en-2026-segun-el-ultimo-digito-del-numero/ (registro de líneas)
