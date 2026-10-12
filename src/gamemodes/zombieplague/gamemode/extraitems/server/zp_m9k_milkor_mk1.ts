WeaponManager.AddWeaponMultiplier("m9k_m202_rocket", 4);

export default new ExtraItemDefinition({
    ID: "ZPMilkorMK1",
    Name: "ExtraItemMilkorMK1Name",
    Price: 35,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_milkormgl");
        if (IsValid(Weap)) {
            ply.GiveAmmo(6, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_milkormgl");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_milkormgl");
    },
});

