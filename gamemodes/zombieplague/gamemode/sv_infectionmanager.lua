-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_infectionmanager.ts. DO NOT EDIT; run npm run build.
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
____exports.InfectionManager = __TS__Class()
local InfectionManager = ____exports.InfectionManager
InfectionManager.name = "InfectionManager"
function InfectionManager.prototype.____constructor(self)
end
function InfectionManager.prototype.Infect(self, target, attacker)
    if cvars.Bool("zp_ap_zombies", false) and target ~= attacker then
        attacker:GiveAmmoPacks(cvars.Number("zp_ap_zombies_total", 1))
    end
    target:Infect()
    local infect = attacker:GetZombieClass().InfectionFunction
    if infect then
        infect(attacker, target)
    end
    attacker:AddFrags(1)
    target:AddDeaths(1)
    attacker:AddPoints(cvars.Number("zp_point_points_per_infection", 10))
    if not RoundManager:IsRealisticMod() then
        for ____, ply in ipairs(player.GetAll()) do
            local phrase = target ~= attacker and "NoticeInfect" or "NoticeSelfInfect"
            SendPopupMessage(
                ply,
                {
                    Phrase = "zombieplague." .. string.lower(phrase),
                    Arguments = {
                        target:Name(),
                        attacker:Name()
                    }
                }
            )
        end
    end
    hook.Call("ZPInfectionEvent", GAMEMODE, target, attacker)
    hook.Call(
        "ZPResetAbilityEvent" .. target:SteamID64(),
        GAMEMODE
    )
    if RoundManager:LastHuman() then
        hook.Call("ZPLastHumanEvent")
    end
end
function InfectionManager.prototype.Cure(self, target, attacker)
    target:Cure()
    attacker:AddFrags(1)
    if not RoundManager:IsRealisticMod() then
        for ____, ply in ipairs(player.GetAll()) do
            local phrase = target ~= attacker and "NoticeGetCured" or "NoticeAntidote"
            SendPopupMessage(
                ply,
                {
                    Phrase = "zombieplague." .. string.lower(phrase),
                    Arguments = {
                        target:Name(),
                        attacker:Name()
                    }
                }
            )
        end
    end
    attacker:AddPoints(cvars.Number("zp_point_points_per_cure", 50))
    hook.Call("ZPCureEvent", GAMEMODE, target, attacker)
    hook.Call(
        "ZPResetAbilityEvent" .. target:SteamID64(),
        GAMEMODE
    )
    if RoundManager:LastZombie() then
        hook.Call("ZPLastZombieEvent")
    end
end
local infectionManager = __TS__New(____exports.InfectionManager)
_G.InfectionManager = infectionManager
return ____exports
