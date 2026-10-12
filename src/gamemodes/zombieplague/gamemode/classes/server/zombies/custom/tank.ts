const ability = ClassManager.CreateClassAbility(true, function (this: void, ply: ZPServerPlayer) {
    ply.ZombieMadness();
});

ability.Drain = 45;

ability.MaxAbilityPower = 45;

export default new ZombieClassDefinition({
    ID: "TankZombie",
    Name: "ZombieTankClassName",
    Description: "ZombieTankClassDescription",
    MaxHealth: 3000,
    PModel: "models/player/zombie_classic.mdl",
    RunSpeed: 250,
    Speed: 100,
    CrouchSpeed: 0.4,
    Gravity: 1.1,
    Breath: 50,
    Scale: 1.1,
    Ability: ability,
});

