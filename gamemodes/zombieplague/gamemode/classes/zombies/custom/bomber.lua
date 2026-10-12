-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/zombies/custom/bomber.ts. DO NOT EDIT; run npm run build.
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
        local Weap = ply:GetWeapon("weapon_frag")
        if IsValid(Weap) then
            ply:GiveAmmo(
                1,
                Weap:GetPrimaryAmmoType(),
                true
            )
        else
            ply:GiveZombieAllowedWeapon("weapon_frag")
        end
    end
)
ability.Drain = 120
ability.MaxAbilityPower = 120
____exports.default = __TS__New(
    ZombieClassDefinition,
    {
        ID = "BomberZombie",
        Name = "ZombieBomberClassName",
        Description = "ZombieBomberClassDescription",
        MaxHealth = 500,
        PModel = "models/player/zombie_classic.mdl",
        RunSpeed = 280,
        Speed = 100,
        CrouchSpeed = 0.4,
        Gravity = 0.7,
        Breath = 50,
        WeaponGive = function(self, ply)
            ply:Give(ZOMBIE_KNIFE)
        end,
        Ability = ability
    }
)
return ____exports
