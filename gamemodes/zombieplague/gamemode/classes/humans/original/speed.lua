-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/original/speed.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(HumanClassDefinition, {
    ID = "SpeedHuman",
    Name = "HumanSpeedClassName",
    Description = "HumanSpeedClassDescription",
    MaxHealth = 50,
    Armor = 0,
    PModel = "models/player/riot.mdl",
    RunSpeed = 270,
    Speed = 100,
    CrouchSpeed = 0.4,
    Gravity = 1,
    JumpPower = 170,
    Battery = 50,
    Breath = 150
})
return ____exports
