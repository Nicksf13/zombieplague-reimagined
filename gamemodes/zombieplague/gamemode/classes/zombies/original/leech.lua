-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/original/leech.ts. DO NOT EDIT; run npm run build.
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
        ID = "LeechZombie",
        Name = "ZombieLeechClassName",
        Description = "ZombieLeechClassDescription",
        MaxHealth = 1000,
        PModel = "models/player/soldier_stripped.mdl",
        RunSpeed = 280,
        Speed = 100,
        CrouchSpeed = 0.5,
        Gravity = 0.7,
        InfectionFunction = function(Attacker, Infected)
            Attacker:SetHealth(Attacker:Health() + 500)
        end
    }
)
return ____exports
