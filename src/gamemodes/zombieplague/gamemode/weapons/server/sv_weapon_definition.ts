export class WeaponDefinition implements ZPRegisteredWeapon {
    PrettyName: string;
    WeaponID: string;
    WeaponType: ZPWeaponType = WEAPON_PRIMARY;
    DamageMultiplier: number = 1;
    Order: number = 100;
    ProjectileID?: string;

    constructor(options: ZPWeaponOptions) {
        this.PrettyName = options.PrettyName;
        this.WeaponID = options.WeaponID;
        Object.assign(this, options);
    }

    GiveWeapon(this: ZPWeaponDefinition, ply: ZPServerPlayer): void {
        if (!this.WeaponID)
            return;
        let weapon = ply.GetWeapon(this.WeaponID);
        if (!IsValid(weapon))
            weapon = ply.Give(this.WeaponID);
        if (!IsValid(weapon))
            return;
        // Zero and -1 remain valid clip sizes, as in the legacy definition.
        const clip = weapon.GetMaxClip1();
        if (clip !== undefined)
            ply.GiveAmmo(clip * 10, weapon.GetPrimaryAmmoType(), true);
        else
            ply.GiveAmmo(weapon.GetMaxClip2() * 10, weapon.GetSecondaryAmmoType(), true);
    }

    ShouldBeEnabled(): boolean { return true; }
}
_G.WeaponDefinition = WeaponDefinition;
