---
name: roblox-datos-y-monetizacion
description: Datos y dinero en Roblox - DataStores con session locking (ProfileStore), reintentos, BindToClose, Game Passes vs Developer Products, ProcessReceipt idempotente, Creator Rewards, DevEx, items aleatorios pagados, PolicyService. Usar al guardar progreso, vender en Robux o calcular ingresos.
---

# Datos y monetización en Roblox

Perder el progreso de un jugador o cobrarle sin darle lo que compró destruye un juego (y puede violar reglas de Roblox). Úsala antes de tocar guardado, compras o números de ingresos.

## Regla 0: verifica antes de confiar

- Límites, tasas y políticas cambian. Antes de citarlos o programar contra ellos, WebFetch a la página oficial con `.md` al final (ej. `https://create.roblox.com/docs/production/monetization/developer-exchange.md`). Usa Context7 si está disponible.
- Antes de usar ProfileStore, lee su API actual: https://madstudioroblox.github.io/ProfileStore/api/

## Guardado: usa ProfileStore, no DataStore a mano

Explícale al usuario: "Uso ProfileStore porque evita que dos servidores guarden tus datos al mismo tiempo y dupliquen animales".

- **ProfileStore** (de loleris) es el sucesor de ProfileService: autosave, session locking, `Reconcile` para llenar campos nuevos, `Mock` para Studio. Se obtiene del Creator Store o del repo (no de Wally según su doc). Va en `ServerStorage` o `ServerScriptService`.
- Session locking = un solo servidor puede tener cargado el perfil de un jugador. Sin esto, cuando alguien cambia de servidor rápido, el servidor viejo puede sobrescribir datos nuevos y nacen los duplicados.
- Patrón obligatorio (código completo en `references/profilestore-y-compras.md`):
  1. `ProfileStore.New("DatosJugador", PLANTILLA)` con una plantilla con todos los campos y valores por defecto.
  2. En `PlayerAdded`: `StartSessionAsync(tostring(player.UserId), { Cancel = function() return player.Parent ~= Players end })`.
  3. Si no devuelve perfil → `player:Kick()` con mensaje claro (la doc de ProfileStore lo recomienda).
  4. `profile:AddUserId(player.UserId)` (GDPR) y `profile:Reconcile()`.
  5. `profile.OnSessionEnd` → kick ("tus datos se abrieron en otro servidor").
  6. Si el jugador ya se fue mientras cargaba → `profile:EndSession()`.
  7. En `PlayerRemoving` → `profile:EndSession()`.
  8. En Studio, usa `PlayerStore.Mock` si no quieres tocar datos reales al probar.
- ProfileStore ya maneja `BindToClose` internamente; no agregues tu propio guardado en paralelo sobre la misma llave.
- `profile:IsActive()` deja de ser garantía después de cualquier yield: revísalo de nuevo tras `task.wait`.

## Si alguna vez usas DataStore directo (no lo recomiendo)

Reglas de la doc oficial:
- Usa `UpdateAsync` (lee y escribe atómico), no `SetAsync` para datos de jugador. El callback de `UpdateAsync` no puede hacer yield.
- Todo en `pcall`, reintentos con backoff exponencial + jitter, tope de intentos; no reintentes errores de petición inválida; procesa en orden por llave.
- Un set pequeño y fijo de DataStores, una llave por jugador (máx. 4 MB por llave; nombres de store/llave ≤ 50 caracteres).
- Presupuesto por servidor (lectura/escritura): `60 + jugadores × 40` peticiones/min. Almacenamiento total: `500 MB + 1 MB × usuarios de por vida`. Verifica en `cloud-services/data-stores/error-codes-and-limits.md` antes de depender de esto.
- Autosave periódico (la doc usa 180 s) con offset aleatorio por jugador, guardado al salir, y `game:BindToClose` que guarde en paralelo: solo hay **30 segundos** antes de que el servidor se apague.
- Si la carga falla, no sobrescribas los datos reales con los de por defecto: marca el perfil como "con error" y no lo guardes.

## Game Passes vs Developer Products

| | Pass (Game Pass) | Developer Product |
|---|---|---|
| Se compra | Una vez, permanente | Las veces que quiera |
| Ejemplos | VIP, 2x dinero, slot de base extra | Monedas, huevo, boost temporal, "cerrar base 60 s" |
| Cómo se entrega | Revisar `UserOwnsGamePassAsync` en servidor al entrar + `PromptGamePassPurchaseFinished` | **Solo** en `MarketplaceService.ProcessReceipt` |
| Precio | Se configura en el Creator Dashboard | Mínimo 1 Robux |

- Crear Passes y Products lo hace el usuario en Creator Dashboard → Monetization. Tú solo usas sus IDs (pídeselos; no inventes).
- Regional pricing: activado por defecto para Passes (Managed Pricing); los precios regionales nunca superan el precio base ni bajan más de 70%. Si hay intercambio/regalos de items comprados, revisa `GetUsersPriceLevelsAsync`.
- A nov 2026 Roblox marca `GetProductInfo` como deprecated; usa la versión `Async` que indique la referencia.

## ProcessReceipt: reglas duras

1. Un solo `ProcessReceipt` en todo el juego, en un Script del servidor.
2. Nunca entregues por `PromptProductPurchaseFinished` (solo es UI).
3. **Idempotente:** guarda cada `receiptInfo.PurchaseId` procesado en los datos del jugador. Si ya está, no lo vuelvas a dar.
4. Devuelve `PurchaseGranted` **solo** cuando lo entregado ya quedó guardado en el DataStore. Con ProfileStore: agrega el `PurchaseId` + la recompensa a `Profile.Data`, y espera a que aparezca en `Profile.LastSavedData` (o llama `profile:Save()` y espera `OnAfterSave`).
5. Si el jugador no está, el perfil no está activo o el guardado falla → `NotProcessedYet`. Roblox volverá a llamar cuando el jugador regrese.
6. Las funciones que entregan no deben hacer yield si corren dentro de un callback de `UpdateAsync`.

Código completo (patrón "caché de PurchaseId" de ProfileStore) en `references/profilestore-y-compras.md`.

## Items aleatorios pagados (huevos, cofres) y PolicyService

Aplica si un resultado aleatorio se consigue con Robux **directa o indirectamente** (también si se compra una moneda del juego con Robux y con esa se abre el huevo):

- Muestra **todas** las recompensas posibles y sus probabilidades en **porcentaje**, que sumen exactamente 100%, **antes** de la compra. Si no caben, botón visible "Info/Detalles" (un ícono (i) solo no basta).
- Boosts de suerte: explica cómo cambian las probabilidades antes de comprarlos y actualízalas mientras estén activos.
- Antes de ofrecerlos, en servidor: `PolicyService:GetPolicyInfoForPlayerAsync(player)` en `pcall`. Si `ArePaidRandomItemsRestricted` es `true`, ese jugador NO puede usar generadores aleatorios pagados: ofrece ruta gratuita, compra directa del item, u oculta la opción. Si `IsPaidItemTradingAllowed` es falso, no le permitas intercambiar items pagados.
- Huevos que se ganan solo jugando (sin Robux ni moneda comprada) no requieren mostrar probabilidades, pero mostrarlas igual es buena práctica.

## Cuánto dinero llega de verdad (para el plan de ingresos)

- **DevEx** (cambiar Robux ganados a dólares), a nov 2026: 13+ años, mínimo **30,000 Robux ganados**, correo verificado, cuenta en Tipalti con formulario fiscal (W-8 para no estadounidenses), cumplir Términos. Tasa estándar: **USD 0.0038 por Robux ganado** (30,000 R$ = 114 USD). Hay tasa mayor (0.0054) solo para ciertas compras de jugadores de EE.UU. verificados 18+. Verifica la tasa en la página oficial antes de hacer cuentas.
- **Premium Payouts por engagement ya no existen**: desde el 24 jul 2025 los reemplazó **Creator Rewards**: 5 Robux/día por cada "Active Spender" (gastó ≥ USD 9.99 en 60 días) cuyo juego sea uno de sus 3 primeros del día y juegue 10+ min; y "Audience Expansion" (35% de las compras de usuarios nuevos/reactivados que traigas por tu link, con requisitos de 100+ DAU por 60 días y cuenta verificada con ID). Llegan como Robux ganados con 60 días de espera.
- Robux de ventas también pasan por periodo pendiente antes de poder usarse en DevEx; no prometas fechas de cobro al usuario sin revisar.
- Para hacer público el juego a todas las edades se pide: verificación de edad, cuestionario de madurez, cuenta con ID verificado (o verificación por padres), 2FA y una tarifa reembolsable de 1,000 Robux por experiencia (o Roblox Plus 2 meses). Dile esto al usuario antes de prometerle una fecha de lanzamiento.

Al hacer proyecciones: Robux ganados → USD con la tasa vigente → MXN con el tipo de cambio del día (búscalo, no lo supongas). Sé conservador.

## Errores comunes que debes evitar

- Guardar con `SetAsync` en cada cambio o cada segundo.
- Dar la compra y devolver `PurchaseGranted` antes de guardar.
- Entregar productos en el cliente o por `PromptProductPurchaseFinished`.
- Dos scripts asignando `ProcessReceipt` (el segundo pisa al primero).
- Vender huevos con Robux sin tabla de probabilidades o sin revisar `PolicyService`.
- Dar ventajas de juego a usuarios Premium o hacer Premium obligatorio.
- Prometer ingresos usando la tasa vieja de DevEx (0.0035) o "Premium Payouts".

## Cómo comprobarlo

- Datos: en Studio con API Services activado (Game Settings → Security → Enable Studio Access to API Services), juega, gana monedas, sal, vuelve a entrar: deben seguir. Prueba también con Mock para no ensuciar datos.
- Compras: en Studio las compras son de prueba (no cobran). Compra un producto, revisa que llegue una sola vez, sal y entra, y que no se duplique.

## Fuentes (verificado nov 2026)

- https://madstudioroblox.github.io/ProfileStore/ · https://madstudioroblox.github.io/ProfileStore/api/ · https://madstudioroblox.github.io/ProfileStore/devproducts/
- https://create.roblox.com/docs/cloud-services/data-stores · https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits · https://create.roblox.com/docs/cloud-services/data-stores/best-practices · https://create.roblox.com/docs/cloud-services/data-stores/player-data-purchasing
- https://create.roblox.com/docs/reference/engine/classes/MarketplaceService · https://create.roblox.com/docs/production/monetization/developer-products · https://create.roblox.com/docs/production/monetization/passes · https://create.roblox.com/docs/production/monetization/regional-pricing
- https://create.roblox.com/docs/production/monetization/paid-random-items · https://create.roblox.com/docs/reference/engine/classes/PolicyService
- https://create.roblox.com/docs/production/monetization/developer-exchange · https://create.roblox.com/docs/creator-rewards · https://create.roblox.com/docs/production/monetization/premium-payouts
- https://create.roblox.com/docs/production/publishing/publish-experiences-and-places
