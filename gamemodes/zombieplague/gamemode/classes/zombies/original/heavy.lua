-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/original/heavy.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    ZombieClassDefinition,
    {
        ID = "HeavyZombie",
        Name = "ZombieHeavyClassName",
        Description = "ZombieHeavyClassDescription",
        MaxHealth = 4000,
        PModel = "models/player/zombie_soldier.mdl",
        Speed = 250,
        RunSpeed = 100,
        CrouchSpeed = 0.6,
        Gravity = 0.9,
        Breath = 200,
        Scale = 1.1,
        FallFunction = function(self)
            return true
        end
    }
)
return ____exports
