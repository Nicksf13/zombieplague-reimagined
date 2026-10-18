import type { isProfile as profileValidator } from "./sv_bot_brain";
import type { SharedLearningContext } from "./sv_bot_shared_learning";
const { parseBotMemories } = include("sv_bot_storage.lua") as typeof import("./sv_bot_storage");
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const samples = (memory: ZPBotMemory): number => {
    let count = 0;
    for (const [, estimate] of pairs(memory.Experience)) count += estimate?.Samples ?? 0;
    return count;
};

// Import once, only when no shared file exists. Source files remain untouched.
export function migrateLearning(isProfile: typeof profileValidator): SharedLearningContext[] {
    const [names] = file.Find("zombieplague/bots/scopes/*.json", "DATA");
    const groups: Record<string, { Scope: ZPBotScope; Profiles: Record<string, ZPBotMemory | undefined> } | undefined> = {};
    for (const name of names.sort()) {
        const raw = file.Read("zombieplague/bots/scopes/" + name, "DATA");
        const data = raw !== undefined && raw.length <= 524288 ? record(util.JSONToTable(raw)) : undefined;
        const scope = ZPBotMetricsProtocol.Scope(data?.Scope), bots = parseBotMemories(data?.Bots, isProfile, true);
        if (data?.Version !== 2 || !scope || !bots || name !== util.SHA256(ZPBotMetricsProtocol.Key(scope)) + ".json") {
            print("[ZP bots] Skipping invalid legacy learning file; leaving it unchanged.");
            continue;
        }
        const sharedScope = { ...scope, Map: "*" }, key = ZPBotMetricsProtocol.Key(sharedScope);
        let group = groups[key];
        if (!group) { group = { Scope: sharedScope, Profiles: {} }; groups[key] = group; }
        for (const bot of bots) {
            const profileKey = bot.ID + ":" + bot.Profile;
            let merged = group.Profiles[profileKey];
            if (!merged) { merged = { ID: bot.ID, Profile: bot.Profile, Experience: {} }; group.Profiles[profileKey] = merged; }
            for (const [context, estimate] of pairs(bot.Experience)) {
                if (!estimate) continue;
                const previous = merged.Experience[context], count = (previous?.Samples ?? 0) + estimate.Samples;
                // Keep full counts until all maps have been merged, then apply the schema cap.
                const value = ((previous?.Value ?? 0) * (previous?.Samples ?? 0) + estimate.Value * estimate.Samples) / count;
                merged.Experience[context] = { Value: Math.max(-1, Math.min(1, value)), Samples: count };
            }
        }
    }
    const result: SharedLearningContext[] = [];
    for (const [, group] of pairs(groups)) {
        if (!group) continue;
        const chosen: Record<number, ZPBotMemory | undefined> = {};
        for (const [, memory] of pairs(group.Profiles)) {
            if (!memory) continue;
            const previous = chosen[memory.ID], count = samples(memory), before = previous ? samples(previous) : -1;
            if (!previous || count > before || (count === before && memory.Profile < previous.Profile)) chosen[memory.ID] = memory;
        }
        const bots: ZPBotMemory[] = [];
        for (const [, memory] of pairs(chosen)) {
            if (!memory) continue;
            for (const [, estimate] of pairs(memory.Experience)) if (estimate) estimate.Samples = Math.min(10000, estimate.Samples);
            bots.push(memory);
        }
        bots.sort((left, right) => left.ID - right.ID);
        result.push({ Scope: group.Scope, Bots: bots });
    }
    return result;
}
