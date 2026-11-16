# Plantilla de CLAUDE.md del proyecto (máximo 60 líneas)

Copia el bloque, borra las secciones que no apliquen y llena SOLO con datos verificados. Lo que no verificaste, márcalo `(sin verificar)`.

~~~markdown
# <Nombre del proyecto>

<Qué hace en una frase. Quién lo usa.>

## Stack
- Lenguaje/runtime: <ej. TypeScript en Cloudflare Workers>
- Framework/librerías clave: <nombre@versión> — docs: <URL>
- Gestor de paquetes: <npm|pnpm|bun> (no cambiar)
- Despliegue: <dónde y cómo>

## Comandos (probados el AAAA-MM-DD)
- Instalar: `<comando>`
- Dev: `<comando>` → http://localhost:<puerto>
- Test: `<comando>` (<N> tests)
- Build: `<comando>`
- Deploy: `<comando>` — SOLO con confirmación del usuario
- Logs en producción: `<comando>`

## Rutas importantes
- `<ruta>` — <qué hay ahí>
- `<ruta>` — <punto de entrada>
- `<ruta>` — <configuración>

## Variables de entorno
Lista completa en `.env.example`. Producción: <dónde viven los secrets, ej. `wrangler secret put`>.
Nunca imprimir ni loguear sus valores.

## Reglas del proyecto
- El usuario no programa: explica antes de cambios grandes y confirma lo irreversible (skill modo-mentor).
- Commits pequeños; rama antes de cambios riesgosos. Nunca force-push a main.
- Antes de usar una API externa, verifica la doc de la versión instalada.
- <regla específica, ej. "Todo swap se simula antes de enviarse">
- <regla específica, ej. "Límite de pérdida diaria: nunca subirlo sin confirmación">

## APIs verificadas
- <API> v<versión> — <URL doc> — verificado AAAA-MM-DD. Trampa: <lo que costó averiguar>

## Memoria
Estado y pendientes: <bóveda de Obsidian: Proyectos/<proyecto>/ | NOTAS.md>
~~~

## Reglas para llenarla

- Cada comando lo corriste tú hoy o está marcado `(sin verificar)`.
- Nada de secretos, solo nombres de variables.
- Si pasa de 60 líneas, mueve detalle a `docs/` y enlázalo con `@docs/archivo.md` (Claude Code expande los imports `@ruta` al iniciar, así que solo importa lo que de verdad se necesita siempre).
- Actualiza "APIs verificadas" cada vez que aprendas algo que te habría ahorrado tiempo.
