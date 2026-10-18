interface PlaceLearningContract { Score(key: string): number; Event(key: string, metric: keyof ZPBotPlaceTotals, amount?: number): void; Reward(key: string, reward: number): void; }
const { learningAllowed, evaluationRequested } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
export class BotPlaceLearning implements PlaceLearningContract {
    private dirty = false;
    constructor(private memory: ZPBotPlaceMemory, private rewardObserver?: (this: void, component: string, amount: number) => void) {}
    private Entry(key: string): ZPBotPlaceRecord {
        const existing = this.memory.Records[key]; if (existing) return existing;
        if (Object.keys(this.memory.Records).length >= 64) {
            const oldest = Object.keys(this.memory.Records)[0]; if (oldest !== undefined) delete this.memory.Records[oldest];
        }
        const entry = { ...ZPBotPlaceProtocol.Empty().Totals, Value: 0, Samples: 0 }; this.memory.Records[key] = entry; return entry;
    }
    Score(key: string): number { return (this.memory.Records[key]?.Value ?? 0) * 0.35; }
    Event(key: string, metric: keyof ZPBotPlaceTotals, amount = 1): void {
        if (amount <= 0 || amount !== amount || amount === Infinity || evaluationRequested()) return;
        const entry = this.Entry(key); entry[metric] = Math.min(1e12, entry[metric] + amount);
        this.memory.Totals[metric] = Math.min(1e12, this.memory.Totals[metric] + amount); this.dirty = true;
    }
    Reward(key: string, reward: number, component = "outcome", components?: Record<string, number>): void {
        if (reward === 0 || reward !== reward) return;
        const clamped = Math.max(-1, Math.min(1, reward));
        if (components) {
            for (const [key, amount] of pairs(components)) this.rewardObserver?.(key, amount);
            if (clamped !== reward) this.rewardObserver?.("clamp", clamped - reward);
        }
        else this.rewardObserver?.(component, clamped);
        if (!learningAllowed()) return;
        const entry = this.Entry(key); entry.Value += (Math.max(-1, Math.min(1, reward)) - entry.Value) * 0.2;
        entry.Samples = Math.min(10000, entry.Samples + 1); this.dirty = true;
    }
    Totals(): ZPBotPlaceTotals { return { ...this.memory.Totals }; }
    Value(key: string): number { return this.memory.Records[key]?.Value ?? 0; }
    IsDirty(): boolean { return this.dirty; }
    Saved(): void { this.dirty = false; }
}
