export default new ExtraItemDefinition({
    ID: "ZPInfectionBomb",
    Name: "ExtraItemInfectionBombName",
    Price: 7,
    Type: ITEM_ZOMBIE,
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon(INFECTION_BOMB);
        if (IsValid(Weap)) {
            ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.GiveZombieAllowedWeapon(INFECTION_BOMB);
        }
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let InfectionBomb = ply.GetWeapon(INFECTION_BOMB);
        return ((((RoundManager as ZPServerRoundManager).IsPlayingRound() && (!(RoundManager as ZPServerRoundManager).IsSpecialRound())) && ply.Alive()) && ((!IsValid(InfectionBomb)) || (IsValid(InfectionBomb) && (InfectionBomb.Clip1() < 1))));
    },
});

