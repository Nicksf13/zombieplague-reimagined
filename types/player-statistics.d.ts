type ZPStatisticsRole = "human" | "zombie" | "nemesis" | "survivor";
type ZPStatisticsMetric = "Kills" | "Deaths" | "Assists" | "DamageDealt" | "DamageTaken" |
    "ArmorDamageDealt" | "ArmorDamageTaken" | "Infections" | "Infected" | "Cures" | "SelfCures" |
    "Cured" | "Distance" | "AliveTime" | "Rounds" | "Wins" | "SurvivedRounds" | "NemesisKills" |
    "SurvivorKills" | "FirstZombieInfections" | "BestKills" | "BestDamage" | "BestInfections" | "BestSurvival";
type ZPStatisticsCounters = Record<ZPStatisticsMetric, number>;
type ZPStatisticsWeaponMetric = "Kills" | "Infections" | "DamageDealt" | "ArmorDamageDealt";
type ZPStatisticsWeaponCounters = Record<ZPStatisticsWeaponMetric, number>;
type ZPStatisticsWeapons = Record<string, Record<ZPStatisticsRole, ZPStatisticsWeaponCounters>>;
interface ZPStatisticsRecord {
    ID: string;
    Bot: boolean;
    Map: string;
    SteamID64: string;
    Name: string;
    Roles: Record<ZPStatisticsRole, ZPStatisticsCounters>;
    Weapons: ZPStatisticsWeapons;
}
interface ZPStatisticsQuery {
    Map: string; // Empty means all recorded maps on this server.
    Role: ZPStatisticsRole;
    Metric: ZPStatisticsMetric;
    Target: string;
    Weapon?: string;
    IncludeBots?: boolean;
}
interface ZPStatisticsRankingRow { ID: string; Bot: boolean; SteamID64: string; Name: string; Value: number; Rank: number; }
interface ZPStatisticsReport {
    Weapons?: { ID: string; Name: string }[];
    WeaponValues?: ZPStatisticsWeaponCounters;
    Maps: string[];
    Leaders: ZPStatisticsRankingRow[];
    SelfRank: number;
    SelfValue: number;
    Players: number;
    Profile: ZPStatisticsRecord;
}
interface ZPStatisticsReply { ID: number; Status: "ready" | "disabled" | "loading"; Report?: ZPStatisticsReport; }
