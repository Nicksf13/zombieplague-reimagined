export {};
const manager = RoundManager as ZPServerRoundManager;
manager.AddPlayerToPlay = function (this: ZPServerRoundManager, entry): void {
    const ply = entry as ZPServerPlayer;
    if (cvars.Bool("zp_bot_training", false) && !ply.IsBot()) {
        ply.ZPVoluntarySpectator = true;
        ply.SetTeam(TEAM_SPECTATOR);
        return;
    }
    if (ply.ZPVoluntarySpectator || this.PlayersToPlay.includes(ply))
        return;
    this.PlayersToPlay.push(ply);
    ply.SetTeam(TEAM_HUMANS);
    if (this.GetRoundState() === ROUND_WAITING_PLAYERS && this.CountPlayersToPlay() >= (cvars.Bool("zp_bot_training", false) ? 2 : cvars.Number("zp_min_players", 2)))
        this.RestartRound();
};
manager.RemovePlayerToPlay = function (this: ZPServerRoundManager, entry): void {
    const ply = entry as ZPServerPlayer, previousTeam = ply.Team();
    if (this.FreezeTimeActive)
        this.UnfreezePlayer(ply);
    ply.SetTeam(TEAM_SPECTATOR);
    for (let i = this.PlayersToPlay.length - 1; i >= 0; i--)
        if (this.PlayersToPlay[i] === ply)
            this.PlayersToPlay.splice(i, 1);
    const replaceZombie = previousTeam === TEAM_ZOMBIES && this.CountZombiesAlive() === 0 && this.CountHumansAlive() > 1;
    const replaceHuman = previousTeam === TEAM_HUMANS && this.CountHumansAlive() === 0 && this.CountZombiesAlive() > 1;
    if (replaceZombie || replaceHuman) {
        const replacement = SafeTableRandom(replaceZombie ? this.GetAliveHumans() : this.GetAliveZombies());
        if (replacement) {
            if (replaceZombie)
                replacement.Infect();
            else
                replacement.Cure();
            for (const entry of player.GetAll()) {
                const receiver = entry as ZPServerPlayer;
                SendPopupMessage(receiver, { Phrase: "zombieplague." + string.lower(replaceZombie ? "LastZombieLeft" : "LastHumanLeft"), Arguments: [replacement.Name()] });
            }
        }
    }
    if (this.GetRoundState() === ROUND_PLAYING)
        this.CheckRoundEnd();
    hook.Call("ZPResetAbilityEvent" + ply.SteamID64(), GAMEMODE);
};
manager.CountPlayersToPlay = function (this: ZPServerRoundManager): number { return this.GetPlayersToPlay().length; };
manager.CountPlayersToPlayAlive = function (this: ZPServerRoundManager): number { return this.GetPlayersToPlay(true).length; };
manager.GetPlayersToPlay = function (this: ZPServerRoundManager, alive?: boolean): ZPServerPlayer[] {
    const result: ZPServerPlayer[] = [];
    for (let i = this.PlayersToPlay.length - 1; i >= 0; i--) {
        const ply = this.PlayersToPlay[i];
        if (!ply || !IsValid(ply))
            this.PlayersToPlay.splice(i, 1);
    }
    for (const ply of this.PlayersToPlay)
        if (!alive || ply.Alive())
            result.push(ply);
    return result;
};
manager.AddPlayerToBeRewarded = function (this: ZPServerRoundManager, ply): void {
    const team = ply.Team(), rewards = this.PlayersToReward[team];
    if (rewards)
        rewards.push(ply.SteamID64());
};
manager.ReturnValidPlayerToBeRewardedOrNil = function (this: ZPServerRoundManager, id, team) {
    const ply = player.GetBySteamID64(id);
    return ply && IsValid(ply) && ply.Team() === team ? ply : undefined;
};
