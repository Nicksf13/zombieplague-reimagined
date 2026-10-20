export class AdminRoundsHUD {
    private list: GLuaPanel | undefined;
    private feedback: ZPAdminLabel;
    private state: ZPAdminRoundsState | undefined;
    private signature = "";
    private buttons: { ID: string; Panel: GLuaPanel; }[] = [];
    constructor(private parent: GLuaPanel, private width: number, private palette: ZPThemePalette,
        private square: boolean, private actions: ZPAdminActions) {
        this.feedback = this.Label("", 0, 36);
        this.Label("zombieplague.adminroundhelp", 40, 80);
    }
    private Label(key: string, y: number, height: number): ZPAdminLabel {
        const label = vgui.Create("DLabel", this.parent);
        label.SetPos(0, y); label.SetSize(this.width, height); label.SetWrap(true);
        label.SetFont("DermaDefault"); label.SetColor(this.palette.Text); label.SetText(language.GetPhrase(key));
        return label;
    }
    Update(state: ZPAdminRoundsState): void {
        this.state = state;
        this.feedback.SetText(language.GetPhrase(state.Feedback !== "" ? state.Feedback :
            state.Pending && state.Entries.length === 0 ? "zombieplague.weaponmenuwaiting" : ""));
        const signature = state.Entries.map(entry => entry.ID + ":" + entry.Name + ":" + entry.MinPlayers).join("|");
        if (!this.list || signature !== this.signature) {
            this.signature = signature; this.list?.Remove(); this.buttons = [];
            const list = this.parent.Add("DPanel"); this.list = list;
            list.SetPos(0, 132); list.SetSize(this.width, Math.max(1, state.Entries.length * 80)); list.Paint = () => {};
            state.Entries.forEach((entry, index) => {
                const button = list.Add("DButton"); button.SetText("");
                button.SetPos(0, index * 80); button.SetSize(this.width, 72);
                button.SetTooltip(language.GetPhrase("zombieplague.adminroundunavailable"));
                button.Paint = (w, h) => {
                    const enabled = button.IsEnabled();
                    draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
                    if (enabled && button.IsHovered()) draw.RoundedBox(0, 0, 0, 3, h, this.palette.Accent);
                    const key = "zombieplague." + string.lower(entry.Name);
                    const translated = language.GetPhrase(key);
                    draw.DrawText(translated === key ? entry.Name : translated, "Trebuchet18", 12, 10,
                        !enabled ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
                    draw.DrawText(string.format(language.GetPhrase("zombieplague.adminroundminimum"), entry.MinPlayers),
                        "DermaDefault", 12, 44, this.palette.Muted, TEXT_ALIGN_LEFT);
                };
                button.DoClick = () => {
                    if (button.IsEnabled() && !this.state?.Pending) this.actions.StartRound(entry.ID);
                };
                this.buttons.push({ ID: entry.ID, Panel: button });
            });
        }
        for (const button of this.buttons)
            button.Panel.SetEnabled(!state.Pending && (state.Entries.find(entry => entry.ID === button.ID)?.Allowed ?? false));
    }
}
