let ActivationAction = function (this: void, ply: ZPServerPlayer) {
    ply.OldHealth = ply.Health();
    ply.OldMaxHealth = ply.GetMaxHealth();
    ply.OldSpeed = ply.GetWalkSpeed();
    ply.OldRunSpeed = ply.GetRunSpeed();
    ply.SetHealth(150);
    ply.SetMaxHealth(150);
    ply.SetWalkSpeed(500);
    ply.SetRunSpeed(600);
};

let ResetAction = function (this: void, ply: ZPServerPlayer) {
    if (ply.OldHealth !== undefined)
        ply.SetHealth(ply.OldHealth);
    if (ply.OldMaxHealth !== undefined)
        ply.SetMaxHealth(ply.OldMaxHealth);
    if (ply.OldSpeed !== undefined)
        ply.SetWalkSpeed(ply.OldSpeed);
    if (ply.OldRunSpeed !== undefined)
        ply.SetRunSpeed(ply.OldRunSpeed);
    delete ply.OldHealth;
    delete ply.OldMaxHealth;
    delete ply.OldSpeed;
    delete ply.OldRunSpeed;
};

const ability = ClassManager.CreateClassAbility(true, ActivationAction, ResetAction, 30);

export default new ZombieClassDefinition({
    ID: "FasterZombie",
    Name: "ZombieFasterClassName",
    Description: "ZombieFasterClassDescription",
    MaxHealth: 500,
    PModel: "models/player/skeleton.mdl",
    RunSpeed: 280,
    Speed: 100,
    CrouchSpeed: 0.6,
    Gravity: 0.7,
    Breath: 50,
    Ability: ability,
});

