export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.GiveZombieAllowedWeapon = function (this: ZPServerPlayer, Weap: string): void {
    this.AddZombieAllowedWeapon(Weap);
    this.Give(Weap);
    this.SelectWeapon(Weap);
};
PLAYER.AddZombieAllowedWeapon = function (this: ZPServerPlayer, Weap: string): void {
    this.GetZombieAllowedWeapons().push(Weap);
};
PLAYER.SetZombieAllowedWeapons = function (this: ZPServerPlayer, AllowedWeapons: string[]): void {
    this.AllowedWeapons = AllowedWeapons;
};
PLAYER.GetZombieAllowedWeapons = function (this: ZPServerPlayer): string[] {
    return (this.AllowedWeapons ?? []);
};
PLAYER.ZombieCanUseWeapon = function (this: ZPServerPlayer, Weap: string): boolean {
    if ((Weap === ZOMBIE_KNIFE)) {
        return true;
    }
    for (const LocalWeap of this.GetZombieAllowedWeapons()) {
        if ((LocalWeap === Weap)) {
            return true;
        }
    }
    return false;
};
PLAYER.RemoveZombieAllowedWeapon = function (this: ZPServerPlayer, Weapon: string): void {
    this.StripWeapon(Weapon);
    table.RemoveByValue(this.GetZombieAllowedWeapons(), Weapon);
};
PLAYER.ResetZombieAllowedWeapons = function (this: ZPServerPlayer): void {
    this.SetZombieAllowedWeapons([ZOMBIE_KNIFE]);
};
PLAYER.GiveWeapon = function (this: ZPServerPlayer, Weap: ZPRegisteredWeapon): void {
    if (this.Alive() && this.IsHuman())
        Weap.GiveWeapon(this);
};
PLAYER.SetPrimaryWeapon = function (this: ZPServerPlayer, PrimaryWeapon: ZPRegisteredWeapon | undefined): void {
    this.PrimaryWeapon = PrimaryWeapon;
    if (PrimaryWeapon) {
        if (((this.Alive() && this.IsHuman()) && (!this.GetPrimaryWeaponGiven()))) {
            this.GiveWeapon(PrimaryWeapon);
            this.SetPrimaryWeaponGiven(true);
        }
    }
};
PLAYER.GetPrimaryWeapon = function (this: ZPServerPlayer): ZPRegisteredWeapon | undefined {
    return this.PrimaryWeapon;
};
PLAYER.SetSecondaryWeapon = function (this: ZPServerPlayer, SecondaryWeapon: ZPRegisteredWeapon | undefined): void {
    this.SecondaryWeapon = SecondaryWeapon;
    if (SecondaryWeapon) {
        if (((this.Alive() && this.IsHuman()) && (!this.GetSecondaryWeaponGiven()))) {
            this.GiveWeapon(SecondaryWeapon);
            this.SetSecondaryWeaponGiven(true);
        }
    }
};
PLAYER.GetSecondaryWeapon = function (this: ZPServerPlayer): ZPRegisteredWeapon | undefined {
    return this.SecondaryWeapon;
};
PLAYER.SetPrimaryWeaponGiven = function (this: ZPServerPlayer, PrimaryWeaponGiven: boolean): void {
    this.PrimaryWeaponGiven = PrimaryWeaponGiven;
};
PLAYER.GetPrimaryWeaponGiven = function (this: ZPServerPlayer): boolean {
    return (this.PrimaryWeaponGiven ?? false);
};
PLAYER.SetSecondaryWeaponGiven = function (this: ZPServerPlayer, SecondaryWeaponGiven: boolean): void {
    this.SecondaryWeaponGiven = SecondaryWeaponGiven;
};
PLAYER.GetSecondaryWeaponGiven = function (this: ZPServerPlayer): boolean {
    return (this.SecondaryWeaponGiven ?? false);
};
PLAYER.SetMeleeWeapon = function (this: ZPServerPlayer, MeleeWeapon: ZPRegisteredWeapon | undefined): void {
    this.MeleeWeapon = MeleeWeapon;
    if (MeleeWeapon) {
        if (((this.Alive() && this.IsHuman()) && (!this.GetMeleeWeaponGiven()))) {
            this.GiveWeapon(MeleeWeapon);
            this.SetMeleeWeaponGiven(true);
        }
    }
};
PLAYER.GetMeleeWeapon = function (this: ZPServerPlayer): ZPRegisteredWeapon | undefined {
    return (this.MeleeWeapon ?? WeaponManager.FindWeaponByWeaponId("weapon_crowbar", WEAPON_MELEE));
};
PLAYER.SetMeleeWeaponGiven = function (this: ZPServerPlayer, MeleeWeaponGiven: boolean): void {
    this.MeleeWeaponGiven = MeleeWeaponGiven;
};
PLAYER.GetMeleeWeaponGiven = function (this: ZPServerPlayer): boolean {
    return (this.MeleeWeaponGiven ?? false);
};
