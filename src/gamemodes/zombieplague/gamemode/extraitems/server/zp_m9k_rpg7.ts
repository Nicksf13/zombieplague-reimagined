WeaponManager.AddWeaponMultiplier("m9k_gdcwa_rpg_heat", 5);

export default new ExtraItemDefinition({
    ID: "ZPRPG7",
    Name: "ExtraItemRPG7Name",
    Price: 20,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_rpg7");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("m9k_rpg7");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_rpg7");
    },
});

