export {};
const rounds = RoundManager as ZPServerRoundManager;
_G.FlashlightShouldDrain = () => cvars.Bool("zp_battery_flashlight_should_drain", false) || rounds.IsRealisticMod();
_G.NightvisionShouldDrain = () => cvars.Bool("zp_battery_nightvision_should_drain", false) || rounds.IsRealisticMod();
_G.VoiceShouldDrain = () => cvars.Bool("zp_battery_voice_should_drain", false) || rounds.IsRealisticMod();
_G.WaterShouldDrain = () => rounds.IsRealisticMod() || cvars.Bool("zp_water_should_drain", false);
_G.RunShouldDrain = ply => ply.GetWalkSpeed() !== ply.GetRunSpeed() && (rounds.IsRealisticMod() || cvars.Bool("zp_run_should_drain", false));
for (const [id, delay] of [["TickManager", 0.1], ["HalfSecondTickManager", 0.5], ["SecondTickManager", 1]] as const)
    timer.Create(id, delay, 0, () => { hook.Call(id); });
hook.Add("TickManager", "ZPReloadManager", () => {
    const mode = cvars.Number("zp_clip_mode", 0);
    if (mode !== WMODE_INFINITE_CLIP && mode !== WMODE_INFINITE)
        return;
    for (const ply of player.GetAll() as ZPServerPlayer[]) {
        if (!ply.Alive() || !ply.IsHuman())
            continue;
        const weapon = ply.GetActiveWeapon();
        if (!IsValid(weapon) || !WeaponManager.IsChosenWeapon(weapon.GetClass()))
            continue;
        if (mode === WMODE_INFINITE_CLIP) {
            if (ply.GetAmmoCount(weapon.GetPrimaryAmmoType()) !== weapon.GetMaxClip1() * 2)
                ply.SetAmmo(weapon.GetMaxClip1() * 2, weapon.GetPrimaryAmmoType());
        }
        else
            weapon.SetClip1(weapon.GetMaxClip1());
    }
});
hook.Add("SecondTickManager", "ZPHealthRegenerator", () => {
    if (!cvars.Bool("zp_health_should_regen", true))
        return;
    for (const ply of rounds.GetAliveZombies()) {
        if (CurTime() - ply.GetLastDamage() > cvars.Number("zp_health_regen_time_delay", 20) && ply.Health() < ply.GetMaxHealth())
            ply.SetHealth(Math.min(ply.Health() + cvars.Number("zp_health_regen", 10), ply.GetMaxHealth()));
    }
});
hook.Add("SecondTickManager", "ZPAFKManager", () => {
    for (const ply of rounds.GetAliveZombies()) {
        if (CurTime() - ply.GetLastMove() > math.random(15, 30)) {
            ply.ZPEmitSound(SafeTableRandom(ZombieIdle), 2, true);
            ply.SetLastMove(CurTime());
        }
    }
});
hook.Add("HalfSecondTickManager", "ZPBreathManager", () => {
    for (const ply of rounds.GetPlayersToPlay()) {
        if (!ply.Alive())
            continue;
        let drain = WaterShouldDrain() && ply.WaterLevel() > 2 ? cvars.Number("zp_water_drain", 1) : 0;
        if (ply.IsHuman() && RunShouldDrain(ply) && ply.KeyDown(IN_SPEED) && [IN_FORWARD, IN_BACK, IN_MOVELEFT, IN_MOVERIGHT].some(key => ply.KeyDown(key)))
            drain += cvars.Number("zp_run_drain", 1);
        if (drain > 0) {
            if (ply.GetBreath() > 0)
                ply.TakeBreath(drain);
            else
                hook.Call("ZPSuffocate", GAMEMODE, ply);
        }
        else if (ply.GetBreath() < ply.GetMaxBreath())
            ply.AddBreath(cvars.Number("zp_breath_recover", 1));
    }
});
hook.Add("ZPSuffocate", "ZPBreathDamage", ply => {
    const damage = DamageInfo();
    damage.SetDamage(cvars.Number("zp_breath_damage", 5));
    damage.SetDamageType(DMG_DROWNRECOVER);
    ply.TakeDamageInfo(damage);
    ply.ScreenFade(SCREENFADE.IN, Color(255, 255, 255, 20), 0.3, 0);
    const sounds = ply.WaterLevel() > 2 ? (ply.IsHuman() ? HumanDrownSounds : ZombieDrownSounds) : (ply.IsHuman() ? HumanSuffocateSound : ZombieSuffocateSound);
    ply.ZPEmitSound(SafeTableRandom(sounds), 1);
});
hook.Add("TickManager", "GravityManager", () => {
    for (const ply of rounds.GetPlayersToPlay())
        if (ply.GetGravity() !== ply.GetAuxGravity())
            ply.SetGravity(ply.GetAuxGravity());
});
hook.Add("ZPCureEvent", "GetCuredEffect", ply => ply.ScreenFade(SCREENFADE.IN, Color(0, 0, 255, 128), 0.3, 0));
hook.Add("TickManager", "DrainManager", () => {
    for (const ply of rounds.GetAliveHumans()) {
        let drain = 0;
        if (FlashlightShouldDrain() && ply.FlashlightIsOn())
            drain += cvars.Number("zp_battery_flashlight_drain", 1);
        if (NightvisionShouldDrain() && ply.NightvisionIsOn())
            drain += cvars.Number("zp_battery_nightvision_drain", 2);
        if (VoiceShouldDrain() && ply.IsTalking())
            drain += cvars.Number("zp_battery_voice_drain", 0.5);
        if (drain > 0) {
            if (ply.GetBattery() > 0)
                ply.DrainBattery(drain);
        }
        else if (ply.GetBattery() < ply.GetMaxBatteryCharge())
            ply.ChargeBattery(cvars.Number("zp_battery_charge", 0.5));
    }
});
const moveKeys = [IN_ATTACK, IN_ATTACK2, IN_BACK, IN_DUCK, IN_FORWARD, IN_JUMP, IN_MOVELEFT, IN_MOVERIGHT, IN_RELOAD, IN_SPEED, IN_USE, IN_WALK, IN_ZOOM, IN_WEAPON1, IN_WEAPON2];
hook.Add("SetupMove", "IdleManager", (ply, move) => { if (ply.Alive() && moveKeys.some(key => move.KeyDown(key)))
    ply.SetLastMove(CurTime()); });
hook.Add("PlayerBatteryOver", "ZPBatteryOver", ply => {
    if (ply.FlashlightIsOn())
        ply.Flashlight(false);
    if (ply.NightvisionIsOn())
        ply.SetNightvision(false);
});
for (const [event, id, teamName] of [["ZPLastHumanEvent", "LastHumanHealth", "human"], ["ZPLastZombieEvent", "LastZombieHealth", "zombie"]] as const) {
    hook.Add(event, id, () => {
        const mode = cvars.Number("zp_last_" + teamName + "_reward_mode", 0);
        const selected = SafeTableRandom(teamName === "human" ? rounds.GetAliveHumans() : rounds.GetAliveZombies());
        if (!selected || (mode !== 1 && mode !== 2))
            return;
        const enemies = teamName === "human" ? rounds.CountZombiesAlive() : rounds.CountHumansAlive();
        selected.SetHealth(selected.Health() + (mode === 1 ? enemies : 1) * cvars.Number("zp_last_" + teamName + "_reward_health", teamName === "human" ? 10 : mode === 1 ? 250 : 25));
    });
}
