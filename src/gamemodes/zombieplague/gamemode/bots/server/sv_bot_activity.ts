import type { BotPlan } from "./sv_bot_motor";
import type { MotorExecution } from "./sv_bot_execution";
const { evaluationRequested } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
interface ActivityRow { Bot: number; Scope: ZPBotScope; Scenario: string; Opponent: string; Evaluation: boolean; Counters: Record<string, number>; }
interface Observation { Time: number; Position: GLuaVector; Status: string; UnderFire: boolean; }
interface Jump { Time: number; Position: GLuaVector; Source: string; Departed: boolean; Forced: boolean; }
interface ActivityContract { Observe(id: number, scope: ZPBotScope, ply: ZPServerPlayer, plan: BotPlan, execution: MotorExecution, underFire: boolean, now: number): void; Export(): boolean; }
/** Bounded descriptive telemetry, independent of reward and never used as policy input. */
export class BotActivity implements ActivityContract {
    private rows = new Map<string, ActivityRow>();
    private previous = new Map<number, Observation>();
    private jumps = new Map<number, Jump>();
    private encounters = new Map<number, { Started: number; Reached: boolean }>();
    private current = new Map<number, ActivityRow>();
    private dropped = 0;
    constructor(private session: string, private code: string) {}
    Context(id: number, scope: ZPBotScope): void { this.Row(id, scope); }
    private Row(id: number, scope: ZPBotScope): ActivityRow {
        const scenario = GetConVar("zp_bot_stats_scenario")?.GetString() ?? "live", opponent = GetConVar("zp_bot_stats_opponent")?.GetString() ?? "uncontrolled";
        const key = [id, ZPBotMetricsProtocol.Key(scope), scenario, opponent, evaluationRequested()].join("|");
        let row = this.rows.get(key);
        if (!row) {
            if (this.rows.size >= 128) { const first = [...this.rows.keys()][0]; if (first !== undefined) this.rows.delete(first); this.dropped++; }
            row = { Bot: id, Scope: { ...scope }, Scenario: scenario, Opponent: opponent, Evaluation: evaluationRequested(), Counters: {} }; this.rows.set(key, row);
        }
        this.current.set(id, row); return row;
    }
    Event(id: number, name: string, amount = 1): void {
        const row = this.current.get(id); if (!row) return;
        row.Counters[name] = Math.min(1e12, (row.Counters[name] ?? 0) + amount);
    }
    Reset(id: number): void {
        if (this.jumps.has(id)) this.Event(id, "Jump:interrupted");
        this.previous.delete(id); this.jumps.delete(id); this.encounters.delete(id); this.current.delete(id);
    }
    Gate(id: number): void {
        this.Event(id, "CommandGate");
        const previous = this.previous.get(id), now = CurTime();
        if (previous) {
            const dt = now - previous.Time;
            if (dt >= 0 && dt <= 0.75) {
                this.Event(id, "State:" + previous.Status + ":seconds", dt);
                if (previous.UnderFire) this.Event(id, "UnderFire:" + previous.Status + ":seconds", dt);
            } else if (dt > 0) this.Event(id, "UnobservedSeconds", dt);
            previous.Status = "gated"; previous.Time = now;
        }
    }
    Observe(id: number, scope: ZPBotScope, ply: ZPServerPlayer, plan: BotPlan, execution: MotorExecution, underFire: boolean, now: number): void {
        this.Row(id, scope);
        const old = this.previous.get(id), position = ply.GetPos(), velocity = ply.GetVelocity();
        const forced = velocity.x * velocity.x + velocity.y * velocity.y > ply.GetRunSpeed() ** 2 * 2.25 || (underFire && !ply.OnGround());
        const foreign = execution.Interventions.find(value => value.Motion || value.Tactical);
        const moving = Math.abs(execution.Commanded.Forward) + Math.abs(execution.Commanded.Side) > 1;
        const progress = old ? Math.sqrt(position.DistToSqr(old.Position)) : 0;
        const status = forced ? "forced_or_knockback" : !ply.OnGround() ? "airborne" : foreign ? "override:" + foreign.Controller :
            plan.Wait ? "intentional_wait" : !moving ? "no_command" : progress < Math.max(1, (now - (old?.Time ?? now)) * 5) ? "command_without_progress" : "moving";
        if (old && now >= old.Time) {
            const dt = now - old.Time;
            if (dt <= 0.75) {
                this.Event(id, "SurvivalSeconds", dt); this.Event(id, "State:" + old.Status + ":seconds", dt);
                if (old.UnderFire) this.Event(id, "UnderFire:" + old.Status + ":seconds", dt);
                if (!plan.Senses.Visible) this.Event(id, "NoVisualContactSeconds", dt);
            } else this.Event(id, "UnobservedSeconds", dt);
        }
        if (foreign && old?.Status !== status) this.Event(id, "Override:" + foreign.Controller + ":starts");
        const jump = this.jumps.get(id);
        if (jump) {
            jump.Forced ||= forced;
            if (!ply.OnGround()) jump.Departed = true;
            if ((jump.Departed && ply.OnGround()) || now - jump.Time > 2.5) {
                const moved = Math.sqrt(position.DistToSqr(jump.Position));
                this.Event(id, "Jump:" + jump.Source + ":" + (jump.Forced ? "external_or_damage_uncertain" : jump.Departed && ply.OnGround() ? moved >= 32 ? "landed_with_progress" : "landed_without_progress" : "no_observed_landing"));
                this.jumps.delete(id);
            }
        }
        if (ply.OnGround() && Math.floor(execution.Commanded.Keys / IN_JUMP) % 2 === 1 && !this.jumps.has(id)) {
            const source = plan.Boost ? "boost" : plan.Steering.Pick?.JumpReason ?? plan.Steering.Controller ?? "unknown";
            this.Event(id, "Jump:" + source + ":issued"); this.jumps.set(id, { Time: now, Position: Vector(position.x, position.y, position.z), Source: source, Departed: false, Forced: forced });
        }
        if (plan.Senses.Visible && !this.encounters.has(id)) { this.encounters.set(id, { Started: now, Reached: false }); this.Event(id, "RealEncounters"); }
        const encounter = this.encounters.get(id);
        if (encounter && !encounter.Reached && plan.Senses.Visible && Math.floor(execution.Commanded.Keys / IN_ATTACK) % 2 === 1) {
            encounter.Reached = true; this.Event(id, "AttackRangeReached"); this.Event(id, "AttackRangeSeconds", now - encounter.Started);
        }
        if (!plan.Senses.EnemyPosition) this.encounters.delete(id);
        this.previous.set(id, { Position: Vector(position.x, position.y, position.z), Time: now, Status: status, UnderFire: underFire });
    }
    Export(): boolean {
        const json = util.TableToJSON({ Version: 1, Session: this.session, Code: this.code, Dropped: this.dropped, Rows: [...this.rows.values()] });
        if (!json || json.length > 1048576) return false;
        file.CreateDir("zombieplague/bots/diagnostics");
        const path = "zombieplague/bots/diagnostics/activity-v1.json";
        const [ok] = pcall(() => file.Write(path, json)); return ok && file.Read(path, "DATA") === json;
    }
}
