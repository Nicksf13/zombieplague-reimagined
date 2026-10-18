type ZPBotMove = "forward" | "back" | "left" | "right" | "diagonalleft" | "diagonalright" | "jump" | "jumpleft" | "jumpright" | "duck" | "duckleft" | "duckright" | "sprint" | "swim" | "climb";
type ZPBotMoveMode = "ground" | "air" | "water" | "ladder";
type ZPBotNavReason = "ready" | "missing" | "connection" | "height" | "fall" | "landing" | "obstacle" | "stalled" | "budget" | "ground" | "occupied";
type ZPBotNavPhase = "route" | "align" | "cross" | "land";
interface ZPBotNavigationDiagnostic {
    Reason: ZPBotNavReason; Phase: ZPBotNavPhase; From: number; To: number; Height: number; Damage: number; Path: number[];
}
interface ZPBotMoveEstimate { Value: number; Samples: number; }
interface ZPBotPassage { Attempts: number; Successes: number; Failures: number; Seconds: number; }
interface ZPBotMoveTotals {
    Attempts: number; Successes: number; Failures: number; Goals: number; Recoveries: number;
    WaterEscapes: number; Ladders: number; Distance: number; Progress: number; Seconds: number;
    StuckSeconds: number; BreathSpent: number; Harm: number;
}
interface ZPBotMoveMemory {
    Places?: ZPBotPlaceMemory;
    Estimates: Record<string, ZPBotMoveEstimate | undefined>;
    Passages: Record<string, ZPBotPassage | undefined>;
    Totals: ZPBotMoveTotals;
}
interface ZPBotMoveDiagnostic {
    Navigation?: ZPBotNavigationDiagnostic;
    Action: ZPBotMove; Mode: ZPBotMoveMode; From: number; To: number; Samples: number; Reward: number;
    Progress: number; Attempts: number; Successes: number; Failures: number; Seconds: number;
    Stuck: number; Breath: number; Goals: number; Recoveries: number; Water: number; Ladders: number; Harm: number;
    Keys: number; Look: number; Path: number[]; Values: number[]; Passage: number[];
}
interface ZPBotMotionProtocol {
    Empty(this: void): ZPBotMoveMemory;
    Memory(this: void, value: unknown): ZPBotMoveMemory | undefined;
    Diagnostic(this: void, value: unknown): ZPBotMoveDiagnostic | undefined;
    Navigation(this: void, value: unknown): ZPBotNavigationDiagnostic | undefined;
    Actions: readonly ZPBotMove[];
}
declare const ZPBotMotionProtocol: ZPBotMotionProtocol;
interface ZPGlobals { ZPBotMotionProtocol: ZPBotMotionProtocol; }
