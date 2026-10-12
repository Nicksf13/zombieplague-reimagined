-- Generated from src/gamemodes/zombieplague/gamemode/effects/server/sv_particlemanager.ts. DO NOT EDIT; run npm run build.
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
____exports.ServerParticleEffectManager = __TS__Class()
local ServerParticleEffectManager = ____exports.ServerParticleEffectManager
ServerParticleEffectManager.name = "ServerParticleEffectManager"
function ServerParticleEffectManager.prototype.____constructor(self)
end
function ServerParticleEffectManager.prototype.EmitExplosion(self, amount, color, position)
    local explosion = {Pos = position, ParticleInformations = {}}
    do
        local i = 0
        while i < amount do
            local ____explosion_ParticleInformations_0 = explosion.ParticleInformations
            ____explosion_ParticleInformations_0[#____explosion_ParticleInformations_0 + 1] = self:CreateExplosionParticleEffect(color)
            i = i + 1
        end
    end
    self:EmitParticleEffect(explosion)
end
function ServerParticleEffectManager.prototype.CreateExplosionParticleEffect(self, color)
    local x = math.random(-250, 250)
    local y = math.random(-250, 250)
    return {
        File = "particle/smokesprites_000" .. tostring(math.random(1, 9)),
        Gravity = Vector(0, 0, -250),
        Velocity = Vector(x, y, 0),
        DieTime = math.Rand(5, 10),
        StartAlpha = 40,
        EndAlpha = 0,
        StartSize = 100,
        EndSize = 20,
        Color = color
    }
end
function ServerParticleEffectManager.prototype.EmitParticleEffect(self, explosion)
    net.Start("SendParticleEffectInformation")
    net.WriteTable(explosion)
    net.Broadcast()
end
local particleEffectManager = __TS__New(____exports.ServerParticleEffectManager)
_G.ParticleEffectManager = particleEffectManager
util.AddNetworkString("SendParticleEffectInformation")
return ____exports
