export default new ExtraItemDefinition({
    ID: "ZPArmor",
    Name: "ExtraItemArmorName",
    Price: 12,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        ply.SetArmor((ply.Armor() + 100));
    },
});

