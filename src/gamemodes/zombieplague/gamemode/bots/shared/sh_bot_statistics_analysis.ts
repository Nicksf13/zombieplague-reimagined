export const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
export function canonical(value: unknown): string {
    if (typeof value === "string") return value.length + ":" + value;
    const data = record(value);
    if (!data) return tostring(value);
    return Object.keys(data).sort().map(key => canonical(key) + canonical(data[key])).join("|");
}
const text = (value: unknown, limit = 256): value is string => typeof value === "string" && value.length <= limit;
const number = (value: unknown): value is number => typeof value === "number" && value === value && Math.abs(value) <= 1e12;
export function trial(value: unknown): ZPBotTrial | undefined {
    const row = record(value);
    if (!row) return;
    for (const key of ["ID", "Session", "Code", "Policy", "Rewards", "Map", "Scenario", "Difficulty", "ClassID", "Variant", "Equipment", "Resources", "Reference", "Physics", "Navigation", "Settings", "Opponents", "Detail", "RecordedAt", "Day", "Hour"])
        if (!text(row[key], 2048)) return;
    if (!["navigation", "combat"].includes(tostring(row.Kind)) || !["training", "evaluation", "observation"].includes(tostring(row.Mode)) ||
        !["trained", "heldout", "retention"].includes(tostring(row.Cohort)) || !["human", "zombie"].includes(tostring(row.Role)) ||
        !["success", "fall", "enemy", "environment", "unknown", "timeout", "interrupted", "path_failure", "missing_nav"].includes(tostring(row.End))) return;
    for (const key of ["Round", "Bot", "Incarnation", "Life", "Speed", "Jump", "Health", "Started", "Timestamp", "EndedAt", "UTCOffset", "Seconds", "Active", "Distance", "Stuck", "Replans", "Recoveries", "Falls", "Kills", "Deaths", "Dealt", "Taken", "Win", "Reward"])
        if (!number(row[key]) || (key !== "Reward" && key !== "Win" && key !== "UTCOffset" && (row[key] as number) < 0)) return;
    if (row.ID === "" || row.Session === "" || (row.Bot as number) < 1 || (row.Bot as number) > 64 || ![-1, 0, 1].includes(row.Win as number)) return;
    for (const key of ["Round", "Bot", "Incarnation", "Life", "Replans", "Recoveries", "Falls", "Kills", "Deaths"]) if ((row[key] as number) % 1 !== 0) return;
    if (!Array.isArray(row.Start) || row.Start.length !== 3 || !row.Start.every(value => number(value)) || !Array.isArray(row.Goal) ||
        (row.Goal.length !== 0 && row.Goal.length !== 3) || !row.Goal.every(value => number(value))) return;
    const components = record(row.Components);
    if (!components || Object.keys(components).length > 64) return;
    for (const [key, amount] of pairs(components)) if (!text(key, 96) || !number(amount)) return;
    return row as unknown as ZPBotTrial;
}
export function filter(value: unknown): ZPBotStatisticsFilter | undefined {
    const data = record(value);
    if (!data) return;
    for (const key of ["Bot", "Version", "Scenario", "Difficulty", "Role", "Period"]) if (!text(data[key], 128)) return;
    return data as unknown as ZPBotStatisticsFilter;
}
// Length-prefixed values avoid ambiguous concatenation; physical conditions stay separate.
export function conditions(row: ZPBotTrial): string {
    return [row.Bot, row.Kind, row.Mode, row.Rewards, row.Map, row.Scenario, row.Difficulty, row.Cohort, row.Role, row.ClassID, row.Variant,
        row.Equipment, row.Resources, row.Reference, row.Speed, row.Jump, row.Health, row.Physics, row.Navigation, row.Settings, row.Opponents, row.Start.join(","), row.Goal.join(",")]
        .map(value => tostring(value).length + ":" + tostring(value)).join("");
}
export function matches(row: ZPBotTrial, query: ZPBotStatisticsFilter): boolean {
    return (query.Bot === "" || tostring(row.Bot) === query.Bot) && (query.Version === "" || row.Policy === query.Version || row.Code === query.Version) &&
        (query.Scenario === "" || row.Scenario === query.Scenario) && (query.Difficulty === "" || row.Difficulty === query.Difficulty) && (query.Role === "" || row.Role === query.Role) && (query.Period === "" || row.Hour.startsWith(query.Period));
}
const eligible = (row: ZPBotTrial): boolean => row.End !== "interrupted" && row.End !== "missing_nav" && row.End !== "path_failure";
const quantile = (values: number[], p: number): number => values.length === 0 ? 0 : values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;
export function summarize(rows: ZPBotTrial[], key: string, session = "", block = 0, period = ""): ZPBotTrialSummary {
    const first = rows[0];
    const result: ZPBotTrialSummary = { Key: key, Session: session, Block: block, Period: period, Kind: first?.Kind ?? "navigation", Mode: first?.Mode ?? "observation",
        Map: first?.Map ?? "", Difficulty: first?.Difficulty ?? "", ClassID: first?.ClassID ?? "", Cohort: first?.Cohort ?? "trained", Code: first?.Code ?? "", Challenge: first ? first.Start.join(",") + " → " + first.Goal.join(",") : "", Descriptive: false,
        Policy: first?.Policy ?? "", Scenario: first?.Scenario ?? "", Role: first?.Role ?? "human", N: rows.length, Eligible: 0, Success: 0, Falls: 0, Timeouts: 0,
        Interrupted: 0, Infrastructure: 0, Median: 0, P90: 0, Active: 0, Stuck: 0, Kills: 0, Deaths: 0, DealtPerMinute: 0, TakenPerMinute: 0,
        Wins: 0, Losses: 0, Reward: 0, Sessions: 0, Low: 0, High: 1, FallLow: 0, FallHigh: 1, TimeoutLow: 0, TimeoutHigh: 1 };
    const times: number[] = [], sessions = new Map<string, { N: number; Success: number; Falls: number; Timeouts: number }>();
    let dealt = 0, taken = 0;
    for (const row of rows) {
        result.Falls += row.Falls; result.Active += row.Active; result.Stuck += row.Stuck; result.Kills += row.Kills; result.Deaths += row.Deaths;
        result.Reward += row.Reward; dealt += row.Dealt; taken += row.Taken;
        if (row.Win === 1) result.Wins++; if (row.Win === -1) result.Losses++;
        if (row.End === "interrupted") result.Interrupted++;
        if (row.End === "path_failure" || row.End === "missing_nav") result.Infrastructure++;
        if (row.End === "timeout") result.Timeouts++;
        if (!eligible(row)) continue;
        result.Eligible++;
        const cluster = sessions.get(row.Session) ?? { N: 0, Success: 0, Falls: 0, Timeouts: 0 }; cluster.N++;
        if (row.Falls > 0) cluster.Falls++; if (row.End === "timeout") cluster.Timeouts++;
        if (row.End === "success") { result.Success++; cluster.Success++; times.push(row.Seconds); }
        sessions.set(row.Session, cluster);
    }
    times.sort((a, b) => a - b); result.Median = quantile(times, 0.5); result.P90 = quantile(times, 0.9);
    result.DealtPerMinute = result.Active > 0 ? dealt * 60 / result.Active : 0; result.TakenPerMinute = result.Active > 0 ? taken * 60 / result.Active : 0;
    result.Sessions = sessions.size;
    if (sessions.size > 0) {
        // Two-sided Hoeffding 97.5% interval over independent session proportions.
        // A pair of intervals has >=95% simultaneous coverage (union bound).
        const radius = Math.sqrt(Math.log(80) / (2 * sessions.size));
        for (const [metric, low, high] of [["Success", "Low", "High"], ["Falls", "FallLow", "FallHigh"], ["Timeouts", "TimeoutLow", "TimeoutHigh"]] as const) {
            let mean = 0; for (const [, cluster] of sessions) mean += cluster[metric] / cluster.N / sessions.size;
            result[low] = Math.max(0, mean - radius); result[high] = Math.min(1, mean + radius);
        }
    }
    return result;
}
export function report(rows: ZPBotTrial[], query: ZPBotStatisticsFilter, session: string, dropped: number, blockSize: number): ZPBotStatisticsReport {
    const selected = rows.filter(row => matches(row, query)), grouped = new Map<string, ZPBotTrial[]>();
    const order = new Map<string, number>();
    let position = 0;
    for (const row of selected) {
        const key = conditions(row) + row.Code + ":" + row.Policy;
        const group = grouped.get(key) ?? []; group.push(row); grouped.set(key, group);
        order.set(key, position++);
    }
    const groups: ZPBotTrialSummary[] = [], comparisons: ZPBotStatisticsReport["Comparisons"] = [];
    const previous = new Map<string, { Rows: ZPBotTrial[]; Summary: ZPBotTrialSummary }>();
    const entries = [...grouped]; entries.sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
    for (const [key, group] of entries) {
        const summary = summarize(group, key); groups.push(summary);
        const condition = conditions(group[0]!);
        const baseline = previous.get(condition);
        if (baseline && summary.Mode === "evaluation" && summary.Kind === "navigation") comparisons.push({ Current: summary.Policy, Previous: baseline.Summary.Policy,
            Result: group[0]?.Code === "unavailable" || (group[0]?.Opponents !== "" && group[0]?.Reference === "uncontrolled") ? "inconclusive" : summary.Low > baseline.Summary.High && summary.Median <= baseline.Summary.Median && summary.P90 <= baseline.Summary.P90 &&
                summary.Falls / Math.max(1, summary.Eligible) <= baseline.Summary.Falls / Math.max(1, baseline.Summary.Eligible) ? "improvement" : summary.High < baseline.Summary.Low ? "regression" : "inconclusive",
            RewardWarning: summary.Reward / Math.max(1, summary.N) > baseline.Summary.Reward / Math.max(1, baseline.Summary.N) &&
                summary.Success / Math.max(1, summary.Eligible) <= baseline.Summary.Success / Math.max(1, baseline.Summary.Eligible) });
        previous.set(condition, { Rows: group, Summary: summary });
    }
    // Trend windows may contain different destinations/policies. They never drive inference.
    const trends = new Map<string, ZPBotTrial[]>();
    for (const row of selected) {
        const key = canonical([row.Bot, row.Kind, row.Mode, row.Map, row.Scenario, row.Difficulty, row.Cohort, row.Role, row.ClassID, row.Variant,
            row.Equipment, row.Physics, row.Navigation, row.Settings, row.Opponents, row.Code, row.Rewards]);
        const group = trends.get(key) ?? []; group.push(row); trends.set(key, group);
    }
    for (const [key, group] of trends) {
        const add = (entries: ZPBotTrial[], session: string, block: number, period = ""): void => {
            const summary = summarize(entries, key, session, block, period); summary.Descriptive = true; summary.Challenge = "";
            if (entries.some(row => row.Policy !== summary.Policy)) summary.Policy = "";
            groups.push(summary);
        };
        const sessions = new Map<string, ZPBotTrial[]>();
        for (const row of group) { const entries = sessions.get(row.Session) ?? []; entries.push(row); sessions.set(row.Session, entries); }
        for (const [id, entries] of sessions) {
            add(entries, id, 0);
            for (let offset = 0; offset < entries.length; offset += blockSize) add(entries.slice(offset, offset + blockSize), id, Math.floor(offset / blockSize) + 1);
        }
        for (const periodKey of ["Day", "Hour"] as const) {
            const periods = new Map<string, ZPBotTrial[]>();
            for (const row of group) { const entries = periods.get(row[periodKey]) ?? []; entries.push(row); periods.set(row[periodKey], entries); }
            for (const [period, entries] of periods) add(entries, "", 0, period);
        }
    }
    return { Version: 1, Session: session, Total: selected.length, Dropped: dropped, TimelineDropped: 0, Truncated: Math.max(0, groups.length - 120), Groups: groups.slice(-120), Timeline: [], History: selected.slice(-20), Comparisons: comparisons.slice(-20) };
}
export function parseReport(value: unknown): ZPBotStatisticsReport | undefined {
    const data = record(value);
    if (!data || data.Version !== 1 || !text(data.Session, 128) || !number(data.Total) || !number(data.Dropped) || !number(data.TimelineDropped) || !number(data.Truncated) ||
        !Array.isArray(data.Groups) || data.Groups.length > 120 || !Array.isArray(data.History) || data.History.length > 20 ||
        !Array.isArray(data.Timeline) || data.Timeline.length > 120 ||
        !Array.isArray(data.Comparisons) || data.Comparisons.length > 20) return;
    for (const value of data.History) if (!trial(value)) return;
    if (data.Bots !== undefined && (!Array.isArray(data.Bots) || data.Bots.length > 64 ||
        !data.Bots.every(id => number(id) && id >= 1 && id <= 64 && id % 1 === 0) || new Set(data.Bots).size !== data.Bots.length)) return;
    if (data.Minutes !== undefined && (!Array.isArray(data.Minutes) || data.Minutes.length > 120)) return;
    for (const value of [...data.Groups, ...data.Timeline, ...(Array.isArray(data.Minutes) ? data.Minutes : [])]) {
        const row = record(value); if (!row) return;
        for (const key of ["Key", "Session", "Period", "Kind", "Mode", "Policy", "Scenario", "Role", "Map", "Difficulty", "ClassID", "Cohort", "Code", "Challenge"]) if (!text(row[key], 2048)) return;
        if (typeof row.Descriptive !== "boolean") return;
        for (const key of ["Block", "N", "Eligible", "Success", "Falls", "Timeouts", "Interrupted", "Infrastructure", "Median", "P90", "Active", "Stuck", "Kills", "Deaths", "DealtPerMinute", "TakenPerMinute", "Wins", "Losses", "Reward", "Sessions", "Low", "High", "FallLow", "FallHigh", "TimeoutLow", "TimeoutHigh"])
            if (!number(row[key])) return;
        for (const key of ["Block", "N", "Eligible", "Success", "Falls", "Timeouts", "Interrupted", "Infrastructure", "Kills", "Deaths", "Wins", "Losses", "Sessions"])
            if ((row[key] as number) < 0 || (row[key] as number) % 1 !== 0) return;
        if ((row.Eligible as number) > (row.N as number) || (row.Success as number) > (row.Eligible as number)) return;
        for (const [low, high] of [["Low", "High"], ["FallLow", "FallHigh"], ["TimeoutLow", "TimeoutHigh"]])
            if ((row[low!] as number) < 0 || (row[high!] as number) > 1 || (row[low!] as number) > (row[high!] as number)) return;
    }
    for (const value of data.Comparisons) {
        const row = record(value);
        if (!row || !text(row.Current, 2048) || !text(row.Previous, 2048) || typeof row.RewardWarning !== "boolean" || !["improvement", "regression", "inconclusive"].includes(tostring(row.Result))) return;
    }
    return data as unknown as ZPBotStatisticsReport;
}
