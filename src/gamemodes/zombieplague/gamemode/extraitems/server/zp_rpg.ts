WeaponManager.AddWeaponMultiplier("rpg_missile", 4);

export default new ExtraItemDefinition({
    ID: "ZPRPG",
    Name: "ExtraItemRPGName",
    Price: 15,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("weapon_rpg");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("weapon_rpg");
        }
    },
});

