const ability = ClassManager.CreateClassAbility(true, function (this: void, ply: ZPServerPlayer) {
    let Weap = ply.GetWeapon("weapon_frag");
    if (IsValid(Weap)) {
        ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
    }
    else {
        ply.GiveZombieAllowedWeapon("weapon_frag");
    }
});

ability.Drain = 120;

ability.MaxAbilityPower = 120;

export default new ZombieClassDefinition({
    ID: "BomberZombie",
    Name: "ZombieBomberClassName",
    Description: "ZombieBomberClassDescription",
    MaxHealth: 500,
    PModel: "models/player/zombie_classic.mdl",
    Speed: 280,
    RunSpeed: 100,
    CrouchSpeed: 0.4,
    Gravity: 0.7,
    Breath: 50,
    WeaponGive: function (this: ZPClassDefinition, ply: ZPServerPlayer) {
        ply.Give(ZOMBIE_KNIFE);
    },
    Ability: ability,
});

