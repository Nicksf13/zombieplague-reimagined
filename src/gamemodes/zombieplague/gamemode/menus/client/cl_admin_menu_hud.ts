export class AdminMenuHUD implements ZPAdminPresentation {
    private frame: GLuaPanel | undefined;
    private state: ZPAdminState | undefined;
    private controls: { Index: number; Panel: GLuaPanel; Input?: ZPAdminTextEntry; }[] = [];
    private save: GLuaPanel | undefined;
    private refresh: GLuaPanel | undefined;
    private reload: GLuaPanel | undefined;
    private feedback: GLuaPanel | undefined;
    private addBot: GLuaPanel | undefined;
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Label(parent: GLuaPanel, key: string, y: number, width: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent);
        label.SetPos(0, y); label.SetSize(width, height);
        label.SetFont("DermaDefault"); label.SetColor(this.palette.Text);
        label.SetWrap(true); label.SetText(language.GetPhrase(key));
        return label;
    }
    private Button(parent: GLuaPanel, key: string, x: number, y: number, width: number,
        action: ZPAction, centered: boolean = false): GLuaPanel {
        const button = parent.Add("DButton");
        button.SetPos(x, y); button.SetSize(width, 36); button.SetText("");
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            const text = language.GetPhrase(key);
            let textX = 10, textY = 10;
            if (centered) {
                surface.SetFont("DermaDefault");
                const [textWidth, textHeight] = surface.GetTextSize(text);
                textX = (w - textWidth) / 2;
                textY = (h - textHeight) / 2;
            }
            draw.DrawText(text, "DermaDefault", textX, textY,
                !button.IsEnabled() ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
        return button;
    }
    Open(state: ZPAdminState, actions: ZPAdminActions): void {
        this.state = state;
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false);
        frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        const width = Math.min(760, ScrW() - 32), height = Math.min(720, ScrH() - 48);
        frame.SetSize(width, height); frame.Center();
        frame.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
        };
        const title = this.Label(frame, state.Page === "admin" ? "zombieplague.admintitle" :
            state.Page === "settings" ? "zombieplague.adminmapsettings" :
            state.Page === "bots" ? "zombieplague.adminbots" : "zombieplague.adminenvironment", 20, width - 100, 66);
        title.SetPos(24, 16); title.SetFont("Trebuchet24");
        this.Button(frame, "X", width - 62, 22, 38, () => actions.Close(), true);
        const content = vgui.Create("DScrollPanel", frame);
        content.SetPos(24, 96); content.SetSize(width - 48, height - 210);
        const rowWidth = width - 68;
        if (state.Page === "admin") {
            this.Button(content, "zombieplague.adminmapsettings", 0, 0, rowWidth, () => actions.Navigate("settings"));
            this.Button(content, "zombieplague.adminbots", 0, 48, rowWidth, () => actions.Navigate("bots"));
        }
        else if (state.Page === "settings")
            this.Button(content, "zombieplague.adminenvironment", 0, 0, rowWidth, () => actions.Navigate("environment"));
        else if (state.Page === "bots") {
            this.Label(content, "zombieplague.adminbotshelp", 0, rowWidth, 90);
            this.addBot = this.Button(content, "zombieplague.adminaddbot", 0, 102, rowWidth, () => actions.AddBot());
        }
        else {
            this.feedback = this.Label(content, "", 0, rowWidth, 48);
            this.Label(content, "zombieplague.adminhelp", 48, rowWidth, 60);
            ZPAdminConfig.Entries.forEach((entry, index) => {
                const y = 120 + index * 106;
                this.Label(content, entry.Label, y, rowWidth, 44);
                if (entry.Kind === "toggle") {
                    const button = this.Button(content, "", 0, y + 46, rowWidth, () =>
                        actions.SetValue(index, this.state?.Values[index] === "1" ? "0" : "1"));
                    button.Paint = (w, h) => {
                        draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
                        draw.DrawText(language.GetPhrase(this.state?.Values[index] === "1" ?
                            "zombieplague.settingsenabled" : "zombieplague.settingsdisabled"),
                        "Trebuchet18", 12, 8, this.palette.Accent, TEXT_ALIGN_LEFT);
                    };
                    this.controls.push({ Index: index, Panel: button });
                } else {
                    const input = vgui.Create("DTextEntry", content);
                    ZPMenuControls.TextEntry(input, this.palette, this.square);
                    input.SetPos(0, y + 46); input.SetSize(rowWidth, 36);
                    input.SetText(state.Values[index] ?? entry.Default);
                    input.OnChange = () => actions.SetValue(index, input.GetValue());
                    this.controls.push({ Index: index, Panel: input, Input: input });
                }
            });
            this.reload = this.Button(frame, "zombieplague.adminreload", 24, height - 100, width - 48, () => actions.ConfirmReload());
            const actionWidth = (width - 174) / 2;
            this.refresh = this.Button(frame, "zombieplague.adminrefresh", 150, height - 52, actionWidth, () => actions.Refresh());
            this.refresh.SetTooltip(language.GetPhrase("zombieplague.adminrefreshhelp"));
            this.save = this.Button(frame, "zombieplague.adminsave", 162 + actionWidth, height - 52, actionWidth - 12, () => actions.Save());
        }
        this.Button(frame, "zombieplague.settingsback", 24, height - 52, 114, () => actions.Back());
        frame.MakePopup();
        // Text fields need keyboard focus; ESC remains handled by the controller.
        this.Update(state);
    }
    Update(state: ZPAdminState): void {
        this.state = state;
        this.addBot?.SetEnabled(state.CanAddBot);
        for (const control of this.controls) {
            control.Panel.SetEnabled(state.Ready && !state.Pending);
            const value = state.Values[control.Index];
            if (control.Input && value !== undefined && control.Input.GetValue() !== value)
                control.Input.SetText(value);
        }
        this.save?.SetEnabled(state.Ready && state.Dirty && !state.Pending);
        this.refresh?.SetEnabled(!state.Pending);
        this.reload?.SetEnabled(state.Ready && state.CanReload && state.ReloadRequired && !state.Dirty && !state.Pending);
        const feedback = state.Feedback.length > 0 ? language.GetPhrase(state.Feedback) : "";
        this.feedback?.SetText(feedback + (state.ReloadRequired ? "\n" + language.GetPhrase("zombieplague.adminreloadpending") : ""));
    }
    ConfirmReload(action: ZPAction): GLuaPanel {
        const dialog = vgui.Create("DFrame");
        const width = Math.min(600, ScrW() - 32), height = Math.min(320, ScrH() - 32);
        dialog.SetTitle(""); dialog.ShowCloseButton(false); dialog.SetDraggable(false);
        dialog.SetDeleteOnClose(true); dialog.SetSize(width, height); dialog.Center();
        dialog.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
        };
        const title = this.Label(dialog, "zombieplague.adminreload", 0, width - 48, 60);
        title.SetPos(24, 18); title.SetFont("Trebuchet24");
        const warning = this.Label(dialog, "zombieplague.adminreloadwarning", 0, width - 48, height - 150);
        warning.SetPos(24, 82);
        // Removing the modal releases input. A stale callback cannot confirm twice.
        const dismiss = (): boolean => {
            if (!IsValid(dialog)) return false;
            dialog.Remove();
            return true;
        };
        const buttonWidth = (width - 60) / 2;
        this.Button(dialog, "zombieplague.admincancel", 24, height - 56, buttonWidth, () => { dismiss(); });
        this.Button(dialog, "zombieplague.adminconfirm", 36 + buttonWidth, height - 56, buttonWidth, () => {
            if (dismiss()) action();
        });
        dialog.MakePopup(); dialog.DoModal();
        return dialog;
    }
    Destroy(): void {
        this.frame?.Remove(); this.frame = undefined;
        this.controls = []; this.state = undefined;
        this.addBot = undefined;
        this.save = undefined; this.refresh = undefined; this.reload = undefined; this.feedback = undefined;
    }
}
_G.ZPCreateAdminHUD = (palette, square) => new AdminMenuHUD(palette, square);
