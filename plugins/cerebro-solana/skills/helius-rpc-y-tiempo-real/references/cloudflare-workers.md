# Escuchar Helius 24/7 desde Cloudflare Workers (verificado nov 2026)

Fuentes: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ , https://developers.cloudflare.com/durable-objects/best-practices/websockets/ , https://developers.cloudflare.com/durable-objects/api/alarms/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/platform/limits/ . Para sintaxis exacta de wrangler/bindings usa el plugin `cloudflare` o Context7; este archivo explica el **diseño**.

## Hechos que condicionan el diseño

- Hibernación: solo ocurre si no hay `setTimeout`/`setInterval` pendientes, **no se usa la API estándar de WebSocket** y no hay request en curso. Un socket saliente con `new WebSocket(url)` o `fetch` con `Upgrade: websocket` usa la API estándar → el DO no hiberna y se cobra duración mientras está en memoria.
- Desalojo: idle no-hibernable 70–140 s sin eventos → desalojado. Operaciones pendientes (incluye conexiones salientes) lo retienen hasta 15 min cada una.
- Shutdown por deploy o update del runtime: los WebSockets se terminan. Diseña para reconectar siempre.
- Alarms: el DO puede programar `setAlarm(timestamp)`; al dispararse corre `alarm()` aunque estuviera desalojado (reinicia el constructor). Duración máxima de una alarm: 15 min.
- Precio de duración: se factura por 128 MB asignados mientras está activo o idle no-hibernable. Paid: 400 000 GB-s/mes incluidos + $12.50 por millón de GB-s. Free: 13 000 GB-s/día y solo DOs con backend SQLite.
- Requests de DO: Paid 1M/mes incluidos; los mensajes WebSocket entrantes se facturan con relación 20:1 según la página de precios (revisa la nota al pie vigente).
- Workers Free: 100 000 requests/día, 10 ms CPU por request HTTP, 5 Cron Triggers por cuenta. Paid ($5/mes mínimo): 30 s CPU por defecto (hasta 5 min).

## Patrón recomendado

```
Cron Trigger (cada 1 min)  ──► Worker ──► stub.fetch("/ensure")  (despierta el DO si murió)
                                         │
Durable Object "Listener" (1 instancia por trader, locationHint cercano)
  - estado en SQLite del DO: últimaFirmaProcesada, últimoMensajeAt, estado del socket
  - connect(): WebSocket saliente a wss://mainnet.helius-rpc.com/?api-key=SECRET
               envía transactionSubscribe; guarda subscription id
  - onmessage: valida, deduplica por firma, encola/procesa la copia
  - alarm() cada 30 s:
        si socket cerrado o sin mensajes/pong > 60 s → reconectar + backfill
        enviar ping (JSON-RPC o frame ping)
        reprogramar la siguiente alarm
  - backfill(): getSignaturesForAddress(trader, {until: últimaFirmaProcesada}) y procesar en orden
```

Reglas:
- Una sola conexión por trader en un DO con nombre fijo (`idFromName("trader-1")`): evitas duplicados y el tope de conexiones del plan.
- Persiste en el storage del DO todo lo que necesites tras un reinicio (última firma, posiciones abiertas, contador de errores). La memoria se pierde.
- No hagas trabajo pesado en el constructor.
- La lógica de ejecución (pedir `/build` a Jupiter, firmar, enviar por Sender) puede vivir en el mismo DO para no agregar saltos; mide antes de separar.
- Alertas: si `alarm()` detecta N reconexiones seguidas o X minutos sin mensaje, manda alerta (Telegram/Discord/email) con un fetch saliente. No incluyas secretos en el texto.

## Comprobación de costos antes de prometer "gratis"

1 DO despierto todo el mes ≈ 0.125 GB × 2 592 000 s = 324 000 GB-s. Cabe en los 400 000 GB-s del plan Paid; en Free cabe en 13 000 GB-s/día solo si es uno y no hay otros DOs activos. Más los créditos de Helius (2 créditos por 0.1 MB de stream). Muestra la cuenta al usuario.

## Lo que NO funciona bien en Workers

- Cliente LaserStream gRPC (`helius-laserstream`): el cliente JS usa bindings nativos de Rust; no está documentado como compatible con Workers. Si se necesita, va en un VPS.
- `setInterval` para pings: impide hibernar (irrelevante con socket saliente, pero no sobrevive a desalojo). Usa alarms.
- Guardar estado solo en variables globales del Worker: se pierde entre invocaciones.
