WeaponManager.AddWeaponMultiplier("npc_grenade_frag", 5);

export default new ExtraItemDefinition({
    ID: "ZPGrenade",
    Name: "ExtraItemGrenadeName",
    Price: 1,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("weapon_frag");
        if (IsValid(Weap)) {
            ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.Give("weapon_frag");
        }
    },
});

