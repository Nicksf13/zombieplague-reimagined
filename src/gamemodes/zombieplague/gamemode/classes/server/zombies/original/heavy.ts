export default new ZombieClassDefinition({
    ID: "HeavyZombie",
    Name: "ZombieHeavyClassName",
    Description: "ZombieHeavyClassDescription",
    MaxHealth: 4000,
    PModel: "models/player/zombie_soldier.mdl",
    Speed: 250,
    RunSpeed: 100,
    CrouchSpeed: 0.6,
    Gravity: 0.9,
    Breath: 200,
    Scale: 1.1,
    FallFunction: function (this: ZPClassDefinition) {
        return true;
    },
});

