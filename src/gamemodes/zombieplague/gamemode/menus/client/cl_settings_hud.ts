// Settings presentations consume snapshots/actions, independent of persistence and input handling.
export class SettingsHUD implements ZPSettingsPresentation {
    private frame: GLuaPanel | undefined;
    private content: GLuaPanel | undefined;
    private state: ZPSettingsState | undefined;
    private signature: string = "";
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Text(key: string, font: string, x: number, y: number, color: GLuaColor = this.palette.Text): void {
        draw.DrawText(language.GetPhrase(key), font, x, y, color, TEXT_ALIGN_LEFT);
    }

    Open(state: ZPSettingsState, actions: ZPSettingsActions): void {
        const frame = vgui.Create("DFrame");
        this.frame = frame;
        frame.SetTitle("");
        frame.ShowCloseButton(false);
        frame.SetDraggable(false);
        frame.SetDeleteOnClose(true);
        frame.SetSize(Math.min(580, ScrW() - 32), Math.min(480, ScrH() - 180));
        frame.Center();
        frame.Paint = (width, height) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, width, height, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, width, 3, this.palette.Accent);
            this.Text("ZOMBIE PLAGUE", "Trebuchet18", 24, 20, this.palette.Accent);
            this.Text("zombieplague.settingstitle", "DermaLarge", 24, 48);
        };
        const [width, height] = frame.GetSize();
        this.Button(frame, "X", width - 52, 18, 30, 30, () => actions.Close());
        this.Button(frame, "zombieplague.settingsback", 24, height - 40, 160, 28, () => actions.Back());
        frame.MakePopup();
        frame.SetKeyboardInputEnabled(false);
        this.UpdateContent(state, actions);
    }

    private Button(parent: GLuaPanel, label: string, x: number, y: number, width: number, height: number,
        action: ZPAction, selected: (this: void) => boolean = () => false): GLuaPanel {
        const button = parent.Add("DButton");
        button.SetText("");
        button.SetPos(x, y);
        button.SetSize(width, height);
        button.Paint = (w, h) => {
            const highlighted = selected() || button.IsHovered();
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, highlighted ? this.palette.Accent : this.palette.Panel);
            this.Text(label, "Trebuchet18", 12, (h - 20) / 2, highlighted ? Color(12, 18, 22) : this.palette.Text);
        };
        button.DoClick = () => action();
        return button;
    }

    private actions: ZPSettingsActions | undefined;
    private UpdateContent(state: ZPSettingsState, actions: ZPSettingsActions): void {
        this.state = state;
        this.actions = actions;
        const signature = state.Themes.map(theme => theme.ID + ":" + theme.Name).join("|");
        if (this.content && signature === this.signature)
            return;
        this.signature = signature;
        this.content?.Remove();
        const frame = this.frame;
        if (!frame)
            return;
        const [width, height] = frame.GetSize();
        const content = vgui.Create("DScrollPanel", frame);
        this.content = content;
        content.SetPos(24, 96);
        content.SetSize(width - 48, height - 148);
        const rowWidth = width - 68;
        const appearance = content.Add("DPanel");
        appearance.SetPos(0, 0); appearance.SetSize(rowWidth, 30);
        appearance.Paint = () => this.Text("zombieplague.settingsappearance", "ZPMenuOptionTitle", 0, 0, this.palette.Accent);
        state.Themes.forEach((theme, index) => this.Button(content, theme.Name, 0, 34 + index * 42, rowWidth, 36,
            () => actions.UseTheme(theme.ID), () => this.state?.Theme === theme.ID));
        const gameplayY = 44 + state.Themes.length * 42;
        const gameplay = content.Add("DPanel");
        gameplay.SetPos(0, gameplayY); gameplay.SetSize(rowWidth, 30);
        gameplay.Paint = () => this.Text("zombieplague.settingsgameplay", "ZPMenuOptionTitle", 0, 0, this.palette.Accent);
        const run = this.Button(content, "", 0, gameplayY + 34, rowWidth, 80,
            () => actions.SetAlwaysRun(!(this.state?.AlwaysRun ?? false)));
        run.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            this.Text("zombieplague.settingsalwaysrun", "ZPMenuOptionTitle", 12, 10);
            this.Text(this.state?.AlwaysRun ? "zombieplague.settingsenabled" : "zombieplague.settingsdisabled",
                "Trebuchet18", w - 112, 13, this.palette.Accent);
            this.Text("zombieplague.settingsalwaysrunhelp", "DermaDefault", 12, 48, this.palette.Muted);
        };
    }

    Update(state: ZPSettingsState): void { if (this.actions) this.UpdateContent(state, this.actions); }
    Destroy(): void {
        this.frame?.Remove();
        this.frame = undefined;
        this.content = undefined;
        this.actions = undefined;
    }
}
_G.ZPCreateSettingsHUD = (palette, square) => new SettingsHUD(palette, square);
