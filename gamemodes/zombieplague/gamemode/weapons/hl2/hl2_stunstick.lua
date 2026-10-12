-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/hl2/hl2_stunstick.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(WeaponDefinition, {PrettyName = "Stun Stick", WeaponID = "weapon_stunstick", DamageMultiplier = 6.4, WeaponType = WEAPON_MELEE})
return ____exports
