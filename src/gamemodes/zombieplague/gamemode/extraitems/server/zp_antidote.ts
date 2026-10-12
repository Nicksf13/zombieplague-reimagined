export default new ExtraItemDefinition({
    ID: "ZPAntidote",
    Name: "ExtraItemAntidoteName",
    Price: 20,
    Type: ITEM_ZOMBIE,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        InfectionManager.Cure(ply, ply);
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        return ((((RoundManager as ZPServerRoundManager).IsPlayingRound() && (!(RoundManager as ZPServerRoundManager).IsSpecialRound())) && (!(RoundManager as ZPServerRoundManager).LastZombie())) && ply.Alive());
    },
});

