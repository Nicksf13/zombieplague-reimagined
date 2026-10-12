-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_antidote_grenade.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPAntidoteGrenade",
        Name = "ExtraItemAntidoteGrenade",
        Price = 20,
        BuySounds = {"items/medshot4.wav"},
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon(ANTIDOTE_GRENADE)
            if IsValid(Weap) then
                ply:GiveAmmo(
                    1,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:GiveZombieAllowedWeapon(ANTIDOTE_GRENADE)
            end
            ply:SelectWeapon(ANTIDOTE_GRENADE)
        end,
        CanBuy = function(self, ply)
            local AntidoteGrenade = ply:GetWeapon(ANTIDOTE_GRENADE)
            return RoundManager:IsPlayingRound() and not RoundManager:IsSpecialRound() and not RoundManager:LastZombie() and ply:Alive() and (not IsValid(AntidoteGrenade) or IsValid(AntidoteGrenade) and AntidoteGrenade:Clip1() < 1)
        end
    }
)
return ____exports
