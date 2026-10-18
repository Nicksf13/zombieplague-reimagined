export interface BoostRecord { Key: string; Definition: string; Point: number; Successes: number; Failures: number; Value: number; }
const { learningAllowed, evaluationRequested } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { canonical } = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
interface BoostFile { Version: 1; Map: string; NextID: number; Points: ZPBotBoostPoint[]; Records: BoostRecord[]; }
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const count = (value: unknown, max = 1e9): value is number => typeof value === "number" && value >= 0 && value <= max && value % 1 === 0;
function parsed(value: unknown, map: string): BoostFile | undefined {
    const data = record(value), points = record(data?.Points), records = record(data?.Records);
    if (!data || data.Version !== 1 || data.Map !== map || !count(data.NextID, 65536) || data.NextID < 1 || !points || !records ||
        Object.keys(points).length > 32 || Object.keys(records).length > 128) return;
    const result: BoostFile = { Version: 1, Map: map, NextID: data.NextID, Points: [], Records: [] };
    for (let index = 1; index <= Object.keys(points).length; index++) {
        const point = ZPBotBoostProtocol.Point(points[index]);
        if (!point || point.ID >= result.NextID || result.Points.some(item => item.ID === point.ID)) return; result.Points.push(point);
    }
    for (let index = 1; index <= Object.keys(records).length; index++) {
        const item = record(records[index]);
        if (!item || typeof item.Key !== "string" || item.Key.length < 1 || item.Key.length > 128 || typeof item.Definition !== "string" || item.Definition.length > 128 ||
            !count(item.Point, 65535) || item.Point < 1 || !count(item.Successes) || !count(item.Failures) || typeof item.Value !== "number" ||
            !(item.Value >= -1 && item.Value <= 1) || result.Records.some(entry => entry.Key === item.Key)) return;
        result.Records.push({ Key: item.Key, Definition: item.Definition, Point: item.Point, Successes: item.Successes, Failures: item.Failures, Value: item.Value });
    }
    return result;
}
interface BoostStoreContract { Points(): ZPBotBoostPoint[]; Save(): boolean; Put(point: ZPBotBoostPoint): boolean; Remove(id: number): boolean; }
export class BotBoostStore implements BoostStoreContract {
    private data: BoostFile;
    private path: string;
    private previous: string | undefined;
    private writable = true;
    private dirty = false;
    constructor() {
        const map = game.GetMap(); this.path = "zombieplague/bots/boosts/" + util.SHA256(map).substring(0, 64) + ".json";
        this.data = { Version: 1, Map: map, NextID: 1, Points: [], Records: [] };
        const raw = file.Read(this.path, "DATA"); if (raw === undefined) return;
        const saved = raw.length <= 131072 ? parsed(util.JSONToTable(raw), map) : undefined;
        if (!saved) { this.writable = false; print("[ZP bots] Invalid boost file; leaving it unchanged."); return; }
        this.data = saved; this.previous = raw;
    }
    Points(): ZPBotBoostPoint[] { return this.data.Points.map(point => ({ ID: point.ID, Base: [...point.Base], Approach: [...point.Approach], Exit: [...point.Exit] })); }
    Definition(point: ZPBotBoostPoint): string { return util.SHA256([point.ID, ...point.Base, ...point.Approach, ...point.Exit].join(":")).substring(0, 128); }
    Score(key: string): number { return this.data.Records.find(item => item.Key === key)?.Value ?? 0; }
    Version(): string { return util.SHA256(canonical({ Points: this.data.Points, Values: this.data.Records.map(entry => ({ Key: entry.Key, Value: entry.Value })) })); }
    Results(): ZPBotBoostResult[] {
        return this.data.Points.map(point => {
            const definition = this.Definition(point), records = this.data.Records.filter(item => item.Point === point.ID && item.Definition === definition);
            return { Point: point.ID, Successes: Math.min(1e9, records.reduce((sum, item) => sum + item.Successes, 0)), Failures: Math.min(1e9, records.reduce((sum, item) => sum + item.Failures, 0)) };
        });
    }
    Outcome(point: ZPBotBoostPoint, key: string, success: boolean): void {
        if (evaluationRequested()) return;
        let entry = this.data.Records.find(item => item.Key === key);
        if (!entry) {
            if (this.data.Records.length >= 128) this.data.Records.shift();
            entry = { Key: key, Point: point.ID, Definition: this.Definition(point), Successes: 0, Failures: 0, Value: 0 }; this.data.Records.push(entry);
        }
        if (success) entry.Successes = Math.min(1e9, entry.Successes + 1); else entry.Failures = Math.min(1e9, entry.Failures + 1);
        if (learningAllowed()) entry.Value += ((success ? 1 : -1) - entry.Value) * 0.2;
        this.dirty = true;
    }
    Put(point: ZPBotBoostPoint): boolean {
        if (evaluationRequested()) return false;
        const valid = ZPBotBoostProtocol.Point({ ...point, ID: point.ID === 0 ? this.data.NextID : point.ID });
        if (!valid || (point.ID !== 0 && !this.data.Points.some(item => item.ID === point.ID)) || (point.ID === 0 && this.data.Points.length >= 32)) return false;
        const next: BoostFile = { ...this.data, NextID: Math.max(this.data.NextID, valid.ID + 1), Points: [...this.data.Points.filter(item => item.ID !== valid.ID), valid] };
        if (!this.Write(next)) return false; this.data = next; this.dirty = false; return true;
    }
    Remove(id: number): boolean {
        if (evaluationRequested()) return false;
        if (!this.data.Points.some(item => item.ID === id)) return false;
        const next = { ...this.data, Points: this.data.Points.filter(item => item.ID !== id) };
        if (!this.Write(next)) return false; this.data = next; this.dirty = false; return true;
    }
    private Write(data: BoostFile): boolean {
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON(data); if (!json || json.length > 131072) return;
            file.CreateDir("zombieplague/bots/boosts");
            if (this.previous !== undefined) {
                file.Write(this.path + ".bak.txt", this.previous);
                if (file.Read(this.path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.path, json); verified = file.Read(this.path, "DATA") === json;
            if (verified) this.previous = json;
        });
        return ok && verified;
    }
    Save(): boolean { if (!this.dirty) return true; if (!this.Write(this.data)) return false; this.dirty = false; return true; }
}
