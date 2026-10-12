export default new WeaponDefinition({
    PrettyName: "SMG1",
    WeaponID: "weapon_smg1",
    DamageMultiplier: 1,
    WeaponType: WEAPON_PRIMARY,
    GiveWeapon: function (this: ZPWeaponDefinition, ply: ZPServerPlayer): void {
        if (!this.WeaponID)
            return;
        let weapon = ply.GetWeapon(this.WeaponID);
        if (!IsValid(weapon))
            weapon = ply.Give(this.WeaponID);
        ply.GiveAmmo(weapon.GetMaxClip1() * 10, weapon.GetPrimaryAmmoType(), true);
        ply.GiveAmmo(2, weapon.GetSecondaryAmmoType(), true);
    },
});

