-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/custom/tank.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
local ability = ClassManager:CreateClassAbility(
    true,
    function(ply)
        ply:ZombieMadness()
    end
)
ability.Drain = 45
ability.MaxAbilityPower = 45
____exports.default = __TS__New(ZombieClassDefinition, {
    ID = "TankZombie",
    Name = "ZombieTankClassName",
    Description = "ZombieTankClassDescription",
    MaxHealth = 3000,
    PModel = "models/player/zombie_classic.mdl",
    Speed = 250,
    RunSpeed = 100,
    CrouchSpeed = 0.4,
    Gravity = 1.1,
    Breath = 50,
    Scale = 1.1,
    Ability = ability
})
return ____exports
