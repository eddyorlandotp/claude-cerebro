# cerebro-panel ("Telaraña")

Un panel local, **sin IA y sin nube**, para ver a Claude Code trabajar en un segundo monitor: la cara que piensa, la araña que sugiere skills, el flujo del turno, el medidor de contexto y el hilo de la sesión. Más "la araña": una utilidad que elige por palabras qué skill hace falta y guarda un resumen de la sesión para que Claude retome sin releer.

Requisitos: Node 20 o más nuevo. Cero dependencias, sin `npm install`, sin build.

## Abrirlo

- Dentro de Claude Code: `/cerebro-panel:abrir-panel` (pregunta en qué monitor si hay varios) y `/cerebro-panel:cerrar-panel`.
- A mano: `node servidor/servidor.mjs` y abre <http://127.0.0.1:4317>. Opciones: `--puerto 4317`, `--demo` (sesión de ejemplo en bucle), `--velocidad 2`, `--config-dir <ruta>`.
- Script: `servidor/abrir.sh estado | iniciar | monitores | abrir [--monitor NOMBRE] [--demo] | cerrar`.

El panel sigue solo la sesión de Claude Code con actividad más reciente y se cambia si empieza otra.

## La araña

```
arana indice                      qué skills hay instaladas (prendidas y apagadas)
arana recomendar "<texto>"        las que encajan con un mensaje (calla si no hay coincidencia clara)
arana buscar "<texto>" [-k 5]     lo mismo sin umbral, una línea por skill
arana leer <id>                   imprime una skill lista para usarse, aunque su plugin esté apagado
arana hilo <transcript> [--md]    resumen extractivo de una sesión
arana modo ligero|completo|estado
arana espejo listar|agregar|actualizar|ruta    copias locales de documentación (/cerebro-panel:espejos)
```

`arana` queda en el PATH del Bash de Claude mientras el plugin está habilitado (carpeta `bin/`). En tu propia terminal: `node arana/bin/arana.mjs ...`.

**La araña elige por palabras, no entiende.** Usa BM25 con raíces de palabras y un diccionario chico de sinónimos (`arana/lib/texto.mjs`). A veces fallará; por eso existe `arana buscar`.

## Cuánto contexto agrega

Medido con los hooks reales (caracteres exactos; tokens estimados a ~3.5 caracteres por token):

| Hook | Cuándo | Agrega |
|---|---|---|
| `UserPromptSubmit`, modo completo | solo si hay coincidencia clara, y cada skill una sola vez por sesión | 57–147 caracteres (≈ 16–42 tokens); tope 230 |
| `UserPromptSubmit`, modo ligero | igual | 167–450 caracteres (≈ 50–130 tokens); tope 450 |
| `SessionStart` al arrancar o limpiar | solo en modo ligero | 350 caracteres (≈ 100 tokens) |
| `SessionStart` tras compactar o reanudar | si hay hilo guardado | 548 caracteres en la sesión de prueba; tope 1,800 (≈ 500 tokens) |
| `Stop`, `PreCompact`, `Notification` | siempre | 0 |

Mensajes como "hola", "gracias, continúa" u "ok" no agregan nada. Cada hook tarda 30–90 ms (objetivo < 150 ms) y sale con código 0 pase lo que pase: nunca bloquea a Claude. Dos casos medidos se salen de ese rango, una sola vez cada uno: el primer hook después de instalar o apagar plugins reconstruye el índice (≈ 150 ms), y el primer `Stop` sobre un transcript ya enorme (13 MB) tardó 264 ms; los siguientes leen solo lo nuevo (44 ms).

Para apagar las sugerencias o el hilo: `~/.local/state/cerebro-panel/config.json` con `{ "arana": { "sugerir": false, "hilo": false } }`.

## Modo ligero

`arana modo ligero` apaga a nivel usuario todos los plugins menos el núcleo (y los que no cuestan contexto), guardando antes cómo estaban; `arana modo completo` los deja exactamente igual. La araña sigue viendo las skills apagadas (siguen en disco) y se las entrega a Claude por nombre para que las cargue con `arana leer <id>` solo cuando hacen falta.

Medido en una instalación de prueba con 47 plugins: **10,752 tokens fijos por sesión en modo completo, 706 en modo ligero**, ida y vuelta sin diferencias en `settings.json`. Nunca toca settings de proyecto. Lo que se pierde con un plugin apagado son sus hooks, MCP y agentes; la araña lo avisa cuando sugiere una skill de un plugin así.

## Privacidad

- El servidor escucha solo en `127.0.0.1`, rechaza peticiones que no vayan dirigidas a local y no manda cabeceras CORS.
- Nada llama a internet ni a ningún modelo. Sin telemetría. La única excepción es `arana espejo agregar|actualizar`, que hace `git clone`/`git pull` de los repos que tú elijas.
- Los transcripts se abren en solo lectura. El panel solo escribe en `~/.local/state/cerebro-panel/` (índice de skills, hilos, `eventos.jsonl`, pid, configuración). Los hilos y estados de sesión de más de 30 días se borran solos.

## Pruebas

```
node --test
```

Los transcripts de prueba son sintéticos (`servidor/generar-fixtures.mjs`). Contrato técnico en `docs/CONTRATO.md`, diseño en `docs/DISENO.md`.
