-- Generated from src/gamemodes/zombieplague/gamemode/effects/client/cl_particlemanager.ts. DO NOT EDIT; run npm run build.
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
____exports.ClientParticleEffectManager = __TS__Class()
local ClientParticleEffectManager = ____exports.ClientParticleEffectManager
ClientParticleEffectManager.name = "ClientParticleEffectManager"
function ClientParticleEffectManager.prototype.____constructor(self)
end
function ClientParticleEffectManager.prototype.EmitParticleEffect(self, explosion)
    local emitter = ParticleEmitter(explosion.Pos)
    if not emitter then
        return
    end
    for ____, info in ipairs(explosion.ParticleInformations) do
        do
            local __continue5
            repeat
                local particle = emitter:Add(info.File, explosion.Pos)
                if not particle then
                    __continue5 = true
                    break
                end
                particle:SetVelocity(info.Velocity)
                particle:SetDieTime(info.DieTime)
                particle:SetStartAlpha(info.StartAlpha)
                particle:SetEndAlpha(info.EndAlpha)
                particle:SetStartSize(info.StartSize)
                particle:SetEndSize(info.EndSize)
                particle:SetColor(info.Color.r, info.Color.g, info.Color.b)
                particle:SetAirResistance(100)
                particle:SetCollide(true)
                __continue5 = true
            until true
            if not __continue5 then
                break
            end
        end
    end
    emitter:Finish()
end
local particleEffectManager = __TS__New(____exports.ClientParticleEffectManager)
_G.ParticleEffectManager = particleEffectManager
net.Receive(
    "SendParticleEffectInformation",
    function()
        local packet = ZPClientData.Record(net.ReadTable())
        if not packet or not isvector(packet.Pos) then
            return
        end
        local rawParticles = ZPClientData.Record(packet.ParticleInformations)
        if not rawParticles then
            return
        end
        local particles = {}
        for ____, raw in pairs(rawParticles) do
            do
                local __continue11
                repeat
                    local info = ZPClientData.Record(raw)
                    if not info then
                        __continue11 = true
                        break
                    end
                    local color = ZPClientData.Record(info.Color)
                    if type(info.File) ~= "string" or not isvector(info.Velocity) or not isvector(info.Gravity) or type(info.DieTime) ~= "number" or type(info.StartAlpha) ~= "number" or type(info.EndAlpha) ~= "number" or type(info.StartSize) ~= "number" or type(info.EndSize) ~= "number" or not color or type(color.r) ~= "number" or type(color.g) ~= "number" or type(color.b) ~= "number" then
                        __continue11 = true
                        break
                    end
                    particles[#particles + 1] = {
                        File = info.File,
                        Velocity = info.Velocity,
                        Gravity = info.Gravity,
                        DieTime = info.DieTime,
                        StartAlpha = info.StartAlpha,
                        EndAlpha = info.EndAlpha,
                        StartSize = info.StartSize,
                        EndSize = info.EndSize,
                        Color = Color(color.r, color.g, color.b)
                    }
                    __continue11 = true
                until true
                if not __continue11 then
                    break
                end
            end
        end
        particleEffectManager:EmitParticleEffect({Pos = packet.Pos, ParticleInformations = particles})
    end
)
return ____exports
