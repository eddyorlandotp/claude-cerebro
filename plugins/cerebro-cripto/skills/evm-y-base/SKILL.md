---
name: evm-y-base
description: Código para Ethereum, Base y otras L2 EVM - cuentas, gas EIP-1559 y fee L1, nonces, ERC-20 (decimals, approve), RPCs, viem/wagmi, conectar billeteras, swaps con 0x o 1inch y comisión de integrador. Úsala para EVM, Base, ERC20, connect wallet.
---

# EVM y Base (Ethereum, L2s)

El usuario ya tiene experiencia en Solana y podría llevar su terminal o bot a Base u otra cadena EVM. Esta skill evita los errores de "pensar en Solana" o de usar APIs viejas. Para Solana usa el plugin `cerebro-solana` (empieza por `solana-fundamentos`).

## Regla 0: verifica antes de confiar

- Antes de escribir código contra viem, wagmi, 0x, 1inch o un RPC, confirma la API con Context7 (MCP `context7`, si está instalado) o con WebFetch a la doc oficial. Muchas docs dan Markdown si agregas `.md` a la URL (`docs.base.org`, `docs.0x.org`, `wagmi.sh`) y tienen índice en `/llms.txt`.
- Antes de instalar un paquete, revisa versión y compatibilidad: `npm view <paquete> version peerDependencies`. No instales una librería de UI de billetera que pida otra versión mayor de wagmi.
- Nunca digas "listo" sin haber corrido el flujo en testnet (Base Sepolia) o en un fork local (`anvil --fork-url`, ver `solidity-basico-y-seguridad`).

## Reglas duras (dinero real)

1. Nunca pidas, imprimas, loguees ni commitees llaves privadas o seed phrases. En servidores/Workers van como secret; en Foundry usa keystore cifrado (`cast wallet import <nombre> --interactive`), nunca `--private-key` en el historial de la terminal. Detalle en la skill `secretos-y-llaves` de cerebro-base.
2. Bot o backend que firma = billetera dedicada con saldo pequeño, nunca la personal.
3. Simula antes de enviar (`simulateContract` / `eth_call` / `estimateGas`). Si la simulación revierte, no envíes.
4. Antes de cualquier tx que mueva fondos reales o dé un `approve`, muestra al usuario: red, contrato, monto en unidades humanas, gas estimado, y espera su "sí".
5. Nada de recomendaciones de inversión: explicas cómo funciona, no qué comprar.

## Diferencias clave con Solana (las que más rompen código)

| Tema | Solana | EVM |
|---|---|---|
| Orden de tx | blockhash con expiración | **nonce** secuencial por cuenta: una tx atorada bloquea las siguientes |
| Fee | base + priority fee (+ tip Jito) | EIP-1559: `maxFeePerGas` y `maxPriorityFeePerGas`; en L2 además fee L1 |
| Tokens | cuentas de token (ATA) por dueño | un contrato ERC-20 guarda todos los saldos; no hay "crear cuenta de token" |
| Permisos | firmas por tx | `approve` deja un permiso **persistente** a otro contrato |
| Unidad nativa | lamports (9 decimales) | wei (18 decimales): 1 ETH = 10^18 wei |
| Direcciones | base58 | hex `0x` de 20 bytes con checksum (EIP-55) |
| Reversión | tx falla y pagas fee | tx revierte y **pagas el gas usado** |

## Cuentas y nonces

- Hay cuentas de usuario (EOA, con llave) y contratos. Con EIP-7702 una EOA puede delegar en código de contrato: trata cualquier firma de "autorización/delegación" como peligrosa (ver `seguridad-cripto-personal`).
- El nonce lo pone la librería. En un bot que envía varias tx seguidas desde la misma cuenta, lleva tú el nonce (lee `getTransactionCount` con `blockTag: 'pending'` al arrancar y súmale uno por tx) o serializa los envíos; dos envíos en paralelo con el mismo nonce = uno se pierde o reemplaza al otro.
- Tx atorada: se reemplaza enviando otra con el **mismo nonce** y fees más altas (o una tx de 0 a ti mismo para cancelarla). Explícaselo al usuario antes de hacerlo.

## Gas (EIP-1559) y Base

- Costo L2 = `gasUsed × (baseFee + priorityFee)`; tú fijas topes (`maxFeePerGas`, `maxPriorityFeePerGas`) y pagas lo efectivo. viem los estima solo; no los pongas a mano salvo que sepas por qué.
- **Base y otras OP-stack cobran además un fee L1** (publicar datos en Ethereum) que `estimateGas` no incluye. Fórmula de la doc de Base: `totalFee = gasUsed × (baseFee + priorityFee) + l1Fee + operatorFee` (`l1Fee` y `operatorFee` salen del predeploy `GasPriceOracle`). Para mostrar "costo de la tx" al usuario, incluye el fee L1 o di que es aproximado.
- A nov 2026 Base: bloques de 200 ms, orden dentro del bloque por priority fee, base fee mínimo 0.005 gwei (puede cambiar: ver doc de Network Fees).
- Retiros Base → Ethereum por el puente nativo tardan días (a nov 2026: 5 días, o 1 día con pruebas TEE+ZK). Depósitos Ethereum → Base, minutos.

## Red y RPC (Base)

| Red | chainId | RPC público | Explorador |
|---|---|---|---|
| Base Mainnet | 8453 | `https://mainnet.base.org` | basescan.org |
| Base Sepolia (test) | 84532 | `https://sepolia.base.org` | sepolia.basescan.org |

- Los RPC públicos tienen límite bajo, no sirven `debug`/`trace`/`txpool` y la doc dice que **no son para producción**. Para la app o un bot usa un proveedor dedicado (la doc de Base los lista en "Builder Stack"); guarda la URL con key como secret.
- Configura un `fallback` de transportes en viem (2 proveedores) para un bot 24/7.
- Siempre valida `chainId` antes de firmar: firmar en la red equivocada es el error más caro y silencioso.

## Librerías (a nov 2026)

- **viem 2.x** (TypeScript, bajo nivel) para backend, bots y scripts. Es lo que usan los ejemplos de la doc de Base. ethers v6 sigue publicado (6.17.0, jun 2026); úsalo solo si el proyecto ya lo usa. No mezcles las dos en el mismo proyecto.
- **wagmi 3.x** (hooks de React sobre viem) para frontend. Cambios de v3 que Claude suele ignorar:
  - Los conectores tienen dependencias opcionales que instalas tú (p. ej. el conector `baseAccount` necesita `@base-org/account`).
  - `useAccount` → `useConnection`, `useAccountEffect` → `useConnectionEffect`, `useSwitchAccount` → `useSwitchConnection`.
  - Instalación base: `npm install wagmi viem@2.x @tanstack/react-query`.
- **OnchainKit está retirado** (repo archivado, paquete npm marcado "no longer supported"). La doc de Base manda a wagmi + viem. No lo instales aunque aparezca en tutoriales.
- "Base App" ahora se llama Coinbase Wallet; el SDK de Base Account se documenta como Coinbase Wallet SDK (paquete `@base-org/account`).

## Conectar billeteras (frontend)

Decide con el usuario en 1-2 frases: "¿Quieres un botón propio simple o un modal listo con muchas billeteras?".

1. **Propio con wagmi** (recomendado para empezar): conectores `injected` (MetaMask, Rabby, etc. en el navegador), `walletConnect` (móvil; requiere projectId de Reown), `baseAccount`/`coinbaseWallet`. Menos dependencias, menos sorpresas.
2. **Modal listo**: la guía de wagmi menciona ConnectKit, Dynamic y Privy. Cuidado a nov 2026: ConnectKit y RainbowKit declaran `wagmi 2.x` como peer dependency (no v3). Reown AppKit 2.0.0 (adapter wagmi) pide `wagmi >=3` pero salió el 16 nov 2026: espera o fija versión y pruébalo. Dynamic y Privy son servicios con cuenta y llaves de API: revisa planes y si crean billeteras embebidas (custodia) antes de elegir.
3. Siempre: el usuario firma en **su** billetera; tu app nunca ve llaves. Mismos principios que `billetera-sin-custodia` de cerebro-solana.

## ERC-20: decimals y approve

- **Lee `decimals()` del contrato siempre.** Ejemplos verificados por RPC (nov 2026): USDC en Base tiene 6; USDT (BSC-USD) en BNB Chain tiene 18. Mismo símbolo, distinta escala según la cadena.
- Montos con `bigint` y `parseUnits`/`formatUnits` de viem; nunca `Number` para montos raw. Misma regla que `montos-y-decimales` de cerebro-solana.
- Toma direcciones de tokens de la fuente oficial (p. ej. la lista de contratos de USDC de Circle) y del explorador verificado, nunca de memoria ni de un tweet.
- `approve(spender, amount)` deja permiso persistente. Reglas:
  - Aprueba el **monto exacto** del trade, no `maxUint256`, salvo que el usuario lo pida sabiendo el riesgo.
  - Aprueba solo al spender que diga la API (ver agregadores abajo) y verifica en el explorador que es el contrato oficial.
  - Algunos tokens (USDT en Ethereum) exigen poner el allowance en 0 antes de cambiarlo; en Solidity usa `SafeERC20.forceApprove` de OpenZeppelin.
  - Antes de aprobar, lee `allowance(owner, spender)`: si ya alcanza, no aprobar de nuevo.
- Tokens raros: con fee al transferir, rebase, blacklist, pausables o proxies actualizables. Si el bot opera tokens arbitrarios, verifica lo recibido por diferencia de saldo, no por el monto pedido.

## Swaps con agregadores (0x, 1inch)

Antes de integrar, lee `references/agregadores-swaps.md` (endpoints, parámetros y trampas verificadas). Lo esencial:

- **0x Swap API v2**: `https://api.0x.org/swap/allowance-holder/quote` (recomendado) con headers `0x-api-key` y `0x-version: v2`. Comisión de integrador con `swapFeeRecipient` + `swapFeeBps` (máx. 1000 bps por defecto) + `swapFeeToken`, disponible en todos los planes. **Nunca aprobar al contrato Settler**: solo al spender que devuelve `issues.allowance.spender`.
- **1inch**: `https://api.1inch.com/swap/v6.1/{chainId}/...`, API key como Bearer. Ojo: en el plan gratis Dev, los parámetros `fee` + `referrer` se **ignoran en silencio** (el swap sale, tú no cobras). Cobrar comisión requiere plan de pago. Además 1inch descuenta su propio fee de infraestructura del monto de destino (plan Dev: 10 bps stables / 30 bps resto, a nov 2026).
- Flujo seguro: precio indicativo → cotización firme con `taker` → revisar `minBuyAmount`/salida mínima y fees → approve exacto si falta → simular → confirmación del usuario → enviar → esperar recibo → verificar saldos.

## Errores comunes que debes evitar

- Asumir 18 decimales para todo token, o 6 para todo "USD".
- Mostrar costo de gas en Base sin el fee L1.
- Enviar varias tx en paralelo desde la misma cuenta sin manejar nonces.
- Usar el RPC público de Base en producción.
- Instalar OnchainKit o una UI de billetera incompatible con la versión de wagmi.
- Integrar 1inch "con comisión" en plan gratis y no notar que no se cobra nada.
- Hacer `approve` ilimitado por comodidad.

## Cómo lo compruebas tú (usuario)

Después de un swap o transferencia de prueba en Base Sepolia, abre la tx en sepolia.basescan.org: revisa "From", "To", los token transfers (montos con decimales correctos) y el fee pagado. Luego, en revoke.cash, confirma que no quedó ningún permiso que no esperabas.

## Fuentes (verificado nov 2026)

- https://docs.base.org/base-chain/quickstart/connecting-to-base (chainIds, RPCs, aviso de producción)
- https://docs.base.org/specifications/transactions/network-fees · https://docs.base.org/specifications/transactions/transaction-ordering · https://docs.base.org/base-chain/network-information/transaction-finality
- https://docs.base.org/sdks/migrated-products (OnchainKit retirado, Base App → Coinbase Wallet)
- https://viem.sh/docs/introduction · https://wagmi.sh/react/getting-started · https://wagmi.sh/react/guides/connect-wallet · https://wagmi.sh/react/guides/migrate-from-v2-to-v3
- https://docs.ethers.org/v6/ · registry.npmjs.org (versiones y peerDependencies de viem, wagmi, ethers, connectkit, @rainbow-me/rainbowkit, @reown/appkit-adapter-wagmi, @coinbase/onchainkit)
- https://docs.0x.org/evm/0x-swap-api/guides/swap-tokens-with-0x-swap-api · https://docs.0x.org/evm/0x-swap-api/guides/monetize-your-app-using-swap
- https://business.1inch.com/products/swap · https://business.1inch.com/portal/llms-full.txt (fees de integrador requieren plan de pago; plan Dev 1 RPS y 100 000 llamadas/mes; fee de infraestructura por plan)
- https://developers.circle.com/stablecoins/usdc-contract-addresses · OpenZeppelin `SafeERC20.sol` (forceApprove)
- https://ethereum.org/developers/docs/gas/
