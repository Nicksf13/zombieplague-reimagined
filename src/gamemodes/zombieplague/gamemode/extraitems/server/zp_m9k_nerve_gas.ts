export default new ExtraItemDefinition({
    ID: "ZPNerveGas",
    Name: "ExtraItemNerveGasName",
    Price: 20,
    Type: ITEM_ZOMBIE,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("m9k_nerve_gas");
        if (IsValid(Weap)) {
            ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.GiveZombieAllowedWeapon("m9k_nerve_gas");
        }
    },
    ShouldBeEnabled: function (this: ZPExtraItem) {
        return WeaponManager.ServerHasWeapon("m9k_nerve_gas");
    },
});

