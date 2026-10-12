-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/humans/custom/camouflage.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
local function ActivationAction(ply)
    local AuxClass = SafeTableRandom(RoundManager:GetAliveZombies()):GetZombieClass()
    ply:SetWalkSpeed(AuxClass.Speed)
    ply:SetRunSpeed(AuxClass.RunSpeed)
    ply:SetCrouchedWalkSpeed(AuxClass.CrouchSpeed)
    ply:SetModel(AuxClass.PModel)
    ply:SetupHands()
    ply:SetAuxGravity(AuxClass.Gravity)
    ply:Give(ZOMBIE_KNIFE)
end
local function ResetAction(ply)
    local ZPClass = ply:GetHumanClass()
    ply:SetHealth(ZPClass.MaxHealth)
    ply:SetWalkSpeed(ZPClass.Speed)
    ply:SetRunSpeed(ZPClass.RunSpeed)
    ply:SetCrouchedWalkSpeed(ZPClass.CrouchSpeed)
    ply:SetModel(ZPClass.PModel)
    ply:SetupHands()
    ply:SetAuxGravity(ZPClass.Gravity)
end
local ability = ClassManager:CreateClassAbility(true, ActivationAction, ResetAction, 30)
ability.CanUseAbility = function(self)
    return RoundManager:GetRoundState() == ROUND_PLAYING and RoundManager:CountZombiesAlive() > 0
end
____exports.default = __TS__New(HumanClassDefinition, {
    ID = "CamouflageHuman",
    Name = "HumanCamouflageClassName",
    Description = "HumanCamouflageClassDescription",
    MaxHealth = 50,
    PModel = "models/player/riot.mdl",
    Speed = 210,
    RunSpeed = 100,
    CrouchSpeed = 0.4,
    Gravity = 1,
    Breath = 50,
    Ability = ability
})
return ____exports
