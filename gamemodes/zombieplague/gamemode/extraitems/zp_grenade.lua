-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_grenade.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
WeaponManager:AddWeaponMultiplier("npc_grenade_frag", 5)
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPGrenade",
        Name = "ExtraItemGrenadeName",
        Price = 1,
        OnBuy = function(self, ply)
            local Weap = ply:GetWeapon("weapon_frag")
            if IsValid(Weap) then
                ply:GiveAmmo(
                    1,
                    Weap:GetPrimaryAmmoType(),
                    true
                )
            else
                ply:Give("weapon_frag")
            end
        end
    }
)
return ____exports
