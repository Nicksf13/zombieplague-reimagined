/** Backends load once and upsert absolute records. A callback must run exactly once. */
interface ZPStatisticsStorage {
    Load(this: ZPStatisticsStorage, done: (this: void, records: ZPStatisticsRecord[] | undefined) => void): void;
    Save(this: ZPStatisticsStorage, records: ZPStatisticsRecord[], done: (this: void, success: boolean) => void): void;
}
interface ZPPlayerStatisticsService {
    IsEnabled(this: ZPPlayerStatisticsService): boolean;
    IsReady(this: ZPPlayerStatisticsService): boolean;
    GetPlayerID(this: ZPPlayerStatisticsService, ply: ZPServerPlayer): string | undefined;
    SetStorage(this: ZPPlayerStatisticsService, storage: ZPStatisticsStorage): boolean;
    Initialize(this: ZPPlayerStatisticsService): void;
    Flush(this: ZPPlayerStatisticsService): void;
    Report(this: ZPPlayerStatisticsService, steamID64: string, query: ZPStatisticsQuery): ZPStatisticsReport;
}
interface ZPGameMode { PlayerStatistics?: ZPPlayerStatisticsService; }
/** @noSelf */
declare namespace hook {
    function Add(name: "ZPPlayerRoleChanged", id: string, callback: (this: void, ply: ZPServerPlayer) => void): void;
    function Add(name: "ZPPreInfectionEvent" | "ZPPreCureEvent", id: string, callback: (this: void, target: ZPServerPlayer, attacker: ZPServerPlayer, inflictor?: GLuaEntity) => void): void;
    function Add(name: "ZPStatisticsDamageStarted", id: string, callback: (this: void, target: ZPServerPlayer, damage: GLuaDamageInfo) => void): void;
    function Add(name: "ZPStatisticsStorage", id: string, callback: (this: void, service: ZPPlayerStatisticsService) => void): void;
}
