interface FieldControl { Index: number; Panel: GLuaPanel; Input?: ZPTextEntry; Combo?: ZPMenuComboBox<string>; }
interface CvarsHUDContract { Update(state: ZPServerCvarClientState): void; }
/** Native inputs keep editing/focus semantics while every surface uses the active palette. */
export class ServerCvarsHUD implements CvarsHUDContract {
    private state: ZPServerCvarClientState;
    private controls: FieldControl[] = [];
    private feedback: GLuaPanel;
    private entries: ZPServerCvarEntry[];
    constructor(parent: ZPMenuScrollPanel, width: number, state: ZPServerCvarClientState,
        private palette: ZPThemePalette, private square: boolean, actions: ZPServerCvarActions) {
        this.state = state;
        const category = ZPServerCvars.Categories[state.Category];
        this.entries = category ? ZPServerCvars.ForCategory(category.ID) : [];
        ZPMenuControls.ScrollPanel(parent, palette, square);
        this.feedback = this.Label(parent, "", 0, width, 42);
        this.Label(parent, language.GetPhrase(category?.SuperAdmin ? "zombieplague.scsuperadmin" : "zombieplague.schelp"), 44, width, 58);
        this.entries.forEach((entry, index) => {
            const y = 112 + index * 108;
            const label = (entry.Subject ? language.GetPhrase(entry.Subject) + " — " : "") + language.GetPhrase(entry.Label) + " (" + entry.Name + ")";
            this.Label(parent, label, y, width, 46);
            this.Label(parent, language.GetPhrase("zombieplague.scapply" + entry.Apply), y + 86, width, 20).SetColor(palette.Muted);
            const tooltip = entry.Help ? language.GetPhrase(entry.Help) : entry.Kind === "number" ?
                string.format(language.GetPhrase("zombieplague.scrange"), tostring(entry.Min ?? 0), tostring(entry.Max ?? 1000000000)) : entry.Name;
            if (entry.Kind === "toggle") {
                const button = parent.Add("DButton"); button.SetText(""); button.SetPos(0, y + 48); button.SetSize(width, 36);
                button.Paint = (w, h) => {
                    draw.RoundedBox(square ? 0 : 4, 0, 0, w, h, palette.Panel);
                    const value = this.state.Values[index] ?? entry.Default;
                    const caption = value === "1" ? language.GetPhrase("zombieplague.settingsenabled") :
                        value === "0" ? language.GetPhrase("zombieplague.settingsdisabled") : value;
                    draw.DrawText(caption,
                        "DermaDefault", 12, 10, !button.IsEnabled() ? palette.Muted : button.IsHovered() ? palette.Accent : palette.Text, TEXT_ALIGN_LEFT);
                };
                button.DoClick = () => { if (button.IsEnabled()) actions.SetCvar(index, this.state.Values[index] === "0" ? "1" : "0"); };
                button.SetTooltip(tooltip); this.controls.push({ Index: index, Panel: button });
            } else if (entry.Kind === "choice") {
                const combo = vgui.Create<string>("DComboBox", parent);
                ZPMenuControls.ComboBox(combo, palette, square);
                combo.SetPos(0, y + 48); combo.SetSize(width, 36); combo.SetSortItems(false); combo.SetTooltip(tooltip);
                for (const option of entry.Options ?? []) combo.AddChoice(language.GetPhrase(option.Label), option.Value);
                combo.OnSelect = (_index, _label, value) => actions.SetCvar(index, value);
                this.controls.push({ Index: index, Panel: combo, Combo: combo });
            } else {
                const input = vgui.Create("DTextEntry", parent);
                ZPMenuControls.TextEntry(input, palette, square);
                input.SetPos(0, y + 48); input.SetSize(width, 36); input.SetTooltip(tooltip);
                input.SetPlaceholderText(entry.Default); input.SetText(state.Values[index] ?? entry.Default);
                input.OnChange = () => actions.SetCvar(index, input.GetValue());
                this.controls.push({ Index: index, Panel: input, Input: input });
            }
        });
        this.Update(state);
    }
    private Label(parent: GLuaPanel, text: string, y: number, width: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent);
        label.SetPos(0, y); label.SetSize(width, height); label.SetFont("DermaDefault"); label.SetColor(this.palette.Text);
        label.SetWrap(true); label.SetText(text); return label;
    }
    Update(state: ZPServerCvarClientState): void {
        this.state = state;
        this.feedback.SetText(language.GetPhrase(state.Feedback) + (state.ReloadRequired ? "\n" + language.GetPhrase("zombieplague.adminreloadpending") : ""));
        for (const control of this.controls) {
            const available = state.Available[control.Index] === true, value = state.Values[control.Index] ?? "";
            control.Panel.SetEnabled(state.Ready && !state.Pending && state.CanEdit && available);
            if (state.Ready && !available) control.Panel.SetTooltip(language.GetPhrase("zombieplague.scunavailable"));
            if (control.Input && control.Input.GetValue() !== value) control.Input.SetText(value);
            if (control.Combo) {
                const option = this.entries[control.Index]?.Options?.find(item => item.Value === value);
                const caption = option ? language.GetPhrase(option.Label) : value;
                if (control.Combo.GetText() !== caption) control.Combo.SetValue(caption);
            }
        }
    }
}
