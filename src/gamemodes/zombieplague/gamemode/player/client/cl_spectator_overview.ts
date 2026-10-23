export {};
const { SpectatorOverviewHUD } = include("cl_spectator_overview_hud.lua") as typeof import("./cl_spectator_overview_hud");

class SpectatorOverview implements ZPSpectatorOverviewClient {
    private state: ZPSpectatorSnapshot | undefined;
    private updated = -10;
    private presentation: ZPSpectatorOverviewPresentation | undefined;
    private theme = "";
    private overview: ZPRadarOverview | undefined;
    private width = 0;
    private height = 0;
    private blockUntil = -10;

    GetSnapshot(): ZPSpectatorSnapshot | undefined { return this.IsOpen() ? this.state : undefined; }
    IsOpen(): boolean {
        const ply = LocalPlayer();
        return this.state?.Active === true && IsValid(ply) && !ply.Alive() && ply.Team() === this.state.Team &&
            CurTime() - this.updated <= 1.5 && ZPRadar.GetOverview() !== undefined;
    }
    Receive(raw: unknown): void {
        const state = ZPSpectatorProtocol.Snapshot(raw);
        if (!state) return;
        this.state = state; this.updated = CurTime();
        this.Tick();
    }
    Follow(id: number): void {
        if (!this.IsOpen() || !ZPRadarRules.Finite(id, 0, 65535) || id % 1 !== 0) return;
        if (id !== 0 && !this.state?.Contacts.some(contact => contact.ID === id)) return;
        net.Start("ZPSpectatorOverviewFollow"); net.WriteUInt(id, 16); net.SendToServer();
        // Keep the view until the authoritative reply; rejected/stale clicks do not strand the camera.
        this.blockUntil = CurTime() + 0.3;
    }
    Tick(): void {
        if (!this.IsOpen()) {
            this.presentation?.Destroy(); this.presentation = undefined;
            this.state = undefined;
            return;
        }
        const theme = ZPThemes.GetTheme(), overview = ZPRadar.GetOverview();
        if (!theme || !overview) return;
        if (this.presentation && (this.theme !== ZPThemes.GetActiveID() || this.width !== ScrW() || this.height !== ScrH() || this.overview !== overview)) {
            this.presentation.Destroy(); this.presentation = undefined;
        }
        if (!this.presentation) {
            this.theme = ZPThemes.GetActiveID(); this.width = ScrW(); this.height = ScrH();
            this.overview = overview;
            this.presentation = new SpectatorOverviewHUD(theme.Palette, this.theme === "hl2" || this.theme === "cs16");
            this.presentation.Open(this, overview);
        }
    }
    Filter(command: ZPClientUserCommand): void {
        if (!this.IsOpen() && CurTime() >= this.blockUntil) return;
        command.ClearButtons(); command.ClearMovement();
    }
}

const overview = new SpectatorOverview();
_G.ZPSpectatorOverview = overview;
net.Receive("ZPSpectatorOverviewState", length => { if (length <= 524288) overview.Receive(net.ReadTable()); });
hook.Add("Think", "ZPSpectatorOverview", () => overview.Tick());
hook.Add("CreateMove", "ZPSpectatorOverview", command => overview.Filter(command));
hook.Add("PlayerBindPress", "ZPSpectatorOverview", (_ply, bind, pressed) => {
    if (overview.IsOpen() && pressed && bind === "+jump" && !gui.IsGameUIVisible() && !gui.IsConsoleVisible()) {
        overview.Follow(0); return true;
    }
});
