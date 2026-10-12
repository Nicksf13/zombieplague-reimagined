export default new ExtraItemDefinition({
    ID: "ZPExtraAmmo",
    Name: "ExtraItemExtraAmmoName",
    Price: 3,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        for (const Weap of ply.GetWeapons()) {
            if (WeaponManager.IsChoosableWeapon(Weap.GetClass())) {
                if (Weap.GetMaxClip1() !== undefined) {
                    ply.GiveAmmo((Weap.GetMaxClip1() * 15), Weap.GetPrimaryAmmoType(), true);
                }
                else {
                    ply.GiveAmmo((Weap.GetMaxClip2() * 15), Weap.GetSecondaryAmmoType(), true);
                }
            }
        }
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        return (ply.Alive() && (cvars.Number("zp_clip_mode", 0) === WMODE_NONE));
    },
});

