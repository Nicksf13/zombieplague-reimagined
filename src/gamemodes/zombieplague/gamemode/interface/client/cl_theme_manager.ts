export class ThemeManager implements ZPThemeManager {
    private themes: Record<string, ZPThemeDefinition | undefined> = {};
    private order: string[] = [];
    private activeID: string = "classic";
    private preferredID: string = "classic";
    private saveFile: string = "zombieplague/theme.json";

    constructor() {
        const saved = file.Read(this.saveFile, "DATA");
        const data = saved === undefined ? undefined : ZPClientData.Record(util.JSONToTable(saved));
        if (data && typeof data.Theme === "string" && data.Theme.length > 0 && data.Theme.length <= 64)
            this.preferredID = data.Theme;
    }

    RegisterTheme(id: string, theme: ZPThemeDefinition): void {
        if (id.length === 0 || id.length > 64 || this.themes[id])
            return;
        this.themes[id] = theme;
        this.order.push(id);
        ZPWeaponMenu.RegisterPresentation(id, theme.CreateWeaponMenu);
        // A saved addon theme may be registered after the built-in themes.
        if (id === this.preferredID)
            this.UseTheme(id);
    }

    UseTheme(id: string): boolean {
        if (!this.themes[id])
            return false;
        const changed = this.activeID !== id;
        this.activeID = id;
        if (ZPWeaponMenu.GetState().Presentation !== id)
            ZPWeaponMenu.UsePresentation(id);
        if (changed) {
            ZPMainMenu.Rebuild();
            _G.ZPScoreboard?.Rebuild();
        }
        if (this.preferredID !== id) {
            this.preferredID = id;
            if (!file.Exists("zombieplague", "DATA"))
                file.CreateDir("zombieplague");
            file.Write(this.saveFile, util.TableToJSON({ Theme: id }));
        }
        return true;
    }

    GetActiveID(): string { return this.activeID; }
    GetTheme(): ZPThemeDefinition | undefined { return this.themes[this.activeID]; }
    GetThemes(): { ID: string; Name: string; }[] {
        const result: { ID: string; Name: string; }[] = [];
        for (const id of this.order) {
            const theme = this.themes[id];
            if (theme)
                result.push({ ID: id, Name: language.GetPhrase(theme.Name) });
        }
        return result;
    }
}
const themes = new ThemeManager();
_G.ZPThemes = themes;
concommand.Add("zp_theme", (_ply, _command, args) => {
    const id = args[0];
    if (id !== undefined && themes.UseTheme(id))
        return;
    print("[ZP] " + language.GetPhrase("zombieplague.themeusage"));
    for (const theme of themes.GetThemes())
        print(theme.ID + " - " + theme.Name);
});
