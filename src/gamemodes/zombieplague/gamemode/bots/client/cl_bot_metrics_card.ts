const graph = include("cl_bot_decision_graph.lua") as typeof import("./cl_bot_decision_graph");
const motion = include("cl_bot_motion_hud.lua") as typeof import("./cl_bot_motion_hud");
const phrase = (key: string): string => language.GetPhrase("zombieplague." + key);
const label = (key: string): string => phrase("botmetrics" + key);
const amount = (value: number): string => string.format("%.1f", value);
const enabled = (value: boolean): string => phrase("settings" + (value ? "enabled" : "disabled"));
interface CardContract { Update(row: ZPBotDiagnostic, refreshed: number): void; Height(): number; Destroy(): void; }
export class BotMetricsCard implements CardContract {
    readonly Panel: GLuaPanel;
    private header: GLuaPanel;
    private detail: GLuaPanel;
    private button: GLuaPanel;
    private row: ZPBotDiagnostic;
    private refreshed = 0;
    private expanded = false;
    private moving = false;
    constructor(parent: GLuaPanel, row: ZPBotDiagnostic, private width: number, private palette: ZPThemePalette,
        private square: boolean, relayout: ZPAction) {
        this.row = row;
        const panel = parent.Add("DPanel"); this.Panel = panel;
        panel.Paint = (w, h) => draw.RoundedBox(square ? 0 : 6, 0, 0, w, h, palette.Panel);
        this.header = this.Label(panel, 10, 80);
        const diagram = panel.Add("DPanel"); diagram.SetPos(0, 132); diagram.SetSize(width, 398);
        diagram.SetTooltip(phrase("botvisuallegend"));
        diagram.Paint = () => (this.moving ? motion.paint : graph.paint)(this.row, this.width, this.palette, this.square, CurTime() - this.refreshed < 2.5);
        const outcomes = panel.Add("DPanel"); outcomes.SetPos(12, 538); outcomes.SetSize(width - 24, 104);
        outcomes.Paint = () => this.Outcomes();
        this.button = panel.Add("DButton"); this.button.SetPos(12, 650); this.button.SetSize(width - 24, 30); this.button.SetText("");
        this.button.Paint = (w, h) => {
            draw.RoundedBox(square ? 0 : 4, 0, 0, w, h, palette.Surface);
            draw.DrawText((this.expanded ? "− " : "+ ") + phrase("botvisualdetails"), "DermaDefault", 10, 8,
                this.button.IsHovered() ? palette.Accent : palette.Text, TEXT_ALIGN_LEFT);
        };
        this.button.DoClick = () => { this.expanded = !this.expanded; this.detail.SetVisible(this.expanded); relayout(); };
        this.detail = this.Label(panel, 692, this.DetailHeight()); this.detail.SetVisible(false);
        for (const [index, key] of (["combat", "title"] as const).entries()) {
            const tab = panel.Add("DButton"); tab.SetText(""); tab.SetPos(12 + index * (width - 24) / 2, 94); tab.SetSize((width - 28) / 2, 30);
            tab.Paint = (w, h) => {
                draw.RoundedBox(square ? 0 : 4, 0, 0, w, h, palette.Surface);
                draw.DrawText(phrase("botmotion" + key), "DermaDefault", 10, 8,
                    this.moving === (index === 1) || tab.IsHovered() ? palette.Accent : palette.Muted, TEXT_ALIGN_LEFT);
            };
            tab.DoClick = () => { this.moving = index === 1; diagram.SetTooltip(phrase(this.moving ? "botmotionpreferences" : "botvisuallegend")); };
        }
    }
    private Label(parent: GLuaPanel, y: number, height: number): GLuaPanel {
        const panel = vgui.Create("DLabel", parent); panel.SetPos(12, y); panel.SetSize(this.width - 24, height);
        panel.SetWrap(true); panel.SetFont("DermaDefault"); panel.SetColor(this.palette.Text);
        return panel;
    }
    private DetailHeight(): number { return this.width < 560 ? 830 : 580; }
    Height(): number { return 692 + (this.expanded ? this.DetailHeight() + 12 : 0); }
    private Outcomes(): void {
        const width = this.width - 24;
        for (const [index, action] of (["attack", "defend", "retreat", "group"] as const).entries()) {
            const entry = this.row.Totals.Actions[action], y = index * 26, total = Math.max(1, entry.Episodes);
            const barX = Math.min(138, width * 0.4), barWidth = width - barX - 8;
            draw.DrawText(graph.fitted(label(action), barX - 8), "DermaDefault", 0, y, this.palette.Text, TEXT_ALIGN_LEFT);
            draw.RoundedBox(0, barX, y + 3, barWidth, 12, this.palette.Surface);
            draw.RoundedBox(0, barX, y + 3, barWidth * entry.Positive / total, 12, this.palette.Accent);
            draw.RoundedBox(0, barX + barWidth * entry.Positive / total, y + 3, barWidth * entry.Negative / total, 12, this.palette.Muted);
            draw.DrawText(string.format("+%d / −%d", entry.Positive, entry.Negative), "DermaDefault", barX + 4, y + 1, this.palette.Text, TEXT_ALIGN_LEFT);
        }
    }
    Update(row: ZPBotDiagnostic, refreshed: number): void {
        this.row = row; this.refreshed = refreshed;
        const scope = row.Scope, totals = row.Totals;
        const classKey = scope.ClassName.startsWith("zombieplague.") ? scope.ClassName : "zombieplague." + scope.ClassName.toLowerCase();
        const localized = language.GetPhrase(classKey), className = localized === classKey ? scope.ClassName : localized;
        this.header.SetText([
            string.format(label("identity"), row.ID, row.Name, label(row.Profile), phrase("scoreboardstatus" + (row.Alive ? "alive" : "dead"))),
            string.format(label("scope"), scope.Map, phrase(scope.Role === "human" ? "scoreboardtitlehumans" : "scoreboardtitlezombies"), className + " [" + scope.ClassID + "]", scope.Variant === "normal" ? "—" : phrase(scope.Variant)),
            string.format(label("learning"), row.Samples, amount(row.LastReward)),
        ].join("\n"));
        this.detail.SetText([
            string.format(label("decision"), label(row.Action), label(row.Reason), enabled(row.Active)),
            string.format(label("route"), label(row.Route), amount(row.Remaining), totals.Replans, enabled(row.Blocked)),
            string.format(label("destination"), row.Goal.length > 0 ? row.Goal : "—", amount(totals.Progress), totals.Arrivals),
            string.format(label("movement"), amount(totals.Distance), amount(totals.StuckSeconds), totals.Recoveries),
            string.format(label("water"), amount(totals.WaterSeconds), totals.WaterEscapes),
            string.format(label("stamina"), amount(row.Breath), amount(row.MaxBreath), enabled(row.Sprinting), enabled(row.DrainEnabled)),
            string.format(label("resources"), amount(totals.SprintSeconds), amount(totals.BreathSpent)),
            string.format(label("combat"), amount(totals.DamageDealt), amount(totals.DamageTaken), totals.Kills, totals.Deaths, totals.Infections),
            ...(["attack", "defend", "retreat", "group"] as const).map(action => {
                const entry = totals.Actions[action];
                return string.format(label("outcomes"), label(action), entry.Episodes, entry.Positive, entry.Negative, amount(entry.Reward));
            }),
            ...(row.Motion ? [
                phrase("botmotiontitle"),
                string.format(phrase("botmotionstage"), row.Motion.From, row.Motion.To),
                string.format(phrase("botmotionresult"), row.Motion.Successes, row.Motion.Failures, row.Motion.Goals),
                string.format(phrase("botmotionreward"), row.Motion.Samples, row.Motion.Reward),
                string.format(phrase("botmotionprogress"), row.Motion.Progress, row.Motion.Seconds, row.Motion.Stuck),
                string.format(phrase("botmotionrecovery"), row.Motion.Recoveries, row.Motion.Water, row.Motion.Ladders),
                string.format(phrase("botmotionresources"), row.Motion.Breath, row.Motion.Harm),
                ...(row.Motion.Navigation ? motion.navigationLines(row.Motion.Navigation) : []),
            ] : []),
            ...(row.Place ? [
                phrase("botplacetitle") + " · " + phrase("botplace" + row.Place.State),
                row.Place.Reason === "clue" ? phrase("botplaceclue") : label(row.Place.Reason),
                row.Place.Point.length > 0 ? row.Place.Point.join(", ") : "—",
                string.format(phrase("botplacerecord"), row.Place.Visits, row.Place.Finds, row.Place.Value),
                string.format(phrase("botplaceoutcomes"), row.Place.Escapes, row.Place.Deaths, row.Place.Empty, row.Place.Damage),
                string.format(phrase("botplacehold"), row.Place.Hold, row.Place.Seconds),
            ] : []),
        ].join("\n"));
    }
    Destroy(): void { this.Panel.Remove(); }
}
