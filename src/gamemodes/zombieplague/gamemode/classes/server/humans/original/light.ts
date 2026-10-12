export default new HumanClassDefinition({
    ID: "LightHuman",
    Name: "HumanLightClassName",
    Description: "HumanLightClassDescription",
    MaxHealth: 50,
    Armor: 0,
    PModel: "models/player/urban.mdl",
    RunSpeed: 220,
    Speed: 100,
    CrouchSpeed: 0.5,
    Gravity: 0.7,
    JumpPower: 220,
    Battery: 50,
    Breath: 50,
    FallFunction: function (this: ZPClassDefinition) {
        return false;
    },
});

