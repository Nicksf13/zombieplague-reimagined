-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_ex41.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("m9k_launched_ex41", 2)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPEX41",
        Name = "ExtraItemEX41Name",
        Price = 30,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_ex41")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    3,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("m9k_ex41")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_ex41")
        end
    }
)
return ____exports
