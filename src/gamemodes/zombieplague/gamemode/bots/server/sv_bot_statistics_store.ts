const { record, trial } = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
interface StatisticsStoreContract { Save(rows: ZPBotTrial[], open: ZPBotTrial[], dropped: number): boolean; }
export class BotStatisticsStore implements StatisticsStoreContract {
    Rows: ZPBotTrial[] = [];
    Dropped = 0;
    private previous: string | undefined;
    private writable = true;
    constructor(readonly Path = "zombieplague/bots/statistics/history-v1.json") {
        const raw = file.Read(this.Path, "DATA");
        if (raw === undefined) return;
        const parsed = raw.length <= 8388608 ? record(util.JSONToTable(raw)) : undefined;
        const rows = parsed?.Rows, open = parsed?.Open;
        let valid = parsed?.Version === 1 && Array.isArray(rows) && rows.length <= 2000 && Array.isArray(open) && open.length <= 128 &&
            typeof parsed.Dropped === "number" && parsed.Dropped >= 0 && parsed.Dropped <= 1e12;
        const seen = new Set<string>();
        if (valid && Array.isArray(rows) && Array.isArray(open)) for (const value of [...rows, ...open]) {
            const row = trial(value);
            if (!row || seen.has(row.ID)) { valid = false; break; }
            seen.add(row.ID); this.Rows.push(row);
        }
        if (!valid) { this.Rows = []; this.writable = false; print("[ZP statistics] Invalid history preserved; storage disabled until restart/repair."); return; }
        if (Array.isArray(open)) for (const row of this.Rows.slice(this.Rows.length - open.length)) { row.End = "interrupted"; row.Detail = "unclean_restart"; }
        this.Dropped = parsed?.Dropped as number; this.previous = raw;
    }
    Save(rows: ZPBotTrial[], open: ZPBotTrial[], dropped: number): boolean {
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON({ Version: 1, Rows: rows, Open: open, Dropped: dropped });
            if (!json || json.length > 8388608) return;
            file.CreateDir("zombieplague/bots/statistics");
            if (this.previous !== undefined) {
                file.Write(this.Path + ".bak.txt", this.previous);
                if (file.Read(this.Path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.Path, json); verified = file.Read(this.Path, "DATA") === json;
            if (verified) this.previous = json;
        });
        return ok && verified;
    }
    Export(rows: ZPBotTrial[], report: ZPBotStatisticsReport, timeline: ZPBotTrialSummary[]): boolean {
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON({ Version: 1, TimelineQuantileFactor: 1.1, Report: report, Rows: rows, Timeline: timeline });
            if (!json || json.length > 33554432) return;
            const path = "zombieplague/bots/statistics/export-v1.json";
            file.CreateDir("zombieplague/bots/statistics"); file.Write(path, json); verified = file.Read(path, "DATA") === json;
        });
        return ok && verified;
    }
}
