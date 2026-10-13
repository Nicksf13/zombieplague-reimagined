export class AdminMenuController implements ZPAdminController {
    private opened = false;
    private page: ZPAdminPage = "admin";
    private presentation: ZPAdminPresentation | undefined;
    private confirmation: GLuaPanel | undefined;
    private values: string[] = ZPAdminConfig.Entries.map(entry => entry.Default);
    private saved: string[] = [];
    private revision = 0;
    private token = 0;
    private reloadRequired = false;
    private feedback = "";
    private sequence = 0;
    private pending: { ID: number; Deadline: number; } | undefined;

    GetState(): ZPAdminState {
        return { Page: this.page, Values: [...this.values], Pending: this.pending !== undefined,
            Ready: this.revision > 0, Dirty: this.revision > 0 && ZPAdminConfig.Entries.some((entry, index) => {
                const value = this.values[index] ?? "", normalized = ZPAdminConfig.Normalize(entry, value);
                const saved = this.saved[index];
                return entry.Kind === "exposure" && normalized !== undefined && saved !== undefined ?
                    Number(normalized) !== Number(saved) : (normalized ?? value) !== saved;
            }),
            ReloadRequired: this.reloadRequired, CanReload: this.token > 0, Feedback: this.feedback,
            CanAddBot: this.Allowed() && GetGlobalBool("ZPTestBotsEnabled", false) && LocalPlayer().IsSuperAdmin() && !game.SinglePlayer() };
    }
    private Update(): void { if (this.opened) this.presentation?.Update(this.GetState()); }
    private Allowed(): boolean { const player = LocalPlayer(); return IsValid(player) && player.IsAdmin(); }
    private CloseConfirmation(): void {
        if (this.confirmation && IsValid(this.confirmation)) this.confirmation.Remove();
        this.confirmation = undefined;
    }

    Open(): void {
        if (!this.Allowed()) return;
        ZPMainMenu.Close(); ZPSettings.Close(); ZPWeaponMenu.Close();
        this.opened = true;
        this.page = "admin";
        this.Rebuild();
    }
    Rebuild(): void {
        if (!this.opened) return;
        this.CloseConfirmation();
        this.presentation?.Destroy();
        const theme = ZPThemes.GetTheme();
        this.presentation = theme ? ZPCreateAdminHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16") : undefined;
        this.presentation?.Open(this.GetState(), this);
    }
    Navigate(page: ZPAdminPage): void {
        if (!this.opened || !this.Allowed()) return;
        this.page = page;
        this.Rebuild();
        if (page === "environment") this.Refresh();
    }
    Back(): void {
        if (this.page === "environment") this.Navigate("settings");
        else if (this.page === "settings" || this.page === "bots") this.Navigate("admin");
        else { this.Close(); ZPMainMenu.Open(); }
    }
    AddBot(): void {
        if (!this.opened || this.page !== "bots" || !this.GetState().CanAddBot) return;
        // Reuse the server command's permission, slot and argument validation.
        RunConsoleCommand("zp_addbot", "1");
    }
    Close(): void {
        this.opened = false;
        this.CloseConfirmation();
        this.presentation?.Destroy(); this.presentation = undefined;
        // Replies to a closed menu are ignored and never reopen it.
        this.pending = undefined;
        this.token = 0;
    }
    SetValue(index: number, value: string): void {
        if (!this.opened || this.pending || this.revision === 0 || !ZPAdminConfig.Entries[index]) return;
        this.values[index] = value;
        this.feedback = "";
        this.Update();
    }
    private Begin(action: number): boolean {
        if (!this.opened || !this.Allowed() || this.pending) return false;
        this.sequence = this.sequence % 2147483647 + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 };
        this.feedback = "zombieplague.weaponmenuwaiting";
        net.Start("ZPAdminSettingsRequest");
        net.WriteUInt(1, 8); net.WriteUInt(action, 2); net.WriteUInt(this.sequence, 31);
        return true;
    }
    Refresh(): void {
        if (this.Begin(0)) { net.SendToServer(); this.Update(); }
    }
    Save(): void {
        if (this.revision === 0 || !this.GetState().Dirty) return;
        const values: string[] = [];
        for (const [index, entry] of ZPAdminConfig.Entries.entries()) {
            const value = ZPAdminConfig.Normalize(entry, this.values[index] ?? "");
            if (value === undefined) { this.feedback = "zombieplague.adminerror"; this.Update(); return; }
            values.push(value);
        }
        if (!this.Begin(1)) return;
        net.WriteUInt(this.revision, 31);
        for (const value of values) net.WriteString(value);
        net.SendToServer(); this.Update();
    }
    ConfirmReload(): void {
        const state = this.GetState();
        if (!this.opened || !this.Allowed() || state.Pending || state.Dirty || !state.ReloadRequired || this.token === 0) return;
        this.CloseConfirmation();
        const revision = this.revision, token = this.token;
        this.confirmation = this.presentation?.ConfirmReload(() => {
                this.confirmation = undefined;
                if (this.revision !== revision || this.token !== token || this.GetState().Dirty || !this.Begin(2)) return;
                net.WriteUInt(revision, 31); net.WriteUInt(token, 31);
                this.token = 0;
                net.SendToServer(); this.Update();
            });
    }
    Receive(length: number): void {
        if (length < 33 || length > 2048) return;
        const id = net.ReadUInt(31), code = net.ReadUInt(2);
        if (!this.pending || id !== this.pending.ID || !this.opened) return;
        if (code < 2) {
            if (length < 144) return;
            const revision = net.ReadUInt(31), reload = net.ReadBool(), token = net.ReadUInt(31);
            if (revision < 1 || (code === 0 && token !== 0) || (!reload && token !== 0) || (reload && code === 1 && token < 1)) return;
            const values: string[] = [];
            for (const entry of ZPAdminConfig.Entries) {
                const value = ZPAdminConfig.Normalize(entry, net.ReadString());
                if (value === undefined) return;
                values.push(value);
            }
            this.revision = revision; this.reloadRequired = reload; this.token = token;
            this.values = values; this.saved = [...values];
            this.feedback = code === 1 ? "zombieplague.adminsaved" : "";
        } else {
            this.token = 0;
            this.feedback = "zombieplague.adminerror";
        }
        this.pending = undefined; this.Update();
    }
    Tick(): void {
        if (!this.opened) return;
        if (!this.Allowed() || input.IsKeyDown(KEY_ESCAPE)) { this.Close(); return; }
        if (this.pending && CurTime() > this.pending.Deadline) {
            this.pending = undefined;
            this.token = 0;
            this.feedback = "zombieplague.weaponmenutimeout";
            this.Update();
        }
    }
}
const controller = new AdminMenuController();
_G.ZPAdminMenu = controller;
ZPMainMenu.RegisterOption({ ID: "admin", Label: "zombieplague.admintitle",
    Description: "zombieplague.admindescription", IsVisible: () => {
        const player = LocalPlayer(); return IsValid(player) && player.IsAdmin();
    }, Action: () => controller.Open() });
net.Receive("ZPAdminSettingsReply", length => controller.Receive(length));
hook.Add("Think", "ZPAdminMenu", () => controller.Tick());
hook.Add("OnReloaded", "ZPAdminMenu", () => controller.Close());
hook.Add("ShutDown", "ZPAdminMenu", () => controller.Close());
