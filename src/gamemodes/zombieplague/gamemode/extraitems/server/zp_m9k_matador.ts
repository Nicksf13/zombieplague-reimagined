WeaponManager.AddWeaponMultiplier("m9k_gdcwa_matador_90mm", 5);

export default new ExtraItemDefinition({
    ID: "ZPMatador",
    Name: "ExtraItemMatadorName",
    Price: 20,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_matador");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_matador");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_matador");
    },
});

