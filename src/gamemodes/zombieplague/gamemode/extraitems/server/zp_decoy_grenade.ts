export default new ExtraItemDefinition({
    ID: "ZPDecoyGrenade",
    Name: "ExtraItemDecoyName",
    Price: 8,
    Type: ITEM_HUMAN,
    CanBuy: function (this: ZPExtraItem, player: ZPServerPlayer) { return ZPDecoy.CanBuy(player); },
    OnBuy: function (this: ZPExtraItem, player: ZPServerPlayer) { ZPDecoy.Give(player); },
});
