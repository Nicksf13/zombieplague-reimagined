const rounds = RoundManager as ZPServerRoundManager;
ConvarManager.CreateConVar("zp_can_repeat_map", 1, 8, "Allow extending the current map");
ConvarManager.CreateConVar("zp_rounds_to_extend", 10, 8, "Extra rounds when extending the map");
ConvarManager.CreateConVar("zp_notify_rounds_left", 1, 8, "Notify players about remaining rounds");
export class VoteMapManager implements ZPVoteMapManager {
    MapsToVote: Record<string, number> = {};
    Voting: boolean = false;
    Voters: Record<string, boolean> = {};
    StartVotemap(prefixes: string[]): void {
        const candidates: Record<string, number> = {};
        const [maps] = file.Find("maps/*.bsp", "GAME"), current = game.GetMap();
        table.RemoveByValue(maps, current + ".bsp");
        let count = 0;
        if (cvars.Bool("zp_can_repeat_map", true)) {
            candidates[current] = 0;
            count++;
        }
        while (maps.length > 0 && count < cvars.Number("zp_maps_to_vote", 7)) {
            const filename = maps.splice(math.random(1, maps.length) - 1, 1)[0];
            if (!filename)
                continue;
            const map = string.sub(filename, 1, -5);
            if (prefixes.some(prefix => string.StartWith(map, prefix))) {
                candidates[map] = 0;
                count++;
            }
        }
        this.MapsToVote = candidates;
        this.Voters = {};
        if (count === 0) {
            // No usable map exists: keep the server playable instead of indexing an empty vote.
            rounds.AddExtraRounds(cvars.Number("zp_rounds_to_extend", 5));
            rounds.SetTimer(5, () => rounds.TryNewRound());
            return;
        }
        this.Voting = true;
        rounds.SetRoundState(ROUND_VOTEMAP);
        rounds.SetTimer(10, () => this.EndVotemap());
    }
    EndVotemap(): void {
        this.Voting = false;
        const results: {
            Map: string;
            Votes: number;
        }[] = [];
        for (const [map, votes] of pairs(this.MapsToVote))
            results.push({ Map: map, Votes: votes });
        results.sort((a, b) => b.Votes - a.Votes);
        const winner = results[0];
        if (!winner)
            return;
        let phrase = "NoticeVotemapEnded", replacement = winner.Map;
        if (winner.Map === game.GetMap()) {
            phrase = "NoticeVotemapProlong";
            replacement = cvars.String("zp_rounds_to_extend", "5");
            rounds.AddExtraRounds(cvars.Number("zp_rounds_to_extend", 5));
            rounds.SetTimer(5, () => rounds.TryNewRound());
        }
        else {
            rounds.SetRoundState(ROUND_CHANGING_MAP);
            rounds.SetTimer(5, () => RunConsoleCommand("changelevel", winner.Map));
        }
        for (const ply of player.GetAll() as ZPServerPlayer[])
            SendColorMessage(ply, { Phrase: "zombieplague." + string.lower(phrase), Arguments: [replacement] }, Color(0, 255, 0));
    }
}
const voteMap = new VoteMapManager();
_G.ZPVoteMap = voteMap;
const notify = (ply: ZPServerPlayer): void => {
    const left = rounds.RoundsLeft();
    SendColorMessage(ply, left > 0 ? { Phrase: "zombieplague.roundsleft", Arguments: [left] } : { Phrase: "zombieplague.finalround" }, left > 0 ? Color(0, 255, 0) : Color(255, 0, 0));
};
Commands.AddCommand("rounds_left", "Check how many rounds are left.", notify);
hook.Add("ZPNewRound", "zp_round_start_notify_rounds_left", () => {
    if (cvars.Bool("zp_notify_rounds_left", true))
        for (const ply of player.GetAll() as ZPServerPlayer[])
            notify(ply);
});
