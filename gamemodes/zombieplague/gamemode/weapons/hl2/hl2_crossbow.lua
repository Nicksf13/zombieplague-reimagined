-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/hl2/hl2_crossbow.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(WeaponDefinition, {
    PrettyName = "Crossbow",
    WeaponID = "weapon_crossbow",
    DamageMultiplier = 2.2,
    WeaponType = WEAPON_PRIMARY,
    ProjectileID = "crossbow_bolt"
})
return ____exports
