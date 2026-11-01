const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
const phrase = (key: string): string => language.GetPhrase("zombieplague.pstats" + key);
const roleLabel = (role: ZPStatisticsRole): string => language.GetPhrase("zombieplague." +
    (role === "human" ? "humandefaultclassname" : role === "zombie" ? "zombiedefaultclassname" : role));
interface PresentationContract { Update(state: ZPStatisticsMenuState): void; Destroy(): void; }
export class PlayerStatisticsHUD implements PresentationContract {
    private frame: GLuaPanel;
    private map: ZPMenuComboBox<string>;
    private role: ZPMenuComboBox<ZPStatisticsRole>;
    private metric: ZPMenuComboBox<ZPStatisticsMetric>;
    private weapon: ZPMenuComboBox<string>;
    private list: GLuaPanel | undefined;
    private mapSignature = "";
    private weaponSignature = "";
    private state: ZPStatisticsMenuState | undefined;
    private width: number;
    private height: number;
    constructor(private palette: ZPThemePalette, private square: boolean, private actions: ZPStatisticsMenu) {
        this.width = Math.min(1020, ScrW() - 32); this.height = Math.min(720, ScrH() - 48);
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        frame.SetSize(this.width, this.height); frame.Center(); frame.MakePopup();
        frame.Paint = (w, h) => {
            draw.RoundedBox(square ? 0 : 8, 0, 0, w, h, palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, palette.Accent);
            draw.DrawText(phrase("title"), "ZPMenuOptionTitle", 20, 18, palette.Text, TEXT_ALIGN_LEFT);
            draw.DrawText(ZPMenuControls.FitText(phrase("help"), w - 40), "DermaDefault", 20, h - 30, palette.Muted, TEXT_ALIGN_LEFT);
            const state = this.state, report = state?.Report;
            const status = state?.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") :
                state?.Status === "disabled" ? phrase("disabled") : !report ? phrase("unavailable") :
                report.SelfRank > 0 ? string.format(phrase("position"), report.SelfRank, report.Players,
                    this.Format(state.Query.Metric, report.SelfValue)) : phrase("unranked");
            draw.DrawText(status, "DermaDefault", 20, 148, palette.Accent, TEXT_ALIGN_LEFT);
        };
        ZPMenuControls.CloseButton(this.Button(frame, "X", this.width - 50, 16, 30, () => actions.Close()), palette, square);
        const third = (this.width - 56) / 3;
        this.map = this.Combo<string>(20, third); this.role = this.Combo<ZPStatisticsRole>(28 + third, third);
        this.metric = this.Combo<ZPStatisticsMetric>(36 + third * 2, third);
        this.map.OnSelect = (_i, _text, value) => this.Select(value);
        for (const role of schema.roles) this.role.AddChoice(roleLabel(role), role);
        this.role.OnSelect = (_i, _text, value) => this.Select(undefined, value);
        for (const metric of schema.metrics) this.metric.AddChoice(phrase(metric.toLowerCase()), metric);
        this.metric.OnSelect = (_i, _text, value) => this.Select(undefined, undefined, value);
        this.weapon = this.Combo<string>(20, this.width - 40); this.weapon.SetPos(20, 102);
        this.weapon.OnSelect = (_i, _text, value) => {
            const query = this.state?.Query;
            if (query) this.actions.Select(query.Map, query.Role, weapons.supports(query.Metric) ? query.Metric : "Kills", "", value);
        };
    }
    private Combo<T>(x: number, width: number): ZPMenuComboBox<T> {
        const combo = vgui.Create<T>("DComboBox", this.frame); combo.SetPos(x, 60); combo.SetSize(width, 34);
        combo.SetSortItems(false); ZPMenuControls.ComboBox(combo, this.palette, this.square); return combo;
    }
    private Select(map?: string, role?: ZPStatisticsRole, metric?: ZPStatisticsMetric): void {
        const query = this.state?.Query;
        if (query) this.actions.Select(map ?? query.Map, role ?? query.Role, metric ?? query.Metric, "");
    }
    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, action: ZPAction): GLuaPanel {
        const button = parent.Add("DButton"); button.SetPos(x, y); button.SetSize(width, 30); button.SetText("");
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            draw.DrawText(text, "DermaDefault", 8, 8, !button.IsEnabled() ? this.palette.Muted :
                button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); }; return button;
    }
    private Format(metric: ZPStatisticsMetric, value: number): string {
        if (metric === "AliveTime" || metric === "BestSurvival")
            return string.format("%02d:%02d:%02d", Math.floor(value / 3600), Math.floor(value / 60) % 60, Math.floor(value) % 60);
        if (metric === "Distance") return string.format("%.1f m", value * 0.01905);
        return string.format("%.0f", value);
    }
    Update(state: ZPStatisticsMenuState): void {
        this.state = state;
        const maps = state.Report?.Maps ?? [], signature = maps.join("|");
        if (this.mapSignature !== signature || !this.list) {
            this.mapSignature = signature; this.map.Clear(); this.map.AddChoice(phrase("general"), "");
            for (const map of maps) this.map.AddChoice(map, map);
        }
        this.map.SetValue(state.Query.Map.length > 0 ? state.Query.Map : phrase("general")); this.role.SetValue(roleLabel(state.Query.Role));
        this.metric.SetValue(phrase(state.Query.Metric.toLowerCase()));
        const options = state.Report?.Weapons ?? [], weaponSignature = options.map(option => option.ID + ":" + option.Name).join("|");
        if (weaponSignature !== this.weaponSignature || !this.list) {
            this.weaponSignature = weaponSignature; this.weapon.Clear(); this.weapon.AddChoice(phrase("allweapons"), "");
            for (const option of options) this.weapon.AddChoice(this.WeaponName(option.ID, option.Name), option.ID);
        }
        const weaponID = state.Query.Weapon ?? "";
        this.weapon.SetValue(weaponID.length > 0 ? this.WeaponName(weaponID, options.find(option => option.ID === weaponID)?.Name ?? weaponID) : phrase("allweapons"));
        const enabled = state.Status !== "disabled";
        this.map.SetEnabled(enabled); this.role.SetEnabled(enabled); this.metric.SetEnabled(enabled);
        this.weapon.SetEnabled(enabled);
        this.list?.Remove();
        const list = vgui.Create("DScrollPanel", this.frame); this.list = list;
        list.SetPos(20, 178); list.SetSize(this.width - 40, this.height - 224);
        ZPMenuControls.ScrollPanel(list, this.palette, this.square);
        const column = (this.width - 76) / 2, report = state.Report;
        this.Button(list, phrase("refresh"), 0, 0, column, () => this.actions.Refresh());
        this.Button(list, phrase("mine"), column + 16, 0, column, () => this.actions.Select(
            state.Query.Map, state.Query.Role, state.Query.Metric, ""));
        if (!report || state.Pending || state.Status !== "ready") return;
        report.Leaders.forEach((row, index) => {
            const selected = row.ID === report.Profile.ID;
            const button = this.Button(list, "", 0, 42 + index * 48, column, () => this.actions.Select(
                state.Query.Map, state.Query.Role, state.Query.Metric, row.ID));
            const name = row.Bot ? string.format(phrase("botplayer"), row.Name) : row.Name;
            button.SetSize(column, 42); button.SetTooltip(name);
            button.Paint = (w, h) => {
                draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
                const color = selected || button.IsHovered() ? this.palette.Accent : this.palette.Text;
                draw.DrawText(ZPMenuControls.FitText(tostring(row.Rank) + ". " + name, w - 16), "DermaDefault", 8, 4, color, TEXT_ALIGN_LEFT);
                draw.DrawText(this.Format(state.Query.Metric, row.Value), "DermaDefault", 8, 23, color, TEXT_ALIGN_LEFT);
            };
        });
        const totals = report.Profile.Roles[state.Query.Role];
        const filtered = weaponID.length > 0;
        const values = filtered ? { ...totals, ...(report.WeaponValues ?? weapons.counters()) } : totals;
        const visible: readonly ZPStatisticsMetric[] = filtered ? weapons.metrics : schema.metrics;
        const offset = filtered ? 74 : 42;
        const profile = vgui.Create("DPanel", list); profile.SetPos(column + 16, 42); profile.SetSize(column, offset + visible.length * 46);
        profile.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            const name = report.Profile.Bot ? string.format(phrase("botplayer"), report.Profile.Name) : report.Profile.Name;
            draw.DrawText(ZPMenuControls.FitText(name.length > 0 ? name : phrase("mine"), w - 20, "Trebuchet18"),
                "Trebuchet18", 10, 10, this.palette.Accent, TEXT_ALIGN_LEFT);
            if (filtered) draw.DrawText(ZPMenuControls.FitText(string.format(phrase("weapontotalvalue"), this.Format(state.Query.Metric, totals[state.Query.Metric])), w - 20),
                "DermaDefault", 10, 42, this.palette.Muted, TEXT_ALIGN_LEFT);
            visible.forEach((metric, index) => {
                draw.DrawText(ZPMenuControls.FitText(phrase(metric.toLowerCase()), w - 20), "DermaDefault", 10, offset + index * 46, this.palette.Text, TEXT_ALIGN_LEFT);
                draw.DrawText(this.Format(metric, values[metric]), "DermaDefault", 10, offset + 19 + index * 46, this.palette.Accent, TEXT_ALIGN_LEFT);
            });
        };
    }
    private WeaponName(id: string, name: string): string {
        if (id === "unattributed") return phrase("unknownweapon");
        return name.startsWith("#") ? language.GetPhrase(name.substring(1)) : name;
    }
    Destroy(): void { this.frame.Remove(); }
}
