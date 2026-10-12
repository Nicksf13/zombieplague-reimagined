-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/original/crouch.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(HumanClassDefinition, {
    ID = "CrouchHuman",
    Name = "HumanCrouchClassName",
    Description = "HumanCrouchClassDescription",
    MaxHealth = 50,
    Armor = 0,
    PModel = "models/player/swat.mdl",
    RunSpeed = 220,
    Speed = 100,
    CrouchSpeed = 1.4,
    Gravity = 0.8
})
return ____exports
