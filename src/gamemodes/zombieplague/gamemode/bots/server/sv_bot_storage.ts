import type { isProfile as profileValidator } from "./sv_bot_brain";
const { parseBehaviors } = include("sv_bot_behavior.lua") as typeof import("./sv_bot_behavior");
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const number = (value: unknown, min: number, max: number): value is number =>
    typeof value === "number" && value === value && value >= min && value <= max;

export function parseBotMemories(value: unknown, isProfile: typeof profileValidator, requireMetrics = false): ZPBotMemory[] | undefined {
    const bots = record(value), result: ZPBotMemory[] = [], seen: Record<number, boolean> = {};
    if (!bots || Object.keys(bots).length > 64) return;
    for (let index = 1; index <= Object.keys(bots).length; index++) {
        const bot = record(bots[index]), experience = record(bot?.Experience);
        if (!bot || !number(bot.ID, 1, 64) || bot.ID % 1 !== 0 || seen[bot.ID] || !isProfile(bot.Profile) ||
            !experience || Object.keys(experience).length > 288) return;
        const estimates: ZPBotMemory["Experience"] = {};
        for (const [key, value] of pairs(experience)) {
            const estimate = record(value), parts = key.split(":");
            if (parts[0] === "v2") {
                parts.shift();
                const action = parts.pop();
                if (!["quiet", "pressured"].includes(parts.pop() ?? "") || action === undefined) return;
                parts.push(action);
            }
            if (parts.length !== 5 || !["human", "zombie"].includes(parts[0] ?? "") ||
                !["low", "healthy"].includes(parts[1] ?? "") || !["outnumbered", "balanced"].includes(parts[2] ?? "") ||
                !["close", "mid", "far"].includes(parts[3] ?? "") || !["attack", "defend", "retreat", "group"].includes(parts[4] ?? "") ||
                !estimate || !number(estimate.Value, -1, 1) || !number(estimate.Samples, 1, 10000) || estimate.Samples % 1 !== 0) return;
            estimates[key] = { Value: estimate.Value, Samples: estimate.Samples };
        }
        seen[bot.ID] = true;
        const metrics = requireMetrics ? ZPBotMetricsProtocol.Totals(bot.Metrics) : undefined;
        if (requireMetrics && !metrics) return;
        const memory: ZPBotMemory = { ID: bot.ID, Profile: bot.Profile, Experience: estimates };
        if (metrics) memory.Metrics = metrics;
        if (bot.Behaviors !== undefined) {
            const behaviors = parseBehaviors(bot.Behaviors);
            if (!behaviors) return;
            memory.Behaviors = behaviors;
        }
        result.push(memory);
    }
    return result;
}

export class BotLearningStore {
    private writable = true;
    private path = "zombieplague/bots/learning-v1.json";
    private previous: string | undefined;
    constructor(private isProfile: typeof profileValidator, private scope?: ZPBotScope, private metricsOnly = false) {
        if (scope) this.path = "zombieplague/bots/" + (metricsOnly ? "metrics/" : "scopes/") + util.SHA256(ZPBotMetricsProtocol.Key(scope)) + ".json";
    }
    Load(): ZPBotMemory[] {
        const raw = file.Read(this.path, "DATA");
        if (raw === undefined)
            return this.metricsOnly && this.scope ? new BotLearningStore(this.isProfile, this.scope).Load() : [];
        const parsed = raw.length <= 524288 ? record(util.JSONToTable(raw)) : undefined;
        const savedScope = this.scope ? ZPBotMetricsProtocol.Scope(parsed?.Scope) : undefined;
        const result = parseBotMemories(parsed?.Bots, this.isProfile, this.scope !== undefined);
        const valid = parsed?.Version === (this.scope ? 2 : 1) && result !== undefined &&
            (!this.scope || (savedScope !== undefined && ZPBotMetricsProtocol.Key(savedScope) === ZPBotMetricsProtocol.Key(this.scope)));
        if (!valid || !result) {
            this.writable = false;
            print("[ZP bots] Invalid learning file; leaving it unchanged. Learning continues in memory.");
            return [];
        }
        this.previous = raw;
        return result;
    }
    Save(memories: ZPBotMemory[]): boolean {
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON(this.scope ? { Version: 2, Scope: this.scope, Bots: memories } : { Version: 1, Bots: memories });
            if (!json || json.length > 524288) return;
            file.CreateDir("zombieplague/bots");
            if (this.scope) file.CreateDir("zombieplague/bots/" + (this.metricsOnly ? "metrics" : "scopes"));
            const old = this.previous;
            if (old !== undefined) {
                file.Write(this.path + ".bak.txt", old);
                if (file.Read(this.path + ".bak.txt", "DATA") !== old) return;
            }
            file.Write(this.path, json);
            verified = file.Read(this.path, "DATA") === json;
            if (verified) this.previous = json;
        });
        if (!ok || !verified) print("[ZP bots] Learning save failed; keeping pending changes for retry.");
        return ok && verified;
    }
}
