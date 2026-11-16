---
name: solidity-basico-y-seguridad
description: Antes de escribir o desplegar un contrato Solidity - si hace falta, Foundry (forge, anvil, cast), OpenZeppelin 5.x, reentrancy, oráculos, approvals, front-running, Slither y auditoría. Úsala para smart contract, Solidity, deploy, ERC20, auditar.
---

# Solidity básico y seguridad

Un contrato desplegado guarda dinero real, es público y (casi siempre) no se puede corregir. El usuario no lee Solidity: la responsabilidad de no desplegar algo inseguro es tuya. Esta skill es un freno, no un tutorial.

## Regla 0: verifica antes de confiar

- Confirma la API de OpenZeppelin y Foundry con Context7 (MCP `context7`, si está instalado) o WebFetch a la doc oficial antes de escribir código. La doc de Foundry tiene índice en `https://www.getfoundry.sh/llms.txt` y páginas en Markdown con `.md`.
- Corre `forge --version` y `forge <comando> --help` en la máquina antes de dar flags.
- Nunca digas "seguro" o "listo para mainnet". Lo más que puedes decir: "pasa tests, fuzzing y Slither; falta revisión humana/auditoría".

## Paso 1: ¿de verdad necesitas un contrato propio?

Antes de escribir una línea, explícale al usuario en 2-3 frases qué alternativa existe. Casi siempre hay una:

| Quiere... | Sin contrato propio |
|---|---|
| Cobrar comisión en swaps | Comisión de integrador del agregador (0x, 1inch, Jupiter): ver `evm-y-base` |
| Recibir pagos | Transferencia directa a su billetera, o servicio de pagos (plugins `stripe`/`mercadopago` para fiat) |
| Un bot que opera | Bot off-chain que llama contratos existentes (DEX, agregador) |
| Lanzar un token | Fábricas/launchpads ya auditados; si insiste, ERC-20 estándar de OpenZeppelin **sin** lógica extra |
| Guardar fondos del equipo | Safe (multisig) existente, no un contrato propio |

Escribe un contrato propio solo si el usuario lo confirma después de oír la alternativa. Si el contrato va a custodiar fondos de otras personas, dile claramente que necesita auditoría profesional antes de mainnet y que hay implicaciones legales.

## Paso 2: herramientas (Foundry)

Instalación en Linux (a nov 2026, última estable v1.8.6):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup          # instala/actualiza forge, cast, anvil, chisel
```

En fish, si `forge` no aparece, abre una terminal nueva o agrega `~/.foundry/bin` con `fish_add_path`.

- `forge init <proyecto>` · `forge build` · `forge test -vvv` · `forge fmt`
- `anvil` = nodo local. `anvil --fork-url $RPC_URL` = copia local de la cadena real para probar contra contratos reales (Uniswap, USDC) sin gastar.
- `cast` = llamadas desde terminal: `cast call <contrato> "decimals()(uint8)" --rpc-url $RPC_URL`.
- Llaves: `cast wallet import deployer --interactive` (keystore cifrado en `~/.foundry/keystores`) y luego `--account deployer`. Nunca `--private-key` en la línea de comandos ni en scripts.
- Despliegue: `forge script script/Deploy.s.sol --rpc-url $RPC_URL` primero **sin** `--broadcast` (simula); solo con confirmación del usuario agregas `--broadcast --account deployer`.

## Paso 3: escribir con OpenZeppelin

- Versión a nov 2026: OpenZeppelin Contracts **5.7.0**. Instala por tag, no `master`:
  `forge install OpenZeppelin/openzeppelin-contracts@v5.7.0` y en `remappings.txt`:
  `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`
  (la doc avisa que `forge update` puede moverte a `master`, que es desarrollo).
- No copies ni modifiques código de la librería: hereda o compón. Genera la base con el Contracts Wizard (`docs.openzeppelin.com/contracts/5.x/wizard`) y explícale al usuario cada opción que activaste.
- Usa: `SafeERC20` (`safeTransfer`, `forceApprove`) para tokens externos; `Ownable2Step` o `AccessControl` para permisos; `Pausable` si hay fondos; `ReentrancyGuardTransient` en cadenas con transient storage (en 5.7.0 `ReentrancyGuard` normal está marcado como deprecado para v6).
- `pragma solidity` fijo (sin `^`) en contratos a desplegar.

## Vulnerabilidades típicas y la regla para cada una

1. **Reentrancy**: patrón checks-effects-interactions (actualiza estado antes de transferir) + guard `nonReentrant` en funciones que mueven valor o llaman a contratos externos.
2. **Control de acceso**: toda función que mueve fondos, cambia parámetros o hace mint debe tener `onlyOwner`/rol. Revisa una por una; escribe un test que demuestre que una cuenta cualquiera **no** puede llamarla.
3. **Oráculos**: nunca uses el precio spot de un pool (`getReserves`, `slot0`) como precio: se manipula con un flash loan en la misma tx. Usa un oráculo (p. ej. Chainlink) y revisa que el dato no esté viejo (`updatedAt`) ni sea ≤ 0.
4. **Approvals infinitos**: el contrato no debe pedir más allowance del que necesita, y no debe poder mover tokens de un usuario a una dirección arbitraria que elija quien llama (`transferFrom(victima, atacante)`).
5. **Front-running / sandwich**: cualquier función de swap necesita `minAmountOut` y `deadline` definidos por el usuario, nunca 0 ni "infinito". Ver `defi-conceptos`.
6. **Tokens raros**: fee al transferir, rebase, 6 vs 18 decimales, `transfer` que no devuelve bool. Mide lo recibido por diferencia de saldo; usa `SafeERC20`.
7. **Llamadas externas sin control**: `call` con datos que vienen del usuario = puede llamar cualquier cosa en nombre del contrato. Evítalo o limita destinos a una lista fija.
8. **Upgradeability**: proxies actualizables dan al dueño poder total sobre los fondos. Si se usan, el admin debe ser un multisig y el usuario debe entenderlo.
9. **Aritmética y redondeo**: Solidity 0.8 revierte en overflow, pero las divisiones redondean hacia abajo: multiplica antes de dividir y decide a favor de quién se redondea (del protocolo, no del usuario que retira).

## Paso 4: pruebas antes de cualquier red real

- Tests unitarios de cada función, incluidos los caminos que deben fallar (`vm.expectRevert`).
- Fuzzing: Foundry fuzzea automáticamente las funciones de test con parámetros. Agrega invariantes ("la suma de saldos = total supply", "el contrato nunca tiene menos tokens de los que debe").
- Fork test contra la cadena real si integras contratos existentes (`forge test --fork-url $RPC_URL`).
- Análisis estático: Slither (requiere Python 3.10+): `uv tool install slither-analyzer` o `python3 -m pip install slither-analyzer`, luego `slither .`. Revisa cada hallazgo con el usuario; no los silencies en bloque.
- Testnet (Base Sepolia) y uso real con montos de prueba antes de mainnet.

## Paso 5: auditoría y despliegue

- Si el plugin de Trail of Bits está instalado (`/plugin marketplace add trailofbits/skills`, luego `/plugin install building-secure-contracts@trailofbits`), usa sus skills: `secure-workflow-guide`, `guidelines-advisor`, `token-integration-analyzer` (si interactúas con tokens externos), `audit-prep-assistant` y `code-maturity-assessor`. También `entry-point-analyzer` y `property-based-testing` (Echidna/Medusa) del mismo marketplace.
- Si el contrato va a guardar más dinero del que el usuario puede perder sin problema: auditoría profesional antes de mainnet. Dilo aunque no lo pregunte.
- Despliegue: simulación → confirmación del usuario (red, costo, dirección del deployer, parámetros del constructor) → broadcast → verificación del código en el explorador → transferir ownership al multisig si aplica.
- Guarda dirección, tx de despliegue, commit y versión del compilador en el repo.

## Errores comunes que debes evitar

- Escribir un contrato cuando bastaba la comisión del agregador.
- Copiar contratos de tutoriales o de otro proyecto sin revisar línea por línea.
- Usar `tx.origin` para autorización.
- Dejar `onlyOwner` fuera de una función de retiro.
- `--private-key` en comandos o `.env` commiteado.
- Desplegar a mainnet sin haber corrido Slither y fork tests.
- Decir "auditado" cuando solo pasó tus tests.

## Cómo lo compruebas tú (usuario)

En el explorador (basescan.org), la pestaña "Contract" debe mostrar código verificado (palomita verde). En "Read Contract" revisa `owner()`: debe ser tu billetera o tu multisig, no una dirección desconocida. Prueba con montos pequeños antes de confiarle dinero real.

## Fuentes (verificado nov 2026)

- https://getfoundry.sh/introduction/installation · https://github.com/foundry-rs/foundry/releases (v1.8.6, 21 oct 2026)
- https://www.getfoundry.sh/llms.txt · https://www.getfoundry.sh/anvil/forking · https://www.getfoundry.sh/reference/cast/wallet/import
- https://docs.openzeppelin.com/contracts/5.x/ · https://github.com/OpenZeppelin/openzeppelin-contracts/releases (v5.7.0) · `contracts/utils/ReentrancyGuard.sol` y `contracts/token/ERC20/utils/SafeERC20.sol` en el tag v5.7.0
- https://github.com/crytic/slither (instalación, Python 3.10+)
- https://github.com/trailofbits/skills (README y `.claude-plugin/marketplace.json`; licencia CC-BY-SA-4.0, solo se mencionan, no se copia texto) · `plugins/building-secure-contracts/README.md`
