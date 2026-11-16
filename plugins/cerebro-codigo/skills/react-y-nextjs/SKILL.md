---
name: react-y-nextjs
description: Arquitectura React - Vite+React vs Next.js App Router, Server vs Client Components, data fetching, Server Actions, estado, Tailwind 4, errores de hidratación y deploy en Cloudflare, Vercel o Netlify. Usa al crear o arreglar una app React o Next.
---

# React y Next.js sin pelear con el framework

Esta skill decide **arquitectura y código**. La estética (tipografía, colores, layout bonito) la cubre `frontend-design`; el SEO, `seo-tecnico` de `cerebro-web`. Corrige esto de Claude: elige Next.js para todo, pone `"use client"` en la página entera, escribe Tailwind 3 (`tailwind.config.js`, `@tailwind base`), mete secretos en el cliente, y "arregla" hidratación con `suppressHydrationWarning` sin entender la causa.

## Antes de escribir código

1. **Lee `package.json`** (versión de `next`, `react`, `vite`, `tailwindcss`) y, si existe, `AGENTS.md`: `create-next-app` lo genera por defecto para guiar a agentes con la API vigente.
2. **Verifica antes de confiar**: Next cambia rápido (caché, APIs async). Antes de usar una API de Next, React o una librería, confírmala con Context7 (MCP `context7`) o WebFetch a la doc oficial. Las de nextjs.org se pueden pedir en markdown y tienen índice en `/docs/llms.txt`.
3. **Explica en 1–3 frases** por qué eliges Vite o Next.

Versiones a nov 2026 (npm `latest`): React 19.3, Next.js 16.4, Vite 8.3, Tailwind CSS 4.3. Vite pide Node 20.19+ o 22.12+.

## ¿Vite + React o Next.js?

| Si la app... | Usa |
|---|---|
| Vive detrás de login, es un dashboard, una terminal de trading en tiempo real (websockets, gráficas), una herramienta interna o un juego web | **Vite + React** (SPA). Más simple, build estático, se sirve gratis de un CDN |
| Necesita SEO o preview bonita al compartir en cada página (catálogo, blog, landing con muchas rutas) | **Next.js App Router** |
| Necesita llamar APIs con llaves secretas o base de datos y no quieres un backend aparte | Next.js (Server Components / Route Handlers) o Vite + un Worker como API |
| Es una landing de una sola página | Vite o HTML estático; ver `landing-que-convierte` |

Regla: si dudas, **Vite**. Pasar de Vite a Next después es posible; quitarle complejidad a Next es más difícil.

- Vite: `pnpm create vite mi-app --template react-ts`.
- Next: `pnpm create next-app mi-app`. Por defecto: TypeScript, ESLint, Tailwind, App Router, Cache Components, Turbopack y `AGENTS.md`.

## Next.js: Server vs Client Components

- Por defecto **todo en `app/` es Server Component**: corre en el servidor, puede leer la base de datos y usar secretos, y no manda JavaScript al navegador.
- Pon `"use client"` **solo en el componente hoja que necesita** estado, eventos (`onClick`), efectos o APIs del navegador (`window`, `localStorage`). Todo lo que ese archivo importa se vuelve cliente, así que no lo pongas en `layout.tsx` ni en `page.tsx`.
- Props de Server a Client deben ser **serializables** (datos planos; no funciones, no clases). Excepción: Server Actions sí se pueden pasar.
- Para meter un Server Component dentro de uno cliente (modal, tabs), pásalo como `children`.
- Context (tema, sesión): crea un provider con `"use client"` que reciba `children` y úsalo lo más abajo posible del árbol.
- Librería de terceros que usa hooks y no tiene `"use client"`: envuélvela en tu propio archivo con `"use client"` que la reexporte.
- **Secretos**: solo las variables `NEXT_PUBLIC_*` llegan al navegador; las demás quedan vacías ahí. En archivos que usan secretos o la base, pon `import "server-only"` para que el build falle si alguien los importa desde cliente.
- En Next 16 `params` y `searchParams` son **Promises**: `const { id } = await params`.

## Next.js: datos

- Lee datos en Server Components con `async`/`await` (fetch o la base directo). `fetch` **no se cachea por defecto**; para cachear usa la directiva `"use cache"` (Cache Components). Requests idénticos dentro de un render se deduplican solos; para consultas a la base usa `React.cache`.
- **Evita cascadas**: si dos requests no dependen entre sí, arráncalos juntos con `Promise.all` (o `Promise.allSettled` si uno puede fallar).
- **Streaming**: envuelve lo lento en `<Suspense fallback={...}>` o agrega `loading.tsx` a la ruta para que el resto de la página salga de inmediato.
- **Mutaciones**: Server Functions/Actions (`"use server"`) usadas en `<form action={...}>`. Son alcanzables por POST directo desde fuera: **verifica sesión y permisos dentro de cada una** y valida `FormData` con zod. Después de mutar: `revalidatePath`, `updateTag`/`revalidateTag` o `refresh()`; `redirect()` lanza una excepción, así que va al final.
- Webhooks y APIs públicas: `app/api/.../route.ts` (Route Handlers). Ver `apis-y-webhooks`.

## Vite + React: datos y estado

- Datos del servidor: **TanStack Query** o SWR (caché, reintentos, loading y error ya resueltos). No hagas `useEffect` + `fetch` + tres `useState` a mano en cada componente.
- Las llaves secretas **nunca** van en una SPA: todo lo que está en `import.meta.env.VITE_*` es público. Si hay que llamar una API con llave, pon un Worker o backend en medio.
- Tiempo real (precios, trades): una sola conexión websocket en un módulo o provider, con reconexión y backoff; los componentes se suscriben. Acumula actualizaciones y pinta a lo mucho unas veces por segundo para no congelar la UI.

## Estado (ambos)

Sube solo lo necesario, en este orden: `useState` local → subir al padre común → filtros y pestañas en la URL (`searchParams`, sobreviven a recargar y se comparten) → Context → una store (Zustand) solo si varios lugares lejanos escriben el mismo estado. No guardes en estado lo que puedes calcular de otro estado.

## Tailwind CSS 4 (no escribas Tailwind 3)

- **No hay `tailwind.config.js`** ni `@tailwind base/components/utilities`. La personalización va en CSS con `@theme`.
- Vite: `pnpm add tailwindcss @tailwindcss/vite`, agrega `tailwindcss()` a `plugins` en `vite.config.ts` y en el CSS principal `@import "tailwindcss";`.
- Next: `create-next-app` ya lo trae. A mano: `tailwindcss @tailwindcss/postcss postcss`, `postcss.config.mjs` con el plugin `"@tailwindcss/postcss"` y `@import "tailwindcss";` en `app/globals.css`.
- Si ves clases que no aplican, revisa primero que el CSS con `@import "tailwindcss"` esté importado en el layout o `main.tsx`.

## Errores de hidratación (Next)

"Text content does not match server-rendered HTML" = lo que pintó el servidor no es igual al primer render del navegador. Busca la causa en este orden:

1. **HTML mal anidado**: `<div>` o `<p>` dentro de `<p>`, `<a>` dentro de `<a>`, `<button>` dentro de `<button>`.
2. **Valores distintos en servidor y cliente**: `Date.now()`, `new Date()`, `Math.random()`, `toLocaleString()` sin zona fija, `typeof window !== "undefined"` o `localStorage` dentro del render.
3. Extensiones del navegador que modifican el HTML (prueba en ventana privada sin extensiones).
4. Un CDN que modifica el HTML.

Arreglos, en orden de preferencia: corrige el HTML; mueve lo que depende del navegador a `useEffect`; carga el componente sin SSR (`dynamic(() => import(...), { ssr: false })`, solo desde un Client Component). `suppressHydrationWarning` solo para un timestamp inevitable, y es de un solo nivel.

## Deploy

| App | Opción simple | Notas |
|---|---|---|
| Vite SPA | Cloudflare Workers con static assets (`pnpm create cloudflare mi-app --framework=react`) | En la config de Wrangler `assets.not_found_handling = "single-page-application"` para que las rutas del cliente no den 404. Límites: `cloudflare-gratis-decisiones` |
| Next.js | Vercel (soporte nativo) o Netlify | Usa los plugins `vercel` o `netlify-skills` para los detalles |
| Next.js en Cloudflare | `pnpm create cloudflare mi-app --framework=next` | A nov 2026 Cloudflare recomienda **vinext** (plugin de Vite de Cloudflare que reimplementa la API de Next; "en desarrollo activo", ~94% de la API de Next 16). El adaptador OpenNext queda para apps que ya lo usan. Revisa la tabla de compatibilidad antes de prometer que todo funciona |

Antes de decir "desplegado": `pnpm build` local sin errores, abrir la URL real y probar el flujo principal (checklist completo en `deploy-y-monitoreo` de `cerebro-base`).

## Al terminar

Corre `pnpm build` y `pnpm exec tsc --noEmit` (o el script `typecheck`), abre la app en el navegador (o con el plugin `playwright`) y revisa la consola sin errores ni avisos de hidratación. Dile al usuario qué URL abrir y qué clic hacer para comprobarlo.

## Fuentes (verificado nov 2026)

- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/getting-started/fetching-data
- https://nextjs.org/docs/app/getting-started/mutating-data
- https://nextjs.org/docs/app/api-reference/cli/create-next-app
- https://nextjs.org/docs/messages/react-hydration-error
- https://vite.dev/guide/
- https://tailwindcss.com/docs/installation/using-vite y https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ y https://vinext.dev/
- https://registry.npmjs.org (versiones `latest` de next, react, vite, tailwindcss)
