# Cobrar comisión con Jupiter (verificado nov 2026)

Fuentes: https://developers.jup.ag/docs/swap/order-and-execute.md#referral-fees, https://developers.jup.ag/docs/tool-kits/referral-program.md, https://developers.jup.ag/docs/swap/build.md#fees. Programa de referidos open source: https://github.com/TeamRaccoons/referral.

## Opción A: referral en `/order` (recomendada para la terminal)

Cómo funciona:
- Rango: `referralFee` de 50 a 255 bps (0.5% a 2.55%). Debe ir con `referralAccount`.
- Jupiter toma 20% de tu comisión y no cobra su fee de plataforma aparte.
- Jupiter elige el `feeMint` por prioridad: SOL → stables (USDC, USDT…) → LSTs → bluechips → otros.
- Necesitas un `referralTokenAccount` inicializado para cada mint en que esperas cobrar. Si falta el del `feeMint`, la orden se ejecuta igual **sin tu comisión**.
- Soporta SPL y Token-2022.

### Configuración única (dos caminos)

1. **Web**: https://referral.jup.ag/ (Referral Dashboard) para crear y ver tus cuentas. Es lo más simple para un no programador: explícale al usuario qué va a firmar y que cuesta solo el rent de cada cuenta.
2. **Script** con `@jup-ag/referral-sdk` (0.3.0, depende de `@solana/web3.js` 1.x; ponlo en una carpeta aparte del producto):
   - `provider.initializeReferralAccountWithName({ payerPubKey, partnerPubKey, projectPubKey, name })` con el proyecto de referidos que indica la doc vigente (cópialo de la página de order-and-execute, no de memoria).
   - `provider.initializeReferralTokenAccountV2({ payerPubKey, referralAccountPubKey, mint })` por cada mint (empieza con wSOL `So11111111111111111111111111111111111111112` y USDC).
   - Quien firma como `payerPubKey` paga el rent. Usa la billetera de la plataforma con poco saldo, nunca la del usuario.
   - La llave de esa billetera: variable de entorno local solo durante el script, nunca en el repo. Pide al usuario que la cargue él (`read -s` en la terminal); Claude no debe verla ni imprimirla.

### Uso

```ts
const params = new URLSearchParams({
  inputMint, outputMint,
  amount: amountRaw.toString(),      // bigint → string, nunca float
  taker: userAddress,
  referralAccount: env.JUP_REFERRAL_ACCOUNT,
  referralFee: "50",                  // bps
});
const res = await fetch(`https://api.jup.ag/swap/v2/order?${params}`, {
  headers: { "x-api-key": env.JUP_API_KEY },
});
const order = await res.json();
// Verifica que se aplicó: order.referralAccount presente y feeBps/platformFee coherentes.
```

Valida en cada orden: si `order.referralAccount` no viene o el fee cayó al default de Jupiter, registra una alerta "falta referralTokenAccount para <feeMint>".

## Opción B: platform fee en `/build` (para flujos que arman su propia tx)

- `platformFeeBps` (entero) + `feeAccount` (cualquier token account que controles; no tiene que ser del programa de referidos).
- Jupiter no cobra fee de swap en `/build`; te quedas el 100% de tu fee.
- Tú creas y mantienes `feeAccount`. La doc de V2 no explica en qué mint se cobra según la ruta: haz un swap de prueba chico, revisa en el explorador a qué cuenta llegó y en qué token, y solo entonces publica.

## Mostrar la comisión al usuario

Antes de pedir la firma, muestra: monto de entrada, salida estimada, comisión de la plataforma en % y en tokens, fee de Jupiter si aplica, y slippage. Tras `/execute`, muestra `totalOutputAmount` real.

## Checklist antes de cobrar en producción

- [ ] `referralAccount` creado y su dirección guardada como variable (no en el código fuente si el repo es público… aunque es pública on-chain, mantenla en config).
- [ ] `referralTokenAccount` para wSOL y USDC como mínimo.
- [ ] Swap de prueba en mainnet con monto mínimo; comisión visible en el explorador.
- [ ] Alerta si una orden sale sin referral.
- [ ] Términos de servicio de la terminal mencionan la comisión.
