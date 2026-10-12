-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/hl2/hl2_smg1.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    WeaponDefinition,
    {
        PrettyName = "SMG1",
        WeaponID = "weapon_smg1",
        DamageMultiplier = 1,
        WeaponType = WEAPON_PRIMARY,
        GiveWeapon = function(self, ply)
            if not self.WeaponID then
                return
            end
            local weapon = ply:GetWeapon(self.WeaponID)
            if not IsValid(weapon) then
                weapon = ply:Give(self.WeaponID)
            end
            ply:GiveAmmo(
                weapon:GetMaxClip1() * 10,
                weapon:GetPrimaryAmmoType(),
                true
            )
            ply:GiveAmmo(
                2,
                weapon:GetSecondaryAmmoType(),
                true
            )
        end
    }
)
return ____exports
