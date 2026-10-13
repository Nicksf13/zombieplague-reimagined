export {};
const phrase = (key: string): string => language.GetPhrase("zombieplague." + key);
const classPhrase = (key: string): string => phrase(string.lower(key));
interface ClassRow { Entry: ZPClassMenuEntry; Panel: GLuaPanel; Details: GLuaPanel; DetailsHeight: number; }

class ClassMenuHUD implements ZPClassMenuPresentation {
    private frame: GLuaPanel | undefined;
    private scroll: GLuaPanel | undefined;
    private help: ZPAdminLabel | undefined;
    private refresh: GLuaPanel | undefined;
    private empty: ZPAdminLabel | undefined;
    private state: ZPClassMenuState | undefined;
    private actions: ZPClassMenuController | undefined;
    private rows: ClassRow[] = [];
    private expanded: Record<string, boolean | undefined> = {};
    private tabs: Record<ZPClassMenuKind, GLuaPanel | undefined> = { human: undefined, zombie: undefined };
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, action: ZPAction,
        active: (this: void) => boolean = () => false): GLuaPanel {
        const button = vgui.Create("DButton", parent);
        button.SetPos(x, y); button.SetSize(width, 30); button.SetText("");
        button.Paint = (w, h) => {
            const enabled = button.IsEnabled(), highlighted = enabled && (active() || button.IsHovered());
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, highlighted ? this.palette.Accent : this.palette.Panel);
            draw.DrawText(text, "Trebuchet18", 10, 5, !enabled ? this.palette.Muted : highlighted ? Color(12, 18, 22) : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
        return button;
    }

    Open(state: ZPClassMenuState, actions: ZPClassMenuController): void {
        this.actions = actions;
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        frame.SetSize(Math.min(720, ScrW() - 32), Math.min(570, ScrH() - 64)); frame.Center();
        frame.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
            draw.DrawText(phrase("mainmenuclasses"), "DermaLarge", 20, 20, this.palette.Text, TEXT_ALIGN_LEFT);
            draw.DrawText(language.GetPhrase(this.state?.Feedback ?? "zombieplague.classclass"), "DermaDefault", 20, h - 24, this.palette.Muted, TEXT_ALIGN_LEFT);
        };
        const [w, h] = frame.GetSize();
        this.Button(frame, "X", w - 50, 14, 30, () => actions.Close());
        for (const [index, kind] of (["human", "zombie"] as const).entries()) {
            this.tabs[kind] = this.Button(frame, phrase(kind === "human" ? "scoreboardtitlehumans" : "scoreboardtitlezombies"),
                20 + index * ((w - 50) / 2 + 10), 66, (w - 50) / 2, () => actions.SetKind(kind), () => this.state?.Kind === kind);
        }
        const scroll = vgui.Create("DScrollPanel", frame); this.scroll = scroll;
        scroll.SetPos(20, 110); scroll.SetSize(w - 40, Math.max(32, h - 210));
        this.help = vgui.Create("DLabel", frame);
        this.help.SetPos(20, h - 94); this.help.SetSize(w - 40, 38); this.help.SetWrap(true); this.help.SetColor(this.palette.Muted);
        this.refresh = this.Button(frame, phrase("weaponmenurefresh"), 20, h - 54, w - 40, () => actions.Refresh());
        frame.MakePopup(); frame.SetKeyboardInputEnabled(true);
        this.Update(state);
    }

    Update(state: ZPClassMenuState): void {
        this.state = state;
        if (!this.scroll || !IsValid(this.scroll)) return;
        for (const row of this.rows) row.Panel.Remove();
        this.rows = []; this.empty?.Remove(); this.empty = undefined;
        const [width] = this.scroll.GetSize();
        const entries = state.Snapshot?.Entries.filter(entry => entry.Kind === state.Kind) ?? [];
        for (const entry of entries) this.rows.push(this.ClassCard(this.scroll, entry, width - 20));
        if (entries.length === 0) {
            this.empty = vgui.Create("DLabel", this.scroll);
            this.empty.SetPos(12, 10); this.empty.SetSize(width - 24, 40); this.empty.SetWrap(true);
            this.empty.SetColor(this.palette.Muted);
            this.empty.SetText(phrase(state.Pending ? "weaponmenuwaiting" : "classmenuempty"));
        }
        this.Layout();
        this.help?.SetText(phrase(state.Snapshot?.First[state.Kind] ? "classmenufirst" : "classmenunext"));
        this.refresh?.SetEnabled(!state.Pending);
        this.tabs.human?.SetEnabled(!state.Pending && (!state.Automatic || state.Kind === "human"));
        this.tabs.zombie?.SetEnabled(!state.Pending && (!state.Automatic || state.Kind === "zombie"));
    }

    private Key(entry: ZPClassMenuEntry): string { return entry.Kind + ":" + entry.ID; }

    // Resize existing rows so expanding details keeps the native scroll position.
    private Layout(): void {
        let y = 0;
        for (const row of this.rows) {
            const expanded = this.expanded[this.Key(row.Entry)] === true;
            const [width] = row.Panel.GetSize(), height = 62 + (expanded ? row.DetailsHeight + 6 : 0);
            row.Panel.SetPos(0, y); row.Panel.SetSize(width, height); row.Details.SetVisible(expanded);
            y += height + 10;
        }
    }

    private ClassCard(parent: GLuaPanel, entry: ZPClassMenuEntry, width: number): ClassRow {
        const panel = parent.Add("DPanel"); panel.SetSize(width, 62); panel.Paint = () => {};
        const select = this.Button(panel, "", 0, 0, width - 48, () => this.actions?.Select(entry.ID));
        select.SetSize(width - 48, 62); select.SetTooltip(classPhrase(entry.Description));
        select.SetEnabled(!this.state?.Pending);
        select.Paint = (w, h) => {
            const selected = this.state?.Snapshot?.Selected[entry.Kind] === entry.ID;
            const color = selected ? Color(12, 18, 22) : !select.IsEnabled() ? this.palette.Muted : this.palette.Text;
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, selected ? this.palette.Accent : this.palette.Panel);
            if (select.IsEnabled() && select.IsHovered() && !selected) draw.RoundedBox(0, 0, 0, 3, h, this.palette.Accent);
            draw.DrawText(classPhrase(entry.Name), "Trebuchet18", 14, 10, color, TEXT_ALIGN_LEFT);
            draw.DrawText(phrase(selected ? "weaponmenuselected" : this.state?.Pending ? "weaponmenuwaiting" : "weaponmenuchoose"),
                "DermaDefault", 14, 40, selected ? color : this.palette.Muted, TEXT_ALIGN_LEFT);
        };
        const key = this.Key(entry);
        const arrow = this.Button(panel, "", width - 42, 0, 42, () => {
            this.expanded[key] = !this.expanded[key];
            arrow.SetTooltip(phrase(this.expanded[key] ? "classmenucollapse" : "classmenuexpand"));
            this.Layout();
        });
        arrow.SetSize(42, 62);
        arrow.SetTooltip(phrase(this.expanded[key] ? "classmenucollapse" : "classmenuexpand"));
        arrow.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, arrow.IsHovered() ? this.palette.Accent : this.palette.Panel);
            draw.DrawText(this.expanded[key] ? "▲" : "▼", "Trebuchet18", 14, 21,
                arrow.IsHovered() ? Color(12, 18, 22) : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        const details = panel.Add("DPanel"); details.SetPos(0, 68);
        const flag = (enabled: boolean): string => phrase(enabled ? "settingsenabled" : "settingsdisabled");
        const stats: readonly [string, number | string][] = [["classhealth", entry.Health], ["classarmor", entry.Armor],
            ["classspeed", entry.Speed], ["classrunspeed", entry.RunSpeed], ["classcrouchspeed", entry.CrouchSpeed],
            ["classgravity", entry.Gravity], ["classjump", entry.Jump], ["classdamage", entry.Damage],
            ["classbattery", entry.Battery], ["classoxygenlevel", entry.Breath], ["classscale", entry.Scale],
            ["classfootsteps", flag(entry.Footstep)], ["classfalldamage", flag(entry.FallDamage)],
            ["classabilitypower", entry.Ability], ["classabilitycost", entry.AbilityCost], ["classabilityactivation", flag(entry.AbilityOnActivation)]];
        const columns = width >= 560 ? 2 : 1, columnWidth = width / columns;
        const detailsHeight = 88 + Math.ceil(stats.length / columns) * 44;
        details.SetSize(width, detailsHeight);
        const description = vgui.Create("DLabel", details);
        description.SetPos(12, 10); description.SetSize(width - 24, 64); description.SetWrap(true);
        description.SetColor(this.palette.Text); description.SetText(classPhrase(entry.Description));
        details.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
        };
        stats.forEach(([label, value], index) => {
            const columnX = (index % columns) * columnWidth, y = 82 + Math.floor(index / columns) * 44;
            const name = vgui.Create("DLabel", details), amount = vgui.Create("DLabel", details);
            name.SetPos(columnX + 12, y); name.SetSize(columnWidth * 0.68 - 24, 40);
            name.SetFont("DermaDefault"); name.SetColor(this.palette.Muted); name.SetWrap(true); name.SetText(phrase(label));
            amount.SetPos(columnX + columnWidth * 0.68, y); amount.SetSize(columnWidth * 0.32 - 12, 40);
            amount.SetFont("DermaDefault"); amount.SetColor(this.palette.Text); amount.SetWrap(true); amount.SetText(tostring(value));
        });
        return { Entry: entry, Panel: panel, Details: details, DetailsHeight: detailsHeight };
    }

    Destroy(): void {
        if (this.frame && IsValid(this.frame)) this.frame.Remove();
        this.frame = undefined; this.scroll = undefined; this.help = undefined; this.refresh = undefined;
        this.state = undefined; this.actions = undefined; this.empty = undefined;
        this.rows = []; this.expanded = {}; this.tabs = { human: undefined, zombie: undefined };
    }
}
_G.ZPCreateClassMenuHUD = (palette, square) => new ClassMenuHUD(palette, square);
