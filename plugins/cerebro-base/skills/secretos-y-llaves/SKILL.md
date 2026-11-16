---
name: secretos-y-llaves
description: Manejo seguro de API keys, tokens, .env, secrets de Cloudflare/CI y llaves privadas de Solana (id.json, keypairs de 64 números). Qué hacer si algo se filtra y cómo escanear con gitleaks. Usar con .env, secret, API key, private key, seed phrase, wallet, keypair, leak, filtración.
---

# Secretos y llaves

Una API key filtrada cuesta dinero; una llave privada de billetera filtrada ES dinero perdido, y bots automáticos barren repos y logs buscando ambas. Trata cada secreto como efectivo.

## Reglas duras (sin excepciones)

1. **Nunca imprimas un secreto.** Nada de `cat .env`, `echo $API_KEY`, `printenv`, `env`, `console.log(env)`, `JSON.stringify(process.env)`, ni leer `id.json` con la herramienta Read. Lo que imprimes queda en la conversación y en los logs.
2. **Nunca pidas al usuario que pegue una llave en el chat.** Si la necesita un archivo o servicio, dale el comando para que la ponga él (ver abajo). Si la pega de todas formas: no la repitas, dile que la considere expuesta y que la rote cuando pueda (si es llave de billetera con fondos, que los mueva).
3. **Nunca la escribas en código, CLAUDE.md, README, notas de Obsidian, mensajes de commit ni tests.** Usa el nombre de la variable.
4. **Nunca la mandes al frontend.** En Vite todo `VITE_*` y en Next.js todo `NEXT_PUBLIC_*` termina en el JavaScript que descarga cualquiera. Una key de RPC/API de pago va detrás de un Worker o backend que hace de proxy.
5. **Nunca la loguees en errores.** Al reportar un fallo de API, muestra status y cuerpo de respuesta, nunca headers de autorización ni la URL si lleva la key como parámetro.

### Comprobar que una variable existe SIN ver su valor
```bash
grep -c '^HELIUS_API_KEY=' .env                     # 1 = está definida
grep -q '^HELIUS_API_KEY=.\+' .env && echo "tiene valor" || echo "vacía o falta"
test -n "$HELIUS_API_KEY" && echo "definida en el entorno"
npx wrangler secret list                             # solo muestra NOMBRES
```

## Dónde vive cada secreto

| Contexto | Dónde | Cómo lo pone el usuario |
|---|---|---|
| Desarrollo local (Node, Vite, etc.) | `.env` (en `.gitignore`) | Copia `.env.example` a `.env` y lo llena en su editor |
| Cloudflare Workers en local | `.dev.vars` o `.env` (uno de los dos, no ambos; ambos en `.gitignore`) | Igual, en su editor |
| Cloudflare Workers en producción | Secret del Worker | `npx wrangler secret put NOMBRE` (pide el valor de forma interactiva) |
| GitHub Actions | Secret del repo | `gh secret set NOMBRE` (pide el valor) y en el workflow `${{ secrets.NOMBRE }}` |
| Bot o script en un servidor propio | Archivo con permisos `600` fuera del repo, o variable del servicio systemd | `chmod 600 <archivo>` |

Detalles que importan:
- `wrangler secret put` **crea y despliega una versión nueva del Worker de inmediato**. Avisa al usuario antes. Con despliegues graduales usa `npx wrangler versions secret put NOMBRE`.
- Pide al usuario que corra los comandos que piden el valor **en su propia terminal**, no a través de ti, para que el valor nunca pase por la conversación.
- `vars` en `wrangler.jsonc`/`wrangler.toml` son públicas en el repo: nunca para secretos.
- En GitHub Actions, los secrets no llegan a workflows disparados desde forks (salvo `GITHUB_TOKEN`). Un valor sensible que no sea secret se enmascara con `::add-mask::`.

## Llaves de Solana: tratarlas como dinero

- Un keypair de archivo (`~/.config/solana/id.json` o cualquier `*.json` generado por `solana-keygen`) es un **arreglo JSON de 64 números 0-255**: los primeros 32 son la llave privada y los últimos 32 la pública. Quien tenga ese archivo controla la billetera. El archivo NO está cifrado.
- Anza (mantenedor del CLI) describe las billeteras de archivo como el método menos seguro y no recomendado para montos grandes.
- **Una billetera dedicada por bot**, con el saldo mínimo para operar. Nunca la billetera principal del usuario. Retira ganancias a otra billetera seguido.
- La llave del bot en producción vive como secret (`wrangler secret put BOT_KEYPAIR`), nunca en el repo ni en `wrangler.jsonc`.
- **Generar llaves:** pide al usuario que lo haga él en su terminal: `solana-keygen new --outfile ~/.config/solana/bot-<nombre>.json`. Ese comando muestra la seed phrase en pantalla; si lo corres tú, la seed queda en la conversación. Si no hay alternativa, `solana-keygen new --silent --outfile <ruta>` no muestra la seed (entonces el archivo es el único respaldo).
- **Nunca** pidas, muestres ni guardes una seed phrase (12/24 palabras). Si el usuario la escribe en el chat: considérala comprometida, que mueva los fondos.
- Muestra solo la dirección pública: `solana-keygen pubkey <archivo>`.
- Antes de cualquier código que firme o envíe transacciones: simular primero, límites de monto y confirmación del usuario. Las reglas de trading y firma están en el plugin `cerebro-solana`.

## Si algo se filtró: orden de respuesta

1. **Llave de billetera**: mueve TODOS los fondos a una billetera nueva generada por el usuario, ahora, antes de cualquier otra cosa. Revoca aprobaciones/delegaciones de tokens si las hay.
2. **API key / token**: revócala en el panel del proveedor, crea una nueva, actualiza el secret (`wrangler secret put`, `gh secret set`, `.env`) y verifica que el servicio funcione.
3. Revisa el uso en el panel del proveedor (consumo raro, transacciones que no reconoces).
4. Después, limpia el repo/historia (skill `red-de-seguridad-git`, sección "Si se commiteó un secreto"). Limpiar git sin rotar no sirve: ya se copió.
5. Explícale al usuario qué pasó, qué se hizo y qué revisar en los próximos días, en lenguaje simple.

## Escaneo de secretos: gitleaks

A nov 2026 la versión es 8.30.1; el autor declaró gitleaks "feature complete" (solo parches de seguridad) y trabaja en un sucesor llamado Betterleaks. Verifica en https://github.com/gitleaks/gitleaks antes de depender de esto.

Instalar en Arch/CachyOS: `sudo pacman -S gitleaks` (está en `extra`).

```bash
gitleaks git --redact -v .                                  # toda la historia del repo
gitleaks dir --redact -v .                                  # archivos actuales (incluye no rastreados)
gitleaks git --pre-commit --redact --staged --verbose .     # solo lo que está en stage
```
- Usa SIEMPRE `--redact`: sin él, gitleaks imprime el secreto encontrado y lo mete a la conversación.
- Código de salida `1` = encontró algo (o error); `0` = limpio.
- **gitleaks NO detecta keypairs de Solana en formato arreglo con sus reglas por defecto** (comprobado nov 2026). Copia `references/gitleaks.toml` a la raíz del repo como `.gitleaks.toml`: extiende las reglas por defecto y agrega una para arreglos de 64 números. gitleaks lo lee automáticamente desde la carpeta escaneada.
- Como hook de pre-commit (con el framework `pre-commit`): repo `https://github.com/gitleaks/gitleaks`, hook `id: gitleaks`; corre `pre-commit autoupdate` para fijar la versión actual.
- GitHub tiene push protection para repos públicos, pero no confíes solo en ella: escanea localmente.

El hook `guardia` de este plugin ya bloquea `git add`/`git commit` de `.env`, `.dev.vars`, `id.json`, `*keypair*.json`, `*.pem` y de contenido con `BEGIN ... PRIVATE KEY` o arreglos de 64 bytes. Es una red, no un reemplazo de gitleaks ni de tu cuidado.

## Errores comunes

- "Déjame ver tu .env para depurar" → usa los comandos de "comprobar sin ver el valor".
- Poner la key de RPC en `VITE_RPC_URL` "porque es más fácil".
- Hardcodear la llave "solo para probar" y commitearla.
- Imprimir el objeto de configuración completo al arrancar el bot.
- Usar la misma billetera para varios bots o para el usuario.
- Rotar la llave pero olvidar actualizar el secret de producción → el bot se cae en silencio (monitoréalo: skill `deploy-y-monitoreo`).

## Verifica antes de confiar

Los comandos de Wrangler, GitHub CLI y gitleaks cambian. Antes de dar un comando nuevo, confírmalo con Context7 (MCP `context7`, si está instalado), con `<herramienta> --help` o WebFetch a la doc oficial. Para APIs de Workers usa el plugin oficial `cloudflare` si está instalado.

## Fuentes (verificado nov 2026)

- Secrets de Workers (`wrangler secret put` despliega, `.dev.vars`/`.env`, no usar `vars` para secretos): https://developers.cloudflare.com/workers/configuration/secrets/
- `wrangler secret list` / `bulk`: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Secrets en GitHub Actions (`gh secret set`, forks, `::add-mask::`): https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- Variables `VITE_*` expuestas al cliente: https://vite.dev/guide/env-and-mode
- Variables `NEXT_PUBLIC_*` expuestas al navegador: https://nextjs.org/docs/app/guides/environment-variables
- Formato de keypair (64 bytes: 32 privada + 32 pública, `~/.config/solana/id.json`): https://cdn.jsdelivr.net/npm/@solana/keys@6.8.0/README.md
- Billeteras de archivo, menos seguras: https://docs.anza.xyz/cli/wallets/file-system
- `solana-keygen new --silent` (no muestra la seed): https://github.com/anza-xyz/agave/blob/master/keygen/src/keygen.rs
- gitleaks (comandos, `--redact`, exit codes, `[extend] useDefault`, estado del proyecto): https://github.com/gitleaks/gitleaks y su `.pre-commit-hooks.yaml`
- gitleaks en Arch (extra, 8.30.1): https://archlinux.org/packages/?name=gitleaks
- Push protection de GitHub: https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection
