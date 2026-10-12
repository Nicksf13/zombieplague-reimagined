WeaponManager.AddWeaponMultiplier("m9k_m202_rocket", 2);

export default new ExtraItemDefinition({
    ID: "ZPM202",
    Name: "ExtraItemM202Name",
    Price: 40,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_m202");
        if (IsValid(Weap)) {
            ply.GiveAmmo(4, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_m202");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_m202");
    },
});

