type ZPBotBoostPhase = "assemble" | "mount" | "jump" | "land";
type ZPBotBoostFeedback = "ready" | "saved" | "invalid" | "error" | "missing" | "busy" | "testing" | "success" | "failed";
type ZPBotBoostIssueCode = "surface" | "floor" | "range" | "nav" | "distance" | "level" | "rise" | "reach" | "incomplete" | "stale" | "selection" | "capacity" | "storage" | "alive" | "tool" | "disabled" | "round" | "frozen" | "bots" | "busy" | "path" | "physics" | "obstacle" | "unsaved";
interface ZPBotBoostIssue { Code: ZPBotBoostIssueCode; Slot: number; Actual: number; Min: number; Max: number; }
interface ZPBotBoostPoint { ID: number; Base: number[]; Approach: number[]; Exit: number[]; }
interface ZPBotBoostResult { Point: number; Successes: number; Failures: number; }
interface ZPBotBoostSession { Point: number; Support: number; Climber: number; Phase: ZPBotBoostPhase; }
interface ZPBotBoostSnapshot {
    Version: 1; RequestID: number; Revision: number; Points: ZPBotBoostPoint[]; Draft: ZPBotBoostPoint;
    Feedback: ZPBotBoostFeedback; Sessions: ZPBotBoostSession[]; Results: ZPBotBoostResult[];
    Issue?: ZPBotBoostIssue; Dirty?: boolean; Editing?: boolean; Selected?: number;
}
interface ZPBotBoostProtocol {
    Point(this: void, value: unknown, draft?: boolean): ZPBotBoostPoint | undefined;
    Snapshot(this: void, value: unknown): ZPBotBoostSnapshot | undefined;
}
declare const ZPBotBoostProtocol: ZPBotBoostProtocol;
interface ZPGlobals { ZPBotBoostProtocol: ZPBotBoostProtocol; }
