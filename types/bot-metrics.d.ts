type ZPBotProfile = "aggressive" | "cooperative" | "defensive" | "cautious";
type ZPBotRole = "human" | "zombie";
type ZPBotAction = "attack" | "defend" | "retreat" | "group";
type ZPBotReason = "profile" | "learned" | "explore" | "search";
type ZPBotRoute = "mesh" | "local" | "none";
interface ZPBotScope { Map: string; Role: ZPBotRole; ClassID: string; ClassName: string; Variant: "normal" | "nemesis" | "survivor"; }
interface ZPBotActionMetrics { Seconds: number; Episodes: number; Positive: number; Negative: number; Reward: number; }
interface ZPBotMetrics {
    ActiveSeconds: number; Distance: number; Progress: number; Arrivals: number; Replans: number;
    StuckSeconds: number; Recoveries: number; WaterSeconds: number; WaterEscapes: number;
    SprintSeconds: number; BreathSpent: number; DamageDealt: number; DamageTaken: number;
    Kills: number; Deaths: number; Infections: number;
    Actions: Record<ZPBotAction, ZPBotActionMetrics>;
}
type ZPBotInfluence = "Profile" | "Health" | "Threat" | "Distance" | "Cohesion" | "Learned";
interface ZPBotScore extends Record<ZPBotInfluence, number> { Total: number; Samples: number; Eligible: boolean; }
interface ZPBotDecision {
    Health: number; Distance: number; Allies: number; Enemies: number; HasAlly: boolean;
    Held: boolean; Age: number; Scores: Record<ZPBotAction, ZPBotScore>;
}
interface ZPBotDiagnostic {
    ID: number; EntityID: number; Name: string; Profile: ZPBotProfile; Scope: ZPBotScope;
    Action: ZPBotAction; Reason: ZPBotReason; Alive: boolean; Active: boolean;
    Route: ZPBotRoute; Remaining: number; Goal: string; Replans: number; Blocked: boolean;
    Breath: number; MaxBreath: number; Sprinting: boolean; DrainEnabled: boolean;
    Samples: number; LastReward: number; Totals: ZPBotMetrics;
    Decision?: ZPBotDecision;
    Motion?: ZPBotMoveDiagnostic;
    Place?: ZPBotPlaceDiagnostic;
}
interface ZPBotMetricsSnapshot { Version: 1; RequestID: number; Page: number; Total: number; Learning: boolean; Rows: ZPBotDiagnostic[]; }
interface ZPBotMetricsProtocol {
    Empty(this: void): ZPBotMetrics;
    Totals(this: void, value: unknown): ZPBotMetrics | undefined;
    Scope(this: void, value: unknown): ZPBotScope | undefined;
    Key(this: void, scope: ZPBotScope): string;
    Snapshot(this: void, value: unknown): ZPBotMetricsSnapshot | undefined;
    Decision(this: void, value: unknown): ZPBotDecision | undefined;
}
declare const ZPBotMetricsProtocol: ZPBotMetricsProtocol;
interface ZPGlobals { ZPBotMetricsProtocol: ZPBotMetricsProtocol; }
