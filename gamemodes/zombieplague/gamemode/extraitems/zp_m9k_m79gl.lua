-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_m79gl.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("m9k_launched_m79", 2)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPM79GL",
        Name = "ExtraItemM79GLName",
        Price = 22,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_m79gl")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    3,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("m9k_m79gl")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_m79gl")
        end
    }
)
return ____exports
