WeaponManager.AddWeaponMultiplier("m9k_improvised_explosive", 8);

export default new ExtraItemDefinition({
    ID: "ZPIED",
    Name: "ExtraItemIEDName",
    Price: 20,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_ied_detonator");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_ied_detonator");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_ied_detonator");
    },
});

