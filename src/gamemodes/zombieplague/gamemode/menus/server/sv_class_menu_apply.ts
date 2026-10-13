export {};
// The first explicit choice changes this life without replaying infection/loadout,
// healing damage or discarding a human's inventory. Armor keeps its remaining ratio.
_G.ZPApplyInitialClass = (ply, definition, kind): void => {
    const healthFraction = Math.min(1, ply.Health() / Math.max(1, ply.GetMaxHealth()));
    const armorFraction = kind === "human" ? Math.min(1, ply.Armor() / Math.max(1, ply.GetHumanClass().Armor ?? 0)) : 0;
    hook.Call("ZPResetAbilityEvent" + ply.SteamID64(), GAMEMODE);
    if (kind === "human") ply.SetHumanClass(definition);
    else ply.SetZombieClass(definition);
    ply.SetMaxHealth(definition.MaxHealth);
    ply.SetHealth(Math.max(1, Math.floor(definition.MaxHealth * healthFraction)));
    ply.SetModelScale(definition.Scale ?? 1, 0);
    ply.SetWalkSpeed(definition.Speed);
    ply.SetRunSpeed(kind === "zombie" && !cvars.Bool("zp_zombie_should_run", true) ? definition.Speed : definition.RunSpeed);
    ply.SetCrouchedWalkSpeed(definition.CrouchSpeed);
    ply.SetAuxGravity(definition.Gravity);
    ply.SetJumpPower(definition.JumpPower);
    ply.SetModel(definition.PModel);
    ply.SetupHands();
    ply.SetMaxBreath(definition.Breath);
    ply.SetBreath(Math.min(ply.GetBreath(), definition.Breath));
    ply.SetDamageAmplifier(definition.DamageAmplifier);
    ply.SetFootstep(kind === "human" ? definition.Footstep :
        ((RoundManager as ZPServerRoundManager).IsRealisticMod() || cvars.Bool("zp_zombie_footstep", false)) && definition.Footstep);
    if (kind === "human") {
        ply.SetArmor(Math.floor((definition.Armor ?? 0) * armorFraction));
        ply.SetMaxBatteryCharge(definition.Battery ?? 100);
    }
    else {
        ply.StripWeapons();
        definition.WeaponGive?.(ply);
    }
    ply.SetMaxAbilityPower(definition.Ability?.MaxAbilityPower ?? -1);
    ply.SetAbilityPower(definition.Ability?.MaxAbilityPower ?? -1);
};
