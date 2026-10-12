export {};
const manager = RoundManager as ZPServerRoundManager;
manager.SetTimer = function (seconds, callback): void {
    timer.Destroy("ZombiePlagueTimer");
    timer.Create("ZombiePlagueTimer", seconds, 1, callback);
    net.Start("SyncTimer");
    net.WriteInt(seconds, 16);
    net.Broadcast();
};
manager.GetTime = function (): number { return timer.TimeLeft("ZombiePlagueTimer") ?? 0; };
manager.CheckRoundEnd = function (): void {
    const current = this.GetCurrentRoundPlaying();
    if (!current)
        return;
    if (current.Respawn && current.RoundEndFunction)
        current.RoundEndFunction();
    else {
        const humans = this.CountHumansAlive(), zombies = this.CountZombiesAlive();
        if (humans === 0 && zombies === 0)
            this.EndRound(ROUND_DRAW);
        else if (humans === 0)
            this.EndRound(ZOMBIES_WIN);
        else if (zombies === 0)
            this.EndRound(HUMANS_WIN);
    }
};
manager.WaitPlayers = function (): void {
    timer.Destroy("ZombiePlagueTimer");
    this.SetRoundState(ROUND_WAITING_PLAYERS);
};
manager.Prepare = function (): boolean {
    if (this.CountPlayersToPlay() < cvars.Number("zp_min_players", 2))
        return false;
    hook.Call("ZPPrePreparingRound");
    game.CleanUpMap();
    this.SetRoundState(ROUND_STARTING_NEW_ROUND);
    for (const ply of this.GetPlayersToPlay()) {
        ply.SetNemesis(false);
        ply.SetSurvivor(false);
        ply.SetLight(undefined);
        ply.ResetZombieAllowedWeapons();
        ply.SetTeam(TEAM_HUMANS);
        ply.Spawn();
    }
    hook.Call("ZPPostPreparingRound");
    return true;
};
manager.FreezePlayer = function (ply): void {
    ply.SetWalkSpeed(1);
    ply.SetRunSpeed(1);
    ply.SetCrouchedWalkSpeed(1);
    ply.SetJumpPower(1);
};
manager.UnfreezePlayer = function (ply): void {
    const definition = ply.IsHuman() ? ply.GetHumanClass() : ply.GetZombieClass();
    ply.SetWalkSpeed(definition.Speed);
    ply.SetRunSpeed(definition.RunSpeed);
    ply.SetCrouchedWalkSpeed(definition.CrouchSpeed);
    ply.SetJumpPower(definition.JumpPower);
};
manager.FreezeTime = function (): void {
    for (const ply of this.GetAlivePlayers())
        this.FreezePlayer(ply);
    this.SetTimer(cvars.Number("zp_freeze_time_delay", 10), () => {
        for (const ply of (player.GetAll() as ZPServerPlayer[]))
            this.UnfreezePlayer(ply);
        const delay = cvars.Number("zp_infection_delay", 10);
        if (delay > 0) {
            const count = Math.min(delay, CountDownSound.length);
            timer.Create("NoSoundInfectionDelayTimer", Math.max(delay - CountDownSound.length, 0), 1, () => {
                const unfreeze = SafeTableRandom(UnfreezeSounds), first = CountDownSound[count - 1];
                if (unfreeze)
                    BroadcastSound(unfreeze);
                if (first)
                    BroadcastSound(first);
                if (count > 0)
                    timer.Create("TimerSound", 1, count, () => {
                        const left = timer.RepsLeft("TimerSound");
                        const sound = left !== undefined && left > 0 ? CountDownSound[left - 1] : undefined;
                        if (sound)
                            BroadcastSound(sound);
                    });
            });
        }
        this.SetTimer(delay, () => this.NewRound());
    });
};
manager.TryNewRound = function (): void {
    if (this.Prepare())
        this.FreezeTime();
    else
        this.WaitPlayers();
    for (const ply of (player.GetAll() as ZPServerPlayer[]))
        hook.Call("ZPResetAbilityEvent" + ply.SteamID64(), GAMEMODE);
};
manager.NewRound = function (): void {
    const candidates: ZPRoundDefinition[] = [];
    const players = this.CountPlayersToPlayAlive();
    let total = 0;
    for (const [, round] of pairs(this.GetRounds())) {
        if (players >= round.MinPlayers && round.Chance > 0) {
            total += round.Chance;
            candidates.push(round);
        }
    }
    if (total <= 0) {
        this.TryNewRound();
        return;
    }
    const dice = math.random(1, total);
    let floor = 1;
    for (const round of candidates) {
        floor += round.Chance;
        if (dice < floor) {
            this.StartRound(round);
            return;
        }
    }
};
manager.RestartRound = function (): void {
    this.SetTimer(cvars.Number("zp_newround_delay", 10), () => this.TryNewRound());
    this.SetRoundState(ROUND_RESTARTING);
    hook.Call("ZPRestartRound");
};
manager.EndRound = function (reason): void {
    net.Start("SendRoundEnd");
    net.WriteInt(reason, 4);
    net.Broadcast();
    const phrase = reason === ZOMBIES_WIN ? "ZombiesWin" : reason === HUMANS_WIN ? "HumansWin" : "RoundDraw";
    for (const ply of (player.GetAll() as ZPServerPlayer[]))
        SendNotifyMessage(ply, { Phrase: "zombieplague." + string.lower(phrase) }, 5, Color(0, 255, 0));
    const sound = SafeTableRandom(reason === ZOMBIES_WIN ? ZombieWinSounds : reason === HUMANS_WIN ? HumanWinSounds : DrawSounds);
    if (sound)
        BroadcastSound(sound);
    if (this.RoundsLeft() > 0) {
        this.SetRoundState(ROUND_ENDING);
        this.SetTimer(cvars.Number("zp_newround_delay", 10), () => this.TryNewRound());
    }
    else
        ZPVoteMap.StartVotemap(ALLOWED_PREFIX);
    hook.Call("ZPEndRound", GAMEMODE, reason);
};
manager.StartRound = function (round, selected): void {
    hook.Call("ZPPreNewRound", GAMEMODE, round);
    round.StartFunction(selected);
    this.SetSpecialRound(round.SpecialRound ?? false);
    this.SetRespawn(round.Respawn ?? false);
    const sound = round.StartSound && SafeTableRandom(round.StartSound);
    if (sound)
        BroadcastSound(sound);
    this.SetTimer(cvars.Number("zp_round_time", 300), () => this.EndRound(ROUND_DRAW));
    this.SetRound(this.GetRound() + 1);
    this.SetRoundState(ROUND_PLAYING);
    this.RoundPlaying = round;
    hook.Call("ZPNewRound", GAMEMODE, round, this.GetRound());
};
