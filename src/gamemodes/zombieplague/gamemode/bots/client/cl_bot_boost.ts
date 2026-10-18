const { BotBoostMenu } = include("cl_bot_boost_hud.lua") as typeof import("./cl_bot_boost_hud");
const world = include("cl_bot_boost_markers.lua") as typeof import("./cl_bot_boost_markers");
const preview = include("cl_bot_boost_preview.lua") as typeof import("./cl_bot_boost_preview");
const ui = include("cl_bot_boost_presentation.lua") as typeof import("./cl_bot_boost_presentation");
const { screen } = include("cl_bot_boost_screen.lua") as typeof import("./cl_bot_boost_screen");
interface EditorAction { Operation: number; ID: number; }
class BotBoostEditor implements ZPBotBoostEditor {
    private opened = false;
    private slot = 0;
    private selected = 0;
    private sequence = 0;
    private nextPoll = 0;
    private nextSend = 0;
    private data: ZPBotBoostSnapshot | undefined;
    private pending: { ID: number; Operation: number; Deadline: number } | undefined;
    private deferred: EditorAction | undefined;
    private continuation: EditorAction | undefined;
    private confirm: "discard" | "delete" | undefined;
    private menu = new BotBoostMenu();
    private feedback = "";
    private toolReady = false;
    private equipDeadline = 0;
    private escapeDown = false;
    private reloadDown = false;
    private reconcile = false;
    private editingSlot = 2;
    private Allowed(): boolean { const ply = LocalPlayer(); return IsValid(ply) && ply.IsAdmin(); }
    private Active(): boolean { const weapon = LocalPlayer().GetActiveWeapon(); return IsValid(weapon) && weapon.GetClass() === "zp_bot_boost_tool"; }
    Open(): void {
        if (!this.Allowed()) return;
        if (this.opened) { this.Show(); return; }
        this.opened = true; this.data = undefined; this.slot = 0; this.selected = 0; this.feedback = ""; this.reconcile = false;
        this.toolReady = false; this.equipDeadline = CurTime() + 5; this.Request(10, 0);
    }
    Close(): void {
        if (this.opened) this.Send(11, 0);
        screen.Restore();
        this.opened = false; this.slot = 0; this.pending = undefined; this.deferred = undefined; this.continuation = undefined; this.confirm = undefined; this.reloadDown = false; this.Hide();
    }
    private Hide(): void { this.menu.Close(); }
    private Show(): void { this.menu.Open(this.confirm ? 22 : undefined); }
    private CancelMenu(): void { this.confirm = undefined; this.continuation = undefined; this.Hide(); }
    private Back(): void {
        if (this.confirm) { this.confirm = undefined; this.continuation = undefined; this.menu.Open(1); }
        else if (!this.menu.Back()) this.Hide();
    }
    private State(): import("./cl_bot_boost_presentation").BoostViewState {
        const candidate = this.slot !== 0 && !this.menu.IsOpen() ? preview.capture(this.data?.Draft, this.slot) : undefined;
        const issue = this.data?.Issue?.Code !== "incomplete" ? this.data?.Issue : undefined;
        const state: import("./cl_bot_boost_presentation").BoostViewState = { Data: this.data, Selected: this.selected, Hovered: this.slot === 0 ? world.pick(this.data) : 0, Slot: this.slot,
            Pending: this.pending !== undefined || this.deferred !== undefined, Confirm: this.confirm,
            Status: ui.issueText(issue ?? candidate?.Issue ?? this.data?.Issue) || this.feedback || (this.data?.Editing ? ui.role(this.slot || 2) : ui.phrase("selecthint")), Menu: undefined };
        state.Menu = this.menu.View(state); return state;
    }
    private Action(operation: number, id = this.selected): void {
        if (!this.opened || !this.Allowed()) return;
        if (operation === 17) { this.Close(); return; }
        if (operation === 19 || operation === 22) { this.Back(); return; }
        if (this.pending || this.deferred) return;
        if (operation === 24) { this.menu.Choose(); return; }
        if (operation === 16) { this.confirm = "delete"; this.Show(); return; }
        if (operation === 23) { this.confirm = undefined; this.Execute(6, this.selected); return; }
        if (operation === 20) { this.confirm = undefined; this.Request(8, 0); return; }
        if (operation === 21) { this.confirm = undefined; this.Request(5, this.selected); return; }
        if (operation === 12) { this.Select(id); return; }
        if ([2, 3, 4].includes(operation)) { if (this.data?.Editing) { this.slot = operation; this.Hide(); } return; }
        this.Execute(operation === 18 ? 8 : operation, id);
    }
    private Select(id: number): void {
        if (id === 0) return;
        if (this.data?.Editing && this.selected === id) {
            if (this.slot === 0) this.slot = this.editingSlot;
            this.Hide();
        } else this.Execute(9, id);
    }
    private Execute(operation: number, id: number): void {
        if ([1, 8, 9, 12, 6, 7].includes(operation) && this.data?.Dirty) {
            this.continuation = { Operation: operation, ID: id }; this.confirm = "discard"; this.Show(); return;
        }
        this.Request(operation, id);
    }
    private Send(operation: number, id: number): void {
        this.sequence = this.sequence % 2147483647 + 1;
        net.Start("ZPBotBoostRequest"); net.WriteUInt(1, 8); net.WriteUInt(this.sequence, 31); net.WriteUInt(this.data?.Revision ?? 0, 31); net.WriteUInt(operation, 4); net.WriteUInt(id, 16); net.SendToServer();
    }
    private Request(operation: number, id = this.selected): void {
        if (!this.opened || !this.Allowed() || this.pending || (operation !== 0 && operation !== 10 && !this.data)) return;
        if (CurTime() < this.nextSend) { this.deferred = { Operation: operation, ID: id }; return; }
        this.Send(operation, id); this.nextSend = CurTime() + 0.12;
        this.pending = { ID: this.sequence, Operation: operation, Deadline: CurTime() + 3 }; this.nextPoll = CurTime() + 1;
    }
    Receive(length: number): void {
        if (!this.opened || !this.pending || length < 1 || length > 200000) return;
        const data = ZPBotBoostProtocol.Snapshot(net.ReadTable()); if (!data || data.RequestID !== this.pending.ID) return;
        const operation = this.pending.Operation; this.pending = undefined; this.data = data;
        this.selected = data.Selected ?? this.selected;
        if (data.Editing === false) this.slot = 0;
        if (!data.Points.some(point => point.ID === this.selected)) this.selected = 0;
        const keys: Record<ZPBotBoostFeedback, string> = { ready: "botboostready", saved: "botboostsaved", invalid: "botboostinvalid", error: "adminerror", missing: "botnavreasonmissing", busy: "botboostretry", testing: "botboosttesting", success: "botboostsuccess", failed: "botboostfailed" };
        if (operation !== 0 || ["testing", "success", "failed"].includes(data.Feedback)) this.feedback = language.GetPhrase("zombieplague." + keys[data.Feedback]);
        const accepted = data.Feedback === "ready" || data.Feedback === "saved" || data.Feedback === "testing";
        const recovering = operation === 0 && this.reconcile;
        if (operation === 0) this.reconcile = false;
        if ((accepted && [1, 9, 10].includes(operation)) || recovering) {
            this.slot = data.Editing ? Math.max(2, [data.Draft.Base, data.Draft.Approach, data.Draft.Exit].findIndex(point => point.length !== 3) + 2) : 0;
            if (operation === 1 || operation === 9) this.Hide();
        }
        if (operation >= 2 && operation <= 4 && accepted) {
            const missing = [data.Draft.Base, data.Draft.Approach, data.Draft.Exit].findIndex(point => point.length !== 3);
            if (missing !== -1) this.slot = missing + 2;
        }
        if (accepted && [5, 8, 12].includes(operation)) this.slot = 0;
        if (accepted && [5, 8].includes(operation) && this.continuation) {
            const next = this.continuation; this.continuation = undefined; this.Request(next.Operation, next.ID);
        } else if (!accepted && operation !== 0) {
            this.continuation = undefined;
            if (![2, 3, 4, 9].includes(operation)) this.Show();
        }
    }
    ToolAction(operation: number): void {
        if (!this.opened || !this.Allowed() || !this.Active()) return;
        if (operation === 2) {
            if (this.reloadDown) return;
            this.reloadDown = LocalPlayer().KeyDown(IN_RELOAD);
            if (this.menu.IsOpen()) this.CancelMenu(); else this.Show();
            return;
        }
        if (this.menu.IsOpen()) {
            if (operation === 1) this.Back();
            else if (operation === 0) {
                const state = this.State();
                const item = state.Menu?.Items[state.Menu.Active];
                if (item?.Enabled) this.Action(item.Operation, item.ID);
            }
            return;
        }
        if (this.pending || this.deferred) return;
        if (operation === 1) this.ToggleEditing();
        else if (operation === 0 && this.slot === 0) {
            this.Select(world.pick(this.data));
        } else if (operation === 0) {
            const target = preview.capture(this.data?.Draft, this.slot);
            if (target.Valid) this.Request(this.slot); else this.feedback = ui.issueText(target.Issue);
        }
    }
    private ToggleEditing(): void {
        if (this.slot !== 0) {
            this.editingSlot = this.slot;
            this.slot = 0;
        } else if (this.data?.Editing) this.slot = this.editingSlot;
        else {
            const id = this.selected || world.pick(this.data);
            if (id !== 0) this.Request(9, id);
            else this.feedback = ui.phrase("selecthint");
        }
    }
    Wheel(bind: string, pressed: boolean): boolean | undefined {
        if (!this.opened || !this.Allowed() || !this.Active() || !["invnext", "invprev"].includes(bind)) return;
        if (pressed && this.menu.IsOpen()) this.menu.Move(bind === "invnext" ? 1 : -1, this.State());
        else if (pressed && this.slot !== 0 && !this.pending && !this.deferred) {
            this.slot = bind === "invnext" ? this.slot === 4 ? 2 : this.slot + 1 : this.slot === 2 ? 4 : this.slot - 1;
            this.editingSlot = this.slot;
        }
        return true;
    }
    Screen(vm: GLuaBoostViewModel, ply: ZPClientPlayer, weapon: GLuaEntity): void {
        if (!this.opened || !this.Allowed() || !this.Active() || ply !== LocalPlayer() || weapon.GetClass() !== "zp_bot_boost_tool") return;
        const palette = ZPThemes.GetTheme()?.Palette;
        if (palette) screen.Begin(vm, this.State(), palette);
    }
    Tick(): void {
        if (!this.opened) return;
        if (!this.Allowed()) { this.Close(); return; }
        if (this.Active()) this.toolReady = true;
        else if (this.toolReady || CurTime() >= this.equipDeadline) { this.Close(); return; }
        const escape = input.IsKeyDown(KEY_ESCAPE);
        if (escape && !this.escapeDown && this.menu.IsOpen()) this.CancelMenu();
        this.escapeDown = escape;
        if (!LocalPlayer().KeyDown(IN_RELOAD)) this.reloadDown = false;
        if (this.pending && CurTime() >= this.pending.Deadline) { this.reconcile = this.pending.Operation !== 0; this.pending = undefined; this.continuation = undefined; this.feedback = language.GetPhrase("zombieplague.weaponmenutimeout"); }
        if (!this.pending && this.deferred && CurTime() >= this.nextSend) { const next = this.deferred; this.deferred = undefined; this.Request(next.Operation, next.ID); }
        else if (!this.pending && !this.deferred && CurTime() >= this.nextPoll) this.Request(0);
    }
    Paint(worldSpace: boolean): void {
        if (!this.opened || !this.Allowed() || !this.Active()) return;
        const palette = ZPThemes.GetTheme()?.Palette; if (!palette) return;
        const state = this.State();
        if (worldSpace) {
            world.markers(this.data, this.selected, state.Hovered, this.slot, palette);
            if (this.slot !== 0 && !this.menu.IsOpen()) preview.paint(this.data, this.selected, this.slot, palette);
        } else { world.labels(this.data, this.selected, state.Hovered, palette); ui.hud(state, palette); }
    }
}
const editor = new BotBoostEditor(); _G.ZPBotBoostEditor = editor;
net.Receive("ZPBotBoostReply", length => editor.Receive(length));
hook.Add("Think", "ZPBotBoostEditor", () => editor.Tick());
hook.Add("ZPBotBoostToolAction", "ZPBotBoostEditor", operation => editor.ToolAction(operation));
hook.Add("PlayerBindPress", "ZPBotBoostPointWheel", (_ply, bind, pressed) => editor.Wheel(bind, pressed));
hook.Add("PreDrawViewModel", "ZPBotBoostScreen", (vm, ply, weapon) => editor.Screen(vm, ply, weapon));
hook.Add("PostDrawViewModel", "ZPBotBoostScreen", () => screen.Restore());
hook.Add("PostDrawTranslucentRenderables", "ZPBotBoostEditor", () => editor.Paint(true));
hook.Add("HUDPaint", "ZPBotBoostEditor", () => editor.Paint(false));
hook.Add("ShutDown", "ZPBotBoostEditor", () => editor.Close());
hook.Add("OnReloaded", "ZPBotBoostEditor", () => editor.Close());
