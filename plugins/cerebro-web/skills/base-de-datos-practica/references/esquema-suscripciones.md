# Esquema de ejemplo: suscripciones, pagos, referidos y cupones (SQLite / D1)

Punto de partida para una migración `0001`. Adáptalo; no lo copies sin leerlo. Probado con `sqlite3` (las llaves foráneas se aplican por defecto en D1).

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  referred_by   INTEGER REFERENCES users(id),         -- quién lo refirió (NULL si nadie)
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE plans (
  id            TEXT PRIMARY KEY,                     -- 'pro_mensual'
  name          TEXT NOT NULL,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  currency      TEXT NOT NULL CHECK (currency IN ('MXN','USD')),
  interval      TEXT NOT NULL CHECK (interval IN ('month','year')),
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE subscriptions (
  id                        INTEGER PRIMARY KEY,
  user_id                   INTEGER NOT NULL REFERENCES users(id),
  plan_id                   TEXT NOT NULL REFERENCES plans(id),
  provider                  TEXT NOT NULL CHECK (provider IN ('stripe','mercadopago','solana','manual')),
  provider_subscription_id  TEXT,                     -- sub_..., id de preapproval; NULL en cripto manual
  status                    TEXT NOT NULL CHECK (status IN ('pending','trialing','active','past_due','paused','canceled','expired')),
  current_period_end        TEXT,                     -- hasta cuándo tiene acceso (UTC)
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (provider, provider_subscription_id)
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE payments (
  id                    INTEGER PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  subscription_id       INTEGER REFERENCES subscriptions(id),
  provider              TEXT NOT NULL,
  provider_payment_id   TEXT NOT NULL,                -- id del cobro o firma de la transacción on-chain
  amount_minor          TEXT NOT NULL,                -- centavos, lamports o unidades de USDC (6 dec) como texto entero
  currency              TEXT NOT NULL,                -- 'MXN','USD','SOL','USDC'
  status                TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (provider, provider_payment_id)              -- el mismo pago nunca se registra dos veces
);
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at);

-- Idempotencia de webhooks: inserta primero; si choca con UNIQUE, ya se procesó.
CREATE TABLE webhook_events (
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  type          TEXT NOT NULL,
  received_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  processed_at  TEXT,
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE referral_codes (
  code          TEXT PRIMARY KEY COLLATE NOCASE,      -- 'AMIGO10' (sin datos personales en el código)
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  commission_bps INTEGER NOT NULL DEFAULT 1000 CHECK (commission_bps BETWEEN 0 AND 10000),  -- 1000 = 10%
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Comisión generada por cada pago de un referido. Se paga al afiliado después del periodo de reembolso.
CREATE TABLE referral_commissions (
  id              INTEGER PRIMARY KEY,
  payment_id      INTEGER NOT NULL UNIQUE REFERENCES payments(id),
  referrer_user_id INTEGER NOT NULL REFERENCES users(id),
  amount_minor    TEXT NOT NULL,
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending','approved','paid','voided')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_ref_comm_referrer ON referral_commissions(referrer_user_id, status);
```

## Patrón de idempotencia (pseudocódigo)

```text
1. Verifica la firma del webhook con el body crudo. Si falla: 400 y fin.
2. INSERT INTO webhook_events (provider, event_id, type) VALUES (?, ?, ?)
   - Si falla por UNIQUE/PRIMARY KEY: ya lo procesaste -> responde 200 y fin.
3. Consulta al proveedor el estado real del objeto (no confíes solo en el payload).
4. Actualiza subscriptions/payments en un batch.
5. UPDATE webhook_events SET processed_at = ... WHERE provider = ? AND event_id = ?
6. Responde 2xx rápido (Mercado Pago espera respuesta en 22 s; Stripe pide responder antes de lógica pesada).
```

Si el paso 4 puede tardar, encola el trabajo (Cloudflare Queues) y responde 200 en el paso 2.

## Cómo usar los montos

- `amount_minor` como TEXT entero evita perder precisión con lamports grandes; conviértelo con `BigInt(amount_minor)` en JS.
- Nunca sumes montos de monedas distintas.
- Comisión: `BigInt(amount) * BigInt(commission_bps) / 10000n` (redondea hacia abajo; decide y documenta la regla).
