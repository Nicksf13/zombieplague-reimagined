/** Enter observation through the same server rules for manual and training spectators. */
export function enterSpectator(this: void, ply: ZPServerPlayer, rounds: ZPServerRoundManager): void {
    ply.ZPVoluntarySpectator = true;
    rounds.RemovePlayerToPlay(ply);
    rounds.UnfreezePlayer(ply);
    if (ply.Alive()) ply.KillSilent();
    ply.DeathTime = CurTime();
    ply.SetNemesis(false); ply.SetSurvivor(false);
    ply.SetNightvision(false, true); ply.SetLight(undefined); ply.Flashlight(false);
    ply.StripWeapons();
    ply.Spectate(OBS_MODE_ROAMING);
}
