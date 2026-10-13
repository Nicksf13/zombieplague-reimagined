export {};
const phrase = (key: string): string => language.GetPhrase("zombieplague." + key);
const reason = (availability: ZPExtraMenuAvailability): string => phrase(availability === "available" ? "extramenubuy" :
    availability === "wrong_team" ? "extramenuwrongteam" : availability === "not_alive" ? "extramenunotalive" :
    availability === "insufficient" ? "extraitemenought" : "extraitemcantbuy");

class ExtraMenuHUD implements ZPExtraMenuPresentation {
    private frame: GLuaPanel | undefined;
    private scroll: GLuaPanel | undefined;
    private rows: GLuaPanel[] = [];
    private feedback: ZPAdminLabel | undefined;
    private refresh: GLuaPanel | undefined;
    private state: ZPExtraMenuState | undefined;
    private actions: ZPExtraMenuController | undefined;
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, action: ZPAction): GLuaPanel {
        const button = vgui.Create("DButton", parent);
        button.SetText(""); button.SetPos(x, y); button.SetSize(width, 30);
        button.Paint = (w, h) => {
            const highlighted = button.IsEnabled() && button.IsHovered();
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, highlighted ? this.palette.Accent : this.palette.Panel);
            draw.DrawText(text, "Trebuchet18", 10, 5, !button.IsEnabled() ? this.palette.Muted : highlighted ? Color(12, 18, 22) : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
        return button;
    }
    Open(state: ZPExtraMenuState, actions: ZPExtraMenuController): void {
        this.actions = actions;
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        frame.SetSize(Math.min(760, ScrW() - 32), Math.min(570, ScrH() - 64)); frame.Center();
        frame.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
            draw.DrawText(phrase("mainmenuextras"), "DermaLarge", 20, 18, this.palette.Text, TEXT_ALIGN_LEFT);
            draw.DrawText(phrase("ap") + ": " + tostring(this.state?.Snapshot?.Balance ?? 0), "Trebuchet18", 20, 58, this.palette.Accent, TEXT_ALIGN_LEFT);
            draw.DrawText(phrase(this.state?.Kind === "human" ? "scoreboardtitlehumans" : this.state?.Kind === "zombie" ?
                "scoreboardtitlezombies" : "scoreboardtitlespectators"), "Trebuchet18", 20, 88, this.palette.Muted, TEXT_ALIGN_LEFT);
            if (this.state?.Snapshot?.Truncated) draw.DrawText(phrase("extramenutruncated"), "DermaDefault", 20, h - 22, this.palette.Muted, TEXT_ALIGN_LEFT);
        };
        const [w, h] = frame.GetSize();
        this.Button(frame, "X", w - 50, 14, 30, () => actions.Close());
        this.scroll = vgui.Create("DScrollPanel", frame); this.scroll.SetPos(20, 116); this.scroll.SetSize(w - 40, Math.max(32, h - 218));
        this.feedback = vgui.Create("DLabel", frame); this.feedback.SetPos(20, h - 96); this.feedback.SetSize(w - 40, 38);
        this.feedback.SetWrap(true); this.feedback.SetColor(this.palette.Muted);
        this.refresh = this.Button(frame, phrase("weaponmenurefresh"), 20, h - 54, w - 40, () => actions.Refresh());
        frame.MakePopup(); frame.SetKeyboardInputEnabled(true); this.Update(state);
    }
    Update(state: ZPExtraMenuState): void {
        this.state = state;
        const scroll = this.scroll;
        if (!scroll || !IsValid(scroll)) return;
        for (const row of this.rows) row.Remove();
        this.rows = [];
        const [width] = scroll.GetSize(), entries = state.Snapshot?.Team === state.Kind ?
            state.Snapshot.Entries.filter(entry => entry.Kind === state.Kind) : [];
        entries.forEach((entry, index) => this.rows.push(this.Card(scroll, entry, width - 20, index)));
        if (entries.length === 0) {
            const empty = vgui.Create("DLabel", this.scroll); empty.SetPos(12, 10); empty.SetSize(width - 24, 40);
            empty.SetWrap(true); empty.SetColor(this.palette.Muted); empty.SetText(phrase(state.Pending ? "weaponmenuwaiting" : "extramenuempty"));
            this.rows.push(empty);
        }
        this.refresh?.SetEnabled(!state.Pending); this.feedback?.SetText(language.GetPhrase(state.Feedback));
    }
    private Card(parent: GLuaPanel, entry: ZPExtraMenuEntry, width: number, index: number): GLuaPanel {
        const button = parent.Add("DButton"); button.SetText(""); button.SetPos(0, index * 92); button.SetSize(width, 82);
        button.SetEnabled(!this.state?.Pending && entry.Availability === "available");
        button.Paint = (w, h) => {
            const highlighted = button.IsEnabled() && button.IsHovered();
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, highlighted ? this.palette.Accent : this.palette.Panel);
            const color = !button.IsEnabled() ? this.palette.Muted : highlighted ? Color(12, 18, 22) : this.palette.Text;
            status.SetColor(highlighted ? color : this.palette.Muted);
            draw.DrawText(phrase(string.lower(entry.Name)), "Trebuchet18", 14, 8, color, TEXT_ALIGN_LEFT);
            draw.DrawText(tostring(entry.Price) + " " + phrase("ap"), "DermaDefault", 14, 32, color, TEXT_ALIGN_LEFT);
        };
        const status = vgui.Create("DLabel", button); status.SetPos(14, 50); status.SetSize(width - 28, 28);
        status.SetWrap(true); status.SetColor(this.palette.Muted); status.SetText(this.state?.Pending ? phrase("weaponmenuwaiting") : reason(entry.Availability));
        button.SetTooltip(reason(entry.Availability));
        button.DoClick = () => { if (button.IsEnabled()) this.actions?.Buy(entry.ID); };
        return button;
    }
    Destroy(): void {
        if (this.frame && IsValid(this.frame)) this.frame.Remove();
        this.frame = undefined; this.scroll = undefined; this.feedback = undefined; this.refresh = undefined;
        this.state = undefined; this.actions = undefined; this.rows = [];
    }
}
_G.ZPCreateExtraMenuHUD = (palette, square) => new ExtraMenuHUD(palette, square);
