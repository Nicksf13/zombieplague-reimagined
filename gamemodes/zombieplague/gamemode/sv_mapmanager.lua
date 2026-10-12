-- Generated from src/gamemodes/zombieplague/gamemode/maps/server/sv_mapmanager.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.MapManager = __TS__Class()
local MapManager = ____exports.MapManager
MapManager.name = "MapManager"
function MapManager.prototype.____constructor(self)
    self.Configs = {}
end
function MapManager.prototype.SearchConfigs(self)
    local files = file.Find("zombieplague/gamemode/mapconfigs/*.lua", "LUA")
    for ____, name in ipairs(files) do
        _G.MapConfig = {}
        include("zombieplague/gamemode/mapconfigs/" .. name)
        if (MapConfig.Prefix or MapConfig.MapName) and MapConfig.Start then
            self:AddMapConfig(MapConfig)
        else
            print(("Invalid map config: '" .. name) .. "'.")
        end
    end
end
function MapManager.prototype.AddMapConfig(self, config)
    local ____self_Configs_0 = self.Configs
    ____self_Configs_0[#____self_Configs_0 + 1] = config
end
function MapManager.prototype.GetMapConfig(self, name)
    for ____, config in ipairs(self.Configs) do
        if config.MapName == name then
            return config
        end
    end
    for ____, config in ipairs(self.Configs) do
        if config.Prefix and string.StartWith(name, config.Prefix) then
            return config
        end
    end
    return nil
end
local mapManager = __TS__New(____exports.MapManager)
_G.MapManager = mapManager
hook.Add(
    "ZPPrePreparingRound",
    "LoadMapConfig",
    function(round)
        local config = mapManager:GetMapConfig(game.GetMap())
        if config and config.Start then
            config:Start(round)
        end
    end
)
return ____exports
