export class SettingsController implements ZPSettingsController {
    private opened: boolean = false;
    private presentation: ZPSettingsPresentation | undefined;
    private alwaysRun = CreateClientConVar("zp_always_run", "0", true, false, "Always hold the sprint input while alive.");
    private staminaMode: boolean | undefined;
    private capturing = "";
    private ignoreEscape = false;

    private SyncStaminaMode(): boolean {
        const staminaMode = cvars.Bool("zp_realistic_mode", false) || cvars.Bool("zp_run_should_drain", false);
        // A saved preference must not opt the player into stamina costs on another server
        // or when the server enables them. Explicit activation lasts until the mode changes.
        if (staminaMode && this.staminaMode !== true)
            this.alwaysRun.SetBool(false);
        this.staminaMode = staminaMode;
        return staminaMode;
    }

    GetState(): ZPSettingsState {
        this.SyncStaminaMode();
        return { Open: this.opened, Theme: ZPThemes.GetActiveID(), Themes: ZPThemes.GetThemes(),
            AlwaysRun: this.alwaysRun.GetBool(), Bindings: KeyManager.GetBindings(), Capturing: this.capturing };
    }

    Open(): void {
        _G.ZPMapVoteMenu?.Close();
        _G.ZPExtraMenu?.Close();
        _G.ZPClassMenu?.Close();
        _G.ZPAdminMenu?.Close();
        ZPMainMenu.Close();
        ZPWeaponMenu.Close();
        this.opened = true;
        this.Rebuild();
    }

    Rebuild(): void {
        if (!this.opened)
            return;
        this.CancelBinding();
        this.presentation?.Destroy();
        this.presentation = undefined;
        const theme = ZPThemes.GetTheme();
        if (theme) {
            this.presentation = theme.CreateSettingsMenu ? theme.CreateSettingsMenu() :
                ZPCreateSettingsHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16");
            this.presentation.Open(this.GetState(), this);
        }
    }

    UseTheme(id: string): void { if (this.opened) ZPThemes.UseTheme(id); }
    SetAlwaysRun(enabled: boolean): void {
        const staminaMode = this.SyncStaminaMode();
        if (enabled && !this.alwaysRun.GetBool() && staminaMode)
            notification.AddLegacy(language.GetPhrase("zombieplague.settingsalwaysrunstaminawarning"), NOTIFY_GENERIC, 8);
        this.alwaysRun.SetBool(enabled);
        this.presentation?.Update(this.GetState());
    }
    private CancelBinding(): void { this.capturing = ""; KeyManager.Capturing = false; }
    BeginBinding(id: string): void {
        if (!this.opened || !KeyManager.GetBindings().some(binding => binding.ID === id)) return;
        this.capturing = id; KeyManager.Capturing = true;
        this.presentation?.Update(this.GetState());
    }
    CaptureKey(key: number): void {
        if (!this.opened || this.capturing === "") return;
        if (key !== KEY_ESCAPE && !KeyManager.SetBinding(this.capturing, key)) return;
        this.ignoreEscape = key === KEY_ESCAPE;
        this.CancelBinding();
        this.presentation?.Update(this.GetState());
    }
    ResetBindings(): void {
        if (!this.opened) return;
        this.CancelBinding(); KeyManager.ResetBindings();
        this.presentation?.Update(this.GetState());
    }
    Close(): void {
        this.CancelBinding();
        this.opened = false;
        this.presentation?.Destroy();
        this.presentation = undefined;
    }
    Back(): void { this.Close(); ZPMainMenu.Open(); }

    Tick(): void {
        this.SyncStaminaMode();
        if (!this.opened)
            return;
        if (!input.IsKeyDown(KEY_ESCAPE)) this.ignoreEscape = false;
        if (input.IsKeyDown(KEY_ESCAPE) && this.capturing === "" && !this.ignoreEscape)
            this.Close();
        else
            this.presentation?.Update(this.GetState());
    }

    ApplyMovement(command: ZPClientUserCommand): void {
        this.SyncStaminaMode();
        const ply = LocalPlayer();
        if (this.alwaysRun.GetBool() && IsValid(ply) && ply.Alive() && ply.Team() !== TEAM_SPECTATOR)
            // Adds only sprint: attacking, jumping, crouching and manual input remain intact.
            command.AddKey(IN_SPEED);
    }
}
const settings = new SettingsController();
_G.ZPSettings = settings;
ZPMainMenu.RegisterOption({ ID: "settings", Label: "zombieplague.settingstitle",
    Description: "zombieplague.settingsdescription", Action: () => settings.Open() });
hook.Add("Think", "ZPSettingsController", () => settings.Tick());
hook.Add("CreateMove", "ZPAlwaysRun", command => settings.ApplyMovement(command));
