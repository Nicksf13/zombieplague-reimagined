-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_infection_bomb.ts. DO NOT EDIT; run npm run build.
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
        ID = "ZPInfectionBomb",
        Name = "ExtraItemInfectionBombName",
        Price = 7,
        Type = ITEM_ZOMBIE,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon(INFECTION_BOMB)
            if IsValid(Weap) then
                ply:GiveAmmo(
                    1,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:GiveZombieAllowedWeapon(INFECTION_BOMB)
            end
        end,
        CanBuy = function(self, ply)
            local InfectionBomb = ply:GetWeapon(INFECTION_BOMB)
            return RoundManager:IsPlayingRound() and not RoundManager:IsSpecialRound() and ply:Alive() and (not IsValid(InfectionBomb) or IsValid(InfectionBomb) and InfectionBomb:Clip1() < 1)
        end
    }
)
return ____exports
