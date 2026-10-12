WeaponManager.AddWeaponMultiplier("m9k_thrown_harpoon", 3.4);

export default new ExtraItemDefinition({
    ID: "ZPHarpoon",
    Name: "ExtraItemHarpoonName",
    Price: 15,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_harpoon");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_harpoon");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_harpoon");
    },
});

