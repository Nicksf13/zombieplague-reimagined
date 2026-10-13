export {};
export class ExtraMenuController implements ZPExtraMenuController {
    private opened = false;
    private observedTeam: ZPExtraMenuSnapshot["Team"] = "spectator";
    private snapshot: ZPExtraMenuSnapshot | undefined;
    private presentation: ZPExtraMenuPresentation | undefined;
    private pending: { ID: number; Deadline: number } | undefined;
    private sequence = 0;
    private nextRefresh = 0;
    private feedback = "zombieplague.mainmenuextrasdescription";

    private Team(): ZPExtraMenuSnapshot["Team"] {
        const ply = LocalPlayer();
        if (!IsValid(ply)) return "spectator";
        return ply.Team() === TEAM_HUMANS ? "human" : ply.Team() === TEAM_ZOMBIES ? "zombie" : "spectator";
    }
    GetState(): ZPExtraMenuState {
        const kind = this.Team();
        const state = { Open: this.opened, Kind: kind, Pending: this.pending !== undefined, Feedback: this.feedback };
        return this.snapshot ? { ...state, Snapshot: { ...this.snapshot,
            // Hide stale catalogs as soon as the local team changes, including pending requests.
            Entries: this.snapshot.Team === kind ? this.snapshot.Entries.filter(entry => entry.Kind === kind).map(entry => ({ ...entry })) : [] } } : state;
    }
    private Update(): void { if (this.opened) this.presentation?.Update(this.GetState()); }
    Open(): void {
        ZPMainMenu.Close(); ZPWeaponMenu.Close(); _G.ZPClassMenu?.Close(); _G.ZPAdminMenu?.Close(); _G.ZPSettings?.Close();
        if (this.opened) return;
        this.opened = true;
        this.observedTeam = this.Team();
        this.Rebuild(); this.Refresh();
    }
    Close(): void { this.opened = false; this.presentation?.Destroy(); this.presentation = undefined; }
    Rebuild(): void {
        if (!this.opened) return;
        this.presentation?.Destroy();
        const theme = ZPThemes.GetTheme();
        if (theme) {
            this.presentation = theme.CreateExtraMenu ? theme.CreateExtraMenu() :
                ZPCreateExtraMenuHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16");
            this.presentation.Open(this.GetState(), this);
        }
    }
    SetKind(kind: ZPExtraMenuKind): void {
        // Keep the presentation API, but categories always follow the player's actual team.
        if (kind === this.Team() && !this.pending) this.Update();
    }
    private Begin(): number {
        this.sequence = this.sequence >= 2147483647 ? 1 : this.sequence + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 };
        this.feedback = "zombieplague.weaponmenuwaiting"; this.Update();
        return this.sequence;
    }
    Refresh(): void {
        if (this.pending) return;
        const id = this.Begin();
        net.Start("ZPExtraMenuCatalog"); net.WriteUInt(1, 8); net.WriteUInt(id, 31); net.SendToServer();
    }
    Buy(id: string): void {
        const ply = LocalPlayer(), kind = this.Team();
        if (!this.opened || this.pending || !ZPExtraMenuProtocol.Kind(kind) || !IsValid(ply) || !ply.Alive() || this.snapshot?.Team !== kind ||
            !this.snapshot.Entries.some(entry => entry.Kind === kind && entry.ID === id && entry.Availability === "available")) return;
        const request: ZPExtraMenuRequest = { Version: 1, RequestID: this.Begin(), Kind: kind, ID: id };
        net.Start("ZPExtraMenuBuy"); net.WriteTable(request); net.SendToServer();
    }
    Receive(reply: ZPExtraMenuReply): void {
        if (reply.RequestID !== this.pending?.ID) return;
        this.pending = undefined;
        if (reply.Snapshot) this.snapshot = reply.Snapshot;
        this.feedback = reply.Code === "bought" ? "zombieplague.extramenubought" : reply.Code === "invalid_item" ? "zombieplague.extraitemchoose" :
            reply.Code === "restricted" ? "zombieplague.extraitemcantbuy" : reply.Code === "insufficient" ? "zombieplague.extraitemenought" :
            reply.Code === "rate_limited" ? "zombieplague.weaponmenuratelimited" : "zombieplague.mainmenuextrasdescription";
        this.nextRefresh = CurTime() + (this.snapshot && this.snapshot.Team !== this.Team() ? 0.3 : 2);
        this.Update();
    }
    Tick(): void {
        if (this.opened && input.IsKeyDown(KEY_ESCAPE)) this.Close();
        if (this.opened && this.observedTeam !== this.Team()) {
            this.observedTeam = this.Team();
            this.Update();
            this.nextRefresh = Math.min(this.nextRefresh, CurTime() + 0.3);
        }
        if (this.pending && CurTime() >= this.pending.Deadline) {
            this.pending = undefined; this.nextRefresh = CurTime() + 2;
            this.feedback = "zombieplague.weaponmenutimeout"; this.Update();
        }
        // Availability can change with balances, deaths and round-specific item rules.
        if (this.opened && !this.pending && CurTime() >= this.nextRefresh) this.Refresh();
    }
}
const controller = new ExtraMenuController();
_G.ZPExtraMenu = controller;
net.Receive("ZPExtraMenuReply", length => {
    if (length > 524000) return;
    const reply = ZPExtraMenuProtocol.Reply(net.ReadTable());
    if (reply) controller.Receive(reply);
});
net.Receive("ZPExtraMenuOpen", () => controller.Open());
hook.Add("Think", "ZPExtraMenuController", () => controller.Tick());
concommand.Add("zp_extras", () => { if (controller.GetState().Open) controller.Close(); else controller.Open(); });
