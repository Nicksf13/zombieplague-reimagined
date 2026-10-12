WeaponManager.AddWeaponMultiplier("m9k_launched_m79", 2);

export default new ExtraItemDefinition({
    ID: "ZPM79GL",
    Name: "ExtraItemM79GLName",
    Price: 22,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_m79gl");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_m79gl");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_m79gl");
    },
});

