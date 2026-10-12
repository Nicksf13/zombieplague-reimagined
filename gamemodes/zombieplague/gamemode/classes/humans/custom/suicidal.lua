-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/custom/suicidal.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
local function ActivationAction(ply)
    ply:SetArmor(ply:Armor() + 100)
    ply:SetWalkSpeed(290)
    ply:SetRunSpeed(290)
    local TimerNameWithSteamID64 = ply:SteamID64() .. "SuicideExplode"
    timer.Create(
        TimerNameWithSteamID64,
        0.5,
        12,
        function()
            local RepsLeft = timer.RepsLeft(TimerNameWithSteamID64)
            if RepsLeft == 0 then
                ply:Kill()
                local explosion = ents.Create("env_explosion")
                explosion:SetKeyValue("spawnflags", 144)
                explosion:SetKeyValue("iMagnitude", 2000)
                explosion:SetKeyValue("iRadiusOverride", 256)
                explosion:SetOwner(ply)
                explosion:SetPos(ply:GetPos())
                explosion:Spawn()
                explosion:Activate()
                explosion:Fire("explode", "", 0)
            elseif RepsLeft < 5 then
                ply:EmitSound("weapons/grenade/tick1.wav")
            elseif RepsLeft % 2 == 1 then
                ply:EmitSound("weapons/grenade/tick1.wav")
            end
        end
    )
    local EventName = "ZPResetAbilityEvent" .. ply:SteamID64()
    hook.Add(
        EventName,
        TimerNameWithSteamID64,
        function()
            timer.Destroy(TimerNameWithSteamID64)
            hook.Remove(EventName, TimerNameWithSteamID64)
        end
    )
end
local ability = ClassManager:CreateClassAbility(true, ActivationAction)
ability.CanUseAbility = function(self)
    return RoundManager:GetRoundState() == ROUND_PLAYING and RoundManager:CountZombiesAlive() > 0
end
____exports.default = __TS__New(HumanClassDefinition, {
    ID = "SuicideHuman",
    Name = "HumanSuicidalClassName",
    Description = "HumanSuicidalClassDescription",
    MaxHealth = 50,
    PModel = "models/player/guerilla.mdl",
    RunSpeed = 220,
    Speed = 100,
    CrouchSpeed = 0.5,
    Gravity = 0.9,
    Breath = 50,
    Ability = ability
})
return ____exports
