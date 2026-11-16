---
name: seguridad-cripto-personal
description: Proteger billeteras del usuario - seed offline, hardware wallet, billeteras separadas (fría, caliente, bot), revisar y revocar approvals, firmas peligrosas (permit, Permit2, 7702), sitios falsos y qué hacer si te vacían. Úsala para revoke, drainer.
---

# Seguridad cripto personal

Para cuando el usuario va a conectar su billetera a algo, firmar algo raro, configurar billeteras para la terminal o el bot, o cree que le robaron. El objetivo: que un error no le cueste todo. Para llaves y secretos en código (`.env`, Workers, gitleaks) usa `secretos-y-llaves` de cerebro-base; para Solana (Phantom, conexión sin custodia, firmas en Solana) usa `billetera-sin-custodia` y `riesgo-memecoins` de cerebro-solana.

## Regla 0: verifica antes de confiar

- Los dominios oficiales se confirman en la doc o el repo oficial del proyecto, nunca desde un anuncio, un resultado patrocinado, un DM o un "soporte" en Telegram/Discord. Incluso al buscar una billetera conocida, aparecen muchos sitios clonados.
- Si una herramienta de seguridad (revoke.cash, extensión de billetera) cambió de dominio o de función, verifica en su repo/redes oficiales antes de usarla.

## Reglas duras (sin excepciones)

1. **Nunca** pidas, aceptes, imprimas, guardes ni escribas en archivos o chat una seed phrase o llave privada del usuario. Si la pega en el chat: detente, dile que esa billetera debe considerarse comprometida y guíalo a mover los fondos a una nueva (abajo).
2. La seed phrase vive **offline**: papel o placa de metal, en un lugar seguro. Nunca foto, nube, notas del celular, gestor de contraseñas sincronizado ni correo.
3. Ningún sitio, soporte o "verificación" legítima pide la seed phrase. Quien la pide es estafa, siempre.
4. Antes de que el usuario firme algo que tú propusiste, explícale en una frase qué autoriza y a quién.
5. No des recomendaciones de inversión ni sugieras comprar productos específicos con dinero; describe opciones.

## Separar billeteras (por riesgo)

| Billetera | Para qué | Saldo | Dónde vive la llave |
|---|---|---|---|
| **Fría / bóveda** | Ahorros que no se mueven | La mayor parte | Hardware wallet; nunca se conecta a sitios nuevos |
| **Caliente / diario** | Conectar a dApps, probar terminales, mints | Solo lo que puede perder | Extensión o app de billetera |
| **Bot** | La que firma sola en el servidor (copy trading) | Lo mínimo operable + límite de pérdida | Secret del servidor (ver `secretos-y-llaves`), nunca la misma que las otras |
| **Pruebas** | Testnet y montos de prueba | Casi nada | Puede ser desechable |

- Cada una con seed distinta (no "otra cuenta de la misma seed" para la bóveda: si se filtra la seed se pierden todas).
- El bot nunca tiene permisos ni approvals sobre la bóveda. Mueve ganancias del bot a la bóveda a mano, con confirmación.
- Hardware wallet: cómprala solo en la tienda oficial del fabricante, nunca usada ni "preconfigurada"; si viene con una seed ya escrita, es estafa. Revisa en la pantalla del dispositivo (no en la de la compu) la dirección y el monto antes de confirmar.

## Antes de firmar: qué es peligroso

Firmar un mensaje **también** puede costar dinero. Señales de alto riesgo:

- **`approve` / `increaseAllowance`** con monto ilimitado o a un contrato que no reconoces.
- **`setApprovalForAll(…, true)`**: permiso sobre **todos** los NFTs de una colección.
- **Permit (EIP-2612) y Permit2**: firmas "gratis" (sin gas) que crean un permiso de gasto. La billetera muchas veces no las marca como peligrosas y parecen un "sign-in". Una vez firmadas, el estafador las activa rápido; revoke.cash no las ve hasta que se activan. Permit2 puede aprobar varios tokens en una sola firma.
- **Autorización/delegación EIP-7702**: delega tu cuenta a un contrato. Uno malicioso puede vaciar varios activos en una sola tx. Solo acéptala dentro de tu billetera y para un servicio que tú iniciaste.
- **Órdenes de marketplace** que venden tus NFTs/tokens por 0.
- Cualquier firma con texto ilegible (hex) o en una red que no esperabas.

Regla práctica: si no entiendes qué firma, **no firmes**. Cierra el sitio y pregunta. Una buena billetera muestra la simulación de cambios de saldo; si dice que vas a perder algo que no esperabas, cancela.

## Revisar y revocar permisos (EVM)

- Revisa approvals con revoke.cash (conectando solo para leer, o pegando la dirección) o el verificador de approvals del explorador de la red.
- Revocar = `approve(spender, 0)` para tokens o `setApprovalForAll(spender, false)` para NFTs; es una tx (cuesta gas).
- Revoca: permisos ilimitados que ya no usas, a contratos desconocidos o de proyectos abandonados/hackeados, y el approval a Permit2 si ya no lo usas. Las sub-aprobaciones de Permit2 de corto plazo pueden dejarse expirar.
- Delegaciones EIP-7702: revoke.cash las muestra en la pestaña "delegations" pero **no** las revoca; eso se hace dentro de la billetera.
- Rutina: revisar una vez al mes y después de usar cualquier sitio nuevo.
- Solana tiene otro modelo (delegaciones de token, cuentas): remite a cerebro-solana.

## Sitios falsos, airdrops y tokens trampa

- Guarda en marcadores los sitios que usas (DEX, bridge, terminal) y entra solo desde ahí.
- Tokens que "aparecen" en tu billetera con un link o un nombre tipo "Reclama en ..." son anzuelo: no los toques, no visites el sitio, no intentes venderlos (vender puede requerir un approval malicioso). Ocúltalos.
- Airdrops reales se anuncian en canales oficiales del proyecto; si exige conectar la bóveda o firmar un permit, no.
- "Soporte" que te escribe primero, "recuperadores de fondos" y "devs" que piden compartir pantalla: estafa.
- Dirección envenenada (address poisoning): el estafador mete en tu historial transferencias falsas o de 0 (incluso del token real, sin tu permiso) con una dirección parecida a una que usas. Copia direcciones de la fuente original (página de depósito del exchange, el destinatario), nunca del historial, y compara mucho más que los primeros y últimos 4 caracteres.

## Si te vacían (orden de acciones)

Calma, rápido y en este orden (guía basada en revoke.cash):

1. **Identifica qué pasó**: ¿se fueron muchos activos de varias redes? → seed comprometida. ¿Varios activos a un solo contrato? → firma de marketplace/Permit. ¿Un solo activo? → transferencia o approval malicioso. Mira los approvals en revoke.cash.
2. **Si fue un approval o firma**: revoca ya ese permiso (es lo único que frena más robos). Lo robado normalmente no regresa; la billetera puede seguir usándose después de revisar todo.
3. **Si fue la seed o la llave**: la billetera queda inservible para siempre. Desde un dispositivo **limpio** crea una billetera nueva (idealmente hardware) y mueve lo que quede. Bots "sweeper" vacían todo lo que entra; no mandes gas a la billetera comprometida para "rescatar" sin ayuda. Si queda una cantidad importante, la guía de revoke.cash menciona la línea de whitehats de Flashbots.
4. **Revisa la compu**: un malware pudo robar la seed o el `.env`. Escanéala o reinstala, y cambia contraseñas importantes. Si había llaves de bot/API en esa máquina, rota todas (`secretos-y-llaves`).
5. **No caigas en "recuperadores"**: on-chain no se revierte; quien promete recuperar fondos casi siempre es otra estafa.
6. **Reporta**: a los exchanges por donde pasaron los fondos y a la autoridad local; deja rastro por si atrapan a los responsables.

## Errores comunes que debes evitar

- Sugerir "importa tu seed en este script para que el bot funcione" con la billetera principal.
- Usar la misma billetera para la bóveda y para probar sitios nuevos.
- Asumir que una firma sin gas es inofensiva.
- Recomendar revocar desde un link que llegó por DM.
- Dar por hecho que revoke.cash cubre Solana o revoca delegaciones 7702.

## Cómo lo compruebas tú (usuario)

Abre revoke.cash, pega la dirección de tu billetera caliente (no hace falta conectar) y revisa la lista: cada permiso debería ser de un sitio que reconoces y usas. Lo que no, se revoca. Repite con la dirección del bot.

## Fuentes (verificado nov 2026)

- https://revoke.cash/learn/approvals/what-are-token-approvals · https://revoke.cash/learn/approvals/what-are-eip2612-permit-signatures · https://revoke.cash/learn/approvals/what-is-permit2
- https://revoke.cash/learn/wallets/what-is-eip7702 (delegaciones: se ven en revoke.cash, se revocan en la billetera)
- https://revoke.cash/learn/security/what-to-do-when-scammed (orden de acciones, sweeper bots, estafas de recuperación)
- https://revoke.cash/learn/security/what-is-address-poisoning
- https://www.theblock.co/news/ecosystems/2025-06-01-wintermute-warns-pectra-upgrade-leaves-ethereum-users-at-risk-of-automated-attacks (riesgos de delegación 7702)
- https://docs.0x.org/evm/0x-swap-api/guides/swap-tokens-with-0x-swap-api (ejemplo de "nunca aprobar a un contrato que no lo necesita")
