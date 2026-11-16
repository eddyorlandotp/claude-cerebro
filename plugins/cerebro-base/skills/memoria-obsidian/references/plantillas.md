# Plantillas de la bóveda

Reemplaza `<proyecto>`, `<Nombre legible>`, fechas y rutas. Fechas en `AAAA-MM-DD`.

## Proyectos/Inicio.md

```markdown
---
tipo: indice
actualizado: 2026-11-16
tags:
  - claude/indice
---
# Proyectos

| Proyecto | Estado | Última sesión |
|---|---|---|
| [[Proyectos/<proyecto>/estado\|<Nombre legible>]] | activo — una línea de dónde va | 2026-11-16 |
```

(En tablas, el `|` del wikilink se escapa como `\|`.)

## Proyectos/<proyecto>/estado.md

Se REESCRIBE en cada cierre. Máximo ~40 líneas. Es la foto de hoy, no un historial.

~~~markdown
---
proyecto: <proyecto>
aliases:
  - <Nombre legible>
  - <otro nombre con el que el usuario lo llama>
estado: activo
repo: /ruta/absoluta/al/repo
rama: main
actualizado: 2026-11-16
tags:
  - proyecto/<proyecto>
---
# <Nombre legible> — estado

## En una frase
Qué es y para qué sirve.

## Dónde estamos
- Último avance: ...
- Verificado: ... (cómo se verificó)
- Sin verificar / roto: ...

## Siguiente paso
1. ... (el P0 de [[Proyectos/<proyecto>/pendientes|pendientes]])

## Cómo retomar
```bash
cd /ruta/absoluta/al/repo
git switch <rama>
<comando de dev o test>
```

## Enlaces
- Pendientes: [[Proyectos/<proyecto>/pendientes|pendientes]]
- Decisiones: [[Proyectos/<proyecto>/decisiones|decisiones]]
- Última bitácora: [[Proyectos/<proyecto>/bitacora/2026-11-16|2026-11-16]]
~~~

## Proyectos/<proyecto>/pendientes.md

```markdown
---
proyecto: <proyecto>
actualizado: 2026-11-16
tags:
  - proyecto/<proyecto>
---
# Pendientes

## P0 — bloquea o hay dinero/seguridad en riesgo
- [ ] <tarea> — **hecho cuando:** <criterio comprobable>

## P1 — lo siguiente
- [ ] ...

## P2 — algún día
- [ ] ...

## Hecho recientemente
- [x] <tarea> (2026-11-16)
```

Reglas: cada tarea con verbo + "hecho cuando". Mueve lo terminado a "Hecho recientemente" y conserva solo las últimas ~10.

## Proyectos/<proyecto>/decisiones.md

```markdown
---
proyecto: <proyecto>
tags:
  - proyecto/<proyecto>
  - decisiones
---
# Decisiones

## 2026-11-16 — <título corto>
- **Decisión:** ...
- **Por qué:** ...
- **Descartado:** ...
- **Revisar si:** ...
```

Solo se agregan entradas arriba de la anterior (la más nueva primero). No se editan las viejas; si una decisión cambia, agrega una nueva que diga "reemplaza a la del AAAA-MM-DD".

## Proyectos/<proyecto>/bitacora/AAAA-MM-DD.md

```markdown
---
proyecto: <proyecto>
fecha: 2026-11-16
tags:
  - proyecto/<proyecto>
  - bitacora
---
# 2026-11-16

## Qué se hizo
- ...

## Verificado
- `<comando>` → <resultado>

## Problemas / aprendizajes
- ...

## Commits
- `abc1234` <mensaje>

## Siguiente
- ...
```

Si hay varias sesiones el mismo día, agrega una sección `## Sesión 2` en la misma nota.
