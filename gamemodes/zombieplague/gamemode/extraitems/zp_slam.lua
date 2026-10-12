-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_slam.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("npc_tripmine", 4)
WeaponManager:AddWeaponMultiplier("npc_satchel", 4)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPSlam",
        Name = "ExtraItemSlamName",
        Price = 6,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("weapon_slam")
            if IsValid(Weap) then
                ply:GiveAmmo(3, "slam", true)
            else
                ply:Give("weapon_slam")
            end
        end
    }
)
return ____exports
