let ActivationAction = function (this: void, ply: ZPServerPlayer) {
    ply.OldJumpPower = ply.GetJumpPower();
    ply.SetJumpPower(400);
};

let ResetAction = function (this: void, ply: ZPServerPlayer) {
    if (ply.OldJumpPower !== undefined)
        ply.SetJumpPower(ply.OldJumpPower);
    delete ply.OldJumpPower;
};

const ability = ClassManager.CreateClassAbility(true, ActivationAction, ResetAction, 10);

ability.Drain = 30;

ability.MaxAbilityPower = 30;

export default new ZombieClassDefinition({
    ID: "JumperZombie",
    Name: "ZombieJumperClassName",
    Description: "ZombieJumperClassDescription",
    MaxHealth: 1000,
    PModel: "models/player/zombie_classic.mdl",
    RunSpeed: 280,
    Speed: 100,
    CrouchSpeed: 0.5,
    Gravity: 0.7,
    Breath: 50,
    Ability: ability,
});

