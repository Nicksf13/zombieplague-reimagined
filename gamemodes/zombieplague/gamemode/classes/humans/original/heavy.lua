-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/original/heavy.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(HumanClassDefinition, {
    ID = "HeavyHuman",
    Name = "HumanHeavyClassName",
    Description = "HumanHeavyClassDescription",
    MaxHealth = 150,
    Armor = 150,
    PModel = "models/player/combine_super_soldier.mdl",
    Speed = 210,
    RunSpeed = 100,
    CrouchSpeed = 0.3,
    Gravity = 1.2,
    Battery = 200,
    Breath = 150
})
return ____exports
