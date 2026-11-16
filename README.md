# claude-cerebro 🧠

Superpoderes en español para **Claude Code** (la app de terminal): skills, agentes, hooks y servidores MCP para que Claude **planee antes de programar, investigue la documentación real en vez de inventar, y compruebe que algo funciona antes de decir "listo"**.

Junta lo mejor que ya existe (Superpowers, los plugins oficiales de Anthropic y los de seguridad de Trail of Bits) con skills escritas a la medida para Solana, Cloudflare, Roblox, Godot, Linux (CachyOS/Hyprland/fish) y negocio.

## Instalar: pégale esto a Claude Code

Abre Claude Code en cualquier carpeta y pega:

```
Clona https://github.com/eddyorlandotp/claude-cerebro en ~/claude-cerebro (o haz git pull si ya existe), lee ~/claude-cerebro/INSTALAR.md completo y síguelo al pie de la letra.
```

Claude te pregunta qué perfil quieres (completo, completo + ECC o solo cerebro), instala todo él solo, revisa que haya quedado y te dice qué falta. Al final escribe `/reload-plugins`.

- **Actualizar después:** `/cerebro-base:actualizar-cerebro`, o dile "actualiza el cerebro".
- **Ver lo instalado:** `/plugin`. Para los servidores MCP, `/mcp`.
- **Cuánto contexto gasta cada plugin:** `claude plugin details <nombre>`.
- `playwright` descarga su navegador la primera vez que lo usas. `context7` funciona sin cuenta.

## Qué trae

### Plugins propios (marketplace `cerebro`): 15 plugins, 86 skills + Telaraña

| Plugin | Para qué |
|---|---|
| `cerebro-base` | Método de trabajo: modo mentor, memoria en Obsidian, git como red de seguridad, secretos y llaves, investigar antes de codear, deploy, cierre de sesión, ahorro de tokens y dieta de contexto. |
| `cerebro-guardia` | **Hook guardián**: bloquea commits con `.env` o llaves privadas y comandos destructivos. No gasta contexto. |
| `cerebro-panel` | **Telaraña**: panel local sin IA para ver a Claude trabajar (cara que piensa, araña que entrega skills, flujo, contexto, hilo) y **modo ligero**: la araña elige las skills por ti y el contexto fijo baja de ~10,700 a ~700 tokens. |
| `cerebro-solana` | Fundamentos de Solana, swaps y comisiones con Jupiter, Helius en tiempo real, envío rápido de transacciones, bot de copy trading, riesgo de memecoins, montos y decimales, billeteras sin custodia, señales y backtesting. |
| `cerebro-cripto` | EVM y Base, Solidity básico y seguridad, análisis on-chain, conceptos DeFi y seguridad cripto personal. |
| `cerebro-web` | Cloudflare Tunnel y dominio, decisiones del plan gratis de Cloudflare, bases de datos, cobros y suscripciones, SEO técnico y landings. |
| `cerebro-codigo` | TypeScript/Node, Python con uv, React/Next.js, APIs y webhooks, testing, Docker y GitHub Actions, rendimiento y refactors. |
| `cerebro-ia` | Apps con LLMs, chatbots de WhatsApp/Telegram, RAG, n8n, MCP propios, prompts, modelos locales y ML de series de tiempo. |
| `cerebro-apps` | Apps móviles con Expo, PWA, publicar en tiendas, extensiones de Chrome, Tauri y bots de Discord. |
| `cerebro-juegos` | Roblox en Linux con Rojo, arquitectura Luau, anti-exploit, datos y monetización, diseño de juegos, Godot y Steam. |
| `cerebro-diseno` | Blender low-poly para Roblox, UI/UX, branding y logos, miniaturas e imágenes por terminal. |
| `cerebro-linux` | CachyOS + Hyprland + fish, servicios 24/7, home lab y red, Minecraft Bedrock y respaldos. |
| `cerebro-casa` | Home Assistant, ESPHome, servidor multimedia y Wi-Fi doméstico. |
| `cerebro-negocio` | Contenido para redes, video con ffmpeg y clipping, copy en español MX, propuestas freelance y validación de ideas. |
| `cerebro-vida` | CV y entrevistas, estudiar, finanzas personales básicas, trámites en México, seguridad de cuentas y productividad. |

### Curados de otros (los instala Claude siguiendo `INSTALAR.md`)

**Prendidos:** `superpowers` · `context7` · `feature-dev` · `code-review` · `security-guidance` · `claude-md-management` · `claude-code-setup` · `hookify` · `commit-commands` · `skill-creator` · `frontend-design` · `playwright` · `cloudflare` · `mcp-server-dev` · `code-simplifier` · `typescript-lsp` · `pyright-lsp` · `session-report` · Trail of Bits (`insecure-defaults`, `supply-chain-risk-auditor`, `dimensional-analysis`, `sharp-edges`) · `document-skills` · `claude-api`

**Instalados pero apagados** (pesan mucho; se prenden solo en el proyecto que los usa): `expo` · `vercel` · `netlify-skills` · `supabase` · `stripe` · `mercadopago` · `plugin-dev` · `pr-review-toolkit` · `chrome-devtools-mcp` · `building-secure-contracts`

**Ahorro de tokens:** modo ligero con la araña (`arana modo ligero`), RTK para comprimir la salida de los comandos y `/cerebro-base:dieta-de-contexto` para prender plugins por proyecto.

## Cómo sacarle jugo

- **Empieza cada proyecto con:** "arranca el proyecto" (crea el CLAUDE.md, git y .gitignore), y luego "brainstorm" / "haz un plan" (Superpowers).
- **Memoria entre sesiones:** "abre Obsidian y continuemos con <proyecto>"; al terminar, "cierra la sesión".
- **Antes de tocar una API:** Claude revisa la documentación actual con Context7 o la doc oficial (skill `investigar-antes-de-codear`).
- **Antes de decir "listo":** pídele "verifícalo" o invoca al agente `@agent-cerebro-base:verificador`.
- **Código que mueve dinero:** pídele una revisión con `@agent-cerebro-solana:auditor-transacciones` y con los plugins de Trail of Bits.
- **En cada proyecto nuevo:** `/cerebro-base:dieta-de-contexto` para dejar prendido solo lo que ese proyecto usa.

## Editar o agregar skills

Cada skill es una carpeta con un `SKILL.md` en `plugins/<plugin>/skills/`. Las reglas de estilo están en [CONVENCIONES.md](CONVENCIONES.md). Después de editar:

```bash
claude plugin validate ~/claude-cerebro
claude plugin marketplace update cerebro
```

Licencia MIT. Las skills de terceros conservan sus licencias y se instalan desde sus repos originales.
