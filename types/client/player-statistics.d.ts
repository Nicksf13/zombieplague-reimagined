interface ZPStatisticsMenuState {
    Query: ZPStatisticsQuery; Report?: ZPStatisticsReport | undefined; Pending: boolean;
    Status: "ready" | "disabled" | "loading";
}
interface ZPStatisticsMenu {
    Open(): void;
    Close(): void;
    Rebuild(): void;
    Select(map: string, role: ZPStatisticsRole, metric: ZPStatisticsMetric, target: string, weapon?: string): void;
    Refresh(): void;
    GetState(): ZPStatisticsMenuState;
}
interface ZPGameMode { PlayerStatisticsMenu?: ZPStatisticsMenu; }
