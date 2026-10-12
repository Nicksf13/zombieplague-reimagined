export default new ExtraItemDefinition({
    ID: "ZPTVirus",
    Name: "ExtraItemTVirusName",
    Price: 15,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        if (((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_PLAYING)) {
            InfectionManager.Infect(ply, ply);
        }
        else if (((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_STARTING_NEW_ROUND)) {
            const round = (RoundManager as ZPServerRoundManager).GetRounds().SimpleRound;
            if (round)
                (RoundManager as ZPServerRoundManager).StartRound(round, ply);
        }
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        return ((((((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_PLAYING) || ((RoundManager as ZPServerRoundManager).GetRoundState() === ROUND_STARTING_NEW_ROUND)) && (!(RoundManager as ZPServerRoundManager).IsSpecialRound())) && (!(RoundManager as ZPServerRoundManager).LastHuman())) && ply.Alive());
    },
});

