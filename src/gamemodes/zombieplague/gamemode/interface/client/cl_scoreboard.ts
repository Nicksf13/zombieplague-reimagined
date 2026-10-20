// Collect engine data once per refresh. Presentations receive no Player references.
export class ScoreboardController implements ZPScoreboardController {
    private opened: boolean = false;
    private presentation: ZPScoreboardPresentation | undefined;
    // Test bots have no voice stream; keep their UI state per connection instead of engine mute identity.
    private botMuted: Record<number, boolean | undefined> = {};

    GetState(): ZPScoreboardState {
        const groups: ZPScoreboardTeam[] = [
            { ID: TEAM_HUMANS, Label: "zombieplague.scoreboardtitlehumans", Players: [] },
            { ID: TEAM_ZOMBIES, Label: "zombieplague.scoreboardtitlezombies", Players: [] },
            { ID: TEAM_SPECTATOR, Label: "zombieplague.scoreboardtitlespectators", Players: [] },
        ];
        const players = player.GetAll();
        const localPlayer = LocalPlayer();
        const admin = IsValid(localPlayer) && localPlayer.IsAdmin();
        const phase = admin ? RoundManager.GetRoundState() : undefined;
        const beforeRound = admin && (phase === ROUND_WAITING_PLAYERS || phase === ROUND_RESTARTING || phase === ROUND_STARTING_NEW_ROUND);
        const teams = groups.map(group => {
            const entries: ZPScoreboardPlayer[] = [];
            for (const ply of players) {
                if (!IsValid(ply) || ply.Team() !== group.ID)
                    continue;
                entries.push({ ID: ply.UserID(), Name: ply.Name(), Points: ply.GetPoints(), Deaths: ply.Deaths(),
                    Ping: ply.Ping(), Status: group.ID === TEAM_SPECTATOR ? "spectating" : ply.Alive() ? "alive" : "dead",
                    Local: ply === localPlayer, CanMute: ply !== localPlayer, CanViewProfile: !ply.IsBot(),
                    CanInfect: admin && ply.Alive() && group.ID === TEAM_HUMANS && (beforeRound || phase === ROUND_PLAYING),
                    CanStartSpecial: beforeRound && ply.Alive() && group.ID === TEAM_HUMANS,
                    Muted: ply.IsBot() ? this.botMuted[ply.UserID()] ?? false : ply.IsMuted() });
            }
            entries.sort((a, b) => a.Points !== b.Points ? b.Points - a.Points :
                a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : a.ID - b.ID);
            return { ID: group.ID, Label: group.Label, Players: entries };
        });
        return { Open: this.opened, Theme: ZPThemes.GetActiveID(), Width: ScrW(), Height: ScrH(), Teams: teams };
    }

    Show(): void {
        if (this.opened) {
            this.Refresh();
            return;
        }
        this.opened = true;
        this.Rebuild();
        timer.Create("ScoreBoardUpdater", 0.5, 0, () => this.Refresh());
    }

    Hide(): void {
        this.opened = false;
        timer.Destroy("ScoreBoardUpdater");
        this.presentation?.Destroy();
        this.presentation = undefined;
    }

    Rebuild(): void {
        if (!this.opened)
            return;
        this.presentation?.Destroy();
        this.presentation = undefined;
        const theme = ZPThemes.GetTheme();
        if (theme) {
            this.presentation = theme.CreateScoreboard ? theme.CreateScoreboard() : ZPCreateScoreboardHUD(theme.Palette, "classic");
            this.presentation.Open(this.GetState(), this);
        }
    }

    Refresh(): void {
        if (this.opened)
            this.presentation?.Update(this.GetState());
    }

    ViewProfile(id: number): void {
        if (!this.opened)
            return;
        const ply = player.GetAll().find(entry => IsValid(entry) && entry.UserID() === id);
        if (ply && !ply.IsBot())
            ply.ShowProfile();
    }

    TransformPlayer(id: number, role: ZPAdminPlayerRole): void {
        if (!this.opened || !IsValid(LocalPlayer()) || !LocalPlayer().IsAdmin()) return;
        const entry = this.GetState().Teams.flatMap(group => group.Players).find(player => player.ID === id);
        if (!entry || (role === "zombie" ? !entry.CanInfect : !entry.CanStartSpecial)) return;
        net.Start("ZPAdminPlayerRound");
        net.WriteUInt(1, 8); net.WriteUInt(role === "zombie" ? 0 : role === "nemesis" ? 1 : 2, 2); net.WriteUInt(id, 32);
        net.SendToServer();
    }

    ToggleMute(id: number): void {
        if (!this.opened)
            return;
        // UserID identifies the connection, including bots, without reusing entity slots.
        const players = player.GetAll();
        const ply = players.find(entry => IsValid(entry) && entry.UserID() === id);
        if (!ply || ply === LocalPlayer())
            return;
        if (ply.IsBot())
            this.botMuted[id] = !(this.botMuted[id] ?? false);
        else
            ply.SetMuted(!ply.IsMuted());
        this.Refresh();
    }
}
const controller = new ScoreboardController();
_G.ZPScoreboard = controller;
GM.ScoreboardShow = function (): void { controller.Show(); };
GM.ScoreboardHide = function (): void { controller.Hide(); };
