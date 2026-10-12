export default new ZombieClassDefinition({
    ID: "LeechZombie",
    Name: "ZombieLeechClassName",
    Description: "ZombieLeechClassDescription",
    MaxHealth: 1000,
    PModel: "models/player/soldier_stripped.mdl",
    RunSpeed: 280,
    Speed: 100,
    CrouchSpeed: 0.5,
    Gravity: 0.7,
    InfectionFunction: function (this: void, Attacker: ZPServerPlayer, Infected: ZPServerPlayer) {
        Attacker.SetHealth((Attacker.Health() + 500));
    },
});

