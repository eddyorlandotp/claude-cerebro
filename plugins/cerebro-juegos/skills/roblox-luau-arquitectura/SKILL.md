---
name: roblox-luau-arquitectura
description: Arquitectura Roblox en Luau - servidor vs cliente, dónde va cada script, ModuleScripts y servicios, RemoteEvents vs RemoteFunctions, Luau --!strict, patrones de robar y defender (bases, spawns por rareza, inventario, tienda) y rendimiento. Usar al diseñar o escribir código Luau.
---

# Arquitectura Luau para Roblox

Úsala antes de escribir o reorganizar código de un juego de Roblox. Complementa `roblox-anti-exploit` (validación) y `roblox-datos-y-monetizacion` (guardado y compras). Para setup de archivos/Rojo ve `roblox-en-linux-con-rojo`.

## Regla 0: verifica antes de confiar

- Confirma cada clase, método y evento contra la referencia oficial antes de usarlo: Context7 si está, o WebFetch a `https://create.roblox.com/docs/reference/engine/classes/<Clase>.md`. Roblox depreca APIs seguido (p. ej. `GetProductInfo` está marcado deprecated a favor de su versión `Async`; `RenderStepped` "funciona pero no se recomienda").
- No inventes servicios ni propiedades. Si no estás seguro de que algo existe, búscalo.

## Antes de escribir código

1. Explica al usuario en 1-3 frases qué sistema vas a hacer y dónde vive ("La lógica de robo va en el servidor para que nadie haga trampa; el cliente solo muestra botones y efectos").
2. Escribe primero los tipos y la config (tablas de datos), luego el servicio del servidor, al final la UI del cliente.
3. Al terminar, di cómo probarlo en Studio, incluyendo **Start Server con 2 jugadores** si involucra a más de un jugador (robos siempre).

## Servidor vs cliente: la regla que no se rompe

- **Servidor = verdad.** Dinero, inventario, qué animal existe, quién lo carga, qué base es de quién, compras, tiempos de bloqueo. Todo se decide y se guarda en el servidor.
- **Cliente = intención y presentación.** Input, cámara, UI, sonidos, efectos, predicciones visuales. El cliente pide ("quiero recoger el animal X"), nunca ordena ("dame el animal X").
- Si un dato lo necesita el cliente solo para mostrarlo, replícalo desde el servidor (atributos o RemoteEvent servidor→cliente). No dejes que el cliente lo calcule y lo mande de vuelta.

## Dónde va cada cosa

| Lugar | Qué guardar | Se replica al cliente |
|---|---|---|
| `ServerScriptService` | Un `Script` de entrada del servidor + ModuleScripts de servicios | No |
| `ServerStorage` | Plantillas de animales/huevos, ModuleScripts solo-servidor, ProfileStore | No |
| `ReplicatedStorage` | Módulos compartidos (config, tipos, utilidades), carpeta `Remotes`, `Packages` | Sí |
| `ReplicatedFirst` | Solo pantalla de carga mínima | Sí, primero |
| `StarterPlayer/StarterPlayerScripts` | Un `LocalScript` de entrada del cliente + controladores | Sí |
| `StarterGui` | UI (ScreenGuis) | Sí |
| `Workspace` | Mapa, bases, animales spawneados (los crea el servidor) | Sí, sujeto a streaming |

Patrón recomendado por Roblox: **un solo script de entrada por lado** que hace `require` de ModuleScripts y luego llama `.start()` de cada uno. Así todo carga antes de ejecutarse y es fácil aislar un módulo roto.

Nunca pongas lógica secreta (precios reales, tablas de drop, validaciones) en `ReplicatedStorage`: los exploiters descompilan todo lo que se replica.

## Servicios propios (sin framework)

No metas Knit ni frameworks: para un juego pequeño basta un patrón simple.

```luau
--!strict
-- src/server/Servicios/BaseService.luau
local BaseService = {}

function BaseService.start()
	-- conectar eventos aquí, no al hacer require
end

function BaseService.obtenerBaseDe(player: Player): Model?
	-- API pública que otros servicios pueden llamar
	return nil
end

return BaseService
```

- Un servicio por responsabilidad: `DatosService`, `BaseService`, `SpawnService`, `CargaService` (recoger/robar/entregar), `TiendaService`, `EconomiaService`.
- Los servicios se llaman entre sí con `require` directo; evita dependencias circulares (si A necesita B y B necesita A, pasa una función en `start()` o usa una señal).
- Config de juego (rarezas, precios, tiempos) en `ReplicatedStorage/Shared/Config/*.luau` como tablas tipadas, para que el cliente pueda mostrar textos. Lo que deba ser secreto, en `ServerStorage`.

## RemoteEvent vs RemoteFunction vs UnreliableRemoteEvent

| Usa | Cuándo | Ejemplo |
|---|---|---|
| `RemoteEvent` (cliente→servidor) | Acciones del jugador; no necesita respuesta inmediata | `IntentarRecoger`, `ComprarObjeto`, `UsarObjeto` |
| `RemoteEvent` (servidor→cliente) | Notificar cambios, efectos, mensajes | `AnimalRobado`, `Notificacion` |
| `UnreliableRemoteEvent` | Datos que cambian a cada rato y pueden perderse (máx. ~1000 bytes por mensaje) | Efectos visuales cosméticos |
| `RemoteFunction` (cliente→servidor) | El cliente necesita una respuesta para seguir | `ObtenerCatalogoTienda` |
| `RemoteFunction:InvokeClient` | **Nunca** | Si el cliente no responde, el servidor se queda esperando para siempre |

- El límite es de aprox. 500 mensajes por segundo por cliente, compartido entre todos los remotes del mismo tipo. No dispares remotes en loops por frame.
- No se pueden mandar funciones ni metatablas; no mezcles llaves numéricas y de texto en una tabla; instancias que el otro lado no ve llegan como `nil`.
- Para estado continuo (dinero, nivel, si la base está cerrada) usa **atributos** en el `Player` o en el modelo de la base: `player:SetAttribute("Monedas", 100)` en el servidor y `GetAttributeChangedSignal` en el cliente. Menos remotes, menos bugs.
- Crea los remotes como archivos `.model.json` (ver `roblox-en-linux-con-rojo`), no con `Instance.new` en runtime: así existen antes de que el cliente los busque.

## Luau tipado

- Primera línea de cada archivo: `--!strict`. Tipa parámetros de funciones públicas y tablas de config con `export type`.
- En remotes, los parámetros que llegan del cliente tipéalos como `unknown` y valídalos (ver `roblox-anti-exploit`); no confíes en la anotación de tipo, el exploiter manda lo que quiera.
- Corre `luau-lsp analyze` / revisa Script Analysis antes de pedir prueba.
- `task.wait`, `task.spawn`, `task.delay`, `task.defer` en vez de `wait`, `spawn`, `delay` (viejos).

## Patrones para "robar y defender"

Código completo y tipado en `references/patrones-robar-defender.md` (léelo cuando implementes cualquiera de estos):

1. **Bases:** slots fijos en la zona segura; el servidor asigna uno al entrar y lo libera al salir. Dueño guardado como atributo `DuenoUserId` en el modelo de la base.
2. **Spawns por rareza:** el servidor elige rareza con pesos y zona según distancia en la isla (lo raro al fondo). Un solo loop de spawn con `task.wait(intervalo)`, tope de animales por zona.
3. **Cargar/robar/entregar:** estado "quién carga qué" vive en una tabla del servidor; el modelo del animal se suelda al personaje solo como visual. Robar = misma acción de recoger, pero desde una base ajena desbloqueada.
4. **Inventario:** lista de animales con id único (`HttpService:GenerateGUID(false)`), rareza y nivel, dentro de los datos del jugador (ProfileStore).
5. **Ingreso pasivo:** un solo loop por servidor cada 1 s que suma monedas por animal en base; no un loop por animal.
6. **Tienda de objetos para molestar:** el cliente pide `ComprarObjeto(idObjeto)`; el servidor revisa precio desde su config, saldo y cooldown. Efectos con duración corta y contrajuego (ver `diseno-de-juegos-y-retencion`).

## Rendimiento

- **StreamingEnabled** viene activado en places nuevos y no se puede cambiar por script. Consecuencia: en el cliente, las partes lejanas del Workspace pueden no existir. No hagas `workspace.Isla.Zona5.Huevo` desde el cliente; usa `CollectionService` (`GetTagged` + `GetInstanceAddedSignal`/`GetInstanceRemovedSignal`) o `WaitForChild` con timeout.
- Para modelos que el cliente debe tener completos (un animal con sus partes), usa `ModelStreamingMode = Atomic`. `Persistent` solo para casos raros: rompe el beneficio del streaming.
- Un solo loop del servidor para sistemas globales (ingreso, despawn) en vez de miles de `while true do`. Conecta a `RunService.Heartbeat` solo lo que de verdad necesita cada frame (casi nada en este género).
- Desconecta conexiones al destruir objetos (`:Destroy()` desconecta las de esa instancia; guarda y desconecta las de otros objetos, como eventos de `Players`).
- Anclado (`Anchored = true`) todo lo decorativo; menos física = menos lag y menos superficie de exploit.
- Limita animales vivos por zona y haz despawn de los que nadie recoge.

## Errores comunes que debes evitar

- Dar items o dinero en un `LocalScript`: el cambio no existe para el servidor ni para otros jugadores.
- Confiar en `Touched` o `ProximityPrompt.Triggered` sin revisar distancia en el servidor.
- Poner módulos del servidor en `ReplicatedStorage` "para que ambos lados lo usen".
- `RemoteFunction:InvokeClient`.
- Crear remotes dinámicamente con nombres por jugador.
- Lógica de juego dentro de callbacks de UI; la UI solo dispara intenciones.
- `while true do ... end` sin `task.wait()`, o con `task.wait()` vacío por cada objeto.

## Fuentes (verificado nov 2026)

- https://create.roblox.com/docs/scripting/locations
- https://create.roblox.com/docs/scripting/events/remote · https://create.roblox.com/docs/reference/engine/classes/RemoteEvent (throttling) · https://create.roblox.com/docs/reference/engine/classes/UnreliableRemoteEvent
- https://create.roblox.com/docs/luau/type-checking
- https://create.roblox.com/docs/workspace/streaming
- https://create.roblox.com/docs/reference/engine/classes/RunService
- https://create.roblox.com/docs/reference/engine/classes/MarketplaceService (deprecaciones)
- https://create.roblox.com/docs/scripting/security/security-tactics
