# Agregadores de swaps EVM: 0x y 1inch (verificado nov 2026)

Lee esto antes de escribir código de swaps en EVM. Confirma cada parámetro en la doc vigente (WebFetch o Context7) antes de usarlo: estas APIs cambian de versión.

## 0x Swap API v2

- Base URL: `https://api.0x.org`
- Headers obligatorios: `0x-api-key: <key del dashboard de 0x>` y `0x-version: v2`.
- Dos flujos de permisos:
  - **AllowanceHolder (recomendado por 0x)**: `GET /swap/allowance-holder/price` (indicativo) y `GET /swap/allowance-holder/quote` (firme).
  - **Permit2 (0x lo marca "advanced use only")**: requiere firmar un mensaje EIP-712 además de la tx. No lo uses salvo que haya una razón.
- Parámetros básicos: `chainId` (8453 = Base), `sellToken`, `buyToken` (direcciones), `sellAmount` (en unidades base, entero), `taker` (dirección que hará el trade; necesaria para la cotización firme).
- Permisos:
  - Revisa `issues.allowance` en la respuesta. Si es `null`, ya hay permiso suficiente.
  - Si no, aprueba **al spender que indica `issues.allowance.spender`** (o `allowanceTarget`).
  - La doc dice textual que nunca pongas allowance en el contrato **Settler**: no lo necesita y te expone a perder tokens.
  - `issues.balance` indica si el `taker` no tiene saldo suficiente: muéstralo al usuario y no envíes.
- Comisión de integrador (todos los planes):
  - `swapFeeRecipient`: dirección que cobra (admite varias separadas por coma).
  - `swapFeeBps`: 0–1000 (0–10 %) por defecto; más alto requiere hablar con soporte. Alternativa: `swapFeePpm` (partes por millón).
  - `swapFeeToken`: debe ser el `buyToken` o el `sellToken`.
  - El monto cobrado viene en `fees.integratorFee.amount`. Muéstralo al usuario antes de firmar.
- Fee propio de 0x: en el plan Standard, 0x cobra un fee on-chain en swaps de **algunos tokens**; aparece como `zeroExFee` en la respuesta. Ver https://0x.org/pricing.
- Trade surplus (`tradeSurplusRecipient`): solo planes personalizados; si no lo tienes, el surplus lo cobra 0x.
- Doc en Markdown: agrega `.md` a la URL; índice en `https://docs.0x.org/llms.txt`.

## 1inch (1inch Business)

- Base: `https://api.1inch.com`; Classic Swap v6.1: `/swap/v6.1/{chainId}/quote` y `/swap/v6.1/{chainId}/swap` (confirma rutas y parámetros en la doc antes de usarlos).
- Auth: header `Authorization: Bearer <API_KEY>`. La key sale del portal (registro self-serve sin aprobación; el KYC/KYB que menciona la doc es para resolvers y market makers, no para usar la API). Es un bearer token: nunca en el frontend ni en el repo.
- Plan gratis "Dev" (a nov 2026): 1 solicitud por segundo (RPS) y 100 000 llamadas/mes; al llegar al límite responde 429, sin cobro por excedente. Verifícalo en https://business.1inch.com/portal/llms-full.txt antes de depender de esto.
- **Fee de infraestructura de 1inch** (aparte de tu comisión y de la suscripción): se descuenta del monto de destino de cada swap por API. A nov 2026 en plan Dev: 10 bps en stablecoins y 30 bps en el resto (Startup 7/20, Pro 4/10, Business 2/5). Inclúyelo al mostrar el costo al usuario y al comparar contra 0x.
- **Comisión de integrador NO incluida en el plan Dev.** En Classic Swap, `fee` + `referrer` se ignoran sin error: el swap se ejecuta y el `referrer` no recibe nada. En Fusion/Fusion+ la cotización falla con 400 (`FEE_NOT_ALLOWED`, `INTEGRATOR_FEE_DISABLED`, `CUSTOMER_FEE_DISABLED`). Para cobrar: plan de pago y habilitarlo por organización.
- Tokens con fee al transferir + parámetros `fee`/`referrer` pueden hacer que la tx falle siempre (lo dice su FAQ).
- Índice para agentes: `https://business.1inch.com/llms.txt` y `https://business.1inch.com/portal/llms.txt`.

## Comprobación obligatoria después de integrar (cualquier agregador)

1. Swap de prueba con monto pequeño en Base (o la red objetivo), con la billetera de pruebas.
2. En el explorador: el `approve` fue al spender esperado y por el monto exacto.
3. Los token transfers muestran: monto vendido, monto recibido ≥ mínimo, comisión de integrador llegando a tu dirección (si aplica).
4. Registra: cotización, salida mínima, salida real, gas total (incluye fee L1 en L2), comisión cobrada.
5. Si la comisión no llegó, revisa plan/parámetros antes de "arreglar" el código.
