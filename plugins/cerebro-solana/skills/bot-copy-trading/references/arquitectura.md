# Bot de copy trading: pseudocódigo y esquema

Pseudocódigo en TypeScript-ish para explicar el diseño. **No es código para copiar tal cual**: confirma cada llamada (Kit, Helius, Jupiter, Durable Objects) en la doc vigente antes de escribirla.

## Esquema (SQLite del Durable Object)

```sql
CREATE TABLE ops (
  key            TEXT PRIMARY KEY,      -- firmaTrader + ':' + lado  (idempotencia)
  trader_sig     TEXT NOT NULL,
  trader_slot    INTEGER,
  detected_at_ms INTEGER NOT NULL,
  mint           TEXT,
  side           TEXT,                  -- 'buy' | 'sell' | 'no-swap' | 'unsupported'
  trader_sol_raw TEXT,                  -- lamports como string (BigInt)
  trader_tok_raw TEXT,
  trader_pct_bps INTEGER,               -- % del balance en bps
  bot_in_raw     TEXT,
  quote_out_raw  TEXT,
  slippage_bps   INTEGER,
  status         TEXT NOT NULL,         -- 'observed'|'skipped'|'pending'|'sent'|'confirmed'|'failed'|'expired'
  skip_reason    TEXT,
  bot_sig        TEXT,
  last_valid_bh  INTEGER,
  bot_slot       INTEGER,
  real_in_raw    TEXT,
  real_out_raw   TEXT,
  fees_lamports  TEXT,                  -- base + priority + tip
  t_decide_ms INTEGER, t_send_ms INTEGER, t_confirm_ms INTEGER
);
CREATE TABLE positions (mint TEXT PRIMARY KEY, token_raw TEXT, sol_in_raw TEXT, sol_out_raw TEXT, fees_raw TEXT, closed INTEGER DEFAULT 0);
CREATE TABLE health (k TEXT PRIMARY KEY, v TEXT);   -- last_msg_at, last_sig, reconnects, daily_loss, paused
```

Montos como `TEXT` (string de BigInt) para no perder precisión.

## Flujo por evento

```ts
async function onTraderTx(tx) {
  const sig = tx.signature;
  if (tx.meta?.err) return;                               // el trader falló: no copiar
  const swap = parseSwap(tx, TRADER);                      // por balances, ver abajo
  const key = `${sig}:${swap.side}`;
  if (!insertIfAbsent("ops", { key, trader_sig: sig, status: "observed", ... })) return; // dedupe
  if (swap.side === "no-swap" || swap.side === "unsupported") return skip(key, swap.side);
  // Por defecto la pausa y los límites frenan solo las COMPRAS. Las ventas siempre se copian:
  // frenarlas deja al bot con tokens que el trader ya vendió. Solo si el usuario lo pide explícitamente
  // (CONFIG.limitesFrenanVentas = true) se frenan también las ventas.
  const frena = swap.side === "buy" || CONFIG.limitesFrenanVentas === true;
  if (frena && (health.paused || overDailyLoss() || overHourlyCap())) return skip(key, "pausa/límite");

  const size = swap.side === "buy"
    ? mulBps(botSolAvailable() - RESERVE, swap.pctBps)      // BigInt, redondeo hacia abajo
    : mulBps(position(swap.mint).tokenRaw, swap.pctBps);
  if (size < MIN_SIZE[swap.side]) return skip(key, "monto muy chico");
  // El tope por operación está en lamports: solo aplica a compras (en ventas `size` son tokens raw, otra unidad).
  const capped = swap.side === "buy" ? min(size, MAX_PER_TRADE_LAMPORTS) : size;

  const q = await jupBuild({ inputMint, outputMint, amount: capped, taker: BOT, slippageBps: "pendiente" });
  if (swap.side === "buy") {
    // precioBot = q.inAmount / q.outAmount ; precioTope = traderSol/traderTok × (10000+capBps)/10000
    // compara en cruz: q.inAmount × traderTok × 10000  >  traderSol × q.outAmount × (10000+capBps)
    if (exceedsCap(q, swap)) return skip(key, "omitida: precio");
    slippageBps = maxSlippageWithinCap(q, swap);           // floor; si < mínimo operable → skip
  }
  // re-pedir /build con el slippage final si cambió. OJO: es una cotización NUEVA → repite el chequeo del tope
  // contra q2.otherAmountThreshold (salida mínima que exige la tx): si
  //   q2.inAmount × traderTok × 10000  >  traderSol × q2.otherAmountThreshold × (10000+capBps)  → skip "omitida: precio"
  // armar botTx (instrucciones de q2 + tip); simular; CU×1.2; fee con tope
  const signed = signOnce(botTx);                           // la tx del BOT (no la del trader); firma = id
  update(key, { status: "sent", bot_sig: sigOf(signed), last_valid_bh });
  await sendAndRebroadcast(signed, last_valid_bh);         // mismo tx, sin re-firmar
  const st = await confirm(sigOf(signed));                 // confirmed + revisar err
  update(key, st.ok ? fromBalances(st) : { status: st.expired ? "expired" : "failed" });
  updatePositionAndPnl(key);
}
```

## `parseSwap` por balances

```ts
function parseSwap(tx, owner) {
  const keys = allAccountKeys(tx);                     // estáticas + meta.loadedAddresses (writable, readonly)
  const i = keys.indexOf(owner);
  let solDelta = BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
  if (keys[0] === owner) solDelta += BigInt(tx.meta.fee);  // devolver fee si el trader la pagó
  // wSOL del trader cuenta como SOL
  const tok = deltasByMint(tx.meta.preTokenBalances, tx.meta.postTokenBalances, owner); // uiTokenAmount.amount → BigInt
  solDelta += tok.get(WSOL) ?? 0n; tok.delete(WSOL);
  const moved = [...tok].filter(([, d]) => d !== 0n);
  if (moved.length === 0) return { side: "no-swap" };
  if (moved.length > 1) return { side: "unsupported" };
  const [mint, tokDelta] = moved[0];
  const preSol = BigInt(tx.meta.preBalances[i]) + preWsol(owner);
  const preTok = preTokenOf(owner, mint);
  if (tokDelta > 0n && solDelta < 0n) return { side: "buy", mint, sol: -solDelta, tok: tokDelta, pctBps: ratioBps(-solDelta, preSol) };
  if (tokDelta < 0n && solDelta > 0n) return { side: "sell", mint, sol: solDelta, tok: -tokDelta, pctBps: ratioBps(-tokDelta, preTok) };
  return { side: "unsupported" };
}
```

Casos a probar con transacciones reales guardadas (fixtures): compra por Jupiter, compra en bonding curve de pump.fun, venta parcial, venta del 100%, swap fallido, transferencia sin swap, swap token↔USDC, tx v0 con ALT, tx donde el trader no es fee payer.

## Latido (`alarm()` cada 30 s)

```ts
async alarm() {
  if (!socketOpen() || now() - health.last_msg_at > 60_000) await reconnectAndBackfill();
  pingSocket();
  await resolveStuckOps();             // 'sent' cuyo blockhash expiró → consultar firma → confirmed/expired
  await checkAlerts();                 // saldo, fallos seguidos, pérdida diaria, créditos
  this.ctx.storage.setAlarm(now() + 30_000);
}
```

## Reconciliación (cron cada N min)

1. Tokens del trader y del bot (`getTokenAccountsByOwner` con programa SPL y con Token-2022).
2. Por mint: ¿el bot tiene y el trader no? ¿el trader tiene y el bot no, sin "omitida" registrada? ¿proporción desviada > X%?
3. Revisa que las firmas del trader registradas a `processed` aparezcan confirmadas.
4. Envía alerta con la lista. La acción automática solo si el usuario la definió.

## Métricas de latencia a reportar

- `detección` = hora de recepción − hora del bloque del trader (`blockTime`, segundos; usa slots para más precisión).
- `decisión` = desde recepción hasta tx firmada (incluye `/build` y simulación).
- `aterrizaje` = slot del bot − slot del trader (convierte a tiempo con `blockTime` de ambos bloques; no asumas una duración fija por slot).
Reporta mediana y p90 diarios. La meta 1–2 s se evalúa con estos números, no con impresiones.
