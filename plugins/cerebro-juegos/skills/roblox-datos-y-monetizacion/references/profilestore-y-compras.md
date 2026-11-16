# ProfileStore + compras: código de referencia

Adaptado de los ejemplos de la doc de ProfileStore (Basic Usage y Developer Products, https://madstudioroblox.github.io/ProfileStore/). Antes de usarlo, abre esas páginas y confirma que la API no cambió. Requiere el ModuleScript de ProfileStore en `ServerScriptService` o `ServerStorage`.

## DatosService.luau (servidor)

```luau
--!strict
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")

local ProfileStore = require(ServerStorage.ProfileStore)

-- Todos los campos con valor por defecto. Al agregar campos nuevos, ponlos aquí:
-- Reconcile() los rellena en perfiles viejos.
local PLANTILLA = {
	Monedas = 0,
	AnimalesEnBase = {} :: { { instanciaId: string, animalId: string, nivel: number } },
	Objetos = {} :: { [string]: number }, -- idObjeto -> cantidad
	PurchaseIdCache = {} :: { string },
	VersionDatos = 1,
}

local tienda = ProfileStore.New("DatosJugador_v1", PLANTILLA)
if RunService:IsStudio() and ServerStorage:GetAttribute("UsarDatosMock") == true then
	tienda = tienda.Mock -- datos temporales al probar en Studio
end

type Perfil = typeof(tienda:StartSessionAsync(""))
local perfiles: { [Player]: Perfil } = {}

local DatosService = {}

function DatosService.perfil(player: Player): Perfil?
	local p = perfiles[player]
	if p and p:IsActive() then
		return p
	end
	return nil
end

-- Espera (con límite) a que el perfil cargue; útil en ProcessReceipt
function DatosService.esperarPerfil(player: Player, timeout: number): Perfil?
	local inicio = os.clock()
	while player.Parent == Players and os.clock() - inicio < timeout do
		local p = perfiles[player]
		if p then
			return p
		end
		task.wait(0.1)
	end
	return perfiles[player]
end

local function alEntrar(player: Player)
	local perfil = tienda:StartSessionAsync(tostring(player.UserId), {
		Cancel = function()
			return player.Parent ~= Players
		end,
	})
	if perfil == nil then
		player:Kick("No se pudieron cargar tus datos. Vuelve a entrar en un momento.")
		return
	end
	perfil:AddUserId(player.UserId)
	perfil:Reconcile()
	perfil.OnSessionEnd:Connect(function()
		perfiles[player] = nil
		player:Kick("Tus datos se abrieron en otro servidor. Vuelve a entrar.")
	end)
	if player.Parent ~= Players then
		perfil:EndSession() -- se fue mientras cargaba
		return
	end
	perfiles[player] = perfil
	player:SetAttribute("Monedas", perfil.Data.Monedas)
	player:SetAttribute("DatosCargados", true)
end

function DatosService.start()
	for _, player in Players:GetPlayers() do
		task.spawn(alEntrar, player)
	end
	Players.PlayerAdded:Connect(alEntrar)
	Players.PlayerRemoving:Connect(function(player)
		local perfil = perfiles[player]
		if perfil then
			perfil:EndSession()
		end
	end)
end

return DatosService
```

Notas:
- El nombre del store (`DatosJugador_v1`) no se cambia después de publicar: cambiarlo = todos empiezan de cero.
- Para migraciones usa `VersionDatos` y transforma los datos al cargar.
- Nunca guardes instancias, funciones ni `Vector3` en `Data`: solo tablas, strings, números y booleanos.

## ProcessReceipt idempotente (patrón "caché de PurchaseId")

Entrega la compra, registra el `PurchaseId` en los datos y solo devuelve `PurchaseGranted` cuando ese `PurchaseId` ya aparece en `LastSavedData` (lo que realmente quedó guardado).

```luau
--!strict
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local DatosService = require(script.Parent.DatosService)

local TAMANO_CACHE = 100

-- IDs reales los da el usuario desde Creator Dashboard -> Monetization -> Developer Products
local productos: { [number]: (player: Player, perfil: any) -> () } = {
	[0] = function(player, perfil) -- 1000 monedas
		perfil.Data.Monedas += 1000
		player:SetAttribute("Monedas", perfil.Data.Monedas)
	end,
}

local function yaGuardado(perfil: any, purchaseId: string): boolean
	local guardado = perfil.LastSavedData.PurchaseIdCache
	return guardado ~= nil and table.find(guardado, purchaseId) ~= nil
end

local function procesar(perfil: any, purchaseId: string, entregar: () -> ()): Enum.ProductPurchaseDecision
	if not perfil:IsActive() then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local cache = perfil.Data.PurchaseIdCache
	if table.find(cache, purchaseId) == nil then
		local ok, err = pcall(entregar)
		if not ok then
			warn("[Compra] fallo al entregar", purchaseId, err)
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		while #cache >= TAMANO_CACHE do
			table.remove(cache, 1)
		end
		table.insert(cache, purchaseId)
	end
	if yaGuardado(perfil, purchaseId) then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	while perfil:IsActive() do
		local anterior = perfil.LastSavedData
		perfil:Save()
		if perfil.LastSavedData == anterior then
			perfil.OnAfterSave:Wait()
		end
		if yaGuardado(perfil, purchaseId) then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
		if perfil:IsActive() then
			task.wait(10)
		end
	end
	return Enum.ProductPurchaseDecision.NotProcessedYet
end

MarketplaceService.ProcessReceipt = function(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet -- Roblox reintenta cuando vuelva
	end
	local perfil = DatosService.esperarPerfil(player, 30)
	local entregar = productos[info.ProductId]
	if not perfil or not entregar then
		warn("[Compra] sin perfil o producto desconocido", info.ProductId)
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return procesar(perfil, info.PurchaseId, function()
		entregar(player, perfil)
	end)
end
```

Este es el ÚNICO lugar del juego que asigna `ProcessReceipt`.

## Game Pass (servidor)

```luau
--!strict
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local PASS_VIP = 0 -- ID real del Pass (lo da el usuario)

local function tienePass(player: Player, passId: number): boolean
	local ok, resultado = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId)
	end)
	return ok and resultado == true
end

local function aplicarVip(player: Player)
	player:SetAttribute("VIP", true)
	-- beneficios: aplicar SIEMPRE desde el servidor
end

Players.PlayerAdded:Connect(function(player)
	if tienePass(player, PASS_VIP) then
		aplicarVip(player)
	end
end)

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, compro)
	if compro and passId == PASS_VIP then
		aplicarVip(player)
	end
end)
```

El cliente solo llama `PromptGamePassPurchase(player, passId)` para abrir la ventana de compra; nunca aplica beneficios.

## PolicyService antes de mostrar huevos de pago

```luau
--!strict
local PolicyService = game:GetService("PolicyService")

local function puedeAleatorioPagado(player: Player): boolean
	local ok, info = pcall(function()
		return PolicyService:GetPolicyInfoForPlayerAsync(player)
	end)
	if not ok or typeof(info) ~= "table" then
		return false -- ante la duda, restringido
	end
	return info.ArePaidRandomItemsRestricted ~= true
end
```

Guarda el resultado como atributo del jugador para que la UI oculte o cambie la oferta, pero vuelve a revisarlo en el servidor al procesar la compra.
