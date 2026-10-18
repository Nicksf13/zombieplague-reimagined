const analysis = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
const { BotStatisticsStore } = include("sv_bot_statistics_store.lua") as typeof import("./sv_bot_statistics_store");
const counters = ["Active", "Distance", "Stuck", "Replans", "Recoveries", "Falls", "Kills", "Deaths", "Dealt", "Taken", "Reward"] as const;
type Totals = Record<typeof counters[number], number>;
interface Segment { Minute: number; Base: Totals; Last: Totals; Row: ZPBotTrial; }
interface MinutesContract { Observe(row: ZPBotTrial, finished?: boolean): void; Report(query: ZPBotStatisticsFilter): ZPBotTrialSummary[]; Save(): boolean; }
/** One mutable record per original trial/minute. Polls replace snapshots instead of adding samples. */
export class BotMinuteHistory implements MinutesContract {
    private store = new BotStatisticsStore("zombieplague/bots/statistics/minutes-v1.json");
    private active = new Map<string, Segment>();
    private dirty = false;
    private Totals(row?: ZPBotTrial): Totals {
        return { Active: row?.Active ?? 0, Distance: row?.Distance ?? 0, Stuck: row?.Stuck ?? 0, Replans: row?.Replans ?? 0,
            Recoveries: row?.Recoveries ?? 0, Falls: row?.Falls ?? 0, Kills: row?.Kills ?? 0, Deaths: row?.Deaths ?? 0,
            Dealt: row?.Dealt ?? 0, Taken: row?.Taken ?? 0, Reward: row?.Reward ?? 0 };
    }
    Observe(source: ZPBotTrial, finished = false): void {
        const minute = Math.floor(os.time() / 60) * 60, totals = this.Totals(source);
        let entry = this.active.get(source.ID);
        if (!entry || entry.Minute !== minute) {
            const localTime = minute + source.UTCOffset * 60, zone = source.RecordedAt.split(" ")[2] ?? "+00:00";
            const period = os.date("!%Y-%m-%d %H:%M", localTime) + " " + zone;
            const row: ZPBotTrial = { ...source, ID: source.ID + ":m:" + minute, Timestamp: minute, Hour: period,
                RecordedAt: os.date("!%Y-%m-%d %H:%M:%S", localTime) + " " + zone, Day: os.date("!%Y-%m-%d", localTime) + " " + zone,
                Win: 0, End: "interrupted", Detail: "minute_open", Components: {} };
            entry = { Minute: minute, Base: entry?.Last ?? this.Totals(), Last: totals, Row: row };
            this.active.set(source.ID, entry); this.store.Rows.push(row);
        }
        for (const field of counters) entry.Row[field] = totals[field] - entry.Base[field];
        entry.Last = totals; entry.Row.EndedAt = os.time(); entry.Row.Seconds = Math.max(0, CurTime() - source.Started);
        if (finished) { entry.Row.End = source.End; entry.Row.Detail = source.Detail; this.active.delete(source.ID); }
        this.dirty = true;
        const excess = Math.max(0, this.store.Rows.length - 2000);
        if (excess > 0) { this.store.Rows.splice(0, excess); this.store.Dropped += excess; }
    }
    Win(source: ZPBotTrial): void {
        const prefix = source.ID + ":m:";
        for (let index = this.store.Rows.length - 1; index >= 0; index--) {
            const row = this.store.Rows[index];
            if (row?.ID.startsWith(prefix)) { row.Win = source.Win; this.dirty = true; return; }
        }
    }
    Report(query: ZPBotStatisticsFilter): ZPBotTrialSummary[] {
        const groups = new Map<string, ZPBotTrial[]>();
        for (const row of this.store.Rows) if (analysis.matches(row, query)) {
            const key = analysis.canonical([row.Bot, row.Kind, row.Role, row.Mode, row.Map, row.ClassID, row.Variant, row.Cohort,
                row.Code, row.Rewards, row.Scenario, row.Difficulty, row.Physics, row.Navigation, row.Settings, row.Equipment]);
            const id = key + row.Hour, group = groups.get(id) ?? []; group.push(row); groups.set(id, group);
        }
        const result: ZPBotTrialSummary[] = [];
        for (const [, rows] of groups) {
            const first = rows[0]; if (!first) continue;
            const key = analysis.canonical([first.Bot, first.Kind, first.Role, first.Mode, first.Map, first.ClassID, first.Variant, first.Cohort,
                first.Code, first.Rewards, first.Scenario, first.Difficulty, first.Physics, first.Navigation, first.Settings, first.Equipment]);
            const summary = analysis.summarize(rows, key, "", 0, first.Hour); summary.Descriptive = true; summary.Challenge = "";
            if (rows.some(row => row.Policy !== summary.Policy)) summary.Policy = "";
            result.push(summary);
        }
        return result.sort((a, b) => a.Period < b.Period ? -1 : a.Period > b.Period ? 1 : 0);
    }
    Save(): boolean {
        if (!this.dirty) return true;
        const saved = this.store.Save(this.store.Rows, [], this.store.Dropped); if (saved) this.dirty = false; return saved;
    }
}
