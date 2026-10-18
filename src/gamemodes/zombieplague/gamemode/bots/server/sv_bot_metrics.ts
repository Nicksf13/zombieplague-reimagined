import type { BotPlan } from "./sv_bot_motor";
interface BotMetricsContract {
    Reset(): void;
    Observe(ply: ZPServerPlayer, plan: BotPlan, goal: GLuaVector | undefined, route: { Remaining: number; Replans: number }, now: number): void;
    Outcome(action: ZPBotAction, reward: number): void;
    Totals(): ZPBotMetrics;
    IsDirty(): boolean;
    Saved(): void;
}
export class BotMetrics implements BotMetricsContract {
    private dirty = true;
    private previous: { Position: GLuaVector; Goal?: GLuaVector; Distance: number; Replans: number; Action: ZPBotAction;
        Breath: number; Water: boolean; Blocked: boolean; WantedMove: boolean; Time: number; } | undefined;
    LastReward = 0;
    Progress = 0;
    Sprinting = false;
    Blocked = false;
    constructor(private totals: ZPBotMetrics) {}
    Reset(): void { this.previous = undefined; this.Progress = 0; this.Sprinting = false; this.Blocked = false; }
    Observe(ply: ZPServerPlayer, plan: BotPlan, goal: GLuaVector | undefined, route: { Remaining: number; Replans: number }, now: number): void {
        const position = ply.GetPos(), breath = ply.GetBreath(), water = ply.WaterLevel() >= 2;
        const remaining = route.Remaining;
        let blocked = plan.Steering.Stuck || (goal !== undefined && remaining > 40 && !plan.Steering.Position);
        const previous = this.previous;
        this.totals.Replans += Math.max(0, route.Replans - (previous?.Replans ?? 0));
        this.Sprinting = ply.KeyDown(IN_SPEED);
        this.Progress = 0;
        if (previous && now >= previous.Time && now - previous.Time <= 1) {
            const seconds = now - previous.Time, moved = Math.sqrt(position.DistToSqr(previous.Position));
            this.totals.ActiveSeconds += seconds;
            this.totals.Actions[previous.Action].Seconds += seconds;
            // Ignore teleport-sized deltas instead of reporting them as useful movement.
            const ordinaryMove = moved <= Math.max(100, ply.GetRunSpeed() * seconds * 3);
            if (ordinaryMove) this.totals.Distance += moved;
            const sameGoal = goal && previous.Goal && goal.DistToSqr(previous.Goal) < 64 && route.Replans === previous.Replans;
            if (sameGoal && ordinaryMove) {
                this.Progress = previous.Distance - remaining;
                // Signed progress prevents walking back and forth from counting as repeated success.
                this.totals.Progress += this.Progress;
                if (remaining <= 40 && previous.Distance > 40) this.totals.Arrivals++;
            }
            if (previous.WantedMove && seconds >= 0.1 && moved < seconds * 5) blocked = true;
            if (blocked) this.totals.StuckSeconds += seconds;
            if (previous.Blocked && !blocked && moved > 10) this.totals.Recoveries++;
            if (water) this.totals.WaterSeconds += seconds;
            if (previous.Water && !water) this.totals.WaterEscapes++;
            if (this.Sprinting && moved > 1) this.totals.SprintSeconds += seconds;
            this.totals.BreathSpent += Math.max(0, previous.Breath - breath);
            this.dirty = true;
        }
        this.Blocked = blocked;
        this.dirty = true;
        this.previous = { Position: Vector(position.x, position.y, position.z), Distance: remaining, Replans: route.Replans, Action: plan.Action,
            Breath: breath, Water: water, Blocked: blocked, WantedMove: plan.Steering.Position !== undefined, Time: now };
        if (goal) this.previous.Goal = Vector(goal.x, goal.y, goal.z);
    }
    Event(key: "DamageDealt" | "DamageTaken" | "Kills" | "Deaths" | "Infections", amount: number): void {
        if (amount > 0 && amount === amount) { this.totals[key] = Math.min(1e12, this.totals[key] + amount); this.dirty = true; }
    }
    Outcome(action: ZPBotAction, reward: number): void {
        this.LastReward = reward;
        const entry = this.totals.Actions[action];
        entry.Episodes = Math.min(2147483647, entry.Episodes + 1);
        if (reward > 0) entry.Positive = Math.min(entry.Episodes, entry.Positive + 1);
        if (reward < 0) entry.Negative = Math.min(entry.Episodes, entry.Negative + 1);
        entry.Reward = Math.max(-1e12, Math.min(1e12, entry.Reward + reward));
        this.dirty = true;
    }
    Totals(): ZPBotMetrics {
        const result = { ...this.totals, Actions: { ...this.totals.Actions } };
        for (const action of ["attack", "defend", "retreat", "group"] as const) result.Actions[action] = { ...result.Actions[action] };
        return result;
    }
    IsDirty(): boolean { return this.dirty; }
    Saved(): void { this.dirty = false; }
}
