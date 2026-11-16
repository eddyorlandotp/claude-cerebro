# Encargo para Claude Code en la máquina del usuario

> Este archivo es para **Claude Code corriendo en la PC del usuario**. Telaraña (este plugin) se construyó en la nube contra una sesión simulada. Tu trabajo es probarla con sesiones reales en esta máquina, arreglar lo que no cuadre y dejar el resultado en el repo para que la otra IA lo lea.

## Antes de empezar

1. Lee completos `docs/CONTRATO.md`, `docs/DISENO.md` y `README.md` de este plugin. El contrato y el diseño mandan; si necesitas cambiarlos, hazlo y anótalo en el reporte.
2. Trabaja en el clon `~/claude-cerebro`, en una rama nueva: `git switch -c local/panel-AAAA-MM-DD`. Edita **solo** dentro de `plugins/cerebro-panel/` (código) y `local/telarana/` (reporte y capturas).
3. Todo lo que produzcas para reportar va en `local/telarana/` (en la raíz del repo, fuera del plugin): `REPORTE.md` y `capturas/*.png`.
4. **Privacidad (el repo es público):** nunca copies al repo contenido de transcripts reales, rutas personales, llaves, direcciones de billetera ni nombres de proyectos privados. Si agregas fixtures a partir de sesiones reales, conserva solo la estructura y reemplaza todo texto por texto inventado. Las capturas se toman con el modo `--demo` o con una sesión de prueba creada para eso, no con trabajo real del usuario.
5. Reglas de siempre: explica en 1–3 frases simples lo que vas a hacer antes de cada bloque; pide el "sí" antes de cualquier `sudo`, instalación de paquetes o cambio de configuración del sistema o de Hyprland; no declares nada como "funciona" sin haberlo visto funcionar.
6. No uses IA ni servicios externos para nada del panel o de la araña: el requisito central es que corra en esta máquina sin costo de tokens.

## 1. Entorno

- `node --version` (≥ 20), navegador disponible (chromium, brave, google-chrome o firefox), `git`.
- Desde `plugins/cerebro-panel/`: `node --test`. Deben pasar todas. Si alguna falla aquí y no en la nube, es hallazgo: anótalo y arréglalo.
- `node servidor/servidor.mjs --demo` y abre <http://127.0.0.1:4317>. Confirma que el demo corre completo sin errores en la consola del navegador.

## 2. Formato real de los transcripts (lo más importante)

El lector (`servidor/lib/transcript.mjs`) se escribió a partir de una descripción del formato y de archivos sintéticos. Compruébalo contra sesiones reales de `~/.claude/projects/**.jsonl`:

- Haz un inventario (script desechable, no lo subas con datos): tipos de registro (`type`), tipos de bloque dentro de `message.content`, campos de `usage`, y qué registros marcan el fin de un turno.
- Responde con evidencia, en el reporte:
  1. ¿Los bloques `thinking` traen texto o llegan vacíos/cifrados? Si llegan vacíos, la cara debe mostrar "pensando" sin burbuja y las burbujas se alimentan del texto visible (`dicho`) y del nombre de la herramienta en curso. Ajusta la interfaz para que no se vea vacía.
  2. ¿Cómo se guardan los subagentes: en el mismo archivo con `isSidechain: true`, en `<sessionId>/subagents/*.jsonl`, o de otra forma? ¿Cómo se enlazan con el `tool_use` que los lanzó?
  3. ¿`tool_use` y `tool_result` se emparejan como espera el lector? ¿Cómo se marca un error?
  4. ¿De dónde sale el modelo, el uso de tokens y (si existe) el costo?
  5. ¿Qué tipos desconocidos aparecen y se están ignorando sin fallar?
- Corrige `transcript.mjs`, `vigia.mjs` y `estado.mjs` según lo que encuentres. Agrega fixtures **saneados** y pruebas que cubran cada diferencia.

## 3. Hooks en vivo

Con el plugin instalado y habilitado (`claude plugin list`), abre una sesión de prueba en una carpeta temporal y comprueba, uno por uno:

- `UserPromptSubmit`: al escribir algo como "el bot tarda mucho en copiar", ¿Claude recibe la línea `[araña] …`? (míralo en el transcript o con `claude --debug`). Con "hola" no debe recibir nada.
- `arana` en el PATH del Bash de Claude: `arana modo estado` debe funcionar sin ruta completa.
- `SessionStart` en modo ligero: ¿aparece la nota corta al arrancar?
- `Notification`: cuando Claude pide permiso, ¿el panel pasa a ámbar ("esperándote")?
- `PreCompact` + `SessionStart(compact)`: corre `/compact` en una sesión con algo de trabajo y confirma que el hilo se reinyecta y que es útil y corto.
- Mide cuánto tarda cada hook (`time`) y confirma que ninguno bloquea si Node falla o el servidor está apagado.

Verifica el formato de cada hook contra <https://code.claude.com/docs/en/hooks> si algo no se comporta como dice el contrato.

## 4. El panel en esta máquina

- `/cerebro-panel:abrir-panel`: debe arrancar el servidor, preguntar en qué monitor y abrir a pantalla completa ahí. El script `servidor/abrir.sh` usa comandos de `hyprctl` que **no se pudieron probar**: revísalos con `hyprctl monitors -j`, `hyprctl clients -j` y la wiki de Hyprland (config en Lua en versiones recientes) y corrígelos. Prueba también `/cerebro-panel:cerrar-panel`.
- Pruébalo en cada monitor del usuario, incluido el vertical, y con zonas minimizadas (teclas `1`–`5`, `0`, `F`).
- Con una sesión real corriendo en otra ventana: ¿la cara, las burbujas, el flujo, el contexto y el hilo siguen lo que pasa? ¿Cambia solo de sesión cuando abres otra?
- Rendimiento con GPU real: mide el tiempo de cuadro (ya hay medición en `ui/js/`; si no, `performance.now()` durante 10 s). Objetivo: 60 fps estables. Mira también el uso de CPU del navegador y de `node` en reposo.
- Compara lo que ves contra `docs/DISENO.md` y corrige lo que se vea mal en pantalla real (tamaños de letra a distancia, encimados, zonas vacías, colores fuera de la paleta). No agregues colores ni efectos que el diseño prohíbe.
- Capturas (con `grim` en Hyprland o las herramientas del navegador), usando `--demo`: reposo, araña entregando, mitad de turno, error, espera, y una con dos zonas minimizadas, por cada monitor.

## 5. Modo ligero

- Anota `/context` (o `arana modo estado`) antes y después de `arana modo ligero`, en una sesión nueva cada vez.
- Trabaja 15–20 minutos en una tarea real pequeña en modo ligero y observa: ¿la araña sugirió las skills correctas?, ¿Claude las cargó con `arana leer <id>` cuando hacía falta?, ¿se perdió alguna que debió usarse? Cada fallo del recomendador se arregla en `arana/lib/texto.mjs` (sinónimos) o `recomendar.mjs`, con una prueba nueva en `arana/test/recomendar.test.mjs`.
- Confirma que `arana modo completo` deja todo exactamente como estaba.
- Si el modo ligero resulta peor para el usuario (Claude deja de usar skills que antes usaba solo), dilo claro en el reporte con ejemplos; es una decisión suya seguir o no.

## 6. Copias locales de documentación (espejos)

- Corre `/cerebro-panel:espejos`. Debe mostrar las unidades con espacio libre y **preguntarle al usuario** en cuál guardar las copias y cuáles quiere.
- Descarga las elegidas, anota el tamaño real de cada una en `arana/espejos-sugeridos.json` y comprueba que Claude las consulta con búsqueda local antes de ir a internet.

## 7. Reporte y entrega

Escribe `local/telarana/REPORTE.md` (en español, corto, sin datos privados) con:

1. **Qué funciona**, y cómo lo comprobaste.
2. **Qué cambiaste**, archivo por archivo, y por qué.
3. **Respuestas a las 5 preguntas del punto 2.**
4. **Números**: tokens fijos en modo completo y ligero, lo que inyecta cada hook, tiempos de hooks, fps y CPU.
5. **Qué sigue fallando o quedó sin probar.**
6. **Qué opina el usuario** de cómo se ve y qué quiere cambiar (pregúntale al final y cítalo).

Después: `node --test` en verde, `claude plugin validate ~/claude-cerebro`, commit en tu rama y `git push -u origin <rama>`. Si el push falla por permisos, no fuerces nada: deja el commit local y dile al usuario que corra `gh auth login` o que suba la rama él. Nunca hagas push a `main` ni force-push.
