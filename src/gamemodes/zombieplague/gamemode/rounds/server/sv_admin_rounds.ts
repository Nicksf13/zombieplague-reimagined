export {};

interface AdminRoundsServiceContract {
    Receive(length: number, player: ZPServerPlayer): void;
    Transform(length: number, player: ZPServerPlayer): void;
    Disconnect(player: ZPPlayer): void;
}

class AdminRoundsService implements AdminRoundsServiceContract {
    private nextRequest: Record<string, { Read: number; Action: number; } | undefined> = {};
    constructor(private rounds: ZPServerRoundManager) {}

    private Accept(player: ZPServerPlayer, mutation: boolean): boolean {
        if (!IsValid(player) || !player.IsAdmin()) return false;
        const id = player.SteamID64();
        const session = this.nextRequest[id] ?? { Read: 0, Action: 0 };
        this.nextRequest[id] = session;
        // Background catalog refreshes must not consume the administrator's action budget.
        if (CurTime() < (mutation ? session.Action : session.Read)) return false;
        if (mutation) session.Action = CurTime() + 0.25;
        else session.Read = CurTime() + 0.25;
        return true;
    }

    private BeforeRound(): boolean {
        const state = this.rounds.GetRoundState();
        return state === ROUND_WAITING_PLAYERS || state === ROUND_RESTARTING || state === ROUND_STARTING_NEW_ROUND;
    }

    private Minimum(round: ZPRoundDefinition): number {
        return Math.max(2, cvars.Number("zp_min_players", 2), round.MinPlayers);
    }

    private CanStart(round: ZPRoundDefinition): boolean {
        const count = this.rounds.GetRoundState() === ROUND_STARTING_NEW_ROUND ?
            this.rounds.CountPlayersToPlayAlive() : this.rounds.CountPlayersToPlay();
        return this.BeforeRound() && count >= this.Minimum(round) && (round.ShouldBeEnabled?.() ?? true);
    }

    private Start(round: ZPRoundDefinition, selected?: ZPServerPlayer): boolean {
        if (!this.CanStart(round)) return false;
        // A prepared round keeps its current players and positions. Other idle states need the normal reset.
        if (this.rounds.GetRoundState() !== ROUND_STARTING_NEW_ROUND && !this.rounds.Prepare()) return false;
        if (selected && (!IsValid(selected) || !selected.Alive() || !this.rounds.GetPlayersToPlay(true).includes(selected))) return false;
        if (this.rounds.CountPlayersToPlayAlive() < this.Minimum(round)) return false;
        for (const player of this.rounds.GetPlayersToPlay())
            hook.Call("ZPResetAbilityEvent" + player.SteamID64(), GAMEMODE);
        this.rounds.StartRound(round, selected);
        return true;
    }

    private Reply(player: ZPServerPlayer, sequence: number, feedback: string): void {
        const entries: { ID: string; Round: ZPRoundDefinition; }[] = [];
        for (const [id, round] of pairs(this.rounds.GetRounds())) entries.push({ ID: id, Round: round });
        entries.sort((a, b) => a.Round.Order !== b.Round.Order ? a.Round.Order - b.Round.Order : a.ID < b.ID ? -1 : a.ID > b.ID ? 1 : 0);
        net.Start("ZPAdminRoundsReply");
        net.WriteUInt(1, 8); net.WriteUInt(sequence, 16); net.WriteString(feedback);
        net.WriteUInt(entries.length, 16);
        for (const entry of entries) {
            net.WriteString(entry.ID); net.WriteString(entry.Round.Name);
            net.WriteUInt(this.Minimum(entry.Round), 16); net.WriteBool(this.CanStart(entry.Round));
        }
        net.Send(player);
    }

    Receive(length: number, player: ZPServerPlayer): void {
        if (length < 25 || length > 2080 || !IsValid(player) || !player.IsAdmin()) return;
        const version = net.ReadUInt(8), sequence = net.ReadUInt(16), action = net.ReadUInt(1);
        if (version !== 1 || sequence < 1 || !this.Accept(player, action === 1)) return;
        let feedback = "";
        if (action === 1) {
            if (length < 33) return;
            const id = net.ReadString();
            const round = this.rounds.GetRounds()[id];
            feedback = id.length > 0 && id.length <= 255 && round && this.Start(round) ?
                "zombieplague.adminroundstarted" : "zombieplague.adminroundunavailable";
        }
        this.Reply(player, sequence, feedback);
    }

    Transform(length: number, player: ZPServerPlayer): void {
        if (length < 42 || length > 49 || !this.Accept(player, true)) return;
        const version = net.ReadUInt(8), role = net.ReadUInt(2), id = net.ReadUInt(32);
        if (version !== 1 || role > 2 || id < 1) return;
        // UserID identifies the connection, so stale menus cannot act on a reused entity slot (or another bot).
        const target = this.rounds.GetPlayersToPlay(true).find(entry => entry.UserID() === id && entry.IsHuman());
        let success = false;
        if (target && IsValid(target) && target.Team() !== TEAM_SPECTATOR) {
            if (role === 0 && this.rounds.IsPlayingRound()) {
                hook.Call("ZPResetAbilityEvent" + target.SteamID64(), GAMEMODE);
                target.SetSurvivor(false); target.SetNemesis(false); target.SetLight(undefined);
                target.Infect();
                this.rounds.CheckRoundEnd();
                success = true;
            } else {
                const round = this.rounds.GetRounds()[role === 0 ? "SimpleRound" : role === 1 ? "NemesisRound" : "SurvivalRound"];
                if (round) success = this.Start(round, target);
            }
        }
        if (!success) SendNotifyMessage(player, { Phrase: "zombieplague.adminroundunavailable" }, 5, Color(255, 100, 80));
    }

    Disconnect(player: ZPPlayer): void { delete this.nextRequest[player.SteamID64()]; }
}

const service = new AdminRoundsService(RoundManager as ZPServerRoundManager);
for (const name of ["ZPAdminRoundsRequest", "ZPAdminRoundsReply", "ZPAdminPlayerRound"]) util.AddNetworkString(name);
net.Receive("ZPAdminRoundsRequest", (length, player) => service.Receive(length, player));
net.Receive("ZPAdminPlayerRound", (length, player) => service.Transform(length, player));
hook.Add("PlayerDisconnected", "ZPAdminRounds", player => service.Disconnect(player));
