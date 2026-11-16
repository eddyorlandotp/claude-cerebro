# Patrones de código: juego de robar y defender

Código de referencia, no para copiar a ciegas. Antes de usarlo: confirma APIs en la doc oficial (`.md` al final de la URL), adapta nombres a la estructura del proyecto, y corre `selene` + `luau-lsp analyze`. Las validaciones de remotes completas están en la skill `roblox-anti-exploit`.

## 1. Config tipada de rarezas (ReplicatedStorage/Shared/Config/Animales.luau)

```luau
--!strict
export type Rareza = "Comun" | "Raro" | "Epico" | "Legendario" | "Mitico"

export type AnimalDef = {
	id: string,
	nombre: string,
	rareza: Rareza,
	ingresoPorSegundo: number,
	plantilla: string, -- nombre del modelo en ServerStorage/Animales
}

export type ZonaDef = {
	nombre: string,
	pesos: { [Rareza]: number }, -- probabilidad relativa dentro de la zona
	maxVivos: number,
}

local lista: { [string]: AnimalDef } = {
	pollito = { id = "pollito", nombre = "Pollito", rareza = "Comun", ingresoPorSegundo = 1, plantilla = "Pollito" },
	-- ...
}

-- Zonas de la isla, de la entrada (1) al fondo (N). Lo raro solo aparece lejos.
local zonas: { ZonaDef } = {
	{ nombre = "Zona1", pesos = { Comun = 90, Raro = 10, Epico = 0, Legendario = 0, Mitico = 0 }, maxVivos = 12 },
	{ nombre = "Zona2", pesos = { Comun = 60, Raro = 30, Epico = 10, Legendario = 0, Mitico = 0 }, maxVivos = 10 },
	{ nombre = "Zona3", pesos = { Comun = 30, Raro = 40, Epico = 25, Legendario = 5, Mitico = 0 }, maxVivos = 8 },
	{ nombre = "Zona4", pesos = { Comun = 0, Raro = 30, Epico = 45, Legendario = 20, Mitico = 5 }, maxVivos = 5 },
}

-- No se puede anotar el tipo en `Tabla.campo: T = ...`; declara local y asigna.
return {
	lista = lista,
	zonas = zonas,
}
```

Si un animal se puede obtener pagando Robux de forma aleatoria (huevo de pago), las probabilidades deben mostrarse en porcentajes antes de comprar. Ver `roblox-datos-y-monetizacion`.

## 2. Elegir por peso (ServerStorage o Shared/Util)

```luau
--!strict
local rng = Random.new()

local function elegirPorPeso<T>(pesos: { [T]: number }): T?
	local total = 0
	for _, peso in pesos do
		total += peso
	end
	if total <= 0 then
		return nil
	end
	local tiro = rng:NextNumber(0, total)
	for opcion, peso in pesos do
		tiro -= peso
		if tiro <= 0 then
			return opcion
		end
	end
	return nil
end

return elegirPorPeso
```

El azar se calcula SIEMPRE en el servidor. Si lo calcula el cliente, el exploiter elige su resultado.

## 3. SpawnService (un solo loop)

```luau
--!strict
local CollectionService = game:GetService("CollectionService")
local ServerStorage = game:GetService("ServerStorage")
local HttpService = game:GetService("HttpService")

local Animales = require(game:GetService("ReplicatedStorage").Shared.Config.Animales)
local elegirPorPeso = require(script.Parent.Parent.Util.elegirPorPeso)

local SpawnService = {}
local INTERVALO = 3 -- segundos entre intentos de spawn
local vivosPorZona: { [string]: number } = {}

local function animalesDeRareza(rareza: Animales.Rareza): { Animales.AnimalDef }
	local r = {}
	for _, def in Animales.lista do
		if def.rareza == rareza then
			table.insert(r, def)
		end
	end
	return r
end

local function spawnEnZona(zona: Animales.ZonaDef)
	if (vivosPorZona[zona.nombre] or 0) >= zona.maxVivos then
		return
	end
	local rareza = elegirPorPeso(zona.pesos)
	if not rareza then
		return
	end
	local candidatos = animalesDeRareza(rareza)
	if #candidatos == 0 then
		return
	end
	local def = candidatos[math.random(1, #candidatos)]
	local plantilla = ServerStorage.Animales:FindFirstChild(def.plantilla)
	local area = workspace.Isla:FindFirstChild(zona.nombre)
	if not (plantilla and area) then
		warn("Falta plantilla o zona", def.plantilla, zona.nombre)
		return
	end
	local modelo = plantilla:Clone() :: Model
	modelo:SetAttribute("AnimalId", def.id)
	modelo:SetAttribute("InstanciaId", HttpService:GenerateGUID(false))
	modelo:SetAttribute("Zona", zona.nombre)
	-- posición aleatoria dentro del Part "Area" de la zona
	local base = area:FindFirstChild("Area") :: BasePart
	local offset = Vector3.new(
		(math.random() - 0.5) * base.Size.X,
		base.Size.Y / 2 + 2,
		(math.random() - 0.5) * base.Size.Z
	)
	modelo:PivotTo(CFrame.new(base.Position + offset))
	modelo.Parent = workspace.AnimalesVivos
	CollectionService:AddTag(modelo, "Animal")
	vivosPorZona[zona.nombre] = (vivosPorZona[zona.nombre] or 0) + 1
	modelo.Destroying:Connect(function()
		vivosPorZona[zona.nombre] -= 1
	end)
end

function SpawnService.start()
	task.spawn(function()
		while true do
			for _, zona in Animales.zonas do
				spawnEnZona(zona)
			end
			task.wait(INTERVALO)
		end
	end)
end

return SpawnService
```

Notas: los modelos de animales deben estar **anclados** mientras están en el suelo (el servidor los posee y nadie los empuja). Pon `ModelStreamingMode = Atomic` en la plantilla para que el cliente reciba el modelo completo.

## 4. Bases con slots fijos

```luau
--!strict
local Players = game:GetService("Players")

local BaseService = {}
local basePorJugador: { [Player]: Model } = {}

local function asignar(player: Player)
	for _, base in workspace.Bases:GetChildren() do
		if base:IsA("Model") and base:GetAttribute("DuenoUserId") == nil then
			base:SetAttribute("DuenoUserId", player.UserId)
			base:SetAttribute("Cerrada", false)
			basePorJugador[player] = base
			player:SetAttribute("BaseNombre", base.Name)
			return
		end
	end
	warn("No hay bases libres; revisa MaxPlayers vs número de bases")
end

local function liberar(player: Player)
	local base = basePorJugador[player]
	if base then
		base:SetAttribute("DuenoUserId", nil)
		base:SetAttribute("Cerrada", nil)
		basePorJugador[player] = nil
	end
end

function BaseService.obtenerBaseDe(player: Player): Model?
	return basePorJugador[player]
end

function BaseService.start()
	Players.PlayerAdded:Connect(asignar)
	Players.PlayerRemoving:Connect(liberar)
	for _, p in Players:GetPlayers() do
		asignar(p)
	end
end

return BaseService
```

Regla de diseño: número de bases ≥ `Players.MaxPlayers` (configúralo en Game Settings).

## 5. Estado de carga (quién lleva qué) solo en el servidor

```luau
--!strict
export type Carga = { instanciaId: string, animalId: string, origenUserId: number? }
local cargaPorJugador: { [Player]: Carga } = {}
```

- Recoger del suelo: `origenUserId = nil`. Robar de una base: `origenUserId = dueño`.
- El modelo que se ve en la espalda del personaje es solo visual (soldado con `WeldConstraint`, `Massless = true`, `CanCollide = false`). La verdad es `cargaPorJugador`.
- Al morir, salir o entrar a la zona segura propia: resolver la carga (entregar, devolver o soltar). Conecta `Humanoid.Died` y `PlayerRemoving`.
- Entregar: el servidor revisa que el jugador esté dentro del volumen de SU base (distancia o `GetPartsInPart` contra un Part "ZonaEntrega"), mueve el animal a su inventario y guarda.

## 6. Ingreso pasivo con un solo loop

```luau
--!strict
task.spawn(function()
	while true do
		task.wait(1)
		for player, perfil in Perfiles do -- tabla de perfiles cargados (ver datos)
			local total = 0
			for _, a in perfil.Data.AnimalesEnBase do
				local def = Animales.lista[a.animalId]
				if def then
					total += def.ingresoPorSegundo
				end
			end
			perfil.Data.Monedas += total
			player:SetAttribute("Monedas", perfil.Data.Monedas)
		end
	end
end)
```

No guardes en DataStore cada segundo: ProfileStore guarda solo en su autosave.

## 7. Cliente: solo intención

```luau
--!strict
-- src/client/Controladores/RecogerController.luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local IntentarRecoger = ReplicatedStorage.Remotes.IntentarRecoger :: RemoteEvent

local RecogerController = {}

function RecogerController.start()
	-- p. ej. al activar un ProximityPrompt local o un botón
	-- IntentarRecoger:FireServer(modelo:GetAttribute("InstanciaId"))
end

return RecogerController
```

El cliente manda el **id**, no la instancia ni el valor ni la rareza. El servidor busca el animal por id y decide.
