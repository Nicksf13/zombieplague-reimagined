-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/original/light.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    HumanClassDefinition,
    {
        ID = "LightHuman",
        Name = "HumanLightClassName",
        Description = "HumanLightClassDescription",
        MaxHealth = 50,
        Armor = 0,
        PModel = "models/player/urban.mdl",
        Speed = 220,
        RunSpeed = 100,
        CrouchSpeed = 0.5,
        Gravity = 0.7,
        JumpPower = 220,
        Battery = 50,
        Breath = 50,
        FallFunction = function(self)
            return false
        end
    }
)
return ____exports
