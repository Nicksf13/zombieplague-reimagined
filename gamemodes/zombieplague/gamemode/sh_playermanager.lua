-- Generated from src/gamemodes/zombieplague/gamemode/player/shared/sh_playermanager.ts. DO NOT EDIT; run npm run build.
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
____exports.PlayerManager = __TS__Class()
local PlayerManager = ____exports.PlayerManager
PlayerManager.name = "PlayerManager"
function PlayerManager.prototype.____constructor(self)
end
function PlayerManager.prototype.GetPlayerID(self, ply)
    return ply:SteamID64()
end
function PlayerManager.prototype.DiscoverPlayerByTextID(self, textID)
    for ____, ply in ipairs(player.GetAll()) do
        if self:GetPlayerID(ply) == textID then
            return ply
        end
    end
    return nil
end
local playerManager = __TS__New(____exports.PlayerManager)
_G.PlayerManager = playerManager
return ____exports
