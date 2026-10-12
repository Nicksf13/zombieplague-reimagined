export {};
hook.Add("ZPDamageAttackerIsPlayer", "HandlePlayerDamage", (attacker, target, damage) => {
    let multiplier = WeaponManager.GetWeaponMultiplier(damage.GetInflictor().GetClass());
    if (multiplier === undefined && attacker.Alive() && IsValid(attacker.GetActiveWeapon()))
        multiplier = WeaponManager.GetWeaponMultiplier(attacker.GetActiveWeapon().GetClass());
    damage.ScaleDamage(multiplier ?? 1);
    damage.ScaleDamage(attacker.GetDamageAmplifier());
    if (target.IsPlayer())
        hook.Call(attacker.IsZombie() ? "ZPZombieInflictedDamageOnPlayer" : "ZPHumanInflictedDamageOnPlayer", GAMEMODE, attacker, target, damage);
    else
        damage.ScaleDamage(cvars.Number("zp_map_prop_damage_multiplier", 1));
});
hook.Add("ZPZombieTakeDamage", "HandleZombieDamage", (target, damage) => {
    const sounds = damage.IsDamageType(DMG_FALL) ? FallDamageSounds : damage.IsDamageType(DMG_BURN) ? BurnDamageSounds : target.IsNemesis() ? NemesisDamageSounds : GenericDamageSounds;
    if (!damage.IsDamageType(DMG_FALL) || damage.GetDamage() > 0)
        target.ZPEmitSound(SafeTableRandom(sounds), 1);
});
hook.Add("ZPZombieInflictedDamageOnPlayer", "HandleZombieCausingDamage", (attacker, target, damage) => {
    if (RoundManager.IsRealisticMod() || RoundManager.GetRoundState() === ROUND_PLAYING) {
        const amount = target.TakeArmorDamage(damage.GetDamage());
        damage.SetDamage(amount > 0 && (target.IsHuman() || (cvars.Bool("zp_friendly_fire", false) && target.IsZombie())) ? amount : 0);
        if (!RoundManager.IsSpecialRound() && !RoundManager.LastHuman() && !target.IsZombie() && amount > 0) {
            InfectionManager.Infect(target, attacker);
            damage.SetDamage(0);
        }
    }
    else
        damage.SetDamage(0);
});
hook.Add("ZPHumanInflictedDamageOnPlayer", "HandleHumanCausingDamage", (attacker, target, damage) => {
    if (target.IsZombie()) {
        attacker.AddTotalDamage(damage.GetDamage());
        hook.Call("ZPHumanDamage", GAMEMODE, target, attacker, damage);
    }
});
GM.EntityTakeDamage = function (target, damage): boolean | undefined {
    const attacker = damage.GetAttacker();
    if (attacker.IsPlayer()) {
        if (!RoundManager.IsRealisticMod() && target.IsPlayer() && RoundManager.GetRoundState() !== ROUND_PLAYING)
            return true;
        hook.Call("ZPDamageAttackerIsPlayer", GAMEMODE, attacker, target, damage);
    }
    if (target.IsPlayer()) {
        if (target.IsZombie() && damage.GetDamage() > 0)
            hook.Call("ZPZombieTakeDamage", GAMEMODE, target, damage);
        target.TakeLastDamage();
    }
    return undefined;
};
GM.GetFallDamage = function (ply, speed): number { return ply.ShouldTakeFallDamage() ? Math.max(0, Math.ceil(0.2418 * speed - 141.75)) : 0; };
GM.PlayerShouldTakeDamage = function (ply, attacker): boolean {
    if (cvars.Bool("zp_realistic_mode", false))
        return true;
    if (RoundManager.GetRoundState() !== ROUND_PLAYING)
        return false;
    return !attacker.IsPlayer() || cvars.Bool("zp_friendly_fire", false) || attacker.Team() !== ply.Team();
};
GM.AllowPlayerPickup = function (): boolean { return false; };
GM.PlayerDeathSound = function (): boolean { return true; };
GM.CanPlayerSuicide = function (): boolean { return false; };
GM.PlayerShouldTaunt = function (): boolean { return false; };
