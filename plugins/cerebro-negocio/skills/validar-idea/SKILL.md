---
name: validar-idea
description: Validar una idea de negocio, producto o juego antes de construir - cliente y problema, prueba de 7 días (conversaciones, lista de espera, preventa), métricas definidas antes, y si falló la idea o el canal. Usa al decir idea, validar, emprender, pivotar, abandonar, no funcionó.
---

# Validar una idea antes de construir

Objetivo: que Claude **no se ponga a programar una idea nueva** sin un experimento de ≤ 7 días con criterios
escritos antes, y que **no deje al usuario abandonar** (ni insistir) sin datos suficientes.

Patrón a corregir: el usuario ha dejado negocios tras ~4 días sin respuesta (volantes, videos con pocas
vistas). Casi siempre eso es "el canal no llegó a suficiente gente", no "la idea no sirve". Y al revés:
construir semanas sin preguntar a nadie.

## Cuándo se activa

- El usuario dice "tengo una idea", "quiero hacer un negocio de…", "¿y si hago…?", "esto no funcionó, mejor
  hago otra cosa". → Antes de cualquier código, corre este proceso.
- Si ya construyó, igual aplica: el experimento es conseguir los primeros usuarios/clientes reales.
- Explícale en 1–2 frases: "Antes de construir, vamos a probar en 7 días si alguien lo quiere, con una meta
  escrita. Así sabes si vale la pena sin perder semanas."

## Paso 1 — Cliente y problema (15 min, en el archivo del experimento)

Responde en una línea cada una (si no se puede, ese es el primer hallazgo):
1. **¿Quién exactamente?** Persona concreta y dónde está ("dueñas de tiendas de ropa que venden por Instagram en tu ciudad",
   no "negocios").
2. **¿Qué problema, cada cuánto?** ¿Le duele hoy, con frecuencia?
3. **¿Qué hace hoy para resolverlo?** (si nada, puede que no le importe).
4. **¿Por qué pagaría / usaría lo tuyo** en vez de lo actual?
5. **Supuesto más riesgoso**: lo que, si es falso, mata la idea. El experimento prueba **ese** supuesto.

## Paso 2 — Elegir la prueba más barata (≤ 7 días)

| Prueba | Qué valida | Cuándo usarla |
|---|---|---|
| **5–10 conversaciones** con el cliente exacto | Que el problema existe y cómo lo resuelven hoy | Siempre primero; 2–3 días |
| **Landing + lista de espera** | Que el mensaje atrae a gente que deja su correo | Producto digital (app, terminal, herramienta). Ver `landing-que-convierte` (cerebro-web) si está instalada |
| **Preventa / apartado** | Que pagan (la señal más fuerte) | Servicios, cursos, productos con fecha de entrega |
| **Servicio manual (concierge)** | Que el resultado vale para alguien antes de automatizar | Automatizaciones, bots, servicios web |
| **Prototipo de 1 mecánica** | Que la parte central es divertida/útil | Juegos: 1 mecánica jugable, sin menús ni tienda |

Conversaciones (estilo *The Mom Test*): pregunta por **lo que ya hicieron**, no por opiniones del futuro.
- Bien: "¿Cuándo fue la última vez que te pasó? ¿Qué hiciste? ¿Cuánto te costó?"
- Mal: "¿Usarías una app que…?", "¿Te parece buena idea?" (todos dicen que sí por amabilidad).
- Cierra pidiendo algo real: correo para la lista, una cita, un anticipo. Un "sí" sin compromiso no cuenta.

## Paso 3 — Métricas escritas ANTES de empezar

En el archivo del experimento, antes del día 1, escribe:
1. **Exposición mínima**: cuántas personas del público correcto deben ver la oferta para que el resultado
   cuente (ej.: 10 conversaciones, 300 visitas a la landing, 3 videos con 1,000+ vistas cada uno, 200 volantes
   entregados en mano en la zona correcta). **Si no se alcanza, el experimento no falló: no se hizo.**
2. **Éxito** (número): ej. "≥ 30 registros en lista de espera" o "≥ 2 preventas pagadas".
3. **Fracaso** (número): ej. "con 300 visitas, < 5 registros".
4. **Zona gris** (entre ambos): qué haces (cambiar el mensaje y repetir 7 días).
5. Presupuesto máximo de tiempo y dinero.

Los números de ejemplo son ilustrativos, **no promedios de industria**: el usuario los elige con Claude
según su caso. No inventes "tasas de conversión típicas"; si hace falta una referencia, búscala con fuente.

## Paso 4 — ¿Falló la idea o falló el canal?

Revisa el embudo en orden. **El primer escalón roto es el diagnóstico**; no saltes al final.

| Escalón | Pregunta | Si falla, significa | Qué hacer |
|---|---|---|---|
| 1. Exposición | ¿La vio suficiente gente **del público correcto**? | Falló el **canal/ejecución** | Más volumen o canal donde sí está ese público (DM directos, grupos, Workana, visitar en persona). No toques la idea |
| 2. Interés | ¿Se detuvieron? (retención del gancho, clics, respuestas) | Falló el **mensaje** | Nuevo gancho/titular/oferta, misma idea. Prueba 2–3 variantes antes de concluir |
| 3. Intención | ¿Dejaron correo, pidieron precio, agendaron? | Oferta poco clara o poco valiosa | Hablar con los que sí mostraron interés: ¿qué les faltó? |
| 4. Pago/uso | ¿Pagaron, apartaron o usaron de verdad? | Falló el **valor o el precio** — aquí sí se cuestiona la idea | Cambiar segmento, problema o precio (pivotar) |

Casos típicos:
- "Repartí volantes 4 días y nadie llamó" → ¿cuántos, a quién, con qué oferta y CTA? Si no hubo exposición
  mínima ni un CTA fácil (ej. "manda 'PÁGINA' por WhatsApp"), es **canal/ejecución**.
- "Mis videos tienen pocas vistas" → con < 1,000 vistas por video no hay datos para juzgar la idea. Es
  **canal** (gancho, constancia, formato; ver `contenido-para-redes`), y además el contenido no es la única
  vía: 10 mensajes directos a clientes exactos dan más información en 2 días.
- "Hablé con 10 y todos dicen que está padre pero nadie paga" → escalón 4: la idea/precio no convence.

## Paso 5 — Decidir (con lo escrito, no con el ánimo)

- **Seguir**: pasó el umbral de éxito → construye la versión mínima que entregue eso, nada más.
- **Repetir con cambio**: zona gris, o falló escalón 1–2 → cambia **una** cosa (canal o mensaje) y otro ciclo de 7 días.
- **Pivotar**: falló el escalón 4 con exposición suficiente → cambia segmento o problema; nuevo experimento.
- **Abandonar** cuando: (a) 3 ciclos de 7 días con exposición mínima cumplida y sin pasar el escalón 3, o
  (b) descubriste que no quieres hacerlo (válido, pero escríbelo así, no como "la idea no sirve").
- Antes de empezar otra idea, cierra la anterior con 3 líneas de aprendizaje en su archivo.
- **Un experimento activo a la vez por proyecto.** Si el usuario quiere saltar a otra idea a mitad del ciclo,
  recuérdale la fecha de cierre ya escrita y propón anotar la nueva en `experimentos/ideas.md`.

## Entregable: archivo del experimento

Crea `experimentos/AAAA-MM-DD-slug.md` con la plantilla de `references/plantilla-experimento.md` (fecha real:
`date +%F`). Llena las secciones 1–3 **antes** de lanzar; 4–5 al cerrar. Mantén `experimentos/README.md` con
una línea por experimento: fecha, idea, resultado (seguir / repetir / pivotar / abandonar).

## Verifica antes de confiar

Si el experimento usa una herramienta externa (formulario, landing, pasarela de pago, anuncios), verifica
precios y límites actuales en la doc oficial antes de recomendarla. Para cobrar preventas en México, ver
`cobros-y-suscripciones` (cerebro-web) si está instalada.

## Fuentes (verificado nov 2026)

- Conversaciones con clientes sin sesgo: Rob Fitzpatrick, *The Mom Test* — https://www.momtestbook.com/
- El resto son reglas de proceso, sin datos externos que cambien.
