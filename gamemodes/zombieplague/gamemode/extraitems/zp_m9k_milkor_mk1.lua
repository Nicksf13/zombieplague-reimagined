-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_milkor_mk1.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("m9k_m202_rocket", 4)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPMilkorMK1",
        Name = "ExtraItemMilkorMK1Name",
        Price = 35,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_milkormgl")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    6,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("m9k_milkormgl")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_milkormgl")
        end
    }
)
return ____exports
