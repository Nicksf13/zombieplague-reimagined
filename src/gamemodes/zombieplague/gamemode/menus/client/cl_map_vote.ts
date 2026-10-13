export {};
export class MapVoteController implements ZPMapVoteController {
    private snapshot: ZPMapVoteSnapshot | undefined;
    private deadline = 0;
    private opened = false;
    private presentation: ZPMapVotePresentation | undefined;
    private nextVote = 0;

    GetSnapshot(): ZPMapVoteSnapshot | undefined {
        return this.snapshot ? { ...this.snapshot, Entries: this.snapshot.Entries.map(entry => ({ ...entry })) } : undefined;
    }
    GetRemaining(): number { return Math.max(0, Math.ceil(this.deadline - CurTime())); }
    Receive(snapshot: ZPMapVoteSnapshot): void {
        if (this.snapshot && snapshot.ID < this.snapshot.ID && snapshot.ID !== 1) return;
        const fresh = snapshot.ID !== this.snapshot?.ID;
        this.snapshot = snapshot; this.deadline = CurTime() + snapshot.Remaining;
        if (fresh && snapshot.Voting) { this.nextVote = 0; this.Close(); this.Open(); }
        if (!snapshot.Voting && snapshot.Winner === "") this.Close();
    }
    Open(): void {
        if (!this.snapshot || this.GetRemaining() <= 0 || this.snapshot.Entries.length === 0) return;
        ZPWeaponMenu.Close(); ZPMainMenu.Close(); _G.ZPClassMenu?.Close(); _G.ZPExtraMenu?.Close();
        _G.ZPAdminMenu?.Close(); _G.ZPSettings?.Close();
        if (this.opened) return;
        this.opened = true; this.Rebuild();
    }
    Close(): void { this.opened = false; this.presentation?.Destroy(); this.presentation = undefined; }
    Rebuild(): void {
        if (!this.opened) return;
        this.presentation?.Destroy();
        const theme = ZPThemes.GetTheme();
        if (!theme) return;
        this.presentation = theme.CreateMapVote ? theme.CreateMapVote() :
            ZPCreateMapVoteHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16");
        this.presentation.Open(this);
    }
    Select(map: string): void {
        const snapshot = this.snapshot;
        if (!this.opened || !snapshot?.Voting || this.GetRemaining() <= 0 || CurTime() < this.nextVote ||
            snapshot.Selected === map || !snapshot.Entries.some(entry => entry.Map === map)) return;
        this.nextVote = CurTime() + 0.25;
        const request: ZPMapVoteRequest = { Version: 1, ID: snapshot.ID, Map: map };
        net.Start("ZPMapVoteSelect"); net.WriteTable(request); net.SendToServer();
    }
    Tick(): void {
        if (this.opened && (input.IsKeyDown(KEY_ESCAPE) || (!this.snapshot?.Voting && this.GetRemaining() <= 0))) this.Close();
    }
}
const controller = new MapVoteController();
_G.ZPMapVoteMenu = controller;
net.Receive("ZPMapVoteSnapshot", length => {
    if (length > 32768) return;
    const snapshot = ZPMapVoteProtocol.Snapshot(net.ReadTable());
    if (snapshot) controller.Receive(snapshot);
});
net.Receive("ZPMapVoteOpen", () => controller.Open());
concommand.Add("zp_votemap", () => controller.Open());
hook.Add("Think", "ZPMapVoteMenu", () => controller.Tick());
ZPMainMenu.RegisterOption({ ID: "mapvote", Label: "zombieplague.mapvotetitle", Description: "zombieplague.mapvotehelp",
    IsVisible: () => controller.GetSnapshot()?.Voting === true, Action: () => controller.Open() });
