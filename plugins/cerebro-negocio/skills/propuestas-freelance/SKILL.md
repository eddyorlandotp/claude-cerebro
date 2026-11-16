---
name: propuestas-freelance
description: Conseguir y cerrar proyectos en Workana, Fiverr o Upwork - leer el proyecto, propuesta corta, cotizar con comisiones, alcance escrito, pagos por hitos, no regalar trabajo, ofertas de automatización y chatbots. Usa al decir Workana, propuesta, cotizar, cliente, freelance.
---

# Propuestas freelance (Workana, Fiverr, Upwork)

Objetivo: que Claude produzca **propuestas enviables, cotizaciones con números y un alcance escrito**, y que
no deje al usuario regalar trabajo ni romper reglas de la plataforma (en Workana eso cierra la cuenta).
Plantillas en `references/plantillas.md`. Textos: aplica `copy-espanol-mx`.

## Reglas de Workana que Claude nunca rompe (a nov 2026)

Fuente: centro de ayuda de Workana. Romperlas = propuestas suspendidas 15–180 días o cuenta cerrada.
- **No pedir ni dar datos de contacto externos** (WhatsApp, correo, teléfono). 1a vez alerta, 2a sanción.
- **No pedir ni aceptar pagos fuera de Workana** → cierre automático sin aviso.
- **No pedir anticipo** (parcial o total) por fuera: el mecanismo es la garantía de Workana (abajo).
- **No mandar links externos** al cliente, ni Behance: sube ejemplos al portafolio de Workana.
- **No mencionar la comisión de Workana** al cliente (lo tratan como invitación a saltarse la plataforma).
- No usar portafolio copiado; no tardar más de 24–48 h en responder a un cliente activo.
- En disputas solo cuenta lo que se habló **dentro** de Workana: deja todo acuerdo por escrito ahí.

## Comisiones (a nov 2026 — verifica antes de cotizar)

| Plataforma | Qué te cobran | Notas |
|---|---|---|
| Workana | 20 % hasta US$300 acumulados con ese cliente; 10 % de 301 a 3,000; 5 % arriba de 3,000 | El cliente paga aparte 4.5 % (mín. US$2). Enviar propuestas es gratis; hay planes de pago con más "conexiones" |
| Upwork | 0–15 % variable por contrato (se muestra antes de enviar) | Cada propuesta gasta Connects (US$0.15 c/u) |
| Fiverr | Reportado 20 % por venta | No pude confirmarlo en la página oficial; verifica en el panel de vendedor |

Para cotizar incluye la comisión: `precio = neto_que_quieres / (1 - comisión)`.
Ej.: quieres US$160 netos en un primer proyecto de Workana → `python3 -c "print(160/0.8)"` = US$200.

## Cómo funciona el cobro en Workana (y por qué no necesitas "anticipo")

En proyectos de **precio fijo** el cliente deposita el **monto total antes de que empieces**; Workana lo
retiene y lo libera cuando el cliente aprueba. Eso es tu garantía: **no empieces a trabajar hasta ver el
depósito confirmado**. Se pueden liberar pagos parciales por avance, pero esos quedan **fuera** de la garantía
(no se reembolsan): acuérdalos solo contra entregas concretas. Por hora y pagos directos no tienen esta garantía.

Fuera de plataformas (cliente directo): 50 % de anticipo antes de empezar, 50 % contra entrega **antes** de
pasar accesos finales o código.

## 1. Leer un proyecto (5 min antes de escribir)

Crea `propuestas/<slug-proyecto>/analisis.md` con:
- **Qué pide de verdad** (en una frase) y qué resultado de negocio busca.
- **Señales verdes**: presupuesto definido, problema concreto, cliente con contrataciones/calificaciones,
  pocas propuestas enviadas aún.
- **Señales rojas** (si hay 2+, no apliques): "prueba gratis", piden contacto externo, alcance tipo "como
  Uber/Amazon" con presupuesto mínimo, cliente sin historial y sin depósito verificado, piden hacer parte
  del trabajo para "evaluarte", cripto/apuestas/datos personales sin claridad legal.
- **¿Lo puedes entregar bien?** Ver "Qué sí ofrecer". Si requiere algo que el usuario no podría mantener o
  depurar con Claude Code, dilo y no apliques.
- Preguntas abiertas que cambian el precio.

## 2. Propuesta (≤ 120 palabras, personalizada)

Estructura (plantilla completa en references):
1. **Su problema con sus palabras** + un detalle específico del post (prueba que lo leíste).
2. **Cómo lo harías**: 2–3 pasos concretos, con la herramienta.
3. **Prueba**: proyecto similar del portafolio (en Workana, subido ahí; nada de links externos).
4. **Precio, plazo y qué incluye** (o rango + "lo confirmo con 2 respuestas").
5. **Una pregunta** que obligue a contestar ("¿Los pedidos hoy te llegan por Instagram o por WhatsApp?").

Prohibido en la propuesta: "Hola, estimado", currículum, "tengo X años de experiencia" sin evidencia,
texto genérico pegado en 20 proyectos, promesas de resultados de negocio ("vas a vender el doble").

## 3. Cotizar

1. Divide en entregables y estima horas de cada uno **con el usuario** (él sabe cuánto le toma con Claude Code).
2. `horas × tarifa objetivo × 1.3` (colchón para imprevistos y revisiones) → súmale la comisión.
3. Precio **por proyecto**, no por hora, para encargos chicos y bien definidos.
4. Siempre define: **2 rondas de revisiones incluidas**; cambios fuera de alcance se cotizan aparte por escrito.
5. Costos del cliente separados: dominio, hosting, API de IA, WhatsApp Business, etc. **a nombre del cliente**.
6. Ofrece mantenimiento como cuota mensual opcional, no "soporte ilimitado".
Entrega la cotización como tabla en `propuestas/<slug>/cotizacion.md`.

## 4. Alcance mínimo por escrito (antes de empezar)

Usa la plantilla `alcance` de references y pégala como mensaje en la plataforma (o PDF si es cliente directo).
Debe tener: objetivo, **incluye**, **NO incluye**, entregables, fecha de cada hito, revisiones, qué necesitas
del cliente (accesos, textos, logos) y cuándo, soporte post-entrega (ej. 14 días de corrección de errores),
y que las cuentas y llaves de servicios son del cliente.

## 5. No regalar trabajo

- Nada de "muestra gratis" del proyecto del cliente. Sí: demos genéricas propias en el portafolio.
- Llamada/chat de descubrimiento corto; si piden diseño o solución detallada antes de contratar, eso ya es trabajo.
- Cambio pedido fuera del alcance → "Va, eso no estaba incluido; cuesta X y toma Y días. ¿Lo agrego?"
- No empieces sin depósito (Workana) o anticipo (directo). No entregues el final sin el pago acordado.
- Si el cliente desaparece, deja constancia escrita en la plataforma con fechas.

## 6. Qué sí ofrecer (entregable con calidad usando Claude Code)

Elige ofertas **chicas, repetibles y fáciles de probar**. Para construirlas usa las skills del plugin
`cerebro-ia` (chatbots de WhatsApp/Telegram, n8n, Claude API) si están instaladas; esta skill solo decide
qué vender y cómo cobrarlo.
| Oferta | Stack típico | Cuidado |
|---|---|---|
| Formulario → Google Sheets → aviso por correo/Telegram | Google Apps Script o Cloudflare Worker | Pide acceso con cuenta del cliente, no la tuya |
| Bot de Telegram para pedidos/FAQ | Telegram Bot API (gratis) + Worker | Fácil de probar en vivo con el cliente |
| Chatbot FAQ en la web del negocio | Widget + API de un LLM con la info del negocio | API key del cliente, límite de gasto, que diga "no sé" en vez de inventar |
| Bot de WhatsApp oficial | WhatsApp Business Platform (Cloud API de Meta) | Cobro **por mensaje** desde jul 2025; respuestas dentro de 24 h a quien escribió son gratis; plantillas de marketing se cobran. Verifica tarifas MXN. **Nunca** librerías no oficiales (banean el número) |
| Reporte automático semanal (ventas, inventario) | Script + Sheets/CSV → PDF/correo | Datos de prueba primero |
| Landing + lista de espera | Ver skill `landing-que-convierte` (cerebro-web) si está instalada | — |

No ofrezcas: apps con pagos o datos sensibles sin experiencia, scraping que viole términos, "IA que
garantiza ventas", trabajos que el usuario no podría mantener si fallan a las 2 a.m.

## 7. Entregar (y verificar antes de decir "listo")

- Prueba el flujo completo con datos reales del cliente (o de prueba aprobados) y graba un video de 1–2 min
  mostrándolo funcionar. Usa `verification-before-completion` de superpowers si está disponible.
- Entrega: acceso en cuentas del cliente, `LEEME.md` en español simple (qué hace, cómo se usa, qué hacer si
  falla, costos mensuales), y lista de credenciales **que el cliente debe rotar** si alguien más las vio.
- Nunca guardes llaves del cliente en repos públicos ni en el chat.
- Ingresos de plataformas: en México hay obligaciones fiscales (RFC, régimen). No des asesoría fiscal
  detallada: recomienda revisarlo con el SAT o un contador.

## Verifica antes de confiar

Comisiones, reglas y tarifas de WhatsApp cambian. Antes de cotizar o mandar una propuesta, si la tabla tiene
más de 3 meses, haz WebFetch a las páginas de Fuentes y dile al usuario la fecha. Antes de construir contra
una API (Telegram, WhatsApp, Sheets, un LLM), confirma la doc con Context7 o WebFetch a la doc oficial.

## Fuentes (verificado nov 2026)

- Workana comisiones: https://help.workana.com/hc/en-us/articles/360041235874 y https://help.workana.com/hc/es/articles/360040846094
- Workana reglas y sanciones: https://help.workana.com/hc/en-us/articles/360041499714 y https://help.workana.com/hc/en-us/articles/360041499134
- Workana garantía de pago: https://help.workana.com/hc/es/articles/360041401574
- Upwork tarifas (0–15 %, Connects): https://www.upwork.com/resources/is-upwork-free
- Comparativa Workana/Upwork/Fiverr (terceros, oct 2026): https://www.coderhouse.com/en/coderlibrary/workana-upwork-fiverr-plataforma-freelance-desde-argentina
- WhatsApp Business Platform precios: https://developers.facebook.com/docs/whatsapp/pricing
- Telegram Bot API: https://core.telegram.org/bots/api
