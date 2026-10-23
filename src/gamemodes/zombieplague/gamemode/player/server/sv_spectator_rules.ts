/** Use the same eligibility policy for cameras, overview packets and follow requests. */
export function ready(this: void, ply: ZPServerPlayer): boolean {
    // Initial/training spectators may have been silently killed without a death event.
    return (ply.Team() === TEAM_SPECTATOR && ply.DeathTime === undefined) || CurTime() - (ply.DeathTime ?? CurTime()) > 3;
}

export function restricted(this: void, ply: ZPServerPlayer): boolean {
    return ply.Team() !== TEAM_SPECTATOR && (RoundManager.IsRealisticMod() || cvars.Bool("zp_spectate_team_only", true));
}

export function targets(this: void, ply: ZPServerPlayer): ZPServerPlayer[] {
    const rounds = RoundManager as ZPServerRoundManager;
    const candidates = restricted(ply) ? (ply.IsZombie() ? rounds.GetAliveZombies() : rounds.GetAliveHumans()) : rounds.GetPlayersToPlay(true);
    return candidates.filter(target => IsValid(target) && target !== ply && target.Alive() &&
        (target.Team() === TEAM_HUMANS || target.Team() === TEAM_ZOMBIES));
}
