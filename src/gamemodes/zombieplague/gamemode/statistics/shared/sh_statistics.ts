const weapons = include("sh_statistics_weapons.lua") as typeof import("./sh_statistics_weapons");
export const roles: readonly ZPStatisticsRole[] = ["human", "zombie", "nemesis", "survivor"];
export const metrics: readonly ZPStatisticsMetric[] = [
    "Kills", "Deaths", "Assists", "DamageDealt", "DamageTaken", "ArmorDamageDealt", "ArmorDamageTaken",
    "Infections", "Infected", "Cures", "SelfCures", "Cured", "Distance", "AliveTime", "Rounds", "Wins",
    "SurvivedRounds", "NemesisKills", "SurvivorKills", "FirstZombieInfections", "BestKills", "BestDamage",
    "BestInfections", "BestSurvival",
];
export function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
export function finite(value: unknown): value is number {
    return typeof value === "number" && value >= 0 && value <= 1e15;
}
export function integerMetric(metric: ZPStatisticsMetric): boolean {
    return !["DamageDealt", "DamageTaken", "ArmorDamageDealt", "ArmorDamageTaken", "Distance", "AliveTime", "BestDamage", "BestSurvival"].includes(metric);
}
export function mapName(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 64 && string.match(value, "^[%w_-]+$") !== undefined;
}
export function steamID(value: unknown): value is string {
    return typeof value === "string" && value.length === 17 && string.match(value, "^7656119%d+$") !== undefined;
}
export function botID(value: unknown): value is string {
    if (typeof value !== "string" || value.length < 70 || value.length > 72 || value.substring(0, 4) !== "bot:" || value.charAt(68) !== ":") return false;
    const hash = value.substring(4, 68), suffix = value.substring(69), slot = Number(suffix);
    return string.match(hash, "^[a-f0-9]+$") !== undefined && slot >= 1 && slot <= 128 && slot % 1 === 0 && tostring(slot) === suffix;
}
export function profileID(value: unknown): value is string { return steamID(value) || botID(value); }
function identity(data: Record<string, unknown>): { ID: string; SteamID64: string; Bot: boolean } | undefined {
    const id = data.ID === undefined ? data.SteamID64 : data.ID;
    if (!profileID(id)) return;
    const bot = botID(id), steam = bot ? "" : id;
    if (data.SteamID64 !== steam || (data.Bot !== undefined && data.Bot !== bot)) return;
    return { ID: id, SteamID64: steam, Bot: bot };
}
export function counters(): ZPStatisticsCounters {
    return { Kills: 0, Deaths: 0, Assists: 0, DamageDealt: 0, DamageTaken: 0, ArmorDamageDealt: 0,
        ArmorDamageTaken: 0, Infections: 0, Infected: 0, Cures: 0, SelfCures: 0, Cured: 0, Distance: 0,
        AliveTime: 0, Rounds: 0, Wins: 0, SurvivedRounds: 0, NemesisKills: 0, SurvivorKills: 0,
        FirstZombieInfections: 0, BestKills: 0, BestDamage: 0, BestInfections: 0, BestSurvival: 0 };
}
export function playerName(value: string): string {
    let end = Math.min(value.length, 64);
    while (end > 0 && end < value.length && value.charCodeAt(end) >= 128 && value.charCodeAt(end) < 192) end--;
    return value.substring(0, end);
}
export function empty(map: string, id: string, name: string): ZPStatisticsRecord {
    return { Map: map, ID: id, Bot: botID(id), SteamID64: botID(id) ? "" : id, Name: playerName(name),
        Roles: { human: counters(), zombie: counters(), nemesis: counters(), survivor: counters() }, Weapons: {} };
}
export function parse(value: unknown, attribution = true): ZPStatisticsRecord | undefined {
    const data = record(value), states = record(data?.Roles);
    const owner = data && identity(data);
    if (!data || !owner || !mapName(data.Map) || typeof data.Name !== "string" ||
        data.Name.length > 64 || !states) return;
    const result = empty(data.Map, owner.ID, data.Name);
    for (const role of roles) {
        const source = record(states[role]);
        if (!source) return;
        for (const metric of metrics) {
            const amount = source[metric];
            if (!finite(amount) || (integerMetric(metric) && amount % 1 !== 0)) return;
            result.Roles[role][metric] = amount;
        }
    }
    if (attribution) {
        const parsed = weapons.parse(data.Weapons, result.Roles);
        if (!parsed) return;
        result.Weapons = parsed;
    }
    return result;
}
/** Totals add; records keep the best individual round/life across maps. */
export function merge(target: ZPStatisticsRecord, source: ZPStatisticsRecord): void {
    weapons.merge(target.Weapons, source.Weapons);
    for (const role of roles) for (const metric of metrics) {
        const amount = source.Roles[role][metric];
        target.Roles[role][metric] = metric.startsWith("Best")
            ? Math.max(target.Roles[role][metric], amount) : Math.min(1e15, target.Roles[role][metric] + amount);
    }
}
export function copy(source: ZPStatisticsRecord): ZPStatisticsRecord {
    const result = empty(source.Map, source.ID, source.Name); merge(result, source); return result;
}
export function reply(value: unknown): ZPStatisticsReply | undefined {
    const data = record(value);
    if (!data || !finite(data.ID) || data.ID < 1 || data.ID > 65535 || data.ID % 1 !== 0 ||
        (data.Status !== "ready" && data.Status !== "disabled" && data.Status !== "loading")) return;
    if (data.Status !== "ready") return { ID: data.ID, Status: data.Status };
    const report = record(data.Report), profile = record(report?.Profile);
    // The aggregate profile uses a valid placeholder map on the wire.
    const parsed = parse(profile, false);
    if (!report || !parsed || !Array.isArray(report.Maps) || report.Maps.length > 256 ||
        !report.Maps.every(value => mapName(value)) || !Array.isArray(report.Leaders) || report.Leaders.length > 20 ||
        !finite(report.SelfRank) || !finite(report.SelfValue) || !finite(report.Players) ||
        report.SelfRank % 1 !== 0 || report.Players % 1 !== 0 || report.SelfRank > report.Players) return;
    const leaders: ZPStatisticsRankingRow[] = [];
    for (const raw of report.Leaders) {
        const row = record(raw);
        const owner = row && identity(row);
        if (!row || !owner || typeof row.Name !== "string" || row.Name.length > 64 ||
            !finite(row.Value) || !finite(row.Rank) || row.Rank < 1 || row.Rank % 1 !== 0 || row.Rank > report.Players) return;
        leaders.push({ ...owner, Name: row.Name, Value: row.Value, Rank: row.Rank });
    }
    const options: { ID: string; Name: string }[] = [];
    if (report.Weapons !== undefined) {
        if (!Array.isArray(report.Weapons) || report.Weapons.length > weapons.limit) return;
        for (const raw of report.Weapons) {
            const option = record(raw);
            if (!option || !weapons.valid(option.ID) || typeof option.Name !== "string" || option.Name.length > 64) return;
            options.push({ ID: option.ID, Name: option.Name });
        }
    }
    const values = record(report.WeaponValues);
    if (report.WeaponValues !== undefined && !values) return;
    const selected = weapons.counters();
    if (values) for (const metric of weapons.metrics) {
        const stored = values[metric];
        const amount = stored === undefined && (metric === "DamageDealt" || metric === "ArmorDamageDealt") ? 0 : stored;
        if (!weapons.counter(amount, metric)) return;
        selected[metric] = amount;
    }
    return { ID: data.ID, Status: "ready", Report: { Maps: report.Maps, Leaders: leaders, Weapons: options,
        WeaponValues: selected,
        SelfRank: report.SelfRank, SelfValue: report.SelfValue, Players: report.Players, Profile: parsed } };
}
