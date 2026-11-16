---
name: productividad-y-organizacion
description: Sistema simple con escuela, trabajo y muchos proyectos - una lista de pendientes, priorizar lo que mueve dinero, bloques de tiempo, revisión semanal y cuándo pausar o dejar un proyecto. Usa con pendientes, organizar, semana, prioridades.
---

# Productividad y organización

El error que corrige: Claude propone sistemas complicados (Notion con 12 bases, etiquetas, apps nuevas), reorganiza todo de golpe y trata los 5 proyectos como igual de urgentes. Con escuela + trabajo + varios emprendimientos, lo que funciona es **una lista, pocos proyectos activos y una revisión semanal** en archivos Markdown que Claude puede leer y actualizar.

## Reglas

1. **Un solo lugar para pendientes.** No crees listas paralelas (una en el chat, otra en el proyecto, otra en una app). Si existe bóveda de Obsidian, todo vive ahí (estructura y localización de la bóveda: `memoria-obsidian` de cerebro-base). Si no, `~/vida/` en Markdown.
2. **No propongas apps ni sistemas nuevos** salvo que el usuario lo pida. Mejora el que ya tiene.
3. **Máximo 2 proyectos activos** a la vez además de escuela y trabajo. El resto está en pausa con fecha de revisión.
4. **Máximo 3 tareas en "Hoy".** Si pide meter más, pregunta cuál sale.
5. **Explica cada recorte en 1–3 frases** ("Pauso el proyecto B hasta el 1 de diciembre porque esta semana tienes exámenes y el proyecto A es el que te puede dar dinero este mes").
6. Para guardar el estado de un proyecto al cerrar sesión usa `cierre-de-sesion`; esta skill es la vista de toda la vida, no la de un solo repo.

## Archivos

```
<bóveda o ~/vida>/
  Pendientes.md                 la lista única (ver formato abajo)
  Proyectos/Inicio.md           índice de proyectos con estado Activo / Pausado / Archivado (memoria-obsidian)
  Proyectos/<proyecto>/...      estado, pendientes y decisiones de cada proyecto (memoria-obsidian)
  Semanas/AAAA-Www.md           plan de bloques + revisión semanal
```

Plantillas exactas: lee `references/plantillas.md` antes de crear cualquiera de estos archivos.

`Pendientes.md` tiene secciones fijas: **Bandeja** (todo lo nuevo, sin ordenar) → **Hoy** (≤3) → **Esta semana** → **Con fecha** (escuela, trámites, pagos; con `(fecha: AAAA-MM-DD)` al final) → **Algún día**. De cada proyecto activo solo aparece **la siguiente acción concreta**; el detalle vive en `Proyectos/<proyecto>/pendientes.md`.

Una tarea bien escrita empieza con verbo y se puede hacer en una sentada: "Mandar propuesta a [cliente] por WhatsApp" sí; "Página web" o "Marketing" no.

## Priorizar: qué va primero

Para cada pendiente, en este orden:

1. **¿Tiene fecha externa con consecuencia?** (examen, entrega escolar, trámite que vence, pago, turno de trabajo) → va primero. No se negocia.
2. **¿Mueve dinero en los próximos 30 días?** (cobrar, entregar a un cliente que paga, lanzar algo que ya tiene compradores, postular a un empleo) → siguiente.
3. **¿Desbloquea algo de 1 o 2?** → siguiente.
4. **Construye a futuro** (aprender, mejorar el producto sin cliente esperando) → si sobra tiempo.
5. **Curiosidad o idea nueva** → a "Algún día" o a `experimentos/ideas.md` (ver `validar-idea` de cerebro-negocio). No se empieza hoy.

Cuando el usuario diga "tengo mil cosas", haz esto: vacía todo en Bandeja → clasifica cada cosa con 1–5 → propone 3 para Hoy → pregunta si está de acuerdo. Nada más.

## Bloques de tiempo de la semana

1. Primero lo **fijo**: horario de escuela, turno de trabajo, traslados, comidas, sueño (pregunta horas reales; no asumas).
2. En los huecos, como máximo **1–2 bloques profundos de 60–90 min por día** para el proyecto activo principal. Mejor en el mismo horario cada día.
3. Tareas cortas (mensajes, pagos, trámites en línea) **juntas** en un bloque de 30 min, no regadas.
4. Deja al menos un bloque libre por semana para atrasos y uno de descanso sin pantallas de trabajo.
5. Semana de exámenes o entregas: los bloques de proyecto bajan a mantenimiento (cobrar y responder clientes) y el resto va a estudio (`aprender-y-estudiar`).
6. El plan va en `Semanas/AAAA-Www.md` como tabla. Si tiene un calendario conectado (MCP de Google Calendar u otro), ofrece crear los bloques, solo con su "sí".

## Revisión semanal (30 min, mismo día cada semana)

Guíala tú con este guion, leyendo los archivos reales, no de memoria:

1. **Vacía**: ¿qué hay en la Bandeja, en notas sueltas, en mensajes pendientes? Todo a `Pendientes.md`.
2. **Mira atrás**: ¿qué se terminó? ¿qué se movió de semana dos veces o más? (señal de que es demasiado grande o no importa).
3. **Dinero de la semana**: cuánto entró y salió por proyecto (si usa `finanzas-personales-basicas`, del último resumen). Un proyecto que solo gasta tiempo y dinero se marca para la pregunta 5.
4. **Fechas próximas** (14 días): exámenes, entregas, pagos, citas, vencimientos (e.firma, tarjetas, dominios).
5. **Proyectos**: para cada activo, ¿sigue activo? Para cada pausado, ¿llegó su fecha de revisión?
6. **Planea**: siguiente acción de cada activo, bloques de la semana, 3 tareas para el primer día.
7. Escribe todo en la sección "Revisión" de `Semanas/AAAA-Www.md` y actualiza `Proyectos/Inicio.md`.

## Cuándo pausar o dejar un proyecto

Propón **pausar** (no matar) si se cumple alguna:
- Hay más de 2 proyectos activos.
- Lleva 3 semanas sin avanzar su siguiente acción.
- Viene un periodo de exámenes o un trabajo nuevo.
- No mueve dinero en 90 días y no hay un experimento con fecha que lo vaya a probar.

Pausar bien: en `Proyectos/<proyecto>/estado.md` escribe dónde quedó, qué sigue al volver, la **fecha de revisión** y la **condición para reactivarlo** ("si consigo 3 interesados", "en vacaciones"). Cambia su estado a Pausado en `Inicio.md`. Si tiene servicios que cobran (hosting, dominios, APIs, bots corriendo), lista cuáles y pregunta si se apagan; un bot pausado no debe quedarse moviendo dinero.

Propón **archivar** cuando: pasaron dos fechas de revisión sin ganas de volver, o `validar-idea` ya dio la conclusión de abandonar. Archivar = 3 líneas de aprendizaje en su `estado.md`, estado Archivado, servicios dados de baja (con su confirmación) y fuera de la vista diaria. Recuérdale que dejar un proyecto es una decisión válida, no un fracaso.

## Al terminar

Di: cuántas tareas quedaron en Hoy y cuáles, qué proyectos quedaron activos y cuáles en pausa (con fecha), y cuándo es la siguiente revisión semanal. Cómo comprobarlo él mismo: abrir `Pendientes.md` mañana y ver si las 3 de Hoy siguen teniendo sentido.

## Verifica antes de confiar

Antes de crear archivos, revisa si ya existe un sistema (busca `Pendientes.md`, `Proyectos/Inicio.md`, notas diarias) y adáptate a él. Si usas funciones de Obsidian (notas diarias, plantillas, plugins), confirma cómo funcionan en su ayuda oficial; no asumas plugins de la comunidad instalados.

## Fuentes (verificado nov 2026)

- Skill `memoria-obsidian` de cerebro-base (estructura `Proyectos/`, localización de la bóveda)
- Skill `validar-idea` de cerebro-negocio (criterios para abandonar o pivotar una idea)
- https://obsidian.md/help/plugins/daily-notes (Daily notes es plugin del núcleo; carpeta, plantilla, formato de fecha)
