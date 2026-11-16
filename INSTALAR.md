# Instrucciones de instalación para Claude Code

> Este archivo es para **Claude**, no para una persona. El usuario te pidió instalar claude-cerebro: sigue estos pasos tú mismo con tu herramienta Bash, sin pedirle que corra nada salvo lo que se indica al final.

## Reglas

- Corre cada comando con Bash (los comandos `claude plugin ...` funcionan desde tu shell; no son slash commands).
- Si un marketplace ya existe, `marketplace add` puede fallar: está bien, sigue.
- Si un `install` falla, reinténtalo **una** vez. Si vuelve a fallar, anótalo y sigue con los demás; no te detengas.
- No instales nada que no esté en esta lista. No cambies la configuración del usuario fuera de esto.
- Pregunta solo lo del paso 0. Todo lo demás hazlo sin preguntar, salvo donde un paso diga que necesitas el "sí" del usuario.

## Paso 0: dos preguntas antes de empezar

Hazlas juntas, en un solo mensaje. Si el usuario ya contestó alguna en su mensaje, no la repitas.

**1. Perfil**

| Perfil | Pasos que corres |
|---|---|
| **Completo (recomendado)** | 1, 2, 2b, 3, 4, 5b (solo si dijo que sí a RTK), 6 y 7 |
| **Completo + ECC** | los de Completo más el paso 5. Avísale en una línea que ECC agrega 314 skills, 71 agentes y 27 hooks que se activan en cada acción, y que se encima con Superpowers |
| **Solo cerebro** | 1, 6 y 7 |

**2. ¿Instalo RTK?** Es un programa de terceros (github.com/rtk-ai/rtk, código abierto) que comprime la salida de los comandos para gastar menos tokens. Se instala con un script que se descarga de internet y se ejecuta en su máquina, así que **necesitas su "sí" explícito**. Si no contesta o dice que no, sáltate el paso 5b.

## Paso 1: plugins propios (marketplace `cerebro`)

```bash
claude plugin marketplace add eddyorlandotp/claude-cerebro
```

Instala cada uno con `claude plugin install <nombre>@cerebro`:

cerebro-guardia, cerebro-base, cerebro-solana, cerebro-cripto, cerebro-web, cerebro-codigo, cerebro-ia, cerebro-apps, cerebro-juegos, cerebro-diseno, cerebro-linux, cerebro-casa, cerebro-negocio, cerebro-vida

## Paso 2: oficiales de Anthropic (marketplace `claude-plugins-official`)

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

Instala cada uno con `claude plugin install <nombre>@claude-plugins-official`:

| Plugin | Para qué |
|---|---|
| superpowers | planear, TDD, depurar con método, verificar antes de decir "listo", subagentes |
| context7 | documentación actualizada de cualquier librería |
| feature-dev | flujo de 7 fases para funciones nuevas |
| code-review | revisión de código con varios agentes |
| security-guidance | avisa de patrones inseguros al editar |
| claude-md-management | mantiene al día el CLAUDE.md de cada proyecto |
| claude-code-setup | recomienda hooks/skills/MCP a la medida de un proyecto |
| hookify | crea hooks para frenar errores repetidos |
| commit-commands | commit, push y PR en un comando |
| skill-creator | crear y mejorar skills |
| frontend-design | interfaces que no se ven hechas por IA |
| playwright | abrir un navegador y probar páginas de verdad |
| cloudflare | Workers, Durable Objects, Wrangler, D1, KV, R2 |
| mcp-server-dev | crear servidores MCP propios |
| code-simplifier | simplificar código sin cambiar lo que hace |
| typescript-lsp | entender código TS/JS |
| pyright-lsp | entender código Python |
| session-report | ver en qué se gastaron los tokens |

### Paso 2b: instalados pero APAGADOS (se prenden por proyecto)

Estos pesan mucho contexto (entre 500 y 2,900 tokens por mensaje cada uno) y solo sirven en ciertos proyectos. Instálalos igual que los anteriores y enseguida apágalos a nivel usuario con `claude plugin disable <nombre>@claude-plugins-official --scope user`:

| Plugin | Se prende cuando el proyecto usa... |
|---|---|
| expo | apps móviles con Expo / React Native |
| vercel | deploys en Vercel |
| netlify-skills | deploys en Netlify |
| supabase | Supabase / Postgres + auth |
| stripe | cobros con Stripe |
| mercadopago | cobros con Mercado Pago |
| plugin-dev | crear o modificar plugins de Claude Code |
| pr-review-toolkit | revisión profunda de pull requests |
| chrome-devtools-mcp | depurar rendimiento/red en Chrome |

Para prender uno solo en un proyecto: `claude plugin enable <nombre>@claude-plugins-official --scope local` desde la carpeta del proyecto (lo hace la skill `/cerebro-base:dieta-de-contexto`).

## Paso 3: Trail of Bits (marketplace `trailofbits`)

```bash
claude plugin marketplace add trailofbits/skills
```

Instala con `claude plugin install <nombre>@trailofbits`:

insecure-defaults, supply-chain-risk-auditor, dimensional-analysis, sharp-edges

Instala también `building-secure-contracts@trailofbits` y déjalo **apagado** (`claude plugin disable building-secure-contracts@trailofbits --scope user`): solo se prende en proyectos con contratos inteligentes.

## Paso 4: skills de Anthropic (marketplace `anthropic-agent-skills`)

```bash
claude plugin marketplace add anthropics/skills
```

Instala con `claude plugin install <nombre>@anthropic-agent-skills`:

document-skills, claude-api

## Opcionales (NO los instales salvo que el usuario los pida por nombre)

Se dejaron fuera a propósito porque repiten lo que ya hay y gastan contexto:

- `mattpocock-skills@claude-plugins-official`: 27 skills de proceso (TDD, revisión, specs) que se enciman con `superpowers`.
- `example-skills@anthropic-agent-skills`: repite `frontend-design`, `skill-creator` y el constructor de MCP.

## Paso 5 (solo perfil "Completo + ECC")

```bash
claude plugin marketplace add affaan-m/ECC
claude plugin install ecc@ecc
```

## Paso 5b: RTK (solo si el usuario dijo que sí en el paso 0)

**RTK (Rust Token Killer)** comprime la salida de los comandos (git, tests, builds, ls) antes de que llegue al contexto, sin cambiar cómo piensa Claude. Instálalo así:

1. Si ya existe (`command -v rtk` y `rtk gain` funcionan), salta al punto 3. Ojo: existe otro programa llamado `rtk` ("Rust Type Kit"); si `rtk gain` da "command not found" o un error raro, es el equivocado: avísale al usuario y no sigas con RTK.
2. Instala la edición open source con el script oficial y verifica:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | RTK_EDITION=oss sh
   rtk --version && rtk gain
   ```
   Si el binario quedó en `~/.local/bin` y no está en el PATH, díselo al usuario con el comando para fish: `fish_add_path ~/.local/bin`.
3. Conéctalo a Claude Code **solo con el hook**, sin proxy ni daemon. Primero corre `rtk init --help` para confirmar que existen estas opciones y luego `rtk init -g --hook-only --auto-patch`. Si alguna opción ya no existe o el comando pide instalar un proxy o un servicio, detente y pregúntale al usuario. Confirma con `rtk init --show`.
4. Dile al usuario que reinicie Claude Code para activarlo y que `rtk gain` muestra cuánto va ahorrando.

**No instales Caveman** ni ningún plugin de "respuestas telegráficas", en ningún perfil: el usuario decidió dejarlo fuera porque necesita explicaciones claras, y lo que más gasta tokens es lo que Claude lee, no lo que escribe.

**ccusage** no se instala: se usa cuando haga falta con `npx ccusage@latest daily`.

## Paso 6: dependencias del sistema

El usuario usa CachyOS (Arch). Revisa qué falta con `command -v` para: `typescript-language-server`, `pyright`, `node`, `npm`, `ffmpeg`, `git`. Si falta alguno, **no lo instales tú** (requiere sudo): dale al usuario el comando exacto para pegar, por ejemplo:

```
sudo pacman -S --needed typescript-language-server pyright nodejs npm ffmpeg git
```

## Paso 7: verifica y reporta

1. Corre `claude plugin list` y compara contra lo que intentaste instalar.
2. Responde al usuario con:
   - cuántos plugins quedaron instalados (cuántos prendidos y cuántos apagados) y cuáles fallaron (con el error corto);
   - el comando de dependencias del paso 6, si faltó algo;
   - que escriba **`/reload-plugins`** (o reinicie Claude Code) para activarlos, y `/mcp` para ver los servidores MCP;
   - una línea: en cada proyecto puede correr `/cerebro-base:dieta-de-contexto` para apagar ahí los plugins que no use y ahorrar contexto.

## Para actualizar más adelante

Si el usuario pide "actualiza el cerebro": corre `claude plugin marketplace update` y luego `claude plugin update <nombre>@<marketplace>` para cada plugin instalado (sácalos de `claude plugin list`). Si este archivo agregó plugins nuevos desde la última vez, instálalos también. Termina pidiéndole al usuario que **reinicie Claude Code** (después de `plugin update` no basta con `/reload-plugins`).
