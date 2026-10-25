import type { MoveFrame, MoveOption } from "./sv_bot_motion";
import type { ExperienceEnd, ExperienceTrace, Intervention } from "./sv_bot_experience_trace";
import type { MotionObservation } from "./sv_bot_motion_causality";
const { BotMotionCausality } = include("sv_bot_motion_causality.lua") as typeof import("./sv_bot_motion_causality");
const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
export interface MotionAttempt {
    ID: string; Frame: MoveFrame; Key: string; Action: ZPBotMove; Started: number; Reward: number;
    Components: Record<string, number>; JumpIssued?: boolean; ShotDamage?: number;
    End?: ExperienceEnd; Reason?: string; Committed?: boolean;
    Intervention?: Intervention; Incident?: string;
}
interface ExperienceContract {
    Start(frame: MoveFrame, option: MoveOption, now: number): void;
    Close(now: number, reason: string, end?: ExperienceEnd): void;
    Cancel(reason: string, retainFlight?: boolean): void;
    Harm(amount: number, event?: string): boolean;
}
/** Rewards stay in escrow until a stage is safely completed. Unknown interruption is not failure. */
export class BotMotionExperiences implements ExperienceContract {
    Current: MotionAttempt | undefined;
    LastReward = 0;
    Unattributed = 0;
    LastLimitation = "";
    private sequence = 0;
    private pending: MotionAttempt[] = [];
    private incidents = new Set<string>();
    private causality = new BotMotionCausality(evidence => this.trace?.Record({ Kind: "departure", Learner: "motion",
        Experience: evidence.Owner, Reason: evidence.Reason, DepartureAt: evidence.DepartureAt,
        ...(evidence.CommandAt !== undefined ? { CommandAt: evidence.CommandAt } : {}) }));
    private stages = new Map<string, { Frame: MoveFrame; Success: boolean; Started: number; Ended: number }>();
    constructor(private memory: ZPBotMoveMemory, private observer?: (this: void, component: string, amount: number) => void,
        private trace?: ExperienceTrace, private passage?: (this: void, frame: MoveFrame, success: boolean, started: number, ended: number) => void) {}
    ID(): string { return this.Current?.ID ?? ""; }
    PendingIDs(): string[] { return this.pending.map(attempt => attempt.ID); }
    Integrity(): { Pending: number; Unattributed: number; LastReason: string; Experience: string } {
        return { Pending: this.pending.length, Unattributed: this.Unattributed, LastReason: this.LastLimitation, Experience: this.ID() };
    }
    private Record(attempt: MotionAttempt, kind: "start" | "finalize" | "update", reason: string, before?: number, after?: number, updated?: boolean): void {
        this.trace?.Record({ Kind: kind, Learner: "motion", Experience: attempt.ID, State: attempt.Key, Stage: attempt.Frame.Edge,
            Action: attempt.Action, Reason: reason, Components: attempt.Components, Total: attempt.Reward,
            ...(attempt.Intervention ? { Controller: attempt.Intervention.Controller, InterventionReason: attempt.Intervention.Reason } : {}),
            ...(attempt.Incident ? { Incident: attempt.Incident } : {}),
            ...(attempt.End ? { Outcome: attempt.End } : {}), ...(before !== undefined ? { Before: before } : {}),
            ...(after !== undefined ? { After: after } : {}), ...(updated !== undefined ? { Updated: updated } : {}) });
    }
    private Limit(reason: string, owner = "", amount = 0, incident?: string): void {
        this.Unattributed++; this.LastLimitation = reason;
        this.trace?.Record({ Kind: "unattributed", Learner: "motion", Experience: owner, Reason: reason, Total: amount, Updated: false,
            ...(incident ? { Incident: incident } : {}) });
    }
    Start(frame: MoveFrame, option: MoveOption, now: number): void {
        if (this.pending.length >= 64) {
            const oldest = this.pending.find(entry => !this.causality.Pending(entry.ID, now));
            if (oldest) { this.Limit("experience_buffer_limit", oldest.ID); oldest.End = "interrupted"; oldest.Reason = "experience_buffer_limit"; this.Commit(oldest); }
        }
        const attempt: MotionAttempt = { ID: this.trace?.NewID("motion") ?? "motion:" + ++this.sequence,
            Frame: { ...frame, Position: Vector(frame.Position.x, frame.Position.y, frame.Position.z) },
            Key: frame.Key, Action: option.Action, Started: now, Reward: 0, Components: {} };
        this.pending.push(attempt); this.Current = attempt; this.Record(attempt, "start", "candidate_selected");
    }
    Add(amount: number, component: string, attempt = this.Current): void {
        if (!attempt || attempt.Committed) return;
        attempt.Reward += amount; attempt.Components[component] = (attempt.Components[component] ?? 0) + amount;
    }
    Close(now: number, reason: string, end: ExperienceEnd = "observed"): void {
        const attempt = this.Current; this.Current = undefined;
        if (!attempt) return;
        attempt.End = end; attempt.Reason = reason;
        // A shot during flight establishes exposure, not a failed jump. Combat owns that damage;
        // crossing progress, grounded completion and attributed falls establish the movement outcome.
        if (attempt.End === "observed" && now - attempt.Started >= 0.45 && attempt.Reward <= 0) this.Add(-0.45, "no_progress", attempt);
        this.Flush(now);
    }
    Resolve(frame: MoveFrame, success: boolean, started: number, now: number): void {
        this.stages.set(frame.Edge, { Frame: frame, Success: success, Started: started, Ended: now });
        for (const attempt of this.pending) if (attempt.Frame.Edge === frame.Edge && (attempt.End === "observed" || (!success && attempt.End === "success"))) {
            attempt.End = success ? "success" : "interrupted"; attempt.Reason = success ? "checkpoint_confirmed" : "stage_failed_without_action_evidence";
        }
        this.Flush(now);
    }
    InterruptStage(edge: string, now: number): void {
        for (const attempt of this.pending) if (attempt.Frame.Edge === edge && attempt.End === "observed") {
            attempt.End = "interrupted"; attempt.Reason = "stage_changed_without_completion";
        }
        this.Flush(now);
    }
    ConfirmAction(edge: string, now: number, reason: string): void {
        for (const attempt of this.pending) if (attempt.Frame.Edge === edge && attempt.End === "observed") { attempt.End = "success"; attempt.Reason = reason; }
        this.Flush(now);
    }
    Dynamic(edge: string): void { for (const attempt of this.pending) if (attempt.Frame.Edge === edge) attempt.Frame.Dynamic = true; }
    Cancel(reason: string, retainFlight = false, intervention?: Intervention): void {
        // Diagnostic metadata only; outcome and settlement rules are unchanged.
        if (reason === "controller_substitution" && intervention) for (const attempt of this.pending) {
            if (!attempt.End || attempt.End === "observed") attempt.Intervention ??= intervention;
        }
        const now = CurTime(); this.Close(now, reason, reason === "controller_substitution" ? "superseded" : "interrupted");
        if (!retainFlight) this.causality.Reset(reason);
        for (const attempt of this.pending) {
            if (retainFlight && this.causality.Pending(attempt.ID, now)) continue;
            if (attempt.End !== "failure" && attempt.End !== "success") { attempt.End = reason === "controller_substitution" ? "superseded" : "interrupted"; attempt.Reason = reason; }
        }
        this.Flush(now);
    }
    Observe(observation: MotionObservation, now: number): void {
        this.causality.Observe(observation, this.Current?.ID, now); this.Flush(now);
    }
    InvalidateCausality(reason: string): void { this.causality.Reset(reason); }
    ObserveFrame(frame: MoveFrame, now: number): void {
        // Frames can witness departure, but only Input establishes the executed ground owner.
        this.causality.Observe({ Mode: frame.Mode, Position: frame.Position, Velocity: frame.Velocity ?? Vector(0, 0, 0),
            Run: Math.max(frame.Run ?? frame.Speed, 1), Controlled: !frame.Forced, Moving: false }, undefined, now);
        this.Flush(now);
    }
    Input(keys: number, frame: MoveFrame | undefined, jumping: boolean): void {
        if (this.Current?.Action.startsWith("jump") && frame?.Mode === "ground" && jumping && Math.floor(keys / IN_JUMP) % 2 === 1) this.Current.JumpIssued = true;
    }
    Harm(amount: number, event = "event:" + ++this.sequence, fall = true): boolean {
        if (!Number.isFinite(amount) || amount <= 0 || this.incidents.has(event)) return false;
        this.incidents.add(event); if (this.incidents.size > 128) { const first = [...this.incidents][0]; if (first !== undefined) this.incidents.delete(first); }
        this.memory.Totals.Harm += amount;
        if (!fall) {
            this.trace?.Record({ Kind: "consequence", Learner: "motion", Experience: "", Reason: "drowning", Incident: event,
                Consequence: "drowning", Total: amount, Attributed: false });
            this.Limit("drowning_without_causal_movement_evidence", "", amount, event); return false;
        }
        const now = CurTime(), owner = this.causality.Owner(now), attempt = this.pending.find(entry => entry.ID === owner && !entry.Committed);
        const reason = owner ? "owner_experience_already_finalized" : this.causality.Explain(now);
        this.trace?.Record({ Kind: "consequence", Learner: "motion", Experience: attempt?.ID ?? "", Incident: event,
            Consequence: "fall", Attributed: attempt !== undefined, Total: amount, ...(this.causality.Timing() ?? {}),
            Reason: attempt ? "observed_fall" : reason });
        if (!attempt) {
            this.Limit(reason, owner, amount, event);
            this.Close(now, "unattributed_fall", "interrupted");
            for (const pending of this.pending) if (pending.End === "observed") { pending.End = "interrupted"; pending.Reason = "unattributed_fall"; }
            this.causality.Reset("unattributed_fall"); this.Flush(now); return false;
        }
        if (this.Current === attempt) this.Current = undefined;
        else this.Close(now, "fall_belongs_to_previous_experience", "interrupted");
        this.Add(-Math.min(1, amount / 100), "environment_damage", attempt);
        attempt.Incident = event;
        // A failed crossing must never retain a positive partial-progress/arrival balance.
        this.Add(-Math.max(0, attempt.Reward + 1), "failed_crossing", attempt);
        attempt.End = "failure"; attempt.Reason = "observed_fall";
        this.causality.Consume();
        this.Resolve(attempt.Frame, false, attempt.Started, now);
        return true;
    }
    Shot(amount: number): void {
        if (!this.Current?.JumpIssued || !Number.isFinite(amount) || amount <= 0) return;
        this.Current.ShotDamage = (this.Current.ShotDamage ?? 0) + amount;
        this.memory.Totals.Harm += amount;
    }
    private Flush(now: number): void {
        for (const attempt of [...this.pending]) {
            if (!attempt.End || this.causality.Pending(attempt.ID, now)) continue;
            if (attempt.End === "success" && this.pending.some(other => other.Frame.Edge === attempt.Frame.Edge && this.causality.Pending(other.ID, now))) continue;
            if (attempt.End === "observed" && attempt.Reward > 0) continue;
            this.Commit(attempt);
        }
        for (const [edge, stage] of this.stages) {
            if (this.pending.some(entry => entry.Frame.Edge === edge && this.causality.Pending(entry.ID, now))) continue;
            this.passage?.(stage.Frame, stage.Success, stage.Started, stage.Ended); this.stages.delete(edge);
        }
    }
    private Commit(attempt: MotionAttempt): void {
        if (attempt.Committed) return;
        attempt.Committed = true; this.pending = this.pending.filter(entry => entry !== attempt);
        const valid = attempt.End !== "interrupted" && attempt.End !== "superseded";
        const reward = valid ? Math.max(-2, Math.min(2, attempt.Reward)) : 0;
        if (!valid && attempt.Reward !== 0) this.AddDiscard(attempt);
        if (valid && reward !== attempt.Reward) { attempt.Components.clamp = (attempt.Components.clamp ?? 0) + reward - attempt.Reward; attempt.Reward = reward; }
        const before = this.memory.Estimates[attempt.Key + ":" + attempt.Action]?.Value ?? 0;
        let after = before;
        if (valid) {
            this.memory.Totals.Attempts = Math.min(1e9, this.memory.Totals.Attempts + 1); this.LastReward = reward;
            for (const [component, amount] of pairs(attempt.Components)) this.observer?.(component, amount);
            if (learningAllowed()) {
                const key = attempt.Key + ":" + attempt.Action, previous = this.memory.Estimates[key];
                if (!previous && Object.keys(this.memory.Estimates).length >= 256) { const oldest = Object.keys(this.memory.Estimates)[0]; if (oldest !== undefined) delete this.memory.Estimates[oldest]; }
                after += 0.2 * (Math.max(-1, Math.min(1, reward)) - before);
                this.memory.Estimates[key] = { Value: after, Samples: Math.min(10000, (previous?.Samples ?? 0) + 1) };
            }
        }
        this.Record(attempt, "finalize", attempt.Reason ?? "unspecified", before, after, valid && learningAllowed());
        if (valid && learningAllowed()) this.Record(attempt, "update", "outcome_applied_once", before, after, true);
    }
    private AddDiscard(attempt: MotionAttempt): void { attempt.Components.unresolved_discard = -attempt.Reward; attempt.Reward = 0; }
}
