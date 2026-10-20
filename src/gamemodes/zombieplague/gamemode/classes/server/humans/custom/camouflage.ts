let ActivationAction = function (this: void, ply: ZPServerPlayer) {
    let AuxClass = SafeTableRandom((RoundManager as ZPServerRoundManager).GetAliveZombies())!.GetZombieClass();
    ply.SetWalkSpeed(AuxClass.Speed);
    ply.SetRunSpeed(AuxClass.RunSpeed);
    ply.SetCrouchedWalkSpeed(AuxClass.CrouchSpeed);
    ply.SetModel(AuxClass.PModel);
    ply.SetupHands();
    ply.SetAuxGravity(AuxClass.Gravity);
    ply.Give(ZOMBIE_KNIFE);
    hook.Run("ZPCamouflageChanged", ply, true);
};

let ResetAction = function (this: void, ply: ZPServerPlayer) {
    hook.Run("ZPCamouflageChanged", ply, false);
    let ZPClass = ply.GetHumanClass();
    ply.SetHealth(ZPClass.MaxHealth);
    ply.SetWalkSpeed(ZPClass.Speed);
    ply.SetRunSpeed(ZPClass.RunSpeed);
    ply.SetCrouchedWalkSpeed(ZPClass.CrouchSpeed);
    ply.SetModel(ZPClass.PModel);
    ply.SetupHands();
    ply.SetAuxGravity(ZPClass.Gravity);
};

const ability = ClassManager.CreateClassAbility(true, ActivationAction, ResetAction, 30);

ability.CanUseAbility = function (this: ZPAbility) {
    return (((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_PLAYING) && ((RoundManager as ZPServerRoundManager).CountZombiesAlive() > 0));
};

export default new HumanClassDefinition({
    ID: "CamouflageHuman",
    Name: "HumanCamouflageClassName",
    Description: "HumanCamouflageClassDescription",
    MaxHealth: 50,
    PModel: "models/player/riot.mdl",
    RunSpeed: 210,
    Speed: 100,
    CrouchSpeed: 0.4,
    Gravity: 1,
    Breath: 50,
    Ability: ability,
});

