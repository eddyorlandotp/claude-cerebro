---
name: typescript-node-moderno
description: Proyecto TypeScript/Node moderno y simple - Node LTS, ESM, tsconfig estricto, pnpm vs npm vs bun, correr .ts directo o con tsx, validar entradas y .env con zod, errores y estructura chica. Usa al crear o arreglar código TS/Node, scripts o bots.
---

# TypeScript + Node moderno

Corrige esto de Claude: usa versiones viejas de memoria (Node 18/20, CommonJS, `ts-node`, `dotenv`), mezcla gestores de paquetes, confía en datos externos sin validar, atrapa errores y los ignora, y declara "listo" sin haber corrido `tsc` ni el programa.

## Antes de escribir código

1. **Mira qué hay instalado, no lo supongas:** `node --version`, `cat package.json`, y qué lockfile existe. Si el proyecto ya tiene convenciones, síguelas aunque esta skill diga otra cosa.
2. **Verifica antes de confiar:** antes de usar una librería externa, confirma su API actual con Context7 (MCP `context7`, si está instalado) o WebFetch a su doc oficial. Las versiones de esta skill son de nov 2026; si el proyecto usa otra, manda la del proyecto.
3. **Explica la decisión al usuario en 1–3 frases** ("Uso pnpm porque es rápido y no ejecuta scripts de paquetes sin permiso").

## Versiones (a nov 2026 — verifícalas en https://nodejs.org/en/about/previous-releases)

- **Node 26 "Lithium" es LTS** (también 24 y 22 siguen en LTS). Usa 26 en proyectos nuevos. No uses 25, 23 ni 20: ya están en EOL.
- Desde Node 27 cambia el calendario: un major al año, con fase **Alpha** de 6 meses y luego Current. Nunca uses una versión `alpha` para algo real.
- En CachyOS/Arch, `sudo pacman -S nodejs` instala 26.x a nov 2026, pero ese paquete sigue la versión más nueva; existen `nodejs-lts-krypton` (24) y `nodejs-lts-jod` (22). Para reglas de pacman usa la skill `cachyos-hyprland-fish` de `cerebro-linux`.
- **TypeScript 7.0** (compilador nativo en Go, paquete `typescript`, comando `tsc`). Cambios que rompen: `strict` ya es `true` por defecto, `types` por defecto es `[]` (pon `"types": ["node"]`), `rootDir` por defecto es `./`, y quedaron prohibidos `target: es5`, `moduleResolution: node/node10`, `baseUrl`, `module: amd/umd/none`. TS 7 aún **no trae API**: si typescript-eslint u otra herramienta se queja, instala 6.0 con alias como dice el anuncio oficial.

## Gestor de paquetes: cuál usar

| Situación | Usa |
|---|---|
| Ya hay `pnpm-lock.yaml` / `package-lock.json` / `bun.lock` | **El de ese lockfile.** Nunca mezcles ni borres el lockfile para "arreglar" algo |
| Proyecto nuevo | **pnpm** (12.x a nov 2026; en CachyOS `sudo pacman -S pnpm`) |
| Tutorial, script de un archivo o CI ajeno donde solo hay npm | npm |
| El usuario ya usa Bun como runtime o quiere una sola herramienta | bun |

Por qué pnpm: **no ejecuta los build scripts de dependencias** salvo que estén en `allowBuilds`, falla si uno no está permitido (`strictDepBuilds`) y no instala versiones publicadas hace menos de 1 día (`minimumReleaseAge` = 1440 min). Eso frena paquetes maliciosos recién publicados. Si una instalación falla por un build script, **pregunta al usuario** antes de permitirlo y di qué paquete es.

Bun tampoco ejecuta `postinstall` de dependencias por defecto (`trustedDependencies` para permitirlo) y usa lockfile de texto `bun.lock`.

## Correr TypeScript

- **Node 26 corre `.ts` directo** (type stripping, estable): `node src/main.ts`. Solo **borra los tipos**, no los revisa. Limitaciones: sin `enum`, sin `namespace` con valores, sin parameter properties, sin decorators; los imports llevan extensión (`./config.ts`) y los imports de tipos llevan `type`; ignora `tsconfig.json` y `paths`.
- **Usa `tsx`** (`pnpm add -D tsx`, `tsx src/main.ts`) solo si el proyecto necesita lo que Node no soporta (enums, decorators, `paths` del tsconfig, `.tsx`).
- **No uses `ts-node`** en proyectos nuevos.
- **El chequeo de tipos siempre es aparte:** `pnpm exec tsc` (con `noEmit`). Si no corriste `tsc` y salió sin errores, no está terminado.
- Desarrollo: `node --watch --env-file=.env src/main.ts` (crea `.env` desde `.env.example` primero). Ojo: en Node 22 probé `--watch` junto con `--env-file-if-exists` y truena si el `.env` no existe; con `--watch` usa `--env-file`.

## tsconfig.json base (proyecto Node, verificado con TS 7.0.2)

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["node"],
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

`erasableSyntaxOnly` hace que `tsc` rechace lo que Node no puede correr. `noUncheckedIndexedAccess` obliga a revisar `arr[0]` y `obj[key]` (atrapa muchos `undefined`). Para frameworks (Next, Vite) usa el tsconfig que genera su plantilla, no este.

`package.json`: `"type": "module"` (ESM), `"engines": { "node": ">=26" }`, y scripts:

```json
"scripts": {
  "dev": "node --watch --env-file=.env src/main.ts",
  "start": "node --env-file-if-exists=.env src/main.ts",
  "typecheck": "tsc",
  "test": "vitest run"
}
```

## Variables de entorno y validación con zod

- Node lee `.env` solo: `--env-file=.env` (falla si no existe) o `--env-file-if-exists=.env`. **No instales `dotenv`** en proyectos nuevos. Una variable ya definida en el entorno gana sobre la del archivo.
- **Valida el entorno una sola vez al arrancar** y falla rápido con mensaje claro. zod 4 (`import * as z from "zod"`):

```ts
// src/config.ts
import * as z from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().default(3000),
  API_KEY: z.string().min(1),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Config inválida:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}
export const config = parsed.data;
```

- **Todo lo que entra de fuera se valida con un schema**: body de requests, respuestas de APIs externas, JSON de archivos, mensajes de websocket. Usa `safeParse` en bordes donde un error es esperable y responde con mensaje útil; `parse` solo donde un fallo es bug.
- Tipos desde el schema: `type Config = z.infer<typeof Env>`. No escribas el tipo a mano dos veces.
- Secretos: nunca en el código, nunca en logs. Ver skill `secretos-y-llaves` de `cerebro-base`.

## Manejo de errores

1. **Nunca `catch {}` vacío** ni `catch (e) { console.log(e) }` y seguir como si nada. O lo manejas (reintento, valor por defecto explícito, respuesta 4xx) o lo dejas subir.
2. Agrega contexto al relanzar: `throw new Error("No pude leer precios de X", { cause: err })`.
3. En `catch`, `err` es `unknown`: revisa con `err instanceof Error` antes de usar `.message`.
4. Promesas: siempre `await` o `.catch`. Una promesa suelta que falla tumba el proceso (`unhandledRejection`). En procesos 24/7 registra `process.on("unhandledRejection")` solo para loguear y salir con código ≠ 0 y que systemd lo reinicie (skill `servicios-24-7`).
5. `fetch` no tiene timeout por defecto: usa `fetch(url, { signal: AbortSignal.timeout(10_000) })` y revisa `res.ok` antes de `res.json()`. Retries y backoff: skill `apis-y-webhooks`.
6. Dinero y cantidades de tokens: nada de `number` con decimales; enteros o `bigint` (skill `montos-y-decimales` de `cerebro-solana`).

## Estructura de un proyecto chico

```
src/
  main.ts        # punto de entrada: arma todo y arranca
  config.ts      # env validado con zod
  lib/           # funciones puras (cálculos, parseo) -> fáciles de testear
  services/      # hablan con el mundo: APIs, base de datos, Telegram
  *.test.ts      # tests junto al archivo que prueban
```

- Funciones pequeñas y puras en `lib/`; efectos (red, disco) en `services/`. Así se prueba la lógica sin red.
- Un archivo por responsabilidad, nombres en inglés o español pero consistentes.
- No crees capas "por si acaso" (repositorios, factories, DI) en un proyecto de 10 archivos.
- Lint/format: el que ya tenga el proyecto. Nuevo con Next.js: el que elija `create-next-app` (ESLint o Biome). Nuevo sin framework: Biome (un solo binario para lint y formato).

## Al terminar

Corre y muestra la salida de: `pnpm install` (sin errores), `pnpm typecheck`, `pnpm test` y el programa real una vez. Dile al usuario el comando exacto para correrlo él mismo y qué debería ver. Si algo no se pudo correr (falta una API key, por ejemplo), dilo en vez de darlo por bueno.

## Fuentes (verificado nov 2026)

- https://nodejs.org/en/about/previous-releases (26 LTS, nuevo calendario desde 27)
- https://nodejs.org/api/typescript.html (type stripping estable, limitaciones, tsconfig recomendado)
- https://nodejs.org/api/cli.html (`--env-file`, `--env-file-if-exists`, `--watch`)
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://pnpm.io/installation y https://pnpm.io/supply-chain-security
- https://bun.com/docs/pm/cli/install
- https://tsx.is/
- https://zod.dev/basics
- https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- https://archlinux.org/packages/?q=nodejs (versiones de paquetes en Arch)
- Probado localmente: TypeScript 7.0.2 + zod 4 con el tsconfig y `config.ts` de arriba (`tsc` limpio, error de env legible).
