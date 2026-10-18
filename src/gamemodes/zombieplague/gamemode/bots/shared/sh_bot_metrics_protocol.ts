export {};
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const number = (value: unknown, min = 0, max = 1e12): value is number => typeof value === "number" && value === value && value >= min && value <= max;
const integer = (value: unknown, max: number): value is number => number(value, 0, max) && value % 1 === 0;
const actions: readonly ZPBotAction[] = ["attack", "defend", "retreat", "group"];
function empty(): ZPBotMetrics {
    const entry = (): ZPBotActionMetrics => ({ Seconds: 0, Episodes: 0, Positive: 0, Negative: 0, Reward: 0 });
    return { ActiveSeconds: 0, Distance: 0, Progress: 0, Arrivals: 0, Replans: 0, StuckSeconds: 0, Recoveries: 0,
        WaterSeconds: 0, WaterEscapes: 0, SprintSeconds: 0, BreathSpent: 0, DamageDealt: 0, DamageTaken: 0,
        Kills: 0, Deaths: 0, Infections: 0, Actions: { attack: entry(), defend: entry(), retreat: entry(), group: entry() } };
}
function totals(value: unknown): ZPBotMetrics | undefined {
    const data = record(value), entries = record(data?.Actions), result = empty();
    if (!data || !entries) return;
    for (const key of ["ActiveSeconds", "Distance", "Progress", "Arrivals", "Replans", "StuckSeconds", "Recoveries", "WaterSeconds", "WaterEscapes",
        "SprintSeconds", "BreathSpent", "DamageDealt", "DamageTaken", "Kills", "Deaths", "Infections"] as const) {
        const amount = data[key];
        if (!number(amount, key === "Progress" ? -1e12 : 0)) return;
        result[key] = amount;
    }
    for (const action of actions) {
        const entry = record(entries[action]);
        if (!entry || !number(entry.Seconds) || !integer(entry.Episodes, 2147483647) || !integer(entry.Positive, 2147483647) ||
            !integer(entry.Negative, 2147483647) || entry.Positive + entry.Negative > entry.Episodes || !number(entry.Reward, -1e12)) return;
        result.Actions[action] = { Seconds: entry.Seconds, Episodes: entry.Episodes, Positive: entry.Positive, Negative: entry.Negative, Reward: entry.Reward };
    }
    return result;
}
function scope(value: unknown): ZPBotScope | undefined {
    const data = record(value);
    if (data && text(data.Map) && text(data.ClassID) && text(data.ClassName) && (data.Role === "human" || data.Role === "zombie") &&
        (data.Variant === "normal" || data.Variant === "nemesis" || data.Variant === "survivor"))
        return { Map: data.Map, Role: data.Role, ClassID: data.ClassID, ClassName: data.ClassName, Variant: data.Variant };
}
function decision(value: unknown): ZPBotDecision | undefined {
    const data = record(value), entries = record(data?.Scores);
    if (!data || !entries || !number(data.Health, 0, 1) || !number(data.Distance) || !integer(data.Allies, 1024) || !integer(data.Enemies, 1024) ||
        typeof data.HasAlly !== "boolean" || typeof data.Held !== "boolean" || !number(data.Age)) return;
    const scores: Partial<Record<ZPBotAction, ZPBotScore>> = {};
    for (const action of actions) {
        const entry = record(entries[action]);
        if (!entry || !number(entry.Profile, -5, 5) || !number(entry.Health, -5, 5) || !number(entry.Threat, action === "retreat" && entry.Eligible === false ? -100 : -5, 5) ||
            !number(entry.Distance, -5, 5) || !number(entry.Cohesion, -100, 5) || !number(entry.Learned, -0.65, 0.65) ||
            !number(entry.Total, -100, 10) || !integer(entry.Samples, 10000) || typeof entry.Eligible !== "boolean" ||
            Math.abs(entry.Total - entry.Profile - entry.Health - entry.Threat - entry.Distance - entry.Cohesion - entry.Learned) > 0.000001) return;
        if (action === "retreat" && !entry.Eligible) {
            // A failed retreat cooldown uses the same disabled-node convention as unavailable grouping.
            if (entry.Threat !== -100 || entry.Total !== -100 || entry.Profile !== 0 || entry.Health !== 0 ||
                entry.Distance !== 0 || entry.Cohesion !== 0 || entry.Learned !== 0 || entry.Samples !== 0) return;
        }
        else if (entry.Eligible !== (action !== "group" || data.HasAlly)) return;
        scores[action] = { Profile: entry.Profile, Health: entry.Health, Threat: entry.Threat, Distance: entry.Distance,
            Cohesion: entry.Cohesion, Learned: entry.Learned, Total: entry.Total, Samples: entry.Samples, Eligible: entry.Eligible };
    }
    if (!scores.attack || !scores.defend || !scores.retreat || !scores.group) return;
    return { Health: data.Health, Distance: data.Distance, Allies: data.Allies, Enemies: data.Enemies, HasAlly: data.HasAlly,
        Held: data.Held, Age: data.Age, Scores: { attack: scores.attack, defend: scores.defend, retreat: scores.retreat, group: scores.group } };
}
_G.ZPBotMetricsProtocol = {
    Empty: empty, Totals: totals, Scope: scope, Decision: decision,
    Key(this: void, value) { return value.Map.length + ":" + value.Map + ":" + value.Role + ":" + value.ClassID.length + ":" + value.ClassID + ":" + value.Variant; },
    Snapshot(this: void, value) {
        const data = record(value), entries = record(data?.Rows);
        if (data?.Version !== 1 || !integer(data.RequestID, 2147483647) || data.RequestID < 1 || !integer(data.Page, 3) ||
            !integer(data.Total, 64) || typeof data.Learning !== "boolean" || !entries || Object.keys(entries).length > 16) return;
        const rows: ZPBotDiagnostic[] = [], seen: Record<number, boolean> = {};
        for (let index = 1; index <= Object.keys(entries).length; index++) {
            const row = record(entries[index]), context = scope(row?.Scope), stats = totals(row?.Totals);
            if (!row || !context || !stats || !integer(row.ID, 64) || row.ID < 1 || seen[row.ID] || !integer(row.EntityID, 8191) ||
                !text(row.Name) || !["aggressive", "cooperative", "defensive", "cautious"].some(item => item === row.Profile) ||
                !actions.some(item => item === row.Action) || !["profile", "learned", "explore", "search"].some(item => item === row.Reason) ||
                !["mesh", "local", "none"].some(item => item === row.Route) || !number(row.Remaining) || typeof row.Goal !== "string" || row.Goal.length > 96 ||
                !integer(row.Replans, 2147483647) || !number(row.Breath) || !number(row.MaxBreath) || !integer(row.Samples, 960000) || !number(row.LastReward, -2, 2) ||
                typeof row.Alive !== "boolean" || typeof row.Active !== "boolean" || typeof row.Blocked !== "boolean" ||
                typeof row.Sprinting !== "boolean" || typeof row.DrainEnabled !== "boolean") return;
            seen[row.ID] = true;
            const detail = row.Decision === undefined ? undefined : decision(row.Decision);
            if (row.Decision !== undefined && !detail) return;
            const diagnostic: ZPBotDiagnostic = { ID: row.ID, EntityID: row.EntityID, Name: row.Name, Scope: context, Totals: stats,
                Profile: row.Profile as ZPBotProfile, Action: row.Action as ZPBotAction, Reason: row.Reason as ZPBotReason,
                Route: row.Route as ZPBotRoute, Remaining: row.Remaining, Goal: row.Goal, Replans: row.Replans,
                Breath: row.Breath, MaxBreath: row.MaxBreath, Samples: row.Samples, LastReward: row.LastReward,
                Alive: row.Alive, Active: row.Active, Blocked: row.Blocked, Sprinting: row.Sprinting, DrainEnabled: row.DrainEnabled };
            if (detail) diagnostic.Decision = detail;
            const motion = row.Motion === undefined ? undefined : ZPBotMotionProtocol.Diagnostic(row.Motion);
            if (row.Motion !== undefined && !motion) return;
            if (motion) diagnostic.Motion = motion;
            const place = row.Place === undefined ? undefined : ZPBotPlaceProtocol.Diagnostic(row.Place);
            if (row.Place !== undefined && !place) return;
            if (place) diagnostic.Place = place;
            rows.push(diagnostic);
        }
        if (rows.length > data.Total || (rows.length === 0 && data.Total > data.Page * 16)) return;
        return { Version: 1, RequestID: data.RequestID, Page: data.Page, Total: data.Total, Learning: data.Learning, Rows: rows };
    },
};
