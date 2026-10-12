export default new ExtraItemDefinition({
    ID: "ZPZombieMadness",
    Name: "ExtraItemZombieMadnessName",
    Price: 10,
    Type: ITEM_ZOMBIE,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        ply.ZombieMadness(5);
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        return ply.Alive();
    },
});

