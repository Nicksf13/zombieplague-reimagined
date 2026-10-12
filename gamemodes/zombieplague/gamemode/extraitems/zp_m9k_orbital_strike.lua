-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_orbital_strike.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("m9k_oribital_cannon", 5)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPOrbitalStrike",
        Name = "ExtraItemOrbitalStrikeName",
        Price = 30,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_orbital_strike")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    1,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("m9k_orbital_strike")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_orbital_strike")
        end
    }
)
return ____exports
