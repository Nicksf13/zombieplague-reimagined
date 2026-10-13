export {};
export class ClassMenuController implements ZPClassMenuController {
    private opened = false;
    private automatic = false;
    private kind: ZPClassMenuKind = "human";
    private preview = "";
    private snapshot: ZPClassMenuSnapshot | undefined;
    private presentation: ZPClassMenuPresentation | undefined;
    private pending: { ID: number; Deadline: number; OpenID: number } | undefined;
    private openID = 0;
    private sequence = 0;
    private feedback = "zombieplague.classclass";

    GetState(): ZPClassMenuState {
        const state = { Open: this.opened, Automatic: this.automatic, Kind: this.kind, Preview: this.preview, Pending: this.pending !== undefined, Feedback: this.feedback };
        return this.snapshot ? { ...state, Snapshot: { Entries: this.snapshot.Entries.map(entry => ({ ...entry })),
            Selected: { ...this.snapshot.Selected }, First: { ...this.snapshot.First } } } : state;
    }

    private Update(): void { if (this.opened) this.presentation?.Update(this.GetState()); }

    Open(kind?: ZPClassMenuKind, automatic: boolean = false): void {
        _G.ZPMapVoteMenu?.Close();
        if (kind !== undefined && !ZPClassMenuProtocol.Kind(kind)) return;
        _G.ZPExtraMenu?.Close();
        ZPWeaponMenu.Close(); ZPMainMenu.Close(); _G.ZPAdminMenu?.Close(); _G.ZPSettings?.Close();
        this.kind = kind ?? (LocalPlayer().IsHuman() ? "human" : "zombie");
        this.automatic = automatic;
        this.openID++;
        this.opened = true;
        this.ResetPreview();
        this.Rebuild(); this.Refresh();
    }

    Rebuild(): void {
        if (!this.opened) return;
        this.presentation?.Destroy();
        const theme = ZPThemes.GetTheme();
        if (theme) {
            this.presentation = theme.CreateClassMenu ? theme.CreateClassMenu() :
                ZPCreateClassMenuHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16");
            this.presentation.Open(this.GetState(), this);
        }
    }

    Close(): void {
        this.opened = false; this.automatic = false;
        this.presentation?.Destroy(); this.presentation = undefined;
    }

    private ResetPreview(): void {
        const entries = this.snapshot?.Entries.filter(entry => entry.Kind === this.kind) ?? [];
        this.preview = entries.find(entry => entry.ID === this.snapshot?.Selected[this.kind])?.ID ?? entries[0]?.ID ?? "";
    }

    SetKind(kind: ZPClassMenuKind): void {
        if (!ZPClassMenuProtocol.Kind(kind) || this.pending || (this.automatic && kind !== this.kind)) return;
        this.kind = kind; this.ResetPreview(); this.Update();
    }

    Preview(id: string): void {
        if (!this.pending && this.snapshot?.Entries.some(entry => entry.Kind === this.kind && entry.ID === id)) {
            this.preview = id; this.Update();
        }
    }

    private Begin(): number {
        this.sequence = this.sequence >= 2147483647 ? 1 : this.sequence + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5, OpenID: this.openID };
        this.feedback = "zombieplague.weaponmenuwaiting"; this.Update();
        return this.sequence;
    }

    Refresh(): void {
        if (this.pending) return;
        const id = this.Begin();
        net.Start("ZPClassMenuCatalog"); net.WriteUInt(1, 8); net.WriteUInt(id, 31); net.SendToServer();
    }

    Confirm(): void {
        if (!this.opened || this.pending || !this.snapshot?.Entries.some(entry => entry.Kind === this.kind && entry.ID === this.preview)) return;
        const request: ZPClassMenuRequest = { Version: 1, RequestID: this.Begin(), Kind: this.kind, ID: this.preview };
        net.Start("ZPClassMenuSelect"); net.WriteTable(request); net.SendToServer();
    }

    Receive(reply: ZPClassMenuReply): void {
        // Selection results only close the opening that submitted the request.
        if (reply.RequestID !== this.pending?.ID) return;
        const currentOpening = this.pending.OpenID === this.openID;
        this.pending = undefined;
        if (reply.Snapshot) { this.snapshot = reply.Snapshot; this.ResetPreview(); }
        this.feedback = reply.Code === "invalid" ? "zombieplague.classmenuinvalid" :
            reply.Code === "rate_limited" ? "zombieplague.weaponmenuratelimited" : "zombieplague.classclass";
        if (currentOpening && (reply.Code === "applied" || reply.Code === "saved")) this.Close();
        this.Update();
    }

    Select(id: string): void {
        if (!this.opened || this.pending || !this.snapshot?.Entries.some(entry => entry.Kind === this.kind && entry.ID === id)) return;
        this.preview = id;
        this.Confirm();
    }

    Tick(): void {
        if (this.opened && this.automatic) {
            const ply = LocalPlayer();
            if (!IsValid(ply) || !ply.Alive() || ply.Team() !== (this.kind === "human" ? TEAM_HUMANS : TEAM_ZOMBIES)) this.Close();
        }
        if (this.opened && input.IsKeyDown(KEY_ESCAPE)) this.Close();
        if (this.pending && CurTime() >= this.pending.Deadline) {
            this.pending = undefined; this.feedback = "zombieplague.weaponmenutimeout"; this.Update();
        }
    }
}
const controller = new ClassMenuController();
_G.ZPClassMenu = controller;
net.Receive("ZPClassMenuReply", length => {
    if (length > 524000) return;
    const reply = ZPClassMenuProtocol.Reply(net.ReadTable());
    if (reply) controller.Receive(reply);
});
net.Receive("ZPClassMenuOpen", () => controller.Open());
net.Receive("ZPClassMenuMissing", length => {
    if (length > 128) return;
    const kind = net.ReadString(), ply = LocalPlayer();
    if (ZPClassMenuProtocol.Kind(kind) && IsValid(ply) && ply.Alive() &&
        ply.Team() === (kind === "human" ? TEAM_HUMANS : TEAM_ZOMBIES)) controller.Open(kind, true);
});
hook.Add("Think", "ZPClassMenuController", () => controller.Tick());
concommand.Add("zp_classes", () => { if (controller.GetState().Open) controller.Close(); else controller.Open(); });
