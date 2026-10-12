-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_nerve_gas.ts. DO NOT EDIT; run npm run build.
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
        ID = "ZPNerveGas",
        Name = "ExtraItemNerveGasName",
        Price = 20,
        Type = ITEM_ZOMBIE,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_nerve_gas")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    1,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:GiveZombieAllowedWeapon("m9k_nerve_gas")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_nerve_gas")
        end
    }
)
return ____exports
