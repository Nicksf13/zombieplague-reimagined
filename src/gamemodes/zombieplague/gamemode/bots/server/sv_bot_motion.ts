const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
import type { ExperienceEnd, ExperienceTrace, Intervention } from "./sv_bot_experience_trace";
import type { MotionObservation } from "./sv_bot_motion_causality";
const { BotMotionExperiences } = include("sv_bot_motion_experiences.lua") as typeof import("./sv_bot_motion_experiences");
export interface MoveOption {
    Action: ZPBotMove; Position: GLuaVector; Jump: boolean; Duck: boolean; Sprint: boolean; Preference: number; Keys: number;
    Aim?: GLuaVector; Look?: number;
    SpeedLimit?: number;
    Precision?: boolean;
    EdgeRecovery?: boolean;
    JumpReason?: string;
}
export interface MoveFrame {
    Key: string; Edge: string; Mode: ZPBotMoveMode; From: number; To: number; Position: GLuaVector;
    Remaining: number; RouteRemaining: number; Speed: number; Breath: number; Drain: boolean;
    Dynamic: boolean; Goal: GLuaVector; Completed: boolean; Final: boolean; Path: number[];
    Ladder?: boolean; Forced?: boolean;
    Intent?: string; Stage?: GLuaVector;
    Velocity?: GLuaVector; Gravity?: number;
    Precision?: boolean;
    Run?: number;
}
interface MotionContract { Cancel(): void; Choose(frame: MoveFrame, options: MoveOption[], now: number): MoveOption | undefined; Cost(edge: string, distance: number, speed: number): number; }
export class BotMotionLearner implements MotionContract {
    private previous: { Frame: MoveFrame; Time: number } | undefined;
    private experiences: InstanceType<typeof BotMotionExperiences>;
    private get attempt() { return this.experiences.Current; }
    private choice: MoveOption | undefined;
    private bestStage = Infinity;
    private bestRoute = Infinity;
    private frontiers: Record<string, number | undefined> = {};
    private stageStarted = 0;
    private lastProgress = 0;
    private dynamicStage = false;
    private wasBlocked = false;
    private rewarded: Record<string, boolean> = {};
    private goal: GLuaVector | undefined;
    private dirty = false;
    private progress = 0;
    private keys = 0;
    private look = 0;
    Replan = false;
    constructor(private memory: ZPBotMoveMemory, rewardObserver?: (this: void, component: string, amount: number) => void, private trace?: ExperienceTrace) {
        this.experiences = new BotMotionExperiences(memory, rewardObserver, trace,
            (frame, success, started, ended) => this.Passage(frame, success, ended, frame.Dynamic, started));
    }
    ExperienceID(): string { return this.experiences.ID(); }
    PendingExperiences(): string[] { return this.experiences.PendingIDs(); }
    Stage(): string { return this.previous?.Frame.Edge ?? ""; }
    Integrity() { return this.experiences.Integrity(); }
    Observe(observation: MotionObservation): void { this.experiences.Observe(observation, CurTime()); this.dirty = true; }
    InvalidateCausality(reason: string): void { this.experiences.InvalidateCausality(reason); }
    private AddReward(amount: number, component: string): void {
        this.experiences.Add(amount, component);
    }
    Cancel(reason = "interrupted", retainFlight = false, intervention?: Intervention): void {
        this.experiences.Cancel(reason, retainFlight, intervention);
        this.previous = undefined; this.choice = undefined; this.goal = undefined;
        this.bestStage = Infinity; this.bestRoute = Infinity; this.rewarded = {}; this.frontiers = {}; this.wasBlocked = false; this.Replan = false;
        this.dynamicStage = false;
        this.keys = 0; this.look = 0;
    }
    Input(keys: number, look: number, observation?: MotionObservation): void {
        this.keys = keys; this.look = look;
        if (this.choice) { this.choice.Keys = keys; this.choice.Look = look; }
        this.experiences.Input(keys, this.previous?.Frame, this.choice?.Jump === true);
        if (observation) this.Observe(observation);
    }
    Memory(): ZPBotMoveMemory { return this.memory; }
    IsDirty(): boolean { return this.dirty; }
    Saved(): void { this.dirty = false; }
    Cost(edge: string, distance: number, speed: number): number {
        const entry = this.memory.Passages[edge];
        if (!entry || entry.Attempts < 3) return 1;
        const expected = Math.max(0.5, distance / Math.max(1, speed));
        return 1 + entry.Failures / entry.Attempts * 2 + Math.min(1, Math.max(0, entry.Seconds / entry.Attempts / expected - 1) * 0.2);
    }
    private BoundedKey<T>(table: Record<string, T | undefined>, key: string, limit: number): void {
        if (table[key] !== undefined || Object.keys(table).length < limit) return;
        // Bound per-identity history even on maps with many distinct physics and obstacle contexts.
        const oldest = Object.keys(table)[0]; if (oldest !== undefined) delete table[oldest];
    }
    private Finish(now: number, reason = "interval_elapsed", end: ExperienceEnd = "observed"): void {
        this.experiences.Close(now, reason, end); this.dirty = true;
    }
    private Passage(frame: MoveFrame, success: boolean, now: number, dynamic = this.dynamicStage, started = this.stageStarted): void {
        const totals = this.memory.Totals;
        if (success) totals.Successes++; else totals.Failures++;
        if (success && frame.Final) totals.Goals++; if (success && frame.Ladder) totals.Ladders++;
        if (dynamic || frame.From === 0 || frame.To === 0 || frame.From === frame.To || !learningAllowed()) return;
        const previous = this.memory.Passages[frame.Edge];
        const before = previous ? previous.Failures / Math.max(1, previous.Attempts) : 0;
        this.BoundedKey(this.memory.Passages, frame.Edge, 128);
        const entry = this.memory.Passages[frame.Edge] ?? { Attempts: 0, Successes: 0, Failures: 0, Seconds: 0 };
        if (entry.Attempts >= 1e9) return;
        entry.Attempts++; if (success) entry.Successes++; else entry.Failures++;
        entry.Seconds += Math.max(0, Math.min(30, now - started)); this.memory.Passages[frame.Edge] = entry;
        if (this.trace) this.trace.Record({ Kind: "update", Learner: "passage", Experience: this.trace.NewID("passage"),
            State: frame.Edge, Stage: frame.Edge, Action: "cross", Reason: success ? "passage_success" : "passage_failure",
            ValueKind: "passage_failure_fraction", Before: before, After: entry.Failures / entry.Attempts, Updated: true });
    }
    Harm(amount: number, event?: string, fall = true): void {
        this.experiences.Harm(amount, event, fall); this.dirty = true;
    }
    ShotWhileJumping(amount: number): void {
        this.experiences.Shot(amount); this.dirty = true;
    }
    Choose(frame: MoveFrame, options: MoveOption[], now: number): MoveOption | undefined {
        this.experiences.ObserveFrame(frame, now);
        if (frame.Forced) { this.Cancel("external_displacement"); return options[0]; }
        const previous = this.previous;
        if (previous) {
            const dt = now - previous.Time, moved = Math.sqrt(frame.Position.DistToSqr(previous.Frame.Position));
            const falling = frame.Mode === "air" || previous.Frame.Mode === "air";
            const vertical = falling ? Math.min(2000, Math.max(Math.abs(frame.Velocity?.z ?? 0), Math.abs(previous.Frame.Velocity?.z ?? 0))) * dt * 1.5 : 0;
            const gravity = falling ? (frame.Gravity ?? 0) * dt * dt : 0;
            if (dt < 0 || dt > 0.9 || moved > Math.max(100, frame.Speed * dt * 3 + vertical + gravity)) this.Cancel("observation_gap_or_displacement");
        }
        const changedIntent = frame.Intent !== undefined && this.previous?.Frame.Intent !== frame.Intent;
        if (!this.goal || changedIntent || (frame.Intent === undefined && frame.Goal.DistToSqr(this.goal) > 10000)) {
            if (this.goal) this.Cancel("intent_changed");
            this.goal = Vector(frame.Goal.x, frame.Goal.y, frame.Goal.z);
        }
        const last = this.previous, sameStage = last?.Frame.Edge === frame.Edge;
        const totals = this.memory.Totals;
        this.progress = 0;
        if (last?.Frame.Mode === "water" && frame.Mode === "ground") {
            totals.WaterEscapes++; this.AddReward(0.5, "water_exit");
            this.Finish(now, "observed_ground_exit", "success"); this.experiences.ConfirmAction(last.Frame.Edge, now, "observed_ground_exit");
        }
        if (!sameStage) {
            this.Finish(now, "stage_changed", "interrupted");
            if (last) this.experiences.InterruptStage(last.Frame.Edge, now);
            this.bestStage = this.frontiers[frame.Edge] ?? frame.Remaining; this.stageStarted = now; this.lastProgress = now; this.dynamicStage = false;
        }
        this.dynamicStage = this.dynamicStage || frame.Dynamic;
        if (frame.Dynamic) this.experiences.Dynamic(frame.Edge);
        if (last && now > last.Time) {
            const dt = now - last.Time, moved = Math.sqrt(frame.Position.DistToSqr(last.Frame.Position));
            totals.Seconds += dt; totals.Distance += moved;
            const blocked = moved < dt * 5 && last.Frame.Remaining > 40;
            if (blocked) totals.StuckSeconds += dt;
            if (this.wasBlocked && !blocked && moved > 10) totals.Recoveries++;
            this.wasBlocked = blocked;
            const spent = Math.max(0, last.Frame.Breath - frame.Breath); totals.BreathSpent += spent;
            if (sameStage && this.attempt) {
                const previousRemaining = frame.Stage ? Math.sqrt(last.Frame.Position.DistToSqr(frame.Stage)) : last.Frame.Remaining;
                if (frame.Stage && last.Frame.Stage && frame.Stage.DistToSqr(last.Frame.Stage) > 64) {
                    const directional = previousRemaining - frame.Remaining;
                    this.bestStage = frame.Remaining + Math.max(0, directional);
                }
                const advance = Math.min(moved, Math.max(0, this.bestStage - frame.Remaining));
                const routeAdvance = Math.min(advance, Math.max(0, this.bestRoute - frame.RouteRemaining));
                if (advance > 1) this.lastProgress = now;
                this.progress = previousRemaining - frame.Remaining;
                totals.Progress += advance;
                this.AddReward(Math.min(0.35, advance / Math.max(50, frame.Speed) * 0.5 + routeAdvance / Math.max(100, frame.Speed) * 0.15), "progress");
                this.AddReward(-(blocked ? dt * 0.2 : Math.max(0, -this.progress) / Math.max(100, frame.Speed) * 0.1), blocked ? "blocked" : "backtracking");
                if (frame.Drain) this.AddReward(-Math.min(0.1, spent / 100), "breath");
            }
            this.dirty = true;
        }
        this.bestStage = Math.min(this.bestStage, frame.Remaining); this.bestRoute = Math.min(this.bestRoute, frame.RouteRemaining);
        if (Object.keys(this.frontiers).length < 128 || this.frontiers[frame.Edge] !== undefined) this.frontiers[frame.Edge] = this.bestStage;
        const completedKey = frame.Final ? "goal" : frame.Edge + ":step";
        if (frame.Completed && !this.rewarded[completedKey] && Object.keys(this.rewarded).length < 128 && sameStage) {
            this.rewarded[completedKey] = true;
            this.AddReward(frame.Final ? 1 : 0.5, frame.Final ? "goal" : "checkpoint");
            this.Finish(now, frame.Final ? "goal" : "checkpoint", "success");
            this.experiences.Resolve({ ...frame, Dynamic: this.dynamicStage }, true, this.stageStarted, now);
        }
        if (frame.Precision && frame.Dynamic) this.lastProgress = now;
        if (!frame.Completed && now - this.lastProgress > Math.min(8, 2 + frame.Remaining / Math.max(30, frame.Speed) * 2)) {
            this.AddReward(-0.5, "stuck_failure");
            this.Finish(now, "stuck_failure", "failure"); this.experiences.Resolve({ ...frame, Dynamic: this.dynamicStage }, false, this.stageStarted, now);
            this.stageStarted = now; this.lastProgress = now; this.Replan = true;
        }
        const jumping = this.attempt?.Action.startsWith("jump") && frame.Mode === "air";
        if (this.attempt && now - this.attempt.Started >= (jumping ? 1.5 : 0.45)) this.Finish(now);
        this.previous = { Frame: { ...frame, Position: Vector(frame.Position.x, frame.Position.y, frame.Position.z),
            ...(frame.Velocity ? { Velocity: Vector(frame.Velocity.x, frame.Velocity.y, frame.Velocity.z) } : {}) }, Time: now };
        if (frame.Completed || options.length === 0) { this.choice = undefined; return; }
        if (this.attempt && this.choice && options.some(option => option.Action === this.choice?.Action)) {
            const continued = options.find(option => option.Action === this.choice?.Action);
            if (continued) { this.choice = continued; return continued; }
        }
        this.Finish(now);
        let best = options[0];
        for (const option of options) if (best && this.Value(frame.Key, option) > this.Value(frame.Key, best)) best = option;
        if (learningAllowed() && math.random(1, 100) <= 10)
            best = options[math.random(1, options.length) - 1] ?? best;
        if (best) { this.choice = best; this.experiences.Start(frame, best, now); }
        return best;
    }
    private Value(key: string, option: MoveOption): number { return option.Preference + (this.memory.Estimates[key + ":" + option.Action]?.Value ?? 0) * 0.75; }
    Diagnostic(): ZPBotMoveDiagnostic {
        const frame = this.previous?.Frame, totals = this.memory.Totals;
        const passage = this.memory.Passages[frame?.Edge ?? ""];
        const values = ZPBotMotionProtocol.Actions.map(action => this.memory.Estimates[(frame?.Key ?? "") + ":" + action]?.Value ?? 0);
        let samples = 0; for (const [, estimate] of pairs(this.memory.Estimates)) samples += estimate?.Samples ?? 0;
        return { Action: this.choice?.Action ?? (Math.floor(this.keys / IN_DUCK) % 2 === 1 ? "duck" : "forward"), Mode: frame?.Mode ?? "ground", From: frame?.From ?? 0, To: frame?.To ?? 0,
            Samples: samples, Reward: this.experiences.LastReward, Progress: this.progress, Attempts: totals.Attempts, Successes: totals.Successes, Failures: totals.Failures,
            Seconds: totals.Seconds, Stuck: totals.StuckSeconds, Breath: totals.BreathSpent, Goals: totals.Goals, Recoveries: totals.Recoveries,
            Water: totals.WaterEscapes, Ladders: totals.Ladders, Harm: totals.Harm, Keys: this.choice?.Keys ?? this.keys, Look: this.choice?.Look ?? this.look, Path: [...(frame?.Path ?? [])], Values: values,
            Passage: [passage?.Attempts ?? 0, passage?.Successes ?? 0, passage ? passage.Seconds / Math.max(1, passage.Attempts) : 0] };
    }
}
