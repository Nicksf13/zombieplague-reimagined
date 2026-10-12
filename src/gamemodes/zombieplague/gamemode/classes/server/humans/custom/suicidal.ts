let ActivationAction = function (this: void, ply: ZPServerPlayer) {
    ply.SetArmor((ply.Armor() + 100));
    ply.SetWalkSpeed(290);
    ply.SetRunSpeed(290);
    let TimerNameWithSteamID64 = (ply.SteamID64() + "SuicideExplode");
    timer.Create(TimerNameWithSteamID64, 0.5, 12, function (this: void) {
        let RepsLeft = timer.RepsLeft(TimerNameWithSteamID64);
        if ((RepsLeft === 0)) {
            ply.Kill();
            let explosion = ents.Create("env_explosion");
            explosion.SetKeyValue("spawnflags", 144);
            explosion.SetKeyValue("iMagnitude", 2000);
            explosion.SetKeyValue("iRadiusOverride", 256);
            explosion.SetOwner(ply);
            explosion.SetPos(ply.GetPos());
            explosion.Spawn();
            explosion.Activate();
            explosion.Fire("explode", "", 0);
        }
        else if ((RepsLeft < 5)) {
            ply.EmitSound("weapons/grenade/tick1.wav");
        }
        else if (((RepsLeft % 2) === 1)) {
            ply.EmitSound("weapons/grenade/tick1.wav");
        }
    });
    let EventName = ("ZPResetAbilityEvent" + ply.SteamID64());
    hook.Add(EventName, TimerNameWithSteamID64, function (this: void) {
        timer.Destroy(TimerNameWithSteamID64);
        hook.Remove(EventName, TimerNameWithSteamID64);
    });
};

const ability = ClassManager.CreateClassAbility(true, ActivationAction);

ability.CanUseAbility = function (this: ZPAbility) {
    return (((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_PLAYING) && ((RoundManager as ZPServerRoundManager).CountZombiesAlive() > 0));
};

export default new HumanClassDefinition({
    ID: "SuicideHuman",
    Name: "HumanSuicidalClassName",
    Description: "HumanSuicidalClassDescription",
    MaxHealth: 50,
    PModel: "models/player/guerilla.mdl",
    RunSpeed: 220,
    Speed: 100,
    CrouchSpeed: 0.5,
    Gravity: 0.9,
    Breath: 50,
    Ability: ability,
});

