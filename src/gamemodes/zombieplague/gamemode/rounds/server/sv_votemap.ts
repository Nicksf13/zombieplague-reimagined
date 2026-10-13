const rounds = RoundManager as ZPServerRoundManager;
ConvarManager.CreateConVar("zp_can_repeat_map", 1, 8, "Allow extending the current map");
ConvarManager.CreateConVar("zp_rounds_to_extend", 10, 8, "Extra rounds when extending the map");
ConvarManager.CreateConVar("zp_notify_rounds_left", 1, 8, "Notify players about remaining rounds");
export class VoteMapManager implements ZPVoteMapManager {
    MapsToVote: Record<string, number> = {};
    Voting: boolean = false;
    Voters: Record<string, boolean> = {};
    private choices: Record<string, string | undefined> = {};
    private nextVote: Record<string, number | undefined> = {};
    private order: string[] = [];
    private sequence = 0;
    private deadline = 0;
    private winner = "";
    StartVotemap(prefixes: string[]): void {
        if (this.Voting || RoundManager.GetRoundState() === ROUND_CHANGING_MAP) return;
        const candidates: Record<string, number> = {};
        const limit = Math.max(1, Math.min(8, Math.floor(cvars.Number("zp_maps_to_vote", 8))));
        this.order = ZPMapNominations.Candidates(prefixes, limit);
        for (const map of this.order) candidates[map] = 0;
        if (cvars.Bool("zp_can_repeat_map", true)) {
            candidates[game.GetMap()] = 0;
            this.order.push(game.GetMap());
        }
        this.MapsToVote = candidates;
        this.Voters = {};
        this.choices = {}; this.nextVote = {}; this.winner = "";
        ZPMapNominations.Clear();
        if (this.order.length === 0) {
            // No usable map exists: keep the server playable instead of indexing an empty vote.
            rounds.AddExtraRounds(cvars.Number("zp_rounds_to_extend", 5));
            rounds.SetTimer(5, () => rounds.TryNewRound());
            return;
        }
        this.Voting = true;
        this.sequence = this.sequence >= 2147483647 ? 1 : this.sequence + 1;
        this.deadline = CurTime() + 20;
        rounds.SetRoundState(ROUND_VOTEMAP);
        rounds.SetTimer(20, () => this.EndVotemap());
        this.SendSnapshot();
    }
    SendSnapshot(ply?: ZPServerPlayer): void {
        const entries = this.order.map(map => ({ Map: map, Votes: this.MapsToVote[map] ?? 0, Extend: map === game.GetMap() }));
        for (const recipient of ply ? [ply] : player.GetAll() as ZPServerPlayer[]) {
            if (!IsValid(recipient) || recipient.IsBot()) continue;
            const snapshot: ZPMapVoteSnapshot = { Version: 1, ID: this.sequence, Voting: this.Voting,
                Remaining: Math.max(0, this.deadline - CurTime()), Entries: entries,
                Selected: this.choices[recipient.SteamID64()] ?? "", Winner: this.winner };
            net.Start("ZPMapVoteSnapshot"); net.WriteTable(snapshot); net.Send(recipient);
        }
    }
    Vote(ply: ZPServerPlayer, request: ZPMapVoteRequest): void {
        if (!this.Voting || CurTime() >= this.deadline || request.ID !== this.sequence || !IsValid(ply) || ply.IsBot() ||
            this.MapsToVote[request.Map] === undefined) return;
        const id = ply.SteamID64(), previous = this.choices[id];
        if (CurTime() < (this.nextVote[id] ?? 0) || previous === request.Map) return;
        this.nextVote[id] = CurTime() + 0.25;
        if (previous) this.MapsToVote[previous] = Math.max(0, (this.MapsToVote[previous] ?? 0) - 1);
        this.MapsToVote[request.Map] = (this.MapsToVote[request.Map] ?? 0) + 1;
        this.choices[id] = request.Map; this.Voters[id] = true;
        this.SendSnapshot();
    }
    Remove(ply: ZPServerPlayer): void {
        const id = ply.SteamID64(), previous = this.choices[id];
        delete this.choices[id]; delete this.Voters[id]; delete this.nextVote[id];
        if (this.Voting && previous) {
            this.MapsToVote[previous] = Math.max(0, (this.MapsToVote[previous] ?? 0) - 1);
            this.SendSnapshot();
        }
    }
    EndVotemap(): void {
        if (!this.Voting) return;
        this.Voting = false;
        const results: {
            Map: string;
            Votes: number;
        }[] = [];
        for (const [map, votes] of pairs(this.MapsToVote))
            results.push({ Map: map, Votes: votes });
        results.sort((a, b) => b.Votes - a.Votes);
        const best = results[0]?.Votes;
        const tied = results.filter(result => result.Votes === best);
        const winner = tied.length > 0 ? tied[math.random(1, tied.length) - 1] : undefined;
        if (!winner)
            return;
        this.winner = winner.Map;
        this.deadline = CurTime() + 5;
        this.SendSnapshot();
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
util.AddNetworkString("ZPMapVoteSnapshot");
util.AddNetworkString("ZPMapVoteSelect");
util.AddNetworkString("ZPMapVoteOpen");
net.Receive("ZPMapVoteSelect", (length, ply) => {
    if (length > 4096) return;
    const request = ZPMapVoteProtocol.Request(net.ReadTable());
    if (request) voteMap.Vote(ply, request);
});
hook.Add("ZPPlayerEnvironmentReady", "ZPMapVoteReady", ply => voteMap.SendSnapshot(ply as ZPServerPlayer));
hook.Add("PlayerDisconnected", "ZPMapVoteDisconnect", ply => voteMap.Remove(ply as ZPServerPlayer));
Commands.AddCommand("votemap", "zombieplague.mapvotecommand", ply => {
    voteMap.SendSnapshot(ply);
    net.Start("ZPMapVoteOpen"); net.Send(ply);
});
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
