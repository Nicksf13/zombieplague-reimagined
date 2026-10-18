type ZPBotTrialEnd = "success" | "fall" | "enemy" | "environment" | "unknown" | "timeout" | "interrupted" | "path_failure" | "missing_nav";
type ZPBotRewardObserver = (this: void, id: number, system: string, component: string, amount: number) => void;
interface ZPBotTrial {
    ID: string; Session: string; Round: number; Bot: number; Incarnation: number; Life: number;
    Kind: "navigation" | "combat"; Mode: "training" | "evaluation" | "observation";
    Code: string; Policy: string; Rewards: string; Map: string; Scenario: string; Difficulty: string;
    Cohort: "trained" | "heldout" | "retention"; Role: ZPBotRole; ClassID: string; Variant: string; Equipment: string;
    Speed: number; Jump: number; Health: number; Resources: string; Reference: string; Physics: string; Navigation: string; Settings: string; Opponents: string; Start: number[]; Goal: number[];
    Started: number; Timestamp: number; EndedAt: number; RecordedAt: string; Day: string; Hour: string; UTCOffset: number;
    Seconds: number; Active: number; Distance: number; Stuck: number; Replans: number; Recoveries: number;
    Falls: number; Kills: number; Deaths: number; Dealt: number; Taken: number; Win: number;
    Reward: number; Components: Record<string, number>; End: ZPBotTrialEnd; Detail: string;
}
interface ZPBotStatisticsFilter { Bot: string; Version: string; Scenario: string; Difficulty: string; Role: string; Period: string; }
interface ZPBotTrialSummary {
    Key: string; Session: string; Block: number; Period: string; Kind: string; Mode: string; Policy: string; Scenario: string; Role: string;
    Map: string; Difficulty: string; ClassID: string; Cohort: string; Code: string; Challenge: string; Descriptive: boolean;
    N: number; Eligible: number; Success: number; Falls: number; Timeouts: number; Interrupted: number; Infrastructure: number;
    Median: number; P90: number; Active: number; Stuck: number; Kills: number; Deaths: number; DealtPerMinute: number; TakenPerMinute: number;
    Wins: number; Losses: number; Reward: number; Sessions: number; Low: number; High: number;
    FallLow: number; FallHigh: number; TimeoutLow: number; TimeoutHigh: number;
}
interface ZPBotStatisticsReport {
    Version: 1; Session: string; Total: number; Dropped: number; Truncated: number; Groups: ZPBotTrialSummary[];
    History: ZPBotTrial[]; Comparisons: { Current: string; Previous: string; Result: string; RewardWarning: boolean }[];
    Timeline: ZPBotTrialSummary[];
    TimelineDropped: number;
    Bots?: number[];
    Minutes?: ZPBotTrialSummary[];
}
