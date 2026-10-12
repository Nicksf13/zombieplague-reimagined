-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/original/crouch.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(ZombieClassDefinition, {
    ID = "CrouchZombie",
    Name = "ZombieCrouchClassName",
    Description = "ZombieCrouchClassDescription",
    MaxHealth = 500,
    PModel = "models/player/corpse1.mdl",
    Speed = 280,
    RunSpeed = 100,
    CrouchSpeed = 1.7,
    Gravity = 0.7,
    Breath = 50
})
return ____exports
