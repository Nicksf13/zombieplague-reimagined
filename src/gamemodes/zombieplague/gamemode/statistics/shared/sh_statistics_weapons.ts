export const unknown = "unattributed";
export const limit = 128;
export const metrics: readonly ZPStatisticsWeaponMetric[] = ["Kills", "Infections", "DamageDealt", "ArmorDamageDealt"];
const roles: readonly ZPStatisticsRole[] = ["human", "zombie", "nemesis", "survivor"];
export function supports(metric: ZPStatisticsMetric): metric is ZPStatisticsWeaponMetric {
    return metrics.some(value => value === metric);
}
export function counter(value: unknown, metric: ZPStatisticsWeaponMetric): value is number {
    return typeof value === "number" && value >= 0 && value <= 1e15 &&
        (metric === "DamageDealt" || metric === "ArmorDamageDealt" || value % 1 === 0);
}
export function counters(): ZPStatisticsWeaponCounters { return { Kills: 0, Infections: 0, DamageDealt: 0, ArmorDamageDealt: 0 }; }
export function valid(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 96 && string.match(value, "^[%w_-]+$") !== undefined;
}
export function empty(): Record<ZPStatisticsRole, ZPStatisticsWeaponCounters> {
    return { human: counters(), zombie: counters(), nemesis: counters(), survivor: counters() };
}
export function entry(weapons: ZPStatisticsWeapons, id: string): Record<ZPStatisticsRole, ZPStatisticsWeaponCounters> {
    const key = valid(id) && (weapons[id] !== undefined || Object.keys(weapons).length < limit - 1) ? id : unknown;
    return weapons[key] ?? (weapons[key] = empty());
}
export function merge(target: ZPStatisticsWeapons, source: ZPStatisticsWeapons): void {
    for (const [id, values] of pairs(source)) {
        const result = entry(target, id);
        for (const role of roles) for (const metric of metrics)
            result[role][metric] = Math.min(1e15, result[role][metric] + values[role][metric]);
    }
}
function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
/** Missing attribution is retained as unknown; attributed counts may never exceed totals. */
export function parse(value: unknown, totals: Record<ZPStatisticsRole, ZPStatisticsCounters>): ZPStatisticsWeapons | undefined {
    const result: ZPStatisticsWeapons = {}, source = value === undefined ? {} : record(value);
    if (!source || Object.keys(source).length > limit || (Object.keys(source).length === limit && source[unknown] === undefined)) return;
    for (const [id, raw] of pairs(source)) {
        const data = record(raw);
        if (!valid(id) || !data) return;
        const row = empty();
        for (const role of roles) {
            const counters = record(data[role]);
            if (!counters) return;
            for (const metric of metrics) {
                const stored = counters[metric];
                const amount = stored === undefined && (metric === "DamageDealt" || metric === "ArmorDamageDealt") ? 0 : stored;
                if (!counter(amount, metric)) return;
                row[role][metric] = amount;
            }
        }
        result[id] = row;
    }
    for (const role of roles) for (const metric of metrics) {
        let sum = 0;
        for (const [, values] of pairs(result)) sum += values[role][metric];
        const missing = totals[role][metric] - sum;
        const tolerance = metric === "Kills" || metric === "Infections" ? 0 : Math.max(1, totals[role][metric]) * 1e-12;
        if (missing < -tolerance || missing !== missing) return;
        if (missing > tolerance) entry(result, unknown)[role][metric] += missing;
    }
    return result;
}
