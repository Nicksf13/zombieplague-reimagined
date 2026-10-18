import type { BotLearningStore as StoreType } from "./sv_bot_storage";
import type { BotBrain as BrainType } from "./sv_bot_brain";
import type { BotMetrics as MetricsType } from "./sv_bot_metrics";
import type { BotMotionLearner as MotionType } from "./sv_bot_motion";
import type { BotMotionStore as MotionStoreType } from "./sv_bot_motion_storage";
import type { BotPlaceLearning as PlaceLearningType } from "./sv_bot_place_learning";
import type { ExperienceTrace } from "./sv_bot_experience_trace";
const { BotLearningStore } = include("sv_bot_storage.lua") as typeof import("./sv_bot_storage");
const { BotBrain, isProfile } = include("sv_bot_brain.lua") as typeof import("./sv_bot_brain");
const { BotMetrics } = include("sv_bot_metrics.lua") as typeof import("./sv_bot_metrics");
const { BotMotionLearner } = include("sv_bot_motion.lua") as typeof import("./sv_bot_motion");
const { BotMotionStore } = include("sv_bot_motion_storage.lua") as typeof import("./sv_bot_motion_storage");
const { BotPlaceLearning } = include("sv_bot_place_learning.lua") as typeof import("./sv_bot_place_learning");
const { BotSharedLearning } = include("sv_bot_shared_learning.lua") as typeof import("./sv_bot_shared_learning");
const { parseBotMemories } = include("sv_bot_storage.lua") as typeof import("./sv_bot_storage");
const { canonical } = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
export { isProfile };
export interface BotExperience { Scope: ZPBotScope; Brain: BrainType; Metrics: MetricsType; Motion: MotionType; MotionStore: MotionStoreType; Places: PlaceLearningType; Policy: string; }
interface ScopedExperience extends BotExperience { Learning: ZPBotMemory; }
interface ScopeCache { Store: StoreType; Memories: ZPBotMemory[]; Active: Record<number, ScopedExperience | undefined>; }
export function scopeFor(ply: ZPServerPlayer): ZPBotScope {
    const zombie = ply.IsZombie(), definition = zombie ? ply.GetZombieClass() : ply.GetHumanClass();
    let classID = definition.ID;
    if (!classID) {
        const registry = zombie ? ClassManager.GetZombieClasses() : ClassManager.GetHumanClasses();
        for (const [id, value] of pairs(registry)) if (value === definition) { classID = id; break; }
    }
    return { Map: game.GetMap(), Role: zombie ? "zombie" : "human", ClassID: classID ?? definition.Name,
        ClassName: definition.Name, Variant: ply.IsNemesis() ? "nemesis" : ply.IsSurvivor() ? "survivor" : "normal" };
}
interface BotContextsContract { Profile(ply: ZPServerPlayer, id: number): ZPBotProfile | undefined; Get(ply: ZPServerPlayer, id: number, profile: ZPBotProfile): BotExperience; Save(): void; }
export class BotContexts implements BotContextsContract {
    private evaluation = false;
    private frozen = new Map<string, BotExperience>();
    constructor(private reward?: ZPBotRewardObserver, private tracing?: (this: void, id: number, scope: ZPBotScope) => ExperienceTrace, private requireExecution = false) { this.legacy = new BotLearningStore(isProfile).Load(); }
    private caches: Record<string, ScopeCache | undefined> = {};
    private legacy: ZPBotMemory[];
    private learning = new BotSharedLearning(isProfile);
    private navigation = util.SHA256(file.Read("maps/" + game.GetMap() + ".nav", "GAME") ?? "missing").substring(0, 16);
    SetEvaluation(enabled: boolean): void { this.evaluation = enabled; this.frozen.clear(); }
    Version(entry: Pick<BotExperience, "Brain" | "Motion">): string {
        const brain = entry.Brain.GetMemory(), motion = entry.Motion.Memory();
        const places: Record<string, { Value: number; Samples: number }> = {};
        for (const [key, value] of pairs(motion.Places?.Records ?? {})) if (value) places[key] = { Value: value.Value, Samples: value.Samples };
        return util.SHA256(canonical({ Profile: brain.Profile, Experience: brain.Experience, Behaviors: brain.Behaviors,
            Estimates: motion.Estimates, Passages: motion.Passages, Places: places }));
    }
    private Select(entry: BotExperience, id: number): BotExperience {
        if (!this.evaluation) return entry;
        const key = ZPBotMetricsProtocol.Key(entry.Scope) + ":" + id;
        const old = this.frozen.get(key); if (old) return old;
        const memory = parseBotMemories([entry.Brain.GetMemory()], isProfile)?.[0];
        const movement = ZPBotMotionProtocol.Memory(entry.Motion.Memory());
        if (!memory || !movement) error("Cannot freeze invalid bot parameters");
        const metrics = new BotMetrics(ZPBotMetricsProtocol.Empty());
        const result: BotExperience = { Scope: entry.Scope, Policy: this.Version(entry), Metrics: metrics,
            Brain: new BotBrain(memory, (action, reward) => metrics.Outcome(action, reward), (component, amount) => this.reward?.(id, "tactical", component, amount), this.tracing?.(id, entry.Scope), this.requireExecution),
            Motion: new BotMotionLearner(movement, (component, amount) => this.reward?.(id, "motion", component, amount), this.tracing?.(id, entry.Scope)),
            MotionStore: entry.MotionStore, Places: new BotPlaceLearning(movement.Places ?? ZPBotPlaceProtocol.Empty(), (component, amount) => this.reward?.(id, "place", component, amount)) };
        this.frozen.set(key, result); return result;
    }
    private Cache(scope: ZPBotScope): ScopeCache {
        const key = ZPBotMetricsProtocol.Key(scope), existing = this.caches[key];
        if (existing) return existing;
        const store = new BotLearningStore(isProfile, scope, true);
        const cache = { Store: store, Memories: store.Load().map(memory => ({ ...memory, Experience: {}, Behaviors: {} })), Active: {} };
        this.caches[key] = cache;
        return cache;
    }
    Profile(ply: ZPServerPlayer, id: number): ZPBotProfile | undefined {
        return this.learning.Profile(scopeFor(ply), id) ?? this.legacy.find(memory => memory.ID === id)?.Profile;
    }
    Get(ply: ZPServerPlayer, id: number, profile: ZPBotProfile): BotExperience {
        const scope = scopeFor(ply), cache = this.Cache(scope), existing = cache.Active[id];
        const shared = this.learning.Memory(scope, id, profile);
        if (existing?.Learning === shared) return this.Select(existing, id);
        const saved = cache.Memories.find(memory => memory.ID === id && memory.Profile === profile);
        shared.Behaviors ??= {};
        const memory = { ID: id, Profile: profile, Experience: shared.Experience, Behaviors: shared.Behaviors, Metrics: saved?.Metrics ?? ZPBotMetricsProtocol.Empty() };
        const metrics = new BotMetrics(memory.Metrics);
        const movementStore = existing?.MotionStore ?? new BotMotionStore(scope, id, this.navigation);
        const motion = existing?.Motion ?? new BotMotionLearner(movementStore.Load(), (component, amount) => this.reward?.(id, "motion", component, amount), this.tracing?.(id, scope));
        const placeMemory = motion.Memory().Places ?? ZPBotPlaceProtocol.Empty(); motion.Memory().Places = placeMemory;
        const entry = { Scope: scope, Learning: shared, Metrics: metrics, Brain: new BotBrain(memory, (action, reward) => metrics.Outcome(action, reward), (component, amount) => this.reward?.(id, "tactical", component, amount), this.tracing?.(id, scope), this.requireExecution),
            MotionStore: movementStore, Motion: motion, Places: existing?.Places ?? new BotPlaceLearning(placeMemory, (component, amount) => this.reward?.(id, "place", component, amount)), Policy: "" };
        entry.Policy = this.Version(entry);
        cache.Active[id] = entry;
        return this.Select(entry, id);
    }
    Save(): void {
        for (const [, cache] of pairs(this.caches)) {
            if (!cache) continue;
            let dirty = false;
            for (const [, entry] of pairs(cache.Active)) {
                if (!entry) continue;
                entry.Policy = this.Version(entry);
                if (entry.Brain.IsDirty()) this.learning.Changed();
                dirty = dirty || entry.Metrics.IsDirty();
                const current = entry.Brain.GetMemory();
                cache.Memories = cache.Memories.filter(memory => memory.ID !== current.ID);
                // Telemetry remains map-specific; tactical estimates have one owner.
                cache.Memories.push({ ...current, Experience: {}, Behaviors: {} });
                if ((entry.Motion.IsDirty() || entry.Places.IsDirty()) && entry.MotionStore.Save(entry.Motion.Memory())) { entry.Motion.Saved(); entry.Places.Saved(); }
            }
            if (dirty && cache.Store.Save(cache.Memories))
                for (const [, entry] of pairs(cache.Active)) if (entry) entry.Metrics.Saved();
        }
        if (this.learning.Save())
            for (const [, cache] of pairs(this.caches)) if (cache)
                for (const [, entry] of pairs(cache.Active)) if (entry) entry.Brain.Saved();
    }
}
