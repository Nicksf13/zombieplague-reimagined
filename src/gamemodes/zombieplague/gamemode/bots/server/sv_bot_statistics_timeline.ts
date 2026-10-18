const analysis = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
interface Cluster { N: number; Success: number; Falls: number; Timeouts: number; }
interface Bucket {
    Bot: number; Day: string; Timestamp: number; Summary: ZPBotTrialSummary; Histogram: number[];
    Clusters: Record<string, Cluster | undefined>; Overflow: boolean; Dealt: number; Taken: number;
}
const path = "zombieplague/bots/statistics/timeline-v1.json";
const emptyFilter = (): ZPBotStatisticsFilter => ({ Bot: "", Version: "", Scenario: "", Difficulty: "", Role: "", Period: "" });
const nonnegative = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 1e12;
const sums = ["N", "Eligible", "Success", "Falls", "Timeouts", "Interrupted", "Infrastructure", "Active", "Stuck", "Kills", "Deaths", "Wins", "Losses", "Reward"] as const;
interface TimelineContract { Add(row: ZPBotTrial): void; Save(): boolean; Report(query: ZPBotStatisticsFilter): ZPBotTrialSummary[]; }
/** Durable descriptive hour buckets outlive the bounded raw-event buffer. No bucket drives version inference. */
export class BotStatisticsTimeline implements TimelineContract {
    private buckets = new Map<string, Bucket>();
    private previous: string | undefined;
    private writable = true;
    private dirty = false;
    private nextTrim = 0;
    Dropped = 0;
    constructor() {
        const raw = file.Read(path, "DATA"); if (raw === undefined) return;
        const data = raw.length <= 8388608 ? analysis.record(util.JSONToTable(raw)) : undefined;
        let valid = data?.Version === 1 && nonnegative(data.Dropped) && Array.isArray(data.Buckets) && data.Buckets.length <= 4096;
        if (valid && Array.isArray(data?.Buckets)) for (const value of data.Buckets) {
            const entry = analysis.record(value), summary = analysis.record(entry?.Summary), clusters = analysis.record(entry?.Clusters);
            const parsed = analysis.parseReport({ Version: 1, Session: "", Total: 0, Dropped: 0, TimelineDropped: 0, Truncated: 0, Groups: summary ? [summary] : [], Timeline: [], History: [], Comparisons: [] });
            if (!entry || !summary || !parsed || !nonnegative(entry.Bot) || entry.Bot < 1 || entry.Bot > 64 || !nonnegative(entry.Timestamp) ||
                typeof entry.Day !== "string" || entry.Day.length > 40 || typeof entry.Overflow !== "boolean" || !nonnegative(entry.Dealt) || !nonnegative(entry.Taken) ||
                !Array.isArray(entry.Histogram) || entry.Histogram.length !== 96 || !entry.Histogram.every(value => nonnegative(value)) || !clusters || Object.keys(clusters).length > 512) { valid = false; break; }
            for (const [id, value] of pairs(clusters)) {
                const cluster = analysis.record(value);
                if (id.length > 128 || !cluster || !nonnegative(cluster.N) || !nonnegative(cluster.Success) || !nonnegative(cluster.Falls) || !nonnegative(cluster.Timeouts) ||
                    cluster.Success > cluster.N || cluster.Falls > cluster.N || cluster.Timeouts > cluster.N) { valid = false; break; }
            }
            if (!valid) break;
            const bucket = entry as unknown as Bucket, key = bucket.Summary.Key + ":" + bucket.Summary.Period;
            if (this.buckets.has(key)) { valid = false; break; }
            this.buckets.set(key, bucket);
        }
        if (!valid) { this.buckets.clear(); this.writable = false; print("[ZP statistics] Invalid timeline preserved; writes disabled until repair/restart."); }
        else { this.previous = raw; this.Dropped = data?.Dropped as number; }
    }
    private Key(row: ZPBotTrial): string {
        return util.SHA256(analysis.canonical([row.Bot, row.Kind, row.Mode, row.Code, row.Rewards, row.Map, row.Scenario, row.Difficulty, row.Cohort,
            row.Role, row.ClassID, row.Variant, row.Physics, row.Navigation, row.Settings, row.Equipment]));
    }
    private Clone(bucket: Bucket): Bucket {
        const clusters: Bucket["Clusters"] = {}; for (const [id, cluster] of pairs(bucket.Clusters)) if (cluster) clusters[id] = { ...cluster };
        return { ...bucket, Summary: { ...bucket.Summary }, Histogram: [...bucket.Histogram], Clusters: clusters };
    }
    Add(row: ZPBotTrial): void {
        const key = this.Key(row), id = key + ":" + row.Hour;
        let bucket = this.buckets.get(id);
        if (!bucket) {
            const summary = analysis.summarize([], key, "", 0, row.Hour), first = analysis.summarize([row], key);
            for (const field of ["Kind", "Mode", "Policy", "Scenario", "Role", "Map", "Difficulty", "ClassID", "Cohort", "Code"] as const) summary[field] = first[field];
            summary.Descriptive = true; summary.Challenge = "";
            bucket = { Bot: row.Bot, Day: row.Day, Timestamp: row.Timestamp, Summary: summary, Histogram: Array.from({ length: 96 }, () => 0), Clusters: {}, Overflow: false, Dealt: 0, Taken: 0 };
            this.buckets.set(id, bucket);
        }
        const summary = analysis.summarize([row], key);
        for (const field of sums) bucket.Summary[field] += summary[field];
        if (row.Policy !== bucket.Summary.Policy) bucket.Summary.Policy = "";
        bucket.Dealt += row.Dealt; bucket.Taken += row.Taken;
        if (row.End === "success") {
            const bin = Math.max(0, Math.min(95, Math.ceil(Math.log(Math.max(0.1, row.Seconds) / 0.1) / Math.log(1.1))));
            bucket.Histogram[bin] = (bucket.Histogram[bin] ?? 0) + 1;
        }
        if (summary.Eligible > 0) {
            if (!bucket.Clusters[row.Session] && Object.keys(bucket.Clusters).length >= 512) bucket.Overflow = true;
            else {
                const cluster = bucket.Clusters[row.Session] ?? { N: 0, Success: 0, Falls: 0, Timeouts: 0 };
                cluster.N++; cluster.Success += summary.Success; if (row.Falls > 0) cluster.Falls++; cluster.Timeouts += summary.Timeouts;
                bucket.Clusters[row.Session] = cluster;
            }
        }
        this.dirty = true; this.Trim();
    }
    Win(row: ZPBotTrial): void {
        const bucket = this.buckets.get(this.Key(row) + ":" + row.Hour); if (!bucket) return;
        if (row.Win === 1) bucket.Summary.Wins++; if (row.Win === -1) bucket.Summary.Losses++; this.dirty = true;
    }
    private Trim(): void {
        if (os.time() < this.nextTrim && this.buckets.size <= 4096) return;
        this.nextTrim = os.time() + 60;
        const cutoff = os.time() - Math.max(1, Math.min(3650, cvars.Number("zp_bot_stats_days", 90))) * 86400;
        for (const [key, bucket] of [...this.buckets]) if (bucket.Timestamp < cutoff) { this.buckets.delete(key); this.Dropped++; this.dirty = true; }
        while (this.buckets.size > 4096) {
            const first = [...this.buckets.keys()][0]; if (first === undefined) break; this.buckets.delete(first); this.Dropped++;
        }
    }
    private Summary(bucket: Bucket, period: string): ZPBotTrialSummary {
        const result = { ...bucket.Summary, Period: period }, clusters = Object.keys(bucket.Clusters); result.Sessions = clusters.length;
        result.DealtPerMinute = result.Active > 0 ? bucket.Dealt * 60 / result.Active : 0;
        result.TakenPerMinute = result.Active > 0 ? bucket.Taken * 60 / result.Active : 0;
        for (const [field, percentile] of [["Median", 0.5], ["P90", 0.9]] as const) {
            let total = 0; result[field] = 0;
            for (let index = 0; index < bucket.Histogram.length && result.Success > 0; index++) {
                total += bucket.Histogram[index] ?? 0;
                if (total >= Math.ceil(result.Success * percentile)) { result[field] = 0.1 * Math.pow(1.1, index); break; }
            }
        }
        for (const [field, low, high] of [["Success", "Low", "High"], ["Falls", "FallLow", "FallHigh"], ["Timeouts", "TimeoutLow", "TimeoutHigh"]] as const) {
            let mean = 0;
            for (const [, cluster] of pairs(bucket.Clusters)) if (cluster) mean += cluster[field] / Math.max(1, cluster.N) / Math.max(1, clusters.length);
            const radius = clusters.length > 0 && !bucket.Overflow ? Math.sqrt(Math.log(80) / (2 * clusters.length)) : 1;
            result[low] = Math.max(0, mean - radius); result[high] = Math.min(1, mean + radius);
        }
        return result;
    }
    Identities(): number[] { return [...new Set([...this.buckets.values()].map(bucket => bucket.Bot))]; }
    Report(query = emptyFilter()): ZPBotTrialSummary[] {
        this.Trim(); const groups: ZPBotTrialSummary[] = [], days = new Map<string, Bucket>();
        for (const [, bucket] of this.buckets) {
            const row = bucket.Summary;
            if ((query.Bot !== "" && tostring(bucket.Bot) !== query.Bot) || (query.Version !== "" && query.Version !== row.Code && query.Version !== row.Policy) ||
                (query.Scenario !== "" && query.Scenario !== row.Scenario) || (query.Difficulty !== "" && query.Difficulty !== row.Difficulty) ||
                (query.Role !== "" && query.Role !== row.Role) || (query.Period !== "" && !row.Period.startsWith(query.Period))) continue;
            groups.push(this.Summary(bucket, row.Period));
            const key = row.Key + ":" + bucket.Day, existing = days.get(key);
            if (!existing) { days.set(key, this.Clone(bucket)); continue; }
            for (const field of sums) existing.Summary[field] += row[field];
            if (existing.Summary.Policy !== row.Policy) existing.Summary.Policy = "";
            existing.Dealt += bucket.Dealt; existing.Taken += bucket.Taken; existing.Overflow = existing.Overflow || bucket.Overflow;
            for (let index = 0; index < 96; index++) existing.Histogram[index] = (existing.Histogram[index] ?? 0) + (bucket.Histogram[index] ?? 0);
            for (const [id, cluster] of pairs(bucket.Clusters)) if (cluster) {
                const old = existing.Clusters[id] ?? { N: 0, Success: 0, Falls: 0, Timeouts: 0 };
                for (const field of ["N", "Success", "Falls", "Timeouts"] as const) old[field] += cluster[field]; existing.Clusters[id] = old;
            }
        }
        for (const [, bucket] of days) groups.push(this.Summary(bucket, bucket.Day));
        groups.sort((a, b) => a.Period < b.Period ? -1 : a.Period > b.Period ? 1 : 0); return groups;
    }
    Save(): boolean {
        this.Trim(); if (!this.writable) return false; if (!this.dirty) return true;
        let verified = false;
        const [ok] = pcall(() => {
            let json = util.TableToJSON({ Version: 1, Dropped: this.Dropped, Buckets: [...this.buckets.values()] });
            while (json && json.length > 8388608 && this.buckets.size > 0) {
                const first = [...this.buckets.keys()][0]; if (first === undefined) break; this.buckets.delete(first); this.Dropped++;
                json = util.TableToJSON({ Version: 1, Dropped: this.Dropped, Buckets: [...this.buckets.values()] });
            }
            if (!json) return; file.CreateDir("zombieplague/bots/statistics");
            if (this.previous !== undefined) { file.Write(path + ".bak.txt", this.previous); if (file.Read(path + ".bak.txt", "DATA") !== this.previous) return; }
            file.Write(path, json); verified = file.Read(path, "DATA") === json;
            if (verified) { this.previous = json; this.dirty = false; }
        });
        return ok && verified;
    }
}
