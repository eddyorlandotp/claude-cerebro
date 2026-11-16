---
name: dieta-de-contexto
description: Audita cuánto contexto gastan los plugins, MCP y CLAUDE.md en este proyecto, apaga aquí lo que no se usa y prende lo que sí hace falta, sin desinstalar nada.
disable-model-invocation: true
---

# Dieta de contexto para este proyecto

Objetivo: que en cada proyecto solo estén encendidos los plugins que sirven ahí. Cada skill instalada pone su descripción en cada mensaje; con 40+ plugins eso son miles de tokens por turno que no aportan nada en un proyecto que no los usa. **No se desinstala nada**: se apaga solo en esta carpeta.

## Pasos

1. **Medir.** Corre:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/dieta-de-contexto/scripts/costo-plugins.sh"
   ```
   Si `CLAUDE_PLUGIN_ROOT` no está definido, busca el script con `find ~/.claude/plugins -name costo-plugins.sh | head -1`. Da el costo "siempre activo" de cada plugin habilitado y el total.

2. **Entender el proyecto.** Mira la carpeta actual (README, `package.json`, `pyproject.toml`, `default.project.json`, `wrangler.toml`, extensiones de archivos) y el CLAUDE.md si existe. Resume en una línea de qué trata.

3. **Proponer.** Arma una tabla con tres grupos:
   - **Mantener siempre:** `cerebro-guardia`, `cerebro-base`, `superpowers`, `context7`, y los de seguridad si hay código (`security-guidance`, Trail of Bits).
   - **Mantener por este proyecto:** los del tema (p. ej. en un juego de Roblox: `cerebro-juegos`, `cerebro-diseno`; en el bot: `cerebro-solana`, `cerebro-web`, `cloudflare`).
   - **Apagar aquí:** el resto, con el ahorro estimado de cada uno.
   - **Prender aquí:** plugins instalados pero apagados que este proyecto sí necesita. Míralos con `claude plugin list` (los que salen deshabilitados): `expo`, `vercel`, `netlify-skills`, `supabase`, `stripe`, `mercadopago`, `plugin-dev`, `pr-review-toolkit`, `chrome-devtools-mcp`, `building-secure-contracts`. Ejemplo: si hay `app.json` de Expo, prende `expo`; si hay `supabase/`, prende `supabase`.
   Muéstrala y **pide confirmación** antes de aplicar.

4. **Aplicar** (tras el sí del usuario), solo para esta carpeta y sin tocar el repo compartido:
   ```bash
   claude plugin disable <plugin@marketplace> --scope local
   ```
   Y para prender: `claude plugin enable <plugin@marketplace> --scope local`.
   `local` guarda el cambio en `.claude/settings.local.json` de este proyecto (no se sube a git). Revisa con `claude plugin disable --help` que el flag siga existiendo; si falló, explica la alternativa: `/plugin` → plugin → deshabilitar en este proyecto.

5. **Revisar lo demás que pesa:**
   - `CLAUDE.md` del proyecto: si pasa de ~200 líneas, propone mover flujos específicos a skills.
   - Servidores MCP: `/mcp` para apagar los que no se usen aquí (las definiciones se cargan diferidas, pero sus instrucciones sí ocupan).
   - Sugiere al usuario abrir `/usage` y `/context` para ver el resto.

6. **Reportar:** total antes → total después (tokens por mensaje), qué se apagó y cómo revertirlo: `claude plugin enable <plugin@marketplace> --scope local`, y que reinicie o use `/reload-plugins`.

## Reglas

- Nunca apagues `cerebro-guardia` (el hook guardián de secretos, no gasta contexto) ni plugins de seguridad sin que el usuario lo pida explícitamente.
- No uses `--scope user` (afectaría todos los proyectos) salvo que el usuario lo pida.
- Si dudas si un plugin se usa en el proyecto, déjalo encendido y dilo.
