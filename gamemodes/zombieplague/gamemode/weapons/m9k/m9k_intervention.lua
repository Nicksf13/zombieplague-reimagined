-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/m9k/m9k_intervention.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(WeaponDefinition, {PrettyName = "Intervention", WeaponID = "m9k_intervention", DamageMultiplier = 2.4, WeaponType = WEAPON_PRIMARY})
return ____exports
