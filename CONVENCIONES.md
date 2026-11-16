# Convenciones para escribir skills de claude-cerebro

Este repo es un marketplace de plugins para **Claude Code** (la app de terminal). El usuario construye todo **dirigiendo a Claude Code, sin escribir código él mismo**, en Linux (CachyOS + Hyprland + fish). Proyectos típicos: una terminal web de trading en Solana (Jupiter, Helius, Cloudflare Workers/Tunnel), un bot de copy trading 24/7, juegos de Roblox desarrollados en Linux, un juego indie para Steam, home lab y servidor de Minecraft Bedrock, y contenido para redes. El problema a resolver: Claude "se sabe la teoría pero no la aplica": planea mal, adivina APIs y declara cosas terminadas sin probarlas.

El objetivo de cada skill es **corregir comportamiento concreto** de Claude en esa área, no ser un tutorial.

## Estructura de archivos

```
plugins/<plugin>/
  .claude-plugin/plugin.json      (ya existe, no lo toques)
  skills/<nombre-skill>/SKILL.md
  skills/<nombre-skill>/references/<tema>.md   (opcional: detalle largo que se carga solo si hace falta)
  skills/<nombre-skill>/scripts/<script>       (opcional: scripts que Claude ejecuta; deben funcionar en Linux con bash/python3/node)
  agents/<nombre>.md              (opcional, solo si se te indica)
```

- Nombre de carpeta de skill: kebab-case, sin acentos, en español (ej. `jupiter-swaps`, `roblox-rojo-linux`).
- Frontmatter mínimo de SKILL.md:

```markdown
---
name: <igual-que-la-carpeta>
description: <qué hace + CUÁNDO usarla, con palabras clave en español e inglés que el usuario diría. Máx 250 caracteres (ideal) y nunca más de 300. Sin < ni >.>
---
```

## Reglas de contenido

1. **Escribe en español mexicano neutro**, términos técnicos en inglés como se usan (endpoint, swap, priority fee). Tutea.
2. **Cuerpo de SKILL.md: 80–250 líneas.** Lo largo (tablas de endpoints, ejemplos de código grandes) va en `references/*.md` y el SKILL.md dice cuándo leerlo.
3. **Instrucciones accionables, en imperativo**: reglas, checklists, "antes de X haz Y", errores comunes y cómo evitarlos, comandos exactos. Nada de relleno ni "es importante considerar".
4. **Cero datos inventados.** Todo endpoint, límite, precio, comando, versión o nombre de paquete debe verificarse HOY contra la documentación oficial (WebSearch/WebFetch). Pon al final del SKILL.md una sección `## Fuentes (verificado nov 2026)` con las URLs que usaste. Si algo cambia seguido (precios, límites de free tier, versiones), escríbelo como "a nov 2026: X — verifícalo en <URL> antes de depender de esto".
5. **Incluye una regla de "verifica antes de confiar"**: indica a Claude que confirme APIs con Context7 (MCP `context7`, si está instalado) o WebFetch a la doc oficial antes de escribir código contra una API externa.
6. **Seguridad y dinero real**: en todo lo de cripto/pagos, reglas duras: nunca pedir, imprimir, loguear ni commitear llaves privadas/seed phrases; billeteras dedicadas con poco saldo; simular antes de enviar; límites de pérdida; confirmación del usuario antes de cualquier acción que mueva fondos reales o sea irreversible.
7. **Adaptado a un no-programador**: cuando la skill implique una decisión, Claude debe explicar en 1–3 frases simples qué va a hacer y por qué, y al terminar decir cómo comprobarlo uno mismo.
8. **No dupliques** lo que ya cubren estos plugins oficiales que el usuario también instala: `superpowers` (brainstorming, writing-plans, TDD, systematic-debugging, verification-before-completion, subagent-driven-development, code review), `cloudflare` (APIs de Workers/Wrangler/DO), `context7`, `frontend-design`, `playwright`, `supabase`, `stripe`, `mercadopago`, `security-guidance`, `expo`, `mcp-server-dev`, `plugin-dev`, `chrome-devtools-mcp`, `vercel`, `netlify-skills`, y de anthropics/skills: `claude-api` y `document-skills` (pdf/docx/xlsx/pptx). Puedes referirte a ellos ("usa la skill systematic-debugging de superpowers si está disponible").
9. **Sin datos personales** (el repo puede ser público): nada de direcciones de billetera, teléfonos, correos, nombres de clientes. Habla de "el usuario".
10. Licencia: si adaptas ideas de un repo MIT, menciónalo en Fuentes. No copies texto largo literal de documentación.

11. **Descripciones cortas (≤250 caracteres)**: el repo tendrá 80+ skills y cada descripción ocupa contexto en cada turno. Lo primero de la descripción debe ser el caso de uso principal.

## Calidad: el test

Antes de dar por terminada una skill, pregúntate: "Si Claude Code lee esto a mitad de una tarea, ¿hará algo distinto y mejor que sin leerlo?" Si la respuesta es no, recórtala o elimínala. Es mejor entregar menos skills excelentes que muchas flojas.
