-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_rpg.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("rpg_missile", 4)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPRPG",
        Name = "ExtraItemRPGName",
        Price = 15,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("weapon_rpg")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    3,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("weapon_rpg")
            end
        end
    }
)
return ____exports
