WeaponManager.AddWeaponMultiplier("npc_tripmine", 4);

WeaponManager.AddWeaponMultiplier("npc_satchel", 4);

export default new ExtraItemDefinition({
    ID: "ZPSlam",
    Name: "ExtraItemSlamName",
    Price: 6,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon("weapon_slam");
        if (IsValid(Weap)) {
            ply.GiveAmmo(3, "slam", true);
        }
        else {
            ply.Give("weapon_slam");
        }
    },
});

