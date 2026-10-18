const { fitted } = include("cl_bot_decision_graph.lua") as typeof import("./cl_bot_decision_graph");
export const metrics = ["success", "median", "p90", "stuck", "kills", "deaths", "dealt", "taken", "wins", "reward"] as const;
export type Metric = typeof metrics[number];
export interface Point { Period: string; Hour: number; Value: number; N: number; }
export interface Series { Key: string; Summary: ZPBotTrialSummary; Points: Point[]; }
const phrase = (key: string): string => language.GetPhrase("zombieplague.botstats" + key);
export const metricLabel = (metric: Metric): string => phrase("metrics").split("|")[metrics.indexOf(metric)] ?? "";

function hour(period: string, minute = false): number | undefined {
    const parts = period.split(" "), date = (parts[0] ?? "").split("-"), timeLabel = parts[1] ?? "", time = timeLabel.split(":");
    if ((parts.length !== 2 && parts.length !== 3) || (timeLabel.length !== 2 && timeLabel.length !== 5) ||
        (!minute && time.length === 2 && time[1] !== "00")) return;
    const m = Number(time[1] ?? "0"); if (!Number.isFinite(m) || m < 0 || m > 59 || m % 1 !== 0) return;
    const year = Number(date[0]), month = Number(date[1]), day = Number(date[2]), h = Number(time[0]);
    if (date.length !== 3 || [year, month, day, h].some(value => !Number.isFinite(value) || value % 1 !== 0) || year < 1 ||
        month < 1 || month > 12 || day < 1 || day > 31 || h < 0 || h > 23) return;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const months = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > (months[month - 1] ?? 0)) return;
    let offset = 0;
    if (parts[2] !== undefined) {
        const zone = parts[2], zoneHour = Number(zone.substring(1, 3)), zoneMinute = Number(zone.substring(4, 6));
        if (zone.length !== 6 || zone.substring(3, 4) !== ":" || (zone[0] !== "+" && zone[0] !== "-") ||
            !Number.isFinite(zoneHour) || !Number.isFinite(zoneMinute) || zoneHour > 23 || zoneMinute > 59 || zoneHour < 0 || zoneMinute < 0) return;
        offset = (zoneHour + zoneMinute / 60) * (zone[0] === "-" ? -1 : 1);
    }
    let days = 365 * (year - 1) + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400) + day - 1;
    for (let index = 0; index < month - 1; index++) days += months[index] ?? 0;
    return days * 24 + h + m / 60 - offset;
}
export function value(row: ZPBotTrialSummary, metric: Metric): number | undefined {
    const navigation = metric === "success" || metric === "median" || metric === "p90" || metric === "stuck";
    if (row.Kind !== (navigation ? "navigation" : "combat")) return;
    if (metric === "success") return row.Eligible > 0 ? row.Success * 100 / row.Eligible : undefined;
    if (metric === "median" || metric === "p90") return row.Success > 0 ? (metric === "median" ? row.Median : row.P90) : undefined;
    if (metric === "stuck") return row.Active > 0 ? row.Stuck * 100 / row.Active : undefined;
    if (metric === "kills") return row.Kills;
    if (metric === "deaths") return row.Deaths;
    if (metric === "dealt" || metric === "taken") return row.Active > 0 ? (metric === "dealt" ? row.DealtPerMinute : row.TakenPerMinute) : undefined;
    if (metric === "wins") return row.Wins + row.Losses > 0 ? row.Wins * 100 / (row.Wins + row.Losses) : undefined;
    return row.N > 0 ? row.Reward / row.N : undefined;
}
/** Plot one supplied resolution only; adding daily/session summaries would double-count observations. */
export function series(rows: readonly ZPBotTrialSummary[], metric: Metric, role: string, minute = false): Series[] {
    const groups = new Map<string, Series>();
    for (const row of rows) {
        const time = hour(row.Period, minute), amount = value(row, metric);
        if (time === undefined || amount === undefined || row.Role !== role) continue;
        const group = groups.get(row.Key) ?? { Key: row.Key, Summary: row, Points: [] };
        group.Points.push({ Period: row.Period, Hour: time, Value: amount, N: row.N }); groups.set(row.Key, group);
    }
    for (const [, group] of groups) group.Points.sort((a, b) => a.Hour - b.Hour);
    return [...groups.values()];
}
interface GraphContract { Render(rows: readonly ZPBotTrialSummary[], metric: Metric, role: string): number; }
export class BotStatisticsGraph implements GraphContract {
    private panel: GLuaPanel;
    private groups: Series[] = [];
    private metric: Metric = "success";
    private minute = false;
    constructor(parent: GLuaPanel, private width: number, private palette: ZPThemePalette, private square: boolean) {
        this.panel = vgui.Create("DPanel", parent); this.panel.SetPos(0, 70); this.panel.SetSize(width, 300);
        this.panel.Paint = () => this.Paint();
    }
    Theme(palette: ZPThemePalette, square: boolean): void { this.palette = palette; this.square = square; }
    Render(rows: readonly ZPBotTrialSummary[], metric: Metric, role: string, minute = false): number {
        this.groups = series(rows, metric, role, minute); this.metric = metric; this.minute = minute;
        const height = 300 + this.groups.length * 38; this.panel.SetSize(this.width, height); return height + 70;
    }
    private Text(text: string, x: number, y: number, width: number, color: GLuaColor): void {
        draw.DrawText(fitted(text, width), "DermaDefault", x, y, color, TEXT_ALIGN_LEFT);
    }
    private Paint(): void {
        const palette = this.palette, width = this.width;
        draw.RoundedBox(this.square ? 0 : 4, 0, 0, width, 290, palette.Panel);
        this.Text(metricLabel(this.metric), 12, 10, width - 24, palette.Text);
        const points = this.groups.flatMap(group => group.Points);
        if (points.length === 0) { this.Text(phrase("empty"), 16, 120, width - 32, palette.Muted); return; }
        const minHour = Math.min(...points.map(point => point.Hour)), maxHour = Math.max(...points.map(point => point.Hour));
        let min = Math.min(0, ...points.map(point => point.Value)), max = Math.max(0, ...points.map(point => point.Value));
        if (max === min) max = min + 1;
        const left = 66, right = width - 20, top = 44, bottom = 236;
        const x = (point: Point): number => minHour === maxHour ? (left + right) / 2 : left + (point.Hour - minHour) / (maxHour - minHour) * (right - left);
        const y = (point: Point): number => bottom - (point.Value - min) / (max - min) * (bottom - top);
        for (let tick = 0; tick <= 4; tick++) {
            const pos = top + tick / 4 * (bottom - top);
            surface.SetDrawColor(palette.Muted.r, palette.Muted.g, palette.Muted.b, 80); surface.DrawLine(left, pos, right, pos);
            this.Text(string.format("%.1f", max - tick / 4 * (max - min)), 6, pos - 7, left - 10, palette.Muted);
        }
        const ordered = [...points].sort((a, b) => a.Hour - b.Hour);
        this.Text(ordered[0]?.Period ?? "", left, 254, (right - left) / 2, palette.Muted);
        this.Text(ordered[ordered.length - 1]?.Period ?? "", (left + right) / 2, 254, (right - left) / 2, palette.Muted);
        this.groups.forEach((group, index) => {
            const mix = (index % 5) / 5, base = index % 2 === 0 ? palette.Text : palette.Muted;
            const color = Color(palette.Accent.r * (1 - mix) + base.r * mix, palette.Accent.g * (1 - mix) + base.g * mix, palette.Accent.b * (1 - mix) + base.b * mix);
            surface.SetDrawColor(color.r, color.g, color.b, 255);
            group.Points.forEach((point, i) => {
                const previous = group.Points[i - 1];
                // An empty hour is unknown, not a zero or a continuous observation.
                if (previous && Math.abs(point.Hour - previous.Hour - (this.minute ? 1 / 60 : 1)) < 0.00001) surface.DrawLine(x(previous), y(previous), x(point), y(point));
                draw.RoundedBox(this.square ? 0 : 3, x(point) - 3, y(point) - 3, 6, 6, color);
            });
            const row = group.Summary, modeIndex = ["training", "evaluation", "observation"].indexOf(row.Mode);
            const mode = modeIndex >= 0 ? phrase("states").split("|")[modeIndex + 2] ?? row.Mode : row.Mode;
            const last = group.Points[group.Points.length - 1];
            this.Text(["#" + (index + 1), mode, row.Map, row.ClassID, row.Scenario, row.Difficulty, row.Code.substring(0, 8), row.Key.substring(0, 8)].join(" · "), 12, 300 + index * 38, width - 24, color);
            this.Text((last?.Period ?? "") + string.format(" · %.2f · N=%d", last?.Value ?? 0, last?.N ?? 0), 12, 317 + index * 38, width - 24, palette.Muted);
        });
    }
}
