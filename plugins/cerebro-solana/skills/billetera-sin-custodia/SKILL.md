---
name: billetera-sin-custodia
description: Conectar Phantom y otras billeteras Solana sin custodiar llaves - Wallet Standard, kit-plugin-wallet, wallet-adapter, Phantom Connect, firmar swaps en el navegador, móvil con deeplink, Sign In With Solana y avisos antes de firmar. Úsala para connect wallet, login, firmar.
---

# Billetera sin custodia en la terminal web

El usuario firma cada operación con **su** billetera. La plataforma nunca ve, pide, genera ni guarda llaves privadas o seed phrases de usuarios. Si alguna vez el diseño requiere que el servidor firme por el usuario, para y avísale: eso es custodia (otro riesgo legal y de seguridad).

## Regla 0: verifica antes de confiar

Las librerías de billetera cambiaron en 2025–2026 (Kit, web3.js v3, Phantom Connect SDK 2.x). Antes de instalar o escribir hooks: `npm view <paquete> version` y WebFetch a la doc (`https://solana.com/docs/frontend/react-hooks`, `https://docs.phantom.com/llms.txt`), o Context7. No inventes nombres de hooks.

## Qué librería usar (a nov 2026)

| Caso | Usa | Notas |
| - | - | - |
| App nueva (React/Next.js) | `@solana/kit` + `@solana/kit-plugin-rpc` + `@solana/kit-plugin-wallet` + `@solana/react` | Recomendado en la doc de Solana. Descubre billeteras por **Wallet Standard** (Phantom, Solflare, Backpack… aparecen solas). |
| App existente con wallet-adapter | `@solana/wallet-adapter-react` (0.15.x) | Funciona; pide `@solana/web3.js ^1.99` como peer. No la mezcles con Kit en la misma pantalla sin plan de migración. |
| Login con Google/Apple y billetera embebida | `@phantom/react-sdk` / `@phantom/browser-sdk` (2.0.x) | Las billeteras embebidas requieren App ID de Phantom Portal, que **pausó nuevas solicitudes** (nov 2026). Conectar solo la extensión de Phantom no requiere App ID. |

Hooks de `@solana/kit-plugin-wallet/react` según la doc: `useWallets(client)`, `useConnect(client)` (`connect.dispatch(wallet)`), `useDisconnect(client)`, `useConnectedWallet(client)` → `{ account, signer, wallet }` o `null`, `useSignMessage`, `useSignIn`. El `signer` expone un método por feature de la billetera: `modifyAndSignTransactions` (feature `solana:signTransaction`, solo firma) y `signAndSendTransactions` (`solana:signAndSendTransaction`).

## Firmar un swap de Jupiter

- **`/order` + `/execute`** (recomendado para la terminal): la billetera solo **firma** (`solana:signTransaction`); tu backend hace `POST /execute` con la tx firmada y el `requestId`. Así la API key de Jupiter queda en el servidor.
  - Billeteras embebidas del Phantom Connect SDK **no soportan** `signTransaction` (solo `signAndSendTransaction`): con ellas no puedes usar `/execute`. Usa `/build` y deja que la billetera envíe, o limita la terminal a billeteras de extensión/app.
  - Si `/execute` responde `-2`/`-3` (tx firmada o mensaje inválido), la billetera pudo haber modificado la transacción: registra qué billetera era y muéstrale al usuario un error claro.
- **`/build`**: tu backend arma la tx (con tu `platformFeeBps`), el navegador la pide a la billetera con `signAndSendTransaction` (o firma y tu backend la envía). Confirmas por firma.
- Desde el navegador **no** pongas API keys de Helius, Jupiter o Sender: pasa por tu Worker.

## Antes de pedir la firma: mensaje claro al usuario

Muestra en la UI, en español simple, antes de abrir la billetera:
- Qué vas a hacer: "Cambiar 0.5 SOL por ~12,345 BONK".
- Recibirás como mínimo X (slippage aplicado), comisión de la plataforma Y% (y en qué token), fee de red estimada.
- "Tu billetera te mostrará el detalle; si algo no coincide, rechaza".
- Deshabilita el botón mientras hay una firma pendiente (evita doble compra) y muestra el estado: firmando → enviando → confirmada / falló (con motivo y link al explorador).

Antes de mandar a firmar, valida en tu código la tx que vas a pedir: fee payer = usuario (o el `payer` que tú elegiste a propósito), que tu comisión sea la que anunciaste y que no haya instrucciones inesperadas.

## Móvil

- En el celular, los navegadores normales no tienen la extensión. Ofrece abrir la terminal dentro del navegador de Phantom con el deeplink `https://phantom.com/ul/browse/<url-codificada>?ref=<url-de-tu-app-codificada>`. Dentro de ese navegador, Wallet Standard detecta Phantom como en escritorio.
- Ese deeplink no se pega en el navegador: lo abre el usuario con un botón o QR.
- Android con otras billeteras: `@solana/wallet-adapter-react` trae Mobile Wallet Adapter (`@solana-mobile/wallet-adapter-mobile`) como dependencia. Verifica soporte actual en la doc de Solana Mobile antes de prometerlo.
- Prueba en un teléfono real; el emulador no tiene la app de la billetera.

## Cuentas de usuario: Sign In With Solana (SIWS)

- Usa la feature `solana:signIn` (Wallet Standard). Tu **servidor** genera el input: `domain`, `statement`, `nonce` de un solo uso y `issuedAt`; guarda una copia por nonce.
- Verifica en el servidor con `verifySignIn` de `@solana/wallet-standard-util` (o, para mensajes off-chain, `@solana/kit` / `@solana/offchain-messages`). Toma el mensaje esperado de tu base por nonce, no el que manda el cliente. Consume el nonce al verificar. Agrega tú una expiración corta (la doc no fija una).
- `signIn` v1.1.0 soporta `useOffchainMessage`; revisa la versión de la feature antes de usarlo (`supportsOffchainSignIn`).
- Si la billetera no soporta `signIn`, usa `signMessage` con un texto que incluya dominio, nonce y fecha.
- Nunca pidas firmar una **transacción** para iniciar sesión: entrena al usuario a firmar cosas peligrosas.
- La sesión (cookie httpOnly/JWT) dice "esta dirección es tuya"; no da permiso para mover fondos. Cada operación sigue requiriendo firma.

## Checklist de seguridad del frontend

- [ ] Ninguna API key ni secreto en el bundle del navegador (búscalos en el build: `grep -r "api-key\|x-api-key" dist/`).
- [ ] Todas las llamadas a Jupiter/Helius/Sender pasan por el Worker, que valida montos y aplica rate limit por usuario.
- [ ] Escuchas cambios de cuenta y desconexión de la billetera y limpias el estado (no firmes con la cuenta anterior).
- [ ] Muestras la dirección conectada (abreviada) junto al botón de firmar.
- [ ] Mainnet explícito en la configuración; un banner visible si apuntas a devnet.
- [ ] Content-Security-Policy que limite scripts a tu dominio y a los que realmente usas.
- [ ] Nunca un campo de texto que pida seed phrase o llave privada, ni siquiera "para importar".
- [ ] Mensajes de error que no expongan stack traces ni URLs con API key.

## Errores típicos

| Síntoma | Causa | Arreglo |
| - | - | - |
| "No se detecta Phantom" en celular | Navegador normal | Botón con deeplink `ul/browse` |
| `/execute` falla con embedded wallet | No soporta `signTransaction` | Ruta `/build` + sign-and-send |
| Doble swap | Doble clic, sin estado | Botón deshabilitado + id por intento |
| Login reutilizable | Nonce sin consumir o del cliente | Nonce del servidor, un uso, expiración |
| Pantalla en blanco al conectar | Mezcla de wallet-adapter (web3.js v1) con Kit | Elegir una pila |

## Cómo comprobarlo tú mismo

Conecta Phantom en escritorio y en el celular (con el botón de "abrir en Phantom"), haz un swap mínimo y revisa que Phantom muestre lo mismo que tu pantalla. Cierra sesión, vuelve a entrar y confirma que el mismo mensaje firmado no sirve dos veces.

## Fuentes (verificado nov 2026)

- https://solana.com/docs/frontend , https://solana.com/docs/frontend/react-hooks , https://solana.com/docs/frontend/messages-and-auth
- README de `@solana/kit-plugin-wallet` en npm (métodos del signer, hooks `useSignIn`/`useSignMessage`)
- https://docs.phantom.com/wallet-sdks-overview (App ID, Portal pausado), https://docs.phantom.com/sdks/react-sdk/sign-and-send-transaction (embedded sin `signTransaction`)
- https://docs.phantom.com/phantom-deeplinks/other-methods/browse.md
- Registro npm: `@solana/wallet-adapter-react` 0.15.40 (peer web3.js ^1.99, dependencia `@solana-mobile/wallet-adapter-mobile`), `@phantom/react-sdk` 2.0.4
- https://developers.jup.ag/docs/swap/order-and-execute.md (`/execute`, códigos -2/-3)
