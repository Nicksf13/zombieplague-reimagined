let ActivationAction = function (this: void, ply: ZPServerPlayer) {
    let AuxClass = SafeTableRandom((RoundManager as ZPServerRoundManager).GetAliveHumans())!.GetHumanClass();
    ply.CamouflageZombieWeapon = SafeTableRandom(WeaponManager.GetWeaponsTableByWeaponType(WEAPON_MELEE))!.WeaponID;
    ply.SetHealth(AuxClass.MaxHealth);
    ply.SetWalkSpeed(AuxClass.Speed);
    ply.SetRunSpeed(AuxClass.RunSpeed);
    ply.SetCrouchedWalkSpeed(AuxClass.CrouchSpeed);
    ply.SetModel(AuxClass.PModel);
    ply.SetupHands();
    ply.SetAuxGravity(AuxClass.Gravity);
    ply.GiveZombieAllowedWeapon(ply.CamouflageZombieWeapon);
    hook.Run("ZPCamouflageChanged", ply, true);
};

let ResetAction = function (this: void, ply: ZPServerPlayer) {
    hook.Run("ZPCamouflageChanged", ply, false);
    let ZPClass = ply.GetZombieClass();
    ply.SetHealth(ZPClass.MaxHealth);
    ply.SetWalkSpeed(ZPClass.Speed);
    ply.SetRunSpeed(ZPClass.RunSpeed);
    ply.SetCrouchedWalkSpeed(ZPClass.CrouchSpeed);
    ply.SetModel(ZPClass.PModel);
    ply.SetupHands();
    ply.SetAuxGravity(ZPClass.Gravity);
    if (ply.CamouflageZombieWeapon !== undefined)
        ply.RemoveZombieAllowedWeapon(ply.CamouflageZombieWeapon);
    delete ply.CamouflageZombieWeapon;
};

const ability = ClassManager.CreateClassAbility(true, ActivationAction, ResetAction, 30);

ability.Drain = 45;

ability.MaxAbilityPower = 45;

ability.CanUseAbility = function (this: ZPAbility) {
    return (((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_PLAYING) && ((RoundManager as ZPServerRoundManager).CountHumansAlive() > 0));
};

export default new ZombieClassDefinition({
    ID: "CamouflageZombie",
    Name: "ZombieCamouflageClassName",
    Description: "ZombieCamouflageClassDescription",
    MaxHealth: 500,
    PModel: "models/player/zombie_classic.mdl",
    RunSpeed: 280,
    Speed: 100,
    CrouchSpeed: 0.4,
    Gravity: 0.8,
    Breath: 50,
    Ability: ability,
});

