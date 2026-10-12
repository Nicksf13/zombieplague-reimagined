-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/original/light.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(ZombieClassDefinition, {
    ID = "LightZombie",
    Name = "ZombieLightClassName",
    Description = "ZombieLightClassDescription",
    MaxHealth = 1000,
    PModel = "models/player/charple.mdl",
    Speed = 290,
    RunSpeed = 100,
    CrouchSpeed = 0.4,
    Gravity = 0.3,
    Breath = 50
})
return ____exports
