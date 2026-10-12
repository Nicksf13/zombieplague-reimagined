export default new ExtraItemDefinition({
    ID: "ZPAntidoteGrenade",
    Name: "ExtraItemAntidoteGrenade",
    Price: 20,
    BuySounds: ["items/medshot4.wav"],
    OnBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let Weap = ply.GetWeapon(ANTIDOTE_GRENADE);
        if (IsValid(Weap)) {
            ply.GiveAmmo(1, Weap.GetPrimaryAmmoType(), true);
        }
        else {
            ply.GiveZombieAllowedWeapon(ANTIDOTE_GRENADE);
        }
        ply.SelectWeapon(ANTIDOTE_GRENADE);
    },
    CanBuy: function (this: ZPExtraItem, ply: ZPServerPlayer) {
        let AntidoteGrenade = ply.GetWeapon(ANTIDOTE_GRENADE);
        return (((((RoundManager as ZPServerRoundManager).IsPlayingRound() && (!(RoundManager as ZPServerRoundManager).IsSpecialRound())) && (!(RoundManager as ZPServerRoundManager).LastZombie())) && ply.Alive()) && ((!IsValid(AntidoteGrenade)) || (IsValid(AntidoteGrenade) && (AntidoteGrenade.Clip1() < 1))));
    },
});

