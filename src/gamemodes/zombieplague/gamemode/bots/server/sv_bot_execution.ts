import type { CommandEvidence, ExperienceTrace, Intervention, MovementRequest } from "./sv_bot_experience_trace";
export interface MotorExecution { Commanded: CommandEvidence; Interventions: Intervention[]; AttackGate?: string; }
export interface ExecutionPlan {
    Decision: string; Experience: string; Stage: string; Action: ZPBotAction; Requested: MovementRequest;
}
interface ActiveIntervention { Value: Intervention; Started: number; Plan: ExecutionPlan; }
interface ExecutionContract { Command(plan: ExecutionPlan, execution: MotorExecution, now: number): void; Reset(now: number): void; }
/** Tactical decisions, requested movement and issued input remain separate levels. */
export class BotExecutionTracker implements ExecutionContract {
    private active = new Map<string, ActiveIntervention>();
    private signature = "";
    private next = 0;
    constructor(private trace: ExperienceTrace) {}
    private End(key: string, entry: ActiveIntervention, now: number): void {
        this.trace.Record({ Kind: "intervention", Learner: entry.Value.Tactical ? "tactical" : "motion",
            Experience: entry.Value.Tactical ? entry.Plan.Decision : entry.Plan.Experience,
            Decision: entry.Plan.Decision, Stage: entry.Plan.Stage, Action: entry.Plan.Action, Requested: entry.Plan.Requested,
            Controller: entry.Value.Controller, Reason: entry.Value.Reason, Duration: Math.max(0, now - entry.Started), Updated: false });
        this.active.delete(key);
    }
    Command(plan: ExecutionPlan, execution: MotorExecution, now: number): void {
        const present = new Set<string>();
        for (const value of execution.Interventions) {
            const key = plan.Decision + ":" + value.Controller + ":" + value.Reason; present.add(key);
            if (!this.active.has(key)) this.active.set(key, { Value: value, Started: now, Plan: plan });
        }
        for (const [key, entry] of this.active) if (!present.has(key)) this.End(key, entry, now);
        const cmd = execution.Commanded;
        const signature = [plan.Decision, plan.Experience, ...execution.Interventions.map(value => value.Controller + ":" + value.Reason),
            Math.round(cmd.Forward), Math.round(cmd.Side), cmd.Keys].join("|");
        if (signature !== this.signature && now >= this.next) {
            this.trace.Record({ Kind: "execution", Learner: "motion", Experience: plan.Experience, Decision: plan.Decision,
                Stage: plan.Stage, Action: plan.Action, Reason: "issued_player_input", Requested: plan.Requested, Commanded: cmd,
                Controller: execution.Interventions.map(value => value.Controller + ":" + value.Reason).join(",") });
            this.signature = signature; this.next = now + 0.2;
        }
    }
    Reset(now: number): void { for (const [key, entry] of this.active) this.End(key, entry, now); this.signature = ""; this.next = 0; }
}
