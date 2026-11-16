# Plantillas freelance

Reemplaza `[ ]`. Borra lo que no aplique. Pasa el resultado por `copy-espanol-mx`.

## 1. Propuesta (≤ 120 palabras)

```text
Hola, [nombre si aparece]. Entiendo que [su problema con sus palabras], sobre todo [detalle específico del post].

Lo haría así:
1. [paso concreto + herramienta]
2. [paso concreto]
3. [cómo lo pruebas con él antes de entregar]

Hice algo parecido: [proyecto del portafolio de la plataforma, 1 línea de resultado].

Precio: US$[X] por todo, en [N] días. Incluye [entregables] y 2 rondas de ajustes.

¿[pregunta específica que cambie el alcance o el precio]?
```

Ejemplo (automatización, Workana). La línea "Hice algo parecido" va solo si es real; si aún no hay portafolio, quítala y ofrece una demo en video subida al portafolio. Nunca inventes experiencia:
```text
Hola, Marco. Entiendo que hoy copias a mano cada pedido del formulario a tu Excel y a veces se te pasan, sobre todo los del fin de semana.

Lo haría así:
1. Conecto tu formulario a una hoja de Google que se llena sola.
2. Cada pedido nuevo te llega como aviso a Telegram con nombre, producto y total.
3. Lo probamos juntos con 3 pedidos de prueba antes de dejarlo activo.

Hice algo parecido para una tienda de ropa (está en mi portafolio aquí en Workana).

Precio: US$120 por todo, en 4 días. Incluye la configuración, una guía de uso y 2 rondas de ajustes.

¿Tu formulario es de Google Forms o de tu página web?
```

## 2. Cotización — `propuestas/<slug>/cotizacion.md`

```markdown
# Cotización — [proyecto]   Fecha: [AAAA-MM-DD]   Vigencia: 15 días

| Entregable | Detalle | Horas est. |
|---|---|---|
| 1. [ ] | [ ] | [ ] |
| 2. [ ] | [ ] | [ ] |
| Pruebas y entrega | Pruebas con datos reales, video, guía | [ ] |
| **Total horas** | | [H] |

Cálculo interno (NO se manda al cliente):
- [H] h × [tarifa] × 1.3 = [subtotal]
- Comisión de plataforma [20 %] → precio = subtotal / (1 - 0.20) = [precio]

Para el cliente:
- Precio total: [moneda] [precio]
- Incluye: 2 rondas de revisiones, [N] días de corrección de errores después de entregar.
- No incluye: [ ]
- Costos a cargo del cliente (en sus cuentas): [dominio, hosting, API, WhatsApp…] — estimado mensual [ ]
- Pago: [Workana: depósito en garantía completo antes de iniciar | directo: 50 % anticipo / 50 % contra entrega]
```

## 3. Alcance — mensaje o PDF

```markdown
# Alcance — [proyecto]
**Objetivo:** [qué problema resuelve, 1 frase]

**Incluye**
- [ ]

**No incluye** (se cotiza aparte si se necesita)
- [ej. diseño de logo, textos, fotos, integraciones adicionales, migrar datos viejos]

**Entregables y fechas**
| Hito | Entregable | Fecha |
|---|---|---|
| 1 | [ ] | [ ] |
| 2 | [ ] | [ ] |

**Revisiones:** 2 rondas incluidas por entregable. Cambios fuera de este alcance se cotizan por escrito antes de hacerlos.

**Necesito de ti** (antes del [fecha]; si llega después, la entrega se recorre los mismos días):
- [accesos, textos, logos, ejemplos]

**Después de entregar:** [14] días para corregir errores de lo entregado. Nuevas funciones = nueva cotización.

**Cuentas y llaves:** todos los servicios quedan a tu nombre. Te paso la lista de credenciales para que las cambies al terminar.

**Pago:** [según plataforma]
```

## 4. Respuestas rápidas

- Piden "una prueba gratis": "No hago pruebas gratis del proyecto, pero en mi portafolio hay [ejemplo similar] y te puedo enseñar cómo funciona en una llamada de 10 min aquí en la plataforma."
- Cambio fuera de alcance: "Va. Eso no estaba en el alcance; son US$[X] y [N] días extra. ¿Lo agrego?"
- Cliente que no manda material: "Para cumplir la fecha del [hito] necesito [material] a más tardar el [fecha]. Si llega después, recorro la entrega los mismos días."
- Regateo fuerte: baja **alcance**, no precio: "Por US$[X] puedo hacer [versión reducida] y dejar [parte] para una segunda etapa."
