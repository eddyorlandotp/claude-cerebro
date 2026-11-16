---
name: investigar-antes-de-codear
description: Antes de codear contra una API, SDK, librería o CLI externa - revisa la versión instalada, lee la doc actual (Context7 o doc oficial), no inventa endpoints ni campos, prueba una llamada mínima real y anota lo aprendido. Usar con API, SDK, endpoint, integración, "conecta con X", error 400/404.
---

# Investigar antes de codear

Tu conocimiento de APIs tiene fecha de corte y mezcla versiones. Las APIs de cripto, Cloudflare, Roblox y frameworks web cambian cada pocos meses. El síntoma típico: código que se ve perfecto y llama a un endpoint que ya no existe, con un campo que nunca existió. Esta skill evita eso.

## Cuándo aplica (no la saltes)

- Vas a escribir o modificar código que llama a una API HTTP, un SDK, una librería que no está ya usada igual en el repo, o un CLI con flags que no usaste hoy.
- Recibes un error 400/401/404/422, `undefined is not a function`, "property does not exist on type", o un campo `undefined` en la respuesta.
- Vas a actualizar una dependencia.

No aplica si el mismo patrón ya existe y funciona en el repo: cópialo de ahí (es la mejor documentación de la versión instalada).

## Paso 1. ¿Qué versión está instalada?

```bash
npm ls <paquete>                       # versión real resuelta (o pnpm why / bun pm ls)
grep -n '"<paquete>"' package.json     # rango pedido
pip show <paquete>                     # Python
npx wrangler --version                 # CLIs: siempre --version
```
Si no está instalada, decide la versión ANTES de instalar: la última estable según el registro (`npm view <paquete> version`) salvo que el proyecto exija otra.

Anota la versión mayor. Ejemplos de la trampa: muchos SDKs reescribieron su API entre versiones mayores (v1 → v2), y los ejemplos de internet mezclan ambas.

## Paso 2. Lee la doc de ESA versión

Orden de preferencia:
1. **Context7** (si el MCP `context7` está instalado): `resolve-library-id` con el nombre de la librería, luego `query-docs` con el id y tu pregunta concreta. Incluye la versión en la pregunta.
2. **Doc oficial** con WebFetch. Prueba primero `<sitio-de-docs>/llms.txt`, que muchas docs publican como índice para LLMs. Si la doc tiene selector de versión, usa la que corresponde.
3. **El paquete instalado** (la verdad local):
   ```bash
   ls node_modules/<paquete>/
   cat node_modules/<paquete>/package.json | grep -E '"(version|types|main|exports)"'
   grep -rn "<funcion>" node_modules/<paquete>/dist/*.d.ts | head
   ```
   Los `.d.ts` te dicen los nombres y tipos exactos de esta versión. El `CHANGELOG.md` te dice qué cambió.
4. Para APIs HTTP: la referencia oficial (OpenAPI/endpoint reference) del proveedor. Nunca un blog o una respuesta de foro como fuente única.

Lo que debes sacar de la doc antes de escribir código:
- URL base y endpoint exacto, método HTTP.
- Autenticación (header, query param, OAuth) y de dónde sale la key.
- Parámetros obligatorios, tipos y unidades (ojo: lamports vs SOL, decimales de tokens, milisegundos vs segundos).
- Forma de la respuesta y de los errores.
- Límites: rate limit, tamaño, costo por llamada o créditos del plan (a nov 2026: verifícalos en la página de precios del proveedor; cambian seguido).

## Paso 3. Nunca inventes

- Si un endpoint, campo, parámetro o flag no aparece en la doc ni en los tipos, **no existe** para ti. Di "no lo encontré en la doc de la versión X" y busca alternativa o pregunta.
- Prohibido: "probablemente el endpoint es `/v1/...`", "debería tener un campo `price`", completar parámetros por intuición.
- Si la doc es ambigua, la llamada mínima del paso 4 decide.
- Cuando escribas código basado en una suposición no verificada, márcala con un comentario `// SIN VERIFICAR: <qué>` y díselo al usuario.

## Paso 4. Llamada mínima real ANTES de construir encima

1. Escribe una sonda de 10-20 líneas (`scripts/sonda-<api>.mjs`, o un `curl`) que haga UNA llamada real con la key del entorno (sin imprimirla).
2. Imprime: status HTTP, headers relevantes (rate limit) y el cuerpo, recortado si es enorme.
3. Compara con lo que esperabas. Si difiere, la realidad gana: ajusta tu modelo, no la sonda.
4. Para cualquier cosa que mueva dinero: la sonda solo LEE (precios, cotizaciones, balances) o usa devnet/testnet/simulación. Nunca envíes una transacción real como "prueba".
5. Guarda una respuesta de ejemplo SIN datos sensibles en `docs/apis/<api>-ejemplo.json` si te sirve para tests.

Solo después de que la sonda funciona, escribe el código real, reutilizando exactamente la forma que viste.

Ejemplo de sonda con curl (la key sale del entorno, no se imprime):
```bash
curl -sS -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $MI_API_KEY" "https://api.ejemplo.com/v1/recurso?limit=1" | head -c 2000
```

## Paso 5. Fija versiones

- Commitea el lockfile.
- SDKs críticos (pagos, blockchain, auth): versión exacta `npm install --save-exact <paquete>@<versión>`.
- URLs de CDN o de API con versión explícita en la ruta (`/v6/`, `@1.2.3`), nunca `latest`.
- No actualices una dependencia mayor "de paso". Si hace falta, rama aparte (skill `red-de-seguridad-git`) y repite pasos 1-4.

## Paso 6. Anota lo aprendido en el CLAUDE.md del proyecto

En la sección `## APIs verificadas` (plantilla en `arrancar-proyecto`), una línea por API:
```markdown
- Jupiter Swap API <versión/ruta> — <URL doc> — verificado 2026-11-16. Trampa: <lo que costó averiguar>.
```
Así la próxima sesión no repite la investigación ni el error.

## Cuando una llamada falla

1. Muestra status y cuerpo de la respuesta (sin headers de auth). El mensaje de error suele decir exactamente qué falta.
2. Vuelve a la doc con ese mensaje. No cambies parámetros al azar.
3. Si dos intentos fallan, usa `systematic-debugging` de superpowers (si está) y reporta al usuario lo que sabes.

## Errores comunes

- Usar un ejemplo de la v1 con la librería v2 instalada.
- Confiar en el autocompletado de tu memoria para nombres de campos.
- Construir 300 líneas encima de una llamada que nunca se probó.
- Probar con dinero real "porque es poquito".
- Dejar la key en el código de la sonda.
- No leer los límites de rate y quemar el plan gratuito en un loop.

## Verifica antes de confiar

Esta skill ES la regla: confirma APIs con Context7 (MCP `context7`, si está instalado) o WebFetch a la doc oficial antes de escribir código contra ellas. Para Cloudflare, Supabase, Stripe y Mercado Pago, usa además sus plugins oficiales si están instalados.

## Fuentes (verificado nov 2026)

- Context7 (herramientas `resolve-library-id` y `query-docs`, servidor `https://mcp.context7.com/mcp`): https://github.com/upstash/context7
- `npm install --save-exact`: https://docs.npmjs.com/cli/commands/npm-install
- `npm ls`: https://docs.npmjs.com/cli/commands/npm-ls
- `npm view`: https://docs.npmjs.com/cli/commands/npm-view
- Índice `llms.txt` de docs (ejemplo Claude Code): https://code.claude.com/docs/llms.txt
