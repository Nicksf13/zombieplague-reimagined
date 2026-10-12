-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/original/speed.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(ZombieClassDefinition, {
    ID = "SpeedZombie",
    Name = "ZombieSpeedClassName",
    Description = "ZombieSpeedClassDescription",
    MaxHealth = 500,
    PModel = "models/player/zombie_fast.mdl",
    RunSpeed = 340,
    Speed = 120,
    CrouchSpeed = 0.5,
    Gravity = 0.7,
    Breath = 250
})
return ____exports
