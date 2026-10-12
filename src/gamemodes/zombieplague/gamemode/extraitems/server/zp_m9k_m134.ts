WeaponManager.AddWeaponMultiplier("m9k_minigun", 0.5);

export default new ExtraItemDefinition({
    ID: "ZPM134",
    Name: "ExtraItemM134Name",
    Price: 100,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_minigun");
        if (IsValid(Weap)) {
            ply.GiveAmmo(300, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_minigun");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_minigun");
    },
});

