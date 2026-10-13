export {};
interface PendingRequest { ID: number; Deadline: number; }

export class WeaponMenuController implements ZPWeaponMenuController {
    private presentations: Record<string, ZPWeaponMenuPresentationFactory | undefined> = {};
    private presentation: ZPWeaponMenuPresentation | undefined;
    private presentationID: string = "classic";
    private opened: boolean = false;
    private automatic: boolean = false;
    private category: ZPWeaponMenuCategory = "primary";
    private snapshot: ZPWeaponMenuSnapshot | undefined;
    private pending: PendingRequest | undefined;
    private sequence: number = 0;
    private feedback: string = "zombieplague.weaponmenuready";

    RegisterPresentation(id: string, factory: ZPWeaponMenuPresentationFactory): void {
        if (typeof id === "string" && id.length > 0 && !this.presentations[id])
            this.presentations[id] = factory;
    }

    // Detached data prevents a presentation from editing the controller's snapshot.
    GetState(): ZPWeaponMenuState {
        const state = { Open: this.opened, Category: this.category, Presentation: this.presentationID,
            Pending: this.pending !== undefined, Feedback: this.feedback };
        if (!this.snapshot)
            return state;
        return { ...state, Snapshot: { Entries: this.snapshot.Entries.map(entry => ({ ...entry })),
            Selected: { ...this.snapshot.Selected }, CanReceive: { ...this.snapshot.CanReceive }, Truncated: this.snapshot.Truncated } };
    }

    private Update(): void {
        if (this.opened)
            this.presentation?.Update(this.GetState());
    }

    UsePresentation(id: string): void {
        const factory = this.presentations[id];
        if (!factory)
            return;
        this.presentation?.Destroy();
        this.presentation = undefined;
        this.presentationID = id;
        ZPThemes.UseTheme(id);
        if (this.opened) {
            this.presentation = factory();
            this.presentation.Open(this.GetState(), this);
        }
    }

    Open(): void {
        _G.ZPAdminMenu?.Close();
        _G.ZPSettings?.Close();
        ZPMainMenu.Close();
        if (this.opened)
            return;
        this.opened = true;
        this.UsePresentation(this.presentationID);
        this.Refresh();
    }

    OpenMissing(kind: ZPWeaponMenuCategory): void {
        if (!ZPWeaponMenuProtocol.Category(kind))
            return;
        this.category = kind;
        this.Open();
        this.automatic = true;
        this.Refresh();
        this.Update();
    }

    Close(): void {
        this.opened = false;
        this.automatic = false;
        this.presentation?.Destroy();
        this.presentation = undefined;
        // A network request survives closing or changing HUD; its result never reopens it.
    }

    Toggle(): void { if (this.opened) this.Close(); else this.Open(); }

    SetCategory(kind: ZPWeaponMenuCategory): void {
        if (!ZPWeaponMenuProtocol.Category(kind))
            return;
        this.category = kind;
        this.Update();
    }

    private Begin(): number {
        this.sequence = this.sequence >= 2147483647 ? 1 : this.sequence + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 };
        this.feedback = "zombieplague.weaponmenuwaiting";
        this.Update();
        return this.sequence;
    }

    Refresh(): void {
        if (this.pending)
            return;
        const id = this.Begin();
        net.Start("ZPWeaponMenuCatalog");
        net.WriteUInt(1, 8);
        net.WriteUInt(id, 31);
        net.SendToServer();
    }

    Select(id: string): void {
        if (this.pending || !this.snapshot || !this.snapshot.Entries.some(entry => entry.Kind === this.category && entry.ID === id))
            return;
        const kind = this.category;
        const request: ZPWeaponMenuRequest = { Version: 1, RequestID: this.Begin(), Kind: kind, ID: id };
        net.Start("ZPWeaponMenuSelect");
        net.WriteTable(request);
        net.SendToServer();
    }

    Receive(reply: ZPWeaponMenuReply): void {
        if (reply.RequestID !== this.pending?.ID)
            return;
        this.pending = undefined;
        if (reply.Snapshot)
            this.snapshot = reply.Snapshot;
        const code = reply.Code === "catalog" ? "ready" : reply.Code === "invalid_weapon" ? "invalidweapon" :
            reply.Code === "rate_limited" ? "ratelimited" : reply.Code;
        this.feedback = "zombieplague.weaponmenu" + code;
        // Advance only after the server confirms the catalog or a saved choice.
        if (this.opened && this.automatic && reply.Snapshot) {
            const missing = (["primary", "secondary", "melee"] as const).find(kind =>
                reply.Snapshot?.Selected[kind] === "" && reply.Snapshot.Entries.some(entry => entry.Kind === kind));
            if (missing)
                this.category = missing;
            else
                this.Close();
        }
        this.Update();
    }

    Tick(): void {
        if (this.opened && this.automatic) {
            const ply = LocalPlayer();
            if (!IsValid(ply) || !ply.Alive() || !ply.IsHuman())
                this.Close();
        }
        if (this.opened && input.IsKeyDown(KEY_ESCAPE))
            this.Close();
        if (this.pending && CurTime() >= this.pending.Deadline) {
            this.pending = undefined;
            this.feedback = "zombieplague.weaponmenutimeout";
            this.Update();
        }
    }
}

const controller = new WeaponMenuController();
_G.ZPWeaponMenu = controller;
net.Receive("ZPWeaponMenuReply", length => {
    if (length > 524000)
        return;
    const reply = ZPWeaponMenuProtocol.Reply(net.ReadTable());
    if (reply)
        controller.Receive(reply);
});
net.Receive("ZPWeaponMenuOpen", () => controller.Open());
net.Receive("ZPWeaponMenuMissing", length => {
    if (length > 128)
        return;
    const kind = net.ReadString(), ply = LocalPlayer();
    if (ZPWeaponMenuProtocol.Category(kind) && IsValid(ply) && ply.Alive() && ply.IsHuman())
        controller.OpenMissing(kind);
});
hook.Add("Think", "ZPWeaponMenuController", () => controller.Tick());
concommand.Add("zp_weapons", () => controller.Toggle());
for (const id of ["classic", "hl2", "cs16"])
    concommand.Add("zp_weapon_hud_" + id, () => { controller.UsePresentation(id); controller.Open(); });
