interface PopulationViewContract { Update(state: ZPAdminState): void; }
const phrase = (key: string): string => language.GetPhrase("zombieplague.botfill" + key);
export class BotPopulationHUD implements PopulationViewContract {
    private toggle: GLuaPanel;
    private count: ZPMenuComboBox<number>;
    private save: GLuaPanel;
    private status: GLuaPanel;
    private feedback: GLuaPanel;
    private limit = -1;
    private captions = new Map<GLuaPanel, string>();
    constructor(parent: GLuaPanel, width: number, private palette: ZPThemePalette, private square: boolean, actions: ZPAdminActions) {
        this.Label(parent, 0, width, 100).SetText(phrase("help"));
        this.Label(parent, 106, width, 32).SetText(phrase("enabled"));
        this.toggle = this.Button(parent, 142, width, () => actions.ToggleBotPopulation());
        this.Label(parent, 190, width, 36).SetText(phrase("target"));
        this.count = vgui.Create<number>("DComboBox", parent); this.count.SetPos(0, 230); this.count.SetSize(width, 36); this.count.SetSortItems(false);
        ZPMenuControls.ComboBox(this.count, palette, square); this.count.OnSelect = (_index, _text, value) => actions.SetBotPopulationTarget(value);
        this.status = this.Label(parent, 282, width, 80); this.feedback = this.Label(parent, 370, width, 64);
        this.save = this.Button(parent, 446, width, () => actions.SaveBotPopulation()); this.captions.set(this.save, language.GetPhrase("zombieplague.adminsave"));
    }
    private Label(parent: GLuaPanel, y: number, width: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent); label.SetPos(0, y); label.SetSize(width, height); label.SetFont("DermaDefault"); label.SetColor(this.palette.Text); label.SetWrap(true); return label;
    }
    private Button(parent: GLuaPanel, y: number, width: number, action: ZPAction): GLuaPanel {
        const button = parent.Add("DButton"); button.SetPos(0, y); button.SetSize(width, 36); button.SetText("");
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            draw.DrawText(this.captions.get(button) ?? "", "DermaDefault", 10, 10, !button.IsEnabled() ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); }; return button;
    }
    Update(state: ZPAdminState): void {
        const data = state.BotPopulation, snapshot = data.Snapshot, ready = snapshot !== undefined && !data.Pending && state.CanAddBot;
        this.captions.set(this.toggle, language.GetPhrase(data.Enabled ? "zombieplague.settingsenabled" : "zombieplague.settingsdisabled"));
        this.toggle.SetEnabled(ready); this.count.SetEnabled(ready); this.save.SetEnabled(ready && data.Dirty);
        if (snapshot && this.limit !== snapshot.Limit) {
            this.count.Clear(); this.count.AddChoice(string.format(phrase("maximum"), snapshot.Limit), 0);
            for (let value = 1; value <= snapshot.Limit; value++) this.count.AddChoice(tostring(value), value);
            this.limit = snapshot.Limit;
        }
        const text = data.Target === 0 ? string.format(phrase("maximum"), snapshot?.Limit ?? 0) : tostring(data.Target);
        if (this.count.GetText() !== text) this.count.SetValue(text);
        this.status.SetText(snapshot ? string.format(phrase("status"), snapshot.Humans, snapshot.Bots, snapshot.Connecting, snapshot.Free) : language.GetPhrase("zombieplague.weaponmenuwaiting"));
        this.feedback.SetText(language.GetPhrase(data.Feedback));
    }
}
