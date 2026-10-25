export const profiles: readonly ZPBotProfile[] = ["aggressive", "cooperative", "defensive", "cautious"];
const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
export const actions: readonly ZPBotAction[] = ["attack", "defend", "retreat", "group"];
export const isProfile = (value: unknown): value is ZPBotProfile => profiles.some(profile => profile === value);

export function context(situation: ZPBotSituation): string {
    return "v2:" + situation.Role + ":" + (situation.Health < 0.35 ? "low" : "healthy") + ":" +
        (situation.Enemies > situation.Allies + 1 ? "outnumbered" : "balanced") + ":" +
        (situation.Distance < 180 ? "close" : situation.Distance < 650 ? "mid" : "far") + ":" + (situation.RecentDamage ? "pressured" : "quiet");
}

const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
export function parseBehaviors(value: unknown): ZPBotBehaviorMemory | undefined {
    const data = record(value), result: ZPBotBehaviorMemory = {};
    if (!data || Object.keys(data).length > 72) return;
    for (const [key, value] of pairs(data)) {
        const entries = record(value), parts = key.split(":");
        if (parts[0] === "v2") { parts.shift(); if (!["quiet", "pressured"].includes(parts.pop() ?? "")) return; }
        if (parts.length !== 4 || !["human", "zombie"].includes(parts[0] ?? "") ||
            !["low", "healthy"].includes(parts[1] ?? "") || !["outnumbered", "balanced"].includes(parts[2] ?? "") ||
            !["close", "mid", "far"].includes(parts[3] ?? "") || !entries || Object.keys(entries).length > 4) return;
        const estimates: ZPBotBehaviorEstimates = {};
        for (const [profile, value] of pairs(entries)) {
            const estimate = record(value);
            if (!isProfile(profile) || !estimate || typeof estimate.Value !== "number" || estimate.Value !== estimate.Value ||
                estimate.Value < -1 || estimate.Value > 1 || typeof estimate.Samples !== "number" ||
                estimate.Samples < 1 || estimate.Samples > 10000 || estimate.Samples % 1 !== 0) return;
            estimates[profile] = { Value: estimate.Value, Samples: estimate.Samples };
        }
        result[key] = estimates;
    }
    return result;
}

export interface BehaviorChoice { Profile: ZPBotProfile; Reason: "profile" | "learned" | "explore"; }
export interface BehaviorWeight { Prior: number; Learned: number; Total: number; Samples: number; }
interface BehaviorLearnerContract {
    Choose(situation: ZPBotSituation, explore: boolean): BehaviorChoice;
    Weights(situation: ZPBotSituation): Record<ZPBotProfile, BehaviorWeight>;
    Observe(key: string, profile: ZPBotProfile, reward: number): void;
}

export class BotBehaviorLearner implements BehaviorLearnerContract {
    private estimates: ZPBotBehaviorMemory;
    constructor(private memory: ZPBotMemory) {
        this.estimates = memory.Behaviors ?? {};
        memory.Behaviors = this.estimates;
    }

    Weights(situation: ZPBotSituation): Record<ZPBotProfile, BehaviorWeight> {
        const entries = this.estimates[context(situation)];
        const weight = (profile: ZPBotProfile): BehaviorWeight => {
            const prior = profile === this.memory.Profile ? 0.15 : 0, estimate = entries?.[profile];
            const learned = (estimate?.Value ?? 0) * 0.85;
            return { Prior: prior, Learned: learned, Total: prior + learned, Samples: estimate?.Samples ?? 0 };
        };
        return { aggressive: weight("aggressive"), cooperative: weight("cooperative"), defensive: weight("defensive"), cautious: weight("cautious") };
    }

    Choose(situation: ZPBotSituation, explore: boolean): BehaviorChoice {
        const weights = this.Weights(situation);
        let best = this.memory.Profile;
        for (const profile of profiles) if (weights[profile].Total > weights[best].Total) best = profile;
        if (explore && learningAllowed() && situation.Health >= 0.35) {
            const alternatives = profiles.filter(profile => profile !== best);
            const least = Math.min(...alternatives.map(profile => weights[profile].Samples));
            const choices = alternatives.filter(profile => weights[profile].Samples === least);
            return { Profile: choices[math.random(1, choices.length) - 1] ?? best, Reason: "explore" };
        }
        const learned = profiles.some(profile => weights[profile].Samples > 0);
        return { Profile: best, Reason: learned ? "learned" : "profile" };
    }

    Observe(key: string, profile: ZPBotProfile, reward: number): void {
        if (!learningAllowed() || reward === 0 || reward !== reward) return;
        const entries = this.estimates[key] ?? {}, previous = entries[profile];
        const target = Math.max(-1, Math.min(1, reward));
        entries[profile] = { Value: (previous?.Value ?? 0) + 0.2 * (target - (previous?.Value ?? 0)),
            Samples: Math.min(10000, (previous?.Samples ?? 0) + 1) };
        this.estimates[key] = entries;
    }
}
