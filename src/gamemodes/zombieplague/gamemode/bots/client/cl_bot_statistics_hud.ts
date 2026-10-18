import type { BotStatisticsGraph as GraphType, Metric } from "./cl_bot_statistics_graph";
const { BotStatisticsGraph, metrics, metricLabel } = include("cl_bot_statistics_graph.lua") as typeof import("./cl_bot_statistics_graph");
const phrase = (key: string): string => language.GetPhrase("zombieplague.botstats" + key);
const stateIDs = ["navigation", "combat", "training", "evaluation", "observation", "success", "fall", "enemy", "environment", "unknown", "timeout", "interrupted", "path_failure", "missing_nav"];
const stateLabel = (value: string): string => phrase("states").split("|")[stateIDs.indexOf(value)] ?? value;
interface StatisticsHUDContract { Render(data: ZPBotStatisticsReport, exported: boolean): void; Destroy(): void; }
export class BotStatisticsHUD implements StatisticsHUDContract {
    private frame: GLuaPanel;
    private scroll: ZPMenuScrollPanel;
    private filters = new Map<keyof ZPBotStatisticsFilter, ZPTextEntry>();
    private width: number;
    private label: GLuaPanel;
    private labels: GLuaPanel[] = [];
    private combos: ZPMenuComboBox<string>[] = [];
    private botChoice: ZPMenuComboBox<string>;
    private bot = "";
    private role = "human";
    private metric: Metric = "success";
    private graph: GraphType;
    private report: ZPBotStatisticsReport | undefined;
    private displayed: ZPBotStatisticsFilter | undefined;
    private identities = "";
    constructor(private palette: ZPThemePalette, private square: boolean, private request: (this: void, filter: ZPBotStatisticsFilter, exporting: boolean) => boolean) {
        const frame = vgui.Create("DFrame"); this.frame = frame;
        this.width = Math.min(960, ScrW() - 32); const height = Math.min(760, ScrH() - 48);
        frame.SetSize(this.width, height); frame.Center(); frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDeleteOnClose(true);
        frame.Paint = (w, h) => draw.RoundedBox(this.square ? 0 : 6, 0, 0, w, h, this.palette.Surface);
        this.Label(frame, phrase("title"), 16, 38);
        this.Button(frame, "X", this.width - 54, 10, 36, () => this.Destroy());
        const spacing = (this.width - 48) / 3;
        const combo = (index: number, label: string): ZPMenuComboBox<string> => {
            const title = this.Label(frame, label, 56, 20); title.SetPos(20 + index * spacing, 56); title.SetSize(spacing - 8, 20);
            const input = vgui.Create<string>("DComboBox", frame); input.SetPos(20 + index * spacing, 80); input.SetSize(spacing - 8, 34);
            input.SetSortItems(false); ZPMenuControls.ComboBox(input, palette, square); this.combos.push(input); return input;
        };
        this.botChoice = combo(0, phrase("bot")); this.botChoice.SetValue(phrase("select"));
        this.botChoice.OnSelect = (_index, text, id) => {
            if (this.bot === id) return;
            this.bot = id; this.botChoice.SetValue(text); this.Send(false);
        };
        const role = combo(1, phrase("role"));
        for (const id of ["human", "zombie"]) role.AddChoice(language.GetPhrase("zombieplague." + id + "defaultclassname"), id);
        role.SetValue(language.GetPhrase("zombieplague.humandefaultclassname"));
        role.OnSelect = (_index, text, id) => { if (id === this.role) return; this.role = id; role.SetValue(text); this.Send(false); };
        const metric = combo(2, phrase("metric"));
        for (const id of metrics) metric.AddChoice(metricLabel(id), id);
        metric.SetValue(metricLabel(this.metric));
        metric.OnSelect = (_index, text, id) => {
            const selected = metrics.find(value => value === id); if (!selected) return;
            this.metric = selected; metric.SetValue(text); this.Plot();
        };
        const keys = ["Version", "Scenario", "Difficulty", "Period"] as const;
        keys.forEach((key, index) => {
            const input = vgui.Create("DTextEntry", frame); input.SetPos(20 + index * (this.width - 40) / 4, 126); input.SetSize((this.width - 40) / 4 - 8, 34);
            input.SetText(""); input.SetPlaceholderText(phrase(key.toLowerCase())); ZPMenuControls.TextEntry(input, palette, square); this.filters.set(key, input);
        });
        this.Button(frame, language.GetPhrase("zombieplague.adminrefresh"), 20, 174, (this.width - 48) / 2, () => this.Send(false));
        this.Button(frame, phrase("export"), this.width / 2 + 4, 174, this.width / 2 - 24, () => this.Send(true));
        this.scroll = vgui.Create("DScrollPanel", frame); this.scroll.SetPos(20, 222); this.scroll.SetSize(this.width - 40, height - 284);
        ZPMenuControls.ScrollPanel(this.scroll, palette, square);
        this.Label(this.scroll, phrase("graphhelp"), 0, 62);
        this.graph = new BotStatisticsGraph(this.scroll, this.width - 60, palette, square);
        this.label = this.Label(this.scroll, phrase("help"), 0, 140);
        this.Plot();
        this.Button(frame, language.GetPhrase("zombieplague.settingsback"), 20, height - 46, this.width - 40, () => {
            this.Destroy(); ZPAdminMenu.Open(); ZPAdminMenu.Navigate("bots");
        });
        frame.MakePopup(); this.Send(false);
    }
    private Query(): ZPBotStatisticsFilter {
        const filter: ZPBotStatisticsFilter = { Bot: this.bot, Role: this.role, Version: "", Scenario: "", Difficulty: "", Period: "" };
        for (const [key, input] of this.filters) filter[key] = input.GetValue().substring(0, 128);
        return filter;
    }
    private Send(exporting: boolean): void {
        if (this.request(this.Query(), exporting)) {
            this.displayed = undefined; this.Plot(); this.label.SetText(language.GetPhrase("zombieplague.weaponmenuwaiting"));
        }
    }
    private Plot(): void {
        const matches = this.displayed?.Bot === this.bot && this.bot !== "" && this.displayed.Role === this.role;
        const minutes = this.report?.Minutes ?? [], minute = minutes.length > 0;
        const height = this.graph.Render(matches ? minute ? minutes : this.report?.Timeline ?? [] : [], this.metric, this.role, minute);
        this.label.SetPos(20, height + 16);
    }
    Alive(): boolean { return IsValid(this.frame); }
    private Label(parent: GLuaPanel, text: string, y: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent); label.SetPos(20, y); label.SetSize(this.width - 100, height); label.SetWrap(true);
        label.SetFont("DermaDefault"); label.SetColor(this.palette.Text); label.SetText(text); this.labels.push(label); return label;
    }
    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, action: ZPAction): void {
        const button = parent.Add("DButton"); button.SetPos(x, y); button.SetSize(width, 34); button.SetText("");
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            draw.DrawText(text, "DermaDefault", 10, 9, !button.IsEnabled() ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
    }
    Render(data: ZPBotStatisticsReport, exported: boolean, query?: ZPBotStatisticsFilter): void {
        const bots = data.Bots ?? [...new Set(data.History.map(row => row.Bot))];
        if (bots.join(",") !== this.identities) {
            this.identities = bots.join(","); this.botChoice.Clear();
            for (const id of bots) this.botChoice.AddChoice(phrase("bot") + " #" + id, tostring(id));
            this.botChoice.SetValue(this.bot === "" ? phrase("select") : phrase("bot") + " #" + this.bot);
        }
        this.botChoice.SetEnabled(bots.length > 0);
        if (this.bot === "" && bots[0] !== undefined) {
            this.bot = tostring(bots[0]); this.botChoice.SetValue(phrase("bot") + " #" + this.bot); this.Send(false); return;
        }
        this.report = data; this.displayed = query; this.Plot();
        const lines = [phrase("help"), string.format(phrase("counts"), data.Total, data.Dropped, data.Truncated), exported ? phrase("exported") : ""];
        for (const group of [...data.Timeline, ...data.Groups]) {
            const role = language.GetPhrase("zombieplague." + (group.Role === "zombie" ? "zombiedefaultclassname" : "humandefaultclassname"));
            lines.push([group.Descriptive ? "≈" : "", group.Period, stateLabel(group.Kind), stateLabel(group.Mode), role, group.Map, group.Scenario, group.Difficulty, group.ClassID, group.Policy.substring(0, 16), group.Session, "#" + group.Block].join(" | "));
            if (group.Kind === "navigation") {
                lines.push(string.format(phrase("summary"), group.N, group.Success, group.Eligible, group.Falls, group.Timeouts, group.Median, group.P90, group.Stuck));
                lines.push(string.format(phrase("interval"), group.Sessions, group.Low * 100, group.High * 100, group.Interrupted, group.Infrastructure));
                lines.push(stateLabel("fall") + string.format(" [%.1f–%.1f%%] · ", group.FallLow * 100, group.FallHigh * 100) +
                    stateLabel("timeout") + string.format(" [%.1f–%.1f%%]", group.TimeoutLow * 100, group.TimeoutHigh * 100));
            }
            lines.push(string.format(phrase("combat"), group.Kills, group.Deaths, group.DealtPerMinute, group.TakenPerMinute, group.Wins, group.Losses, group.Reward));
        }
        for (const comparison of data.Comparisons) lines.push(comparison.Current.substring(0, 16) + " / " + comparison.Previous.substring(0, 16) + ": " + phrase(comparison.Result) + (comparison.RewardWarning ? " · " + phrase("rewardwarning") : ""));
        for (const row of data.History) lines.push(row.RecordedAt + " | " + row.ID + " | " + stateLabel(row.Kind) + " | " + stateLabel(row.End) + " | " + string.format("%.1fs", row.Seconds));
        surface.SetFont("DermaDefault"); let height = 32;
        for (const line of lines) { const [width] = surface.GetTextSize(line); height += (Math.ceil(width / Math.max(1, this.width - 100)) + 1) * 18; }
        this.label.SetText(lines.join("\n")); this.label.SetSize(this.width - 100, height);
    }
    Timeout(): void { this.label.SetText(language.GetPhrase("zombieplague.weaponmenutimeout")); }
    Theme(palette: ZPThemePalette, square: boolean): void {
        if (this.palette === palette && this.square === square) return;
        this.palette = palette; this.square = square;
        for (const label of this.labels) label.SetColor(palette.Text);
        for (const [, input] of this.filters) ZPMenuControls.TextEntry(input, palette, square);
        for (const input of this.combos) ZPMenuControls.ComboBox(input, palette, square);
        this.graph.Theme(palette, square);
        ZPMenuControls.ScrollPanel(this.scroll, palette, square);
    }
    Destroy(): void { if (IsValid(this.frame)) this.frame.Remove(); }
}
