export class MainMenuController implements ZPMainMenuController {
    private options: ZPMainMenuOption[] = [];
    private presentation: ZPMainMenuPresentation | undefined;
    private opened: boolean = false;

    RegisterOption(option: ZPMainMenuOption): void {
        if (option.ID.length === 0 || this.options.some(entry => entry.ID === option.ID))
            return;
        this.options.push(option);
        this.presentation?.Update(this.GetState());
    }

    GetState(): ZPMainMenuState {
        return { Open: this.opened, Theme: ZPThemes.GetActiveID(),
            Entries: this.options.filter(option => option.IsVisible?.() ?? true)
                .map(option => ({ ID: option.ID, Label: option.Label, Description: option.Description })) };
    }

    Open(): void {
        _G.ZPMapVoteMenu?.Close();
        _G.ZPExtraMenu?.Close();
        _G.ZPClassMenu?.Close();
        _G.ZPAdminMenu?.Close();
        _G.ZPSettings?.Close();
        ZPWeaponMenu.Close();
        this.opened = true;
        this.Rebuild();
    }

    Rebuild(): void {
        if (!this.opened)
            return;
        this.presentation?.Destroy();
        this.presentation = undefined;
        const theme = ZPThemes.GetTheme();
        if (theme) {
            this.presentation = theme.CreateMainMenu ? theme.CreateMainMenu() : ZPCreateMainMenuHUD(theme.Palette, false);
            this.presentation.Open(this.GetState(), this);
        }
    }

    Close(): void {
        this.opened = false;
        this.presentation?.Destroy();
        this.presentation = undefined;
    }

    Toggle(): void {
        if (this.opened)
            this.Close();
        else
            this.Open();
    }

    Activate(id: string): void {
        if (!this.opened)
            return;
        const option = this.options.find(entry => entry.ID === id);
        if (!option || !(option.IsVisible?.() ?? true))
            return;
        this.Close();
        option.Action();
    }

    Tick(): void {
        if (this.opened) {
            if (input.IsKeyDown(KEY_ESCAPE))
                this.Close();
            else
                this.presentation?.Update(this.GetState());
        }
    }
}
const controller = new MainMenuController();
_G.ZPMainMenu = controller;
controller.RegisterOption({ ID: "weapons", Label: "zombieplague.mainmenuweapons",
    Description: "zombieplague.mainmenuweaponsdescription", Action: () => ZPWeaponMenu.Open() });
controller.RegisterOption({ ID: "classes", Label: "zombieplague.mainmenuclasses",
    Description: "zombieplague.mainmenuclassesdescription", Action: () => ZPClassMenu.Open() });
controller.RegisterOption({ ID: "extras", Label: "zombieplague.mainmenuextras",
    Description: "zombieplague.mainmenuextrasdescription", Action: () => ZPExtraMenu.Open() });
controller.RegisterOption({ ID: "spectate", Label: "zombieplague.mainmenuspectate",
    Description: "zombieplague.mainmenuspectatedescription", Action: () => RunConsoleCommand("zp_spectate"),
    IsVisible: () => IsValid(LocalPlayer()) && LocalPlayer().Team() !== TEAM_SPECTATOR });
controller.RegisterOption({ ID: "join", Label: "zombieplague.mainmenujoin",
    Description: "zombieplague.mainmenujoindescription", Action: () => RunConsoleCommand("zp_join"),
    IsVisible: () => IsValid(LocalPlayer()) && LocalPlayer().Team() === TEAM_SPECTATOR });
hook.Add("Think", "ZPMainMenuController", () => controller.Tick());
concommand.Add("zp_menu", () => controller.Toggle());
