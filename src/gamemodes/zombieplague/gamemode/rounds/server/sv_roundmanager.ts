export {};
const manager = RoundManager as ZPServerRoundManager;
for (const [name, value, description] of [
    ["zp_min_players", 2, "Minimum players to start a round"],
    ["zp_newround_delay", 10, "Delay before a new round"],
    ["zp_infection_delay", 10, "Delay before infection"],
    ["zp_freeze_time_delay", 10, "Freeze time before a round"],
    ["zp_max_rounds", 10, "Rounds before the map vote"],
    ["zp_round_time", 300, "Round duration"],
    ["zp_should_winning_reward", 1, "Reward round winners"],
    ["zp_winning_reward_prize", 5, "Winner ammo pack reward"],
] as const)
    ConvarManager.CreateConVar(name, value, 8, description);
manager.Rounds = {};
manager.PlayersToPlay = [];
manager.ExtraRounds = 0;
manager.PlayersToReward = { [TEAM_HUMANS]: [], [TEAM_ZOMBIES]: [] };
include("sv_round_players.lua");
include("sv_round_defaults.lua");
include("sv_round_lifecycle.lua");
manager.SearchRounds = function (): void {
    this.AddDefaultRounds();
    // Custom round files register themselves through AddRoundType(id, definition).
    for (const [, path] of pairs(Utils.RecursiveFileSearch("zombieplague/gamemode/rounds", ".lua")))
        include(path);
};
manager.AddExtraRounds = function (amount): void { this.ExtraRounds += amount; };
manager.AddRoundType = function (id, round): void {
    this.Rounds[id] = round;
    for (const sound of round.StartSound ?? [])
        resource.AddFile("sound/" + sound);
};
manager.GetServerStatus = function (): ZPServerStatus {
    return { Timer: this.GetTime(), RoundState: this.GetRoundState(), Round: this.GetRound(),
        Players: this.GetPlayersToPlay().map(ply => ({
            ID: PlayerManager.GetPlayerID(ply), AmmoPacks: ply.GetAmmoPacks(), Battery: ply.GetMaxBatteryCharge(),
            ZombieClass: ply.GetZombieClass().Name, HumanClass: ply.GetHumanClass().Name,
            Light: ply.GetLight(), Footstep: ply.GetFootstep(), AbilityPower: ply.GetAbilityPower(), MaxAbilityPower: ply.GetMaxAbilityPower(),
        })),
    };
};
manager.RoundsLeft = function (): number { return cvars.Number("zp_max_rounds", 10) + this.ExtraRounds - this.GetRound(); };
manager.GetCurrentRoundPlaying = function (): ZPRoundDefinition | undefined { return this.RoundPlaying; };
manager.GetRounds = function (): Record<string, ZPRoundDefinition> { return this.Rounds; };
manager.GetGoodRounds = function (): Record<string, ZPRoundDefinition> {
    const result: Record<string, ZPRoundDefinition> = {}, count = this.CountPlayersToPlayAlive();
    for (const [id, round] of pairs(this.Rounds))
        if (count >= round.MinPlayers)
            result[id] = round;
    return result;
};
manager.ShouldRoundEnd = function (): boolean { return this.NoHumans() || this.NoZombies(); };
hook.Add("PostPlayerDeath", "RoundEndCheck", ply => {
    if (manager.GetRoundState() !== ROUND_PLAYING)
        return;
    const round = manager.GetCurrentRoundPlaying();
    round?.OnDeathFunction?.(ply);
    timer.Create("ZPEndRound" + tostring(CurTime()), 0.1, 1, () => manager.CheckRoundEnd());
});
hook.Add("ZPPrePreparingRound", "ZPPrePreparingRoundWinnerClean", () => {
    manager.PlayersToReward = { [TEAM_HUMANS]: [], [TEAM_ZOMBIES]: [] };
});
hook.Add("ZPEndRound", "ZPEndRoundWinnerReward", reason => {
    if (!cvars.Bool("zp_should_winning_reward", true) || reason === ROUND_DRAW)
        return;
    const team = reason === ZOMBIES_WIN ? TEAM_ZOMBIES : TEAM_HUMANS;
    for (const id of manager.PlayersToReward[team] ?? [])
        manager.ReturnValidPlayerToBeRewardedOrNil(id, team)?.GiveAmmoPacks(cvars.Number("zp_winning_reward_prize", 5));
});
for (const name of ["SyncTimer", "SendRoundEnd"])
    util.AddNetworkString(name);
