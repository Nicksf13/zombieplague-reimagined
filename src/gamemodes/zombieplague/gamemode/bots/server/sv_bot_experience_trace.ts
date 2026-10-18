const { evaluationRequested, learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
export type ExperienceEnd = "observed" | "success" | "failure" | "interrupted" | "superseded";
export interface Intervention { Controller: string; Reason: string; Tactical: boolean; Motion: boolean; }
export interface MovementRequest { Goal: number[]; Move: string; Local?: string; Waypoint?: number[]; }
export interface CommandEvidence { Forward: number; Side: number; Keys: number; Yaw: number; WorldX: number; WorldY: number; }
export interface ExperienceEvent {
    Kind: "start" | "execution" | "intervention" | "finalize" | "update" | "unattributed" | "departure" | "consequence" | "marker";
    Learner: "tactical" | "profile" | "motion" | "passage" | "place" | "boost"; Experience: string; Reason: string;
    Decision?: string; Stage?: string; State?: string; Action?: string; Outcome?: ExperienceEnd;
    Controller?: string; InterventionReason?: string; Duration?: number; Requested?: MovementRequest; Commanded?: CommandEvidence;
    Components?: Record<string, number>; Total?: number; Before?: number; After?: number; Updated?: boolean;
    Incident?: string; Consequence?: "fall" | "drowning"; Attributed?: boolean;
    CommandAt?: number; DepartureAt?: number;
    Open?: { Tactical: string[]; Motion: string[]; Place?: string[]; Boost?: string[] };
    Executed?: boolean; ProfileEligible?: boolean;
    ValueKind?: "passage_failure_fraction";
}
export interface ExperienceTrace {
    NewID(this: void, learner: string): string;
    Record(this: void, event: ExperienceEvent): void;
}
interface TraceRow extends ExperienceEvent {
    Session: string; Bot: number; Role: ZPBotRole; Scope: string; Time: number;
    Sequence: number; Learning: boolean; Evaluation: boolean;
}
interface TraceContract { Channel(id: number, scope: ZPBotScope): ExperienceTrace; Export(): boolean; }
/** Debug-only, bounded event history. No per-tick output or writes in ordinary play. */
export class BotExperienceTrace implements TraceContract {
    private sequence = 0;
    private rows: TraceRow[] = [];
    private dropped = 0;
    private records = 0;
    constructor(private session: string) {}
    Channel(id: number, scope: ZPBotScope): ExperienceTrace {
        return {
            NewID: learner => this.session + ":" + id + ":" + learner + ":" + ++this.sequence,
            Record: event => {
                if (!cvars.Bool("zp_bot_learning_trace", false)) return;
                const filter = cvars.Number("zp_bot_learning_trace_bot", 0);
                if (filter > 0 && filter !== id) return;
                const row: TraceRow = { ...event, Session: this.session, Bot: id, Role: scope.Role,
                    Scope: ZPBotMetricsProtocol.Key(scope), Time: CurTime(), Sequence: ++this.records,
                    Learning: learningAllowed(), Evaluation: evaluationRequested() };
                if (event.Components) row.Components = { ...event.Components };
                if (event.Requested) row.Requested = { ...event.Requested, Goal: [...event.Requested.Goal] };
                if (event.Requested?.Waypoint && row.Requested) row.Requested.Waypoint = [...event.Requested.Waypoint];
                if (event.Commanded) row.Commanded = { ...event.Commanded };
                if (event.Open) row.Open = { Tactical: [...event.Open.Tactical], Motion: [...event.Open.Motion],
                    ...(event.Open.Place ? { Place: [...event.Open.Place] } : {}), ...(event.Open.Boost ? { Boost: [...event.Open.Boost] } : {}) };
                this.rows.push(row); if (this.rows.length > 512) { this.rows.shift(); this.dropped++; }
                const json = util.TableToJSON(row); if (json) print("[ZP learning] " + json);
            },
        };
    }
    Export(): boolean {
        if (!cvars.Bool("zp_bot_learning_trace", false)) return false;
        const json = util.TableToJSON({ Version: 1, Session: this.session, Dropped: this.dropped, Rows: this.rows });
        if (!json || json.length > 1048576) return false;
        file.CreateDir("zombieplague/bots/diagnostics");
        const path = "zombieplague/bots/diagnostics/learning-trace-v1.json";
        const [ok] = pcall(() => file.Write(path, json));
        return ok && file.Read(path, "DATA") === json;
    }
}
