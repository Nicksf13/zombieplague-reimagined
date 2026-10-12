-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_m9k_m202.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("m9k_m202_rocket", 2)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPM202",
        Name = "ExtraItemM202Name",
        Price = 40,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("m9k_m202")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    4,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("m9k_m202")
            end
        end,
        ShouldBeEnabled = function(self)
            return WeaponManager:ServerHasWeapon("m9k_m202")
        end
    }
)
return ____exports
