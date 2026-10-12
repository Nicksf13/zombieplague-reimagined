WeaponManager.AddWeaponMultiplier("m9k_launched_ex41", 2);

export default new ExtraItemDefinition({
    ID: "ZPEX41",
    Name: "ExtraItemEX41Name",
    Price: 30,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_ex41");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_ex41");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_ex41");
    },
});

