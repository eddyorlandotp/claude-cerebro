---
name: base-de-datos-practica
description: Elegir y diseñar la base de datos de un proyecto chico (D1/SQLite, Supabase/Postgres, Turso) - esquema, migraciones versionadas, índices, dinero en enteros, secretos fuera de la base, respaldos y SQL parametrizado. Usa al decir base de datos, tabla, esquema, migración, D1, backup.
---

# Base de datos práctica para proyectos chicos

Lo que corrige: Claude crea tablas "al vuelo" sin migraciones, guarda dinero en `REAL`, mete API keys en una tabla, arma SQL con template strings, y nunca prueba que el respaldo se pueda restaurar.

Para la API concreta usa los plugins oficiales: `cloudflare` (D1 desde Workers) y `supabase` (Postgres, auth, RLS). Esta skill decide y fija reglas de diseño.

## Reglas duras

1. **Verifica antes de confiar.** Antes de escribir código contra el cliente de la base (D1, `@supabase/supabase-js`, `@libsql/client`), confirma la API con Context7 (si está instalado) o WebFetch a la doc oficial. No inventes métodos.
2. **Todo cambio de esquema es una migración versionada** en un archivo dentro del repo. Nunca `CREATE TABLE` a mano en producción. Nunca edites una migración ya aplicada: crea otra.
3. **Consultas siempre parametrizadas.** En D1: `env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email)`. Prohibido `` `... WHERE email = '${email}'` ``.
4. **Dinero en enteros**: centavos de MXN/USD (`amount_cents INTEGER`), y en cripto la unidad mínima (lamports para SOL, 6 decimales para USDC) como `INTEGER` o `TEXT` si puede exceder 2^53. Nunca `REAL`/`FLOAT`. Guarda siempre la moneda en otra columna.
5. **Secretos fuera de la base.** API keys, tokens de Stripe/MP, llaves de RPC → `npx wrangler secret put NOMBRE` (o el gestor de secretos del proveedor). Para local: `.dev.vars` o `.env` (uno solo, no ambos) y en `.gitignore`. **Jamás** llaves privadas ni seed phrases en ninguna tabla, log ni commit.
6. **No guardes datos de tarjeta.** Guarda solo los IDs que te devuelve Stripe/Mercado Pago (`cus_...`, `sub_...`, id de preapproval).
7. **Tokens que el usuario presenta** (API keys que tú emites, links mágicos): guarda solo su hash SHA-256 y, si acaso, los últimos 4 caracteres para mostrarlos.
8. Explica al usuario en 1–3 frases qué tabla o migración vas a crear y por qué, antes de crearla.

## Cuál elegir (a nov 2026 — verifica precios y límites antes de decidir)

| | D1 (Cloudflare) | Supabase (Postgres) | Turso (libSQL/SQLite) |
|---|---|---|---|
| Gratis | 10 bases, **500 MB por base**, 5 GB total, 5 M filas leídas/día, 100k escritas/día | **2 proyectos activos**, 500 MB, 50k MAU de auth | 100 bases, 5 GB, 500 M filas leídas/mes, 10 M escritas/mes |
| Trampa del gratis | 50 queries por invocación del Worker (usa `db.batch()`, cuenta como 1) | **Se pausa tras 1 semana sin actividad**; **sin respaldos automáticos** | Restauración a un punto: solo 1 día |
| Primer plan de pago | Workers Paid $5 USD/mes (10 GB por base) | Pro desde $25 USD/mes | Developer $4.99 USD/mes |
| Respaldo integrado | Time Travel: 7 días (Free) / 30 días (Paid) | Diario solo en Pro+ | PITR según plan |
| Ideal cuando | Ya todo vive en Workers | Necesitas auth lista, Postgres, tiempo real, panel visual | Quieres SQLite fuera de Cloudflare o una base por cliente |

**Default para este usuario:** si el backend ya vive en Cloudflare Workers, **D1**. Supabase solo si de verdad se necesita su auth/tiempo real y se acepta la pausa por inactividad (un proyecto de producción pausado = sitio caído). Dilo así de claro.

## Diseño de esquema (proyecto chico de suscripciones)

Tablas mínimas típicas (el SQL completo está en `references/esquema-suscripciones.md`; léelo cuando vayas a crear el esquema de cobros):

- `users` — id, email único, created_at.
- `subscriptions` — user_id, provider (`stripe`/`mercadopago`/`solana`), provider_subscription_id único, status, current_period_end.
- `payments` — monto en enteros + moneda, provider_payment_id **único** (evita doble registro).
- `webhook_events` — provider + event_id **únicos**: es la tabla de idempotencia.
- `referral_codes` / `referrals` — quién refirió a quién y cuánta comisión se generó.

Reglas de diseño:
- Cada tabla con `id` y `created_at` (UTC, ISO 8601 o epoch; elige uno y úsalo siempre).
- Estados con `CHECK (status IN (...))` para que un typo no cree un estado fantasma.
- Llaves foráneas declaradas (D1 las aplica por defecto, como `PRAGMA foreign_keys = on`).
- `UNIQUE` donde la lógica del negocio dice "no puede repetirse" (email, id de pago externo, código de referido). La base es tu última defensa contra duplicados.
- Nada de columnas "por si acaso". Se agregan con una migración cuando se necesiten.

## Migraciones (D1)

```bash
npx wrangler d1 migrations create <DB> crear_suscripciones   # crea migrations/000X_crear_suscripciones.sql
# escribe el SQL en ese archivo
npx wrangler d1 migrations apply <DB> --local                # primero local
npx wrangler d1 execute <DB> --local --command "SELECT name FROM sqlite_schema WHERE type='table';"
npx wrangler d1 migrations apply <DB> --remote               # luego producción (pide confirmación y toma respaldo)
npx wrangler d1 migrations list <DB> --remote                # confirma que no quedan pendientes
```

- Usa el **nombre** de la base (no el binding) para no migrar la base equivocada.
- Si una migración falla, D1 la revierte y deja aplicada la anterior. Lee el error, crea una migración nueva que corrija; no "arregles" en vivo.
- Antes de `--remote`, avisa al usuario y espera su OK: cambia producción.
- Supabase: usa `supabase migration new` / el flujo del plugin `supabase`, con las mismas reglas.

## Índices

- Crea índice para columnas que usas en `WHERE`, `JOIN` u `ORDER BY` frecuentes (p. ej. `subscriptions(user_id)`, `payments(user_id, created_at)`).
- Comprueba que se usa: `EXPLAIN QUERY PLAN SELECT ...` debe decir `USING INDEX`, no `SCAN`.
- En D1, después de crear índices corre `PRAGMA optimize`.
- En D1 se cobra/limita por **filas leídas**: un `SCAN` sobre 100k filas en cada request se come los 5 M diarios gratis en 50 requests.

## Respaldos (si no se ha probado restaurar, no hay respaldo)

- **D1:** `npx wrangler d1 export <DB> --remote --output=./respaldo-AAAA-MM-DD.sql`. Además existe Time Travel (`npx wrangler d1 time-travel info <DB>` / `restore`) para volver a un minuto exacto.
- **Supabase gratis:** no hay respaldos automáticos. Usa `supabase db dump` (roles, esquema y datos por separado; revisa los flags actuales en la guía "Backup and restore" de Supabase antes de correrlo).
- Guarda los respaldos **fuera** del proveedor (R2, disco local, otro servicio) y **sin secretos** dentro.
- Prueba la restauración en una base local al menos una vez: `npx wrangler d1 execute <DB_PRUEBA> --local --file=./respaldo.sql` y cuenta filas.
- Propón al usuario un respaldo semanal automático (cron) y dile dónde quedan los archivos.

## Al terminar

Muestra al usuario: la lista de tablas, la última migración aplicada (`migrations list`), y una consulta de ejemplo que él pueda correr para ver sus datos (`npx wrangler d1 execute <DB> --remote --command "SELECT COUNT(*) FROM users;"`).

## Fuentes (verificado nov 2026)

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/best-practices/use-indexes/
- https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://turso.tech/pricing
