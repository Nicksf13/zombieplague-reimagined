export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.ZombieMadness = function (this: ZPServerPlayer, ZombieMadnessTime?: number): string {
    this.SetLight(Color(255, 0, 0));
    this.GodEnable();
    this.ZPEmitSound(SafeTableRandom(ZombieMadnessSounds), 5, true);
    this.OldWalkSpeed = this.GetWalkSpeed();
    this.selfOldRunSpeed = this.GetRunSpeed();
    this.SetWalkSpeed(200);
    this.SetRunSpeed(200);
    let ZombieMadnessIdentifier = ("ZPZombieMadness" + this.SteamID64());
    let ZombieMadnessDuration = ZombieMadnessTime ?? 5;
    if (timer.Exists(ZombieMadnessIdentifier)) {
        ZombieMadnessDuration += timer.TimeLeft(ZombieMadnessIdentifier) ?? 0;
        timer.Destroy(ZombieMadnessIdentifier);
    }
    timer.Create(ZombieMadnessIdentifier, ZombieMadnessDuration, 1, () => {
        if (IsValid(this)) {
            this.SetLight(undefined);
            this.GodDisable();
            if (this.OldWalkSpeed !== undefined)
                this.SetWalkSpeed(this.OldWalkSpeed);
            if (this.selfOldRunSpeed !== undefined)
                this.SetRunSpeed(this.selfOldRunSpeed);
        }
    });
    return ZombieMadnessIdentifier;
};
PLAYER.TakeLastDamage = function (this: ZPServerPlayer): void {
    this.SetLastDamage(CurTime());
};
PLAYER.SetLastDamage = function (this: ZPServerPlayer, LastDamage: number): void {
    this.LastDamage = LastDamage;
};
PLAYER.GetLastDamage = function (this: ZPServerPlayer): number {
    return (this.LastDamage ?? 0);
};
PLAYER.ShouldTakeFallDamage = function (this: ZPServerPlayer): boolean {
    let FallDamage = cvars.Number("zp_falldamage", 0);
    if (((FallDamage === FALL_DMG_NONE) && (!(RoundManager as ZPServerRoundManager).IsRealisticMod()))) {
        return false;
    }
    if ((this.IsZombie() ? (!this.GetZombieClass().FallFunction()) : (this.IsHuman() && (!this.GetHumanClass().FallFunction())))) {
        return false;
    }
    // Preserve the legacy truthy result; correcting team-specific modes is a separate gameplay change.
    return FallDamage === FALL_DMG_ALL || this.IsZombie() || this.IsHuman();
};
PLAYER.AddTotalDamage = function (this: ZPServerPlayer, TotalDamage: number): void {
    let DamageToAP = cvars.Number("zp_ap_damage", 500);
    if ((DamageToAP > 0)) {
        let ExcedingAPTotalDamage = ((this.GetTotalDamage() % DamageToAP) + TotalDamage);
        let AmmoPacks = math.floor((ExcedingAPTotalDamage / DamageToAP));
        if ((AmmoPacks > 0)) {
            this.GiveAmmoPacks(AmmoPacks);
        }
    }
    let DamageToPoints = cvars.Number("zp_point_damage_amount_to_point", 750);
    if ((DamageToPoints > 0)) {
        let ExcedingPointsTotalDamage = ((this.GetTotalDamage() % DamageToPoints) + TotalDamage);
        let Points = math.floor((ExcedingPointsTotalDamage / DamageToPoints));
        if ((Points > 0)) {
            this.AddPoints((Points * cvars.Number("zp_point_amount_received", 5)));
        }
    }
    this.SetTotalDamage((this.GetTotalDamage() + TotalDamage));
};
PLAYER.SetTotalDamage = function (this: ZPServerPlayer, TotalDamage: number): void {
    this.TotalDamage = TotalDamage;
};
PLAYER.GetTotalDamage = function (this: ZPServerPlayer): number {
    return (this.TotalDamage ?? 0);
};
PLAYER.TakeArmorDamage = function (this: ZPServerPlayer, Dmg: number): number {
    if ((this.Armor() > 0)) {
        let Armor = (this.Armor() - Dmg);
        if ((Armor < 0)) {
            Armor = 0;
            if (cvars.Bool("zp_realistic_mode", false)) {
                this.SetArmor(Armor);
                return (Armor * (-1));
            }
        }
        this.SetArmor(Armor);
        return 0;
    }
    return Dmg;
};
PLAYER.SetDamageAmplifier = function (this: ZPServerPlayer, DamageAmplifier: number): void {
    this.DamageAmplifier = DamageAmplifier;
};
PLAYER.GetDamageAmplifier = function (this: ZPServerPlayer): number {
    return (this.DamageAmplifier ?? 1);
};
