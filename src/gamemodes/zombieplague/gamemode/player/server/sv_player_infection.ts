export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.Infect = function (this: ZPServerPlayer, SilentInfection?: boolean): void {
    const nextClass = this.GetNextZombieClass();
    if (nextClass) {
        this.SetZombieClass(nextClass);
    }
    let HoldingWeapon = this.GetActiveWeapon();
    if (IsValid(HoldingWeapon)) {
        this.DropWeapon(HoldingWeapon);
    }
    this.SetTeam(TEAM_ZOMBIES);
    this.StripWeapons();
    let ZombieClass: ZPClassDefinition | undefined;
    if (this.IsBot()) {
        ZombieClass = SafeTableRandom(ClassManager.GetZombieClasses());
        if (!ZombieClass)
            throw "No zombie classes registered";
        this.SetZombieClass(ZombieClass);
    }
    else {
        ZombieClass = this.GetZombieClass();
    }
    if (ZombieClass.Scale !== undefined) {
        this.SetModelScale(ZombieClass.Scale, 0);
    }
    this.SetMaxHealth(ZombieClass.MaxHealth);
    this.SetHealth(ZombieClass.MaxHealth);
    this.SetWalkSpeed(ZombieClass.Speed);
    this.SetRunSpeed((cvars.Bool("zp_zombie_should_run", true) ? ZombieClass.RunSpeed : ZombieClass.Speed));
    this.SetCrouchedWalkSpeed(ZombieClass.CrouchSpeed);
    this.SetAuxGravity(ZombieClass.Gravity);
    this.SetMaxBreath(ZombieClass.Breath);
    this.SetBreath(ZombieClass.Breath);
    this.SetJumpPower(ZombieClass.JumpPower);
    this.SetDamageAmplifier(ZombieClass.DamageAmplifier);
    this.SetFootstep((((RoundManager as ZPServerRoundManager).IsRealisticMod() || cvars.Bool("zp_zombie_footstep", false)) && ZombieClass.Footstep));
    if (this.FlashlightIsOn()) {
        this.Flashlight(false);
    }
    this.AllowFlashlight(false);
    this.SetModel(ZombieClass.PModel);
    this.SetupHands();
    if (ZombieClass.WeaponGive)
        ZombieClass.WeaponGive(this);
    if ((!SilentInfection)) {
        const sound = SafeTableRandom(InfectionSounds);
        if (sound !== undefined)
            this.EmitSound(sound);
    }
    let Ability = ZombieClass.Ability;
    if (Ability) {
        this.SetMaxAbilityPower(Ability.MaxAbilityPower);
        this.SetAbilityPower(Ability.MaxAbilityPower);
        SendPopupMessage(this, { Phrase: "zombieplague.noticehashability" });
    }
    else {
        this.SetMaxAbilityPower((-1));
        this.SetAbilityPower((-1));
    }
    this.ScreenFade(SCREENFADE.IN, Color(0, 255, 0, 128), 0.3, 0);
    if (cvars.Bool("zp_zombie_screen_filter", true)) {
        this.SetScreenFilter(Color(255, 0, 0, 2));
    }
};
PLAYER.MakeHuman = function (this: ZPServerPlayer): void {
    const nextClass = this.GetNextHumanClass();
    if (nextClass) {
        this.SetHumanClass(nextClass);
    }
    this.SetTeam(TEAM_HUMANS);
    this.StripWeapons();
    let HumanClass: ZPClassDefinition | undefined;
    if (this.IsBot()) {
        HumanClass = SafeTableRandom(ClassManager.GetHumanClasses());
        if (!HumanClass)
            throw "No human classes registered";
        this.SetHumanClass(HumanClass);
    }
    else {
        HumanClass = this.GetHumanClass();
    }
    this.SetMaxHealth(HumanClass.MaxHealth);
    if (HumanClass.Armor !== undefined) {
        this.SetArmor(HumanClass.Armor);
    }
    if (HumanClass.Scale !== undefined) {
        this.SetModelScale(HumanClass.Scale, 0);
    }
    this.SetHealth(HumanClass.MaxHealth);
    this.SetWalkSpeed(HumanClass.Speed);
    this.SetRunSpeed(HumanClass.RunSpeed);
    this.SetCrouchedWalkSpeed(HumanClass.CrouchSpeed);
    this.SetAuxGravity(HumanClass.Gravity);
    this.SetJumpPower(HumanClass.JumpPower);
    this.SetModel(HumanClass.PModel);
    this.SetMaxBreath(HumanClass.Breath);
    this.SetBreath(HumanClass.Breath);
    this.SetMaxBatteryCharge(HumanClass.Battery ?? 100);
    this.SetDamageAmplifier(HumanClass.DamageAmplifier);
    this.SetFootstep(HumanClass.Footstep);
    this.AllowFlashlight(true);
    this.SetupHands();
    this.SetPrimaryWeaponGiven(false);
    this.SetSecondaryWeaponGiven(false);
    this.SetMeleeWeaponGiven(false);
    if ((!this.IsBot())) {
        const primary = this.GetPrimaryWeapon(), secondary = this.GetSecondaryWeapon(), melee = this.GetMeleeWeapon();
        if (primary) {
            this.GiveWeapon(primary);
            this.SetPrimaryWeaponGiven(true);
        }
        if (secondary) {
            this.GiveWeapon(secondary);
            this.SetSecondaryWeaponGiven(true);
        }
        if (melee) {
            this.GiveWeapon(melee);
            // A fallback crowbar must not consume the player's first melee choice.
            this.SetMeleeWeaponGiven(this.MeleeWeapon !== undefined);
        }
    }
    else {
        const weapon = SafeTableRandom(WeaponManager.GetWeaponsTableByWeaponType(WEAPON_PRIMARY));
        if (weapon)
            this.GiveWeapon(weapon);
    }
    let Ability = HumanClass.Ability;
    if (Ability) {
        this.SetMaxAbilityPower(Ability.MaxAbilityPower);
        this.SetAbilityPower(Ability.MaxAbilityPower);
        SendPopupMessage(this, { Phrase: "zombieplague.noticehashability" });
    }
    else {
        this.SetMaxAbilityPower((-1));
        this.SetAbilityPower((-1));
    }
    if (cvars.Bool("zp_zombie_screen_filter", true)) {
        this.SetScreenFilter(undefined);
    }
};
PLAYER.Cure = function (this: ZPServerPlayer): void {
    this.MakeHuman();
    const sound = SafeTableRandom(CureSounds);
    if (sound !== undefined)
        this.EmitSound(sound);
};
PLAYER.MakeNemesis = function (this: ZPServerPlayer): void {
    this.Infect();
    let HealthMode = cvars.Number("zp_nemesis_health_mode", 0);
    if ((HealthMode === 1)) {
        let Health = (this.Health() + ((RoundManager as ZPServerRoundManager).CountHumansAlive() * cvars.Number("zp_nemesis_health_player", 500)));
        this.SetHealth(Health);
        this.SetMaxHealth(Health);
    }
    else if ((HealthMode === 2)) {
        this.SetHealth(cvars.Number("zp_nemesis_health", 3000));
        this.SetMaxHealth(cvars.Number("zp_nemesis_health", 3000));
    }
    else {
        this.SetHealth(NemesisClass.Health);
        this.SetMaxHealth(NemesisClass.Health);
    }
    if ((!cvars.Bool("zp_nemesis_earn", false))) {
        this.SetWalkSpeed(NemesisClass.Speed);
        this.SetRunSpeed(NemesisClass.RunSpeed);
        this.SetCrouchedWalkSpeed(NemesisClass.CrouchedSpeed);
        this.SetAuxGravity(NemesisClass.Gravity);
    }
    if ((!cvars.Bool("zp_nemesis_override_player_mode", false))) {
        this.SetModel(NemesisClass.PlayerModel);
    }
    this.SetFootstep(true);
    this.SetDamageAmplifier(cvars.Number("zp_nemesis_damage", 10));
    this.SetLight(NEMESIS_COLOR);
    this.SetNemesis(true);
};
PLAYER.MakeSurvivor = function (this: ZPServerPlayer): void {
    let HealthMode = cvars.Number("zp_survivor_health_mode", 1);
    if ((HealthMode === 1)) {
        this.SetHealth((this.Health() + ((RoundManager as ZPServerRoundManager).CountZombiesAlive() * cvars.Number("zp_survivor_health_player", 30))));
    }
    else if ((HealthMode === 2)) {
        this.SetHealth(cvars.Number("zp_survivor_health", 3000));
    }
    else {
        this.SetHealth(SurvivorClass.Health);
    }
    if ((!cvars.Bool("zp_survivor_earn", false))) {
        this.SetWalkSpeed(SurvivorClass.Speed);
        this.SetRunSpeed(SurvivorClass.RunSpeed);
        this.SetCrouchedWalkSpeed(SurvivorClass.CrouchedSpeed);
        this.SetAuxGravity(SurvivorClass.Gravity);
    }
    if ((!cvars.Bool("zp_survivor_override_player_mode", false))) {
        this.SetModel(SurvivorClass.PlayerModel);
    }
    this.SetFootstep(false);
    this.SetDamageAmplifier(cvars.Number("zp_survivor_damage", 2));
    this.SetLight(SURVIVOR_COLOR);
    this.SetSurvivor(true);
};
