import type { SafeViewState, SafeMenuItem } from "./cl_bot_safe_hud";
const { BotSafeHUD, phrase } = include("cl_bot_safe_hud.lua") as typeof import("./cl_bot_safe_hud");
const world = include("cl_bot_safe_markers.lua") as typeof import("./cl_bot_safe_markers");
interface SafeRequest { Action: number; ID: number; Role: ZPBotSafeRole; Revision: number; }
class BotSafeEditor implements ZPBotSafeEditor {
    private opened = false;
    private data: ZPBotSafeSnapshot | undefined;
    private role: ZPBotSafeRole = "both";
    private selected = 0;
    private sequence = 0;
    private nextSend = 0;
    private nextPoll = 0;
    private deadline = 0;
    private toolReady = false;
    private pending: { ID: number; Action: number; Deadline: number } | undefined;
    private deferred: SafeRequest | undefined;
    private menu = false;
    private pointMenu = false;
    private focus = 0;
    private feedback = "";
    private escapeDown = false;
    private inputDown = new Set<number>();
    private view = new BotSafeHUD();
    private Allowed(): boolean { return IsValid(LocalPlayer()) && LocalPlayer().IsAdmin(); }
    private Active(): boolean { const weapon = LocalPlayer().GetActiveWeapon(); return IsValid(weapon) && weapon.GetClass() === "zp_bot_safe_tool"; }
    Open(): void {
        if (!this.Allowed()) return;
        if (this.opened) { if (!this.PointOptions()) { this.menu = true; this.pointMenu = false; this.focus = 0; } return; }
        ZPBotBoostEditor.Close();
        this.opened = true; this.data = undefined; this.selected = 0; this.feedback = "";
        this.Hide(); this.toolReady = false; this.deadline = CurTime() + 5;
        this.Request(4);
    }
    Close(): void {
        if (this.opened) this.Send(5, 0, this.role);
        this.opened = false; this.pending = undefined; this.deferred = undefined; this.data = undefined;
        this.Hide(); this.inputDown.clear(); this.view.Restore();
    }
    private Hide(): void { this.menu = false; this.pointMenu = false; this.focus = 0; }
    private PointOptions(): boolean {
        const target = world.pick(this.data?.Points ?? []); if (target === 0) return false;
        this.selected = target; this.menu = true; this.pointMenu = true; this.focus = 0; return true;
    }
    private Send(action: number, id: number, role: ZPBotSafeRole, revision = this.data?.Revision ?? 0): void {
        this.sequence = this.sequence % 2147483647 + 1;
        net.Start("ZPBotSafeRequest"); net.WriteUInt(2, 8); net.WriteUInt(this.sequence, 31); net.WriteUInt(revision, 31);
        net.WriteUInt(action, 3); net.WriteUInt(role === "human" ? 0 : role === "zombie" ? 1 : 2, 2); net.WriteUInt(id, 16); net.SendToServer();
    }
    private Request(action: number, id = 0, role = this.role, revision = this.data?.Revision ?? 0): void {
        if (!this.opened || !this.Allowed() || this.deferred || (action !== 4 && !this.data)) return;
        if (this.pending) {
            // Keep an explicit edit across an in-flight status poll, with its original target and revision.
            if (this.pending.Action === 0 && action > 0 && action !== 4) this.deferred = { Action: action, ID: id, Role: role, Revision: revision };
            return;
        }
        if (CurTime() < this.nextSend) { this.deferred = { Action: action, ID: id, Role: role, Revision: revision }; return; }
        this.Send(action, id, role, revision); this.nextSend = CurTime() + 0.2; this.nextPoll = CurTime() + 1;
        this.pending = { ID: this.sequence, Action: action, Deadline: CurTime() + 3 };
    }
    Receive(length: number): void {
        if (!this.opened || !this.Allowed() || !this.pending || length < 1 || length > 131072) return;
        const data = ZPBotSafeProtocol.Snapshot(net.ReadTable()); if (!data || data.Request !== this.pending.ID) return;
        const action = this.pending.Action; this.pending = undefined; this.data = data;
        if (data.Feedback !== "ready") this.feedback = language.GetPhrase("zombieplague." + ({
            saved: "bsafesaved", invalid: "bsafeinvalid", capacity: "bsafecapacity", error: "adminerror", stale: "bsafestale"
        })[data.Feedback]);
        if (!data.Points.some(point => point.ID === this.selected)) { this.selected = 0; if (this.pointMenu) this.Hide(); }
        if (action === 4) {
            if (!data.Equipped) { chat.AddText(this.feedback || phrase("invalid")); this.Close(); return; }
            this.menu = true; this.pointMenu = false; this.focus = 0;
        } else if (!data.Equipped) this.Close();
    }
    private State(): SafeViewState {
        const pending = this.pending !== undefined || this.deferred !== undefined;
        const busy = this.pending !== undefined && this.pending.Action !== 0 || this.deferred !== undefined;
        const item = (action: number, text: string, available = true): SafeMenuItem => ({ Action: action, Text: text,
            Enabled: available && (!busy || action === 5 || action === 19) });
        const items = this.pointMenu ? [item(3, phrase("delete") + " #" + this.selected, this.selected !== 0), item(19, language.GetPhrase("zombieplague.botboostback"))] :
            (["human", "zombie", "both"] as const).map((role, index) => item(10 + index, (this.role === role ? "✓ " : "") + phrase(role)));
        if (!this.pointMenu) items.push(item(1, phrase("mark")), item(2, phrase("aim")), item(3, phrase("delete") + (this.selected !== 0 ? " #" + this.selected : ""), this.selected !== 0),
            item(5, language.GetPhrase("zombieplague.botboostclose")), item(19, language.GetPhrase("zombieplague.botboostback")));
        this.focus = Math.max(0, Math.min(this.focus, items.length - 1));
        return { Role: this.role, Selected: this.selected, Pending: pending, Feedback: this.feedback, Menu: this.menu, PointMenu: this.pointMenu, Items: items, Focus: this.focus };
    }
    private Choose(): void {
        const item = this.State().Items[this.focus]; if (!item?.Enabled) return;
        const action = item.Action;
        if (action >= 10 && action <= 12) { this.role = action === 10 ? "human" : action === 11 ? "zombie" : "both"; this.Hide(); }
        else if (action === 19) this.Hide();
        else if (action === 5) this.Close();
        else if (action === 2) this.Hide();
        else { this.Request(action, action === 3 ? this.selected : 0); this.Hide(); }
    }
    Input(command: ZPClientUserCommand): void {
        if (!this.opened || !this.Allowed() || !this.Active() || !LocalPlayer().Alive()) { this.inputDown.clear(); return; }
        let press: number | undefined;
        for (const key of [IN_RELOAD, IN_ATTACK2, IN_ATTACK]) {
            const down = command.KeyDown(key); if (down && !this.inputDown.has(key) && press === undefined) press = key;
            if (down) this.inputDown.add(key); else this.inputDown.delete(key); command.RemoveKey(key);
        }
        if (press === undefined || LocalPlayer().IsTyping() || gui.IsGameUIVisible() || gui.IsConsoleVisible() || vgui.CursorVisible()) return;
        if (press === IN_RELOAD) {
            if (this.pointMenu) this.Hide();
            else if (!this.PointOptions()) { this.menu = !this.menu; this.focus = 0; }
        }
        else if (press === IN_ATTACK2) {
            if (this.pointMenu || !this.PointOptions()) this.Hide();
        }
        else if (this.menu) this.Choose();
        else if (!this.pending && !this.deferred) this.Request(2);
    }
    Wheel(bind: string, pressed: boolean): boolean | undefined {
        if (!this.opened || !this.Allowed() || !this.Active() || !["invnext", "invprev"].includes(bind)) return;
        if (pressed && !LocalPlayer().IsTyping() && !gui.IsGameUIVisible() && !gui.IsConsoleVisible() && !vgui.CursorVisible()) {
            const direction = bind === "invnext" ? 1 : -1;
            if (this.menu) this.focus = (this.focus + direction + this.State().Items.length) % this.State().Items.length;
            else if (!this.pending && !this.deferred) {
                const roles: ZPBotSafeRole[] = ["human", "zombie", "both"];
                this.role = roles[(roles.indexOf(this.role) + direction + roles.length) % roles.length] ?? "both";
            }
        }
        return true;
    }
    Tick(): void {
        if (!this.opened) return;
        if (!this.Allowed() || !LocalPlayer().Alive()) { this.Close(); return; }
        if (this.Active()) this.toolReady = true;
        else if (this.toolReady || CurTime() >= this.deadline) { this.Close(); return; }
        const escape = input.IsKeyDown(KEY_ESCAPE);
        if (escape && !this.escapeDown) this.Hide(); this.escapeDown = escape;
        if (this.pending && CurTime() >= this.pending.Deadline) { this.pending = undefined; this.deferred = undefined; this.feedback = language.GetPhrase("zombieplague.weaponmenutimeout"); }
        if (!this.pending && this.deferred && CurTime() >= this.nextSend) {
            const next = this.deferred; this.deferred = undefined; this.Request(next.Action, next.ID, next.Role, next.Revision);
        } else if (!this.pending && !this.deferred && CurTime() >= this.nextPoll) this.Request(this.data ? 0 : 4);
    }
    Screen(vm: GLuaBoostViewModel, ply: ZPClientPlayer, weapon: GLuaEntity): void {
        if (!this.opened || !this.Allowed() || !this.Active() || ply !== LocalPlayer() || weapon.GetClass() !== "zp_bot_safe_tool") return;
        const palette = ZPThemes.GetTheme()?.Palette; if (palette) this.view.Screen(vm, this.State(), palette);
    }
    Restore(): void { this.view.Restore(); }
    Paint(worldSpace: boolean): void {
        if (!this.opened || !this.Allowed() || !this.Active()) return;
        const palette = ZPThemes.GetTheme()?.Palette; if (!palette) return;
        const points = this.data?.Points ?? [], hovered = world.pick(points);
        if (worldSpace) { world.markers(points, this.selected, hovered, palette); if (!this.menu) world.preview(palette); }
        else { world.labels(points, this.selected, hovered, palette); this.view.HUD(this.State(), palette); }
    }
}
const editor = new BotSafeEditor(); _G.ZPBotSafeEditor = editor;
net.Receive("ZPBotSafeReply", length => editor.Receive(length));
hook.Add("Think", "ZPBotSafeEditor", () => editor.Tick());
hook.Add("CreateMove", "ZPBotSafeInput", command => editor.Input(command));
hook.Add("PlayerBindPress", "ZPBotSafeWheel", (_ply, bind, pressed) => editor.Wheel(bind, pressed));
hook.Add("PreDrawViewModel", "ZPBotSafeScreen", (vm, ply, weapon) => editor.Screen(vm, ply, weapon));
hook.Add("PostDrawViewModel", "ZPBotSafeScreen", () => editor.Restore());
hook.Add("PostDrawTranslucentRenderables", "ZPBotSafeEditor", () => editor.Paint(true));
hook.Add("HUDPaint", "ZPBotSafeEditor", () => editor.Paint(false));
hook.Add("ShutDown", "ZPBotSafeEditor", () => editor.Close());
hook.Add("OnReloaded", "ZPBotSafeEditor", () => editor.Close());
