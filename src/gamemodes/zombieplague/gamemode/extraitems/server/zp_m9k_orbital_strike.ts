WeaponManager.AddWeaponMultiplier("m9k_oribital_cannon", 5);

export default new ExtraItemDefinition({
    ID: "ZPOrbitalStrike",
    Name: "ExtraItemOrbitalStrikeName",
    Price: 30,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_orbital_strike");
        if (IsValid(Weap)) {
            ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_orbital_strike");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_orbital_strike");
    },
});

