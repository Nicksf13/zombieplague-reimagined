export {};
const rules = include("sh_bot_boost_rules.lua") as typeof import("./sh_bot_boost_rules");
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const finite = (value: unknown, min = 0, max = 1e9): value is number => typeof value === "number" && value === value && value >= min && value <= max;
const integer = (value: unknown, min = 0, max = 65535): value is number => finite(value, min, max) && value % 1 === 0;
function position(value: unknown, draft: boolean): number[] | undefined {
    const data = record(value); if (!data) return;
    const count = Object.keys(data).length;
    if (count !== 3 && !(draft && count === 0)) return;
    const result: number[] = [];
    for (let index = 1; index <= count; index++) { const coordinate = data[index]; if (!finite(coordinate, -32768, 32768)) return; result.push(coordinate); }
    return result;
}
function point(value: unknown, draft = false): ZPBotBoostPoint | undefined {
    const data = record(value); if (!data || !integer(data.ID, draft ? 0 : 1)) return;
    const base = position(data.Base, draft), approach = position(data.Approach, draft), exit = position(data.Exit, draft);
    if (!base || !approach || !exit) return;
    return { ID: data.ID, Base: base, Approach: approach, Exit: exit };
}
function snapshot(value: unknown): ZPBotBoostSnapshot | undefined {
    const data = record(value), points = record(data?.Points), sessions = record(data?.Sessions), results = record(data?.Results), draft = point(data?.Draft, true);
    if (!data || data.Version !== 1 || !integer(data.RequestID, 1, 2147483647) || !integer(data.Revision, 1, 2147483647) || !points || !sessions || !results || !draft ||
        Object.keys(points).length > 32 || Object.keys(sessions).length > 4 || Object.keys(results).length > 32 ||
        !["ready", "saved", "invalid", "error", "missing", "busy", "testing", "success", "failed"].some(code => code === data.Feedback)) return;
    const output: ZPBotBoostSnapshot = { Version: 1, RequestID: data.RequestID, Revision: data.Revision, Points: [], Draft: draft,
        Feedback: data.Feedback as ZPBotBoostFeedback, Sessions: [], Results: [] };
    if (data.Issue !== undefined) {
        const entry = record(data.Issue);
        if (!entry || !rules.codes.some(code => code === entry.Code) || !integer(entry.Slot, 0, 4) || entry.Slot === 1 ||
            !finite(entry.Actual, -1e9) || !finite(entry.Min, -1e9) || !finite(entry.Max, -1e9) || entry.Min > entry.Max) return;
        output.Issue = { Code: entry.Code as ZPBotBoostIssueCode, Slot: entry.Slot, Actual: entry.Actual, Min: entry.Min, Max: entry.Max };
    }
    if (data.Dirty !== undefined) { if (typeof data.Dirty !== "boolean") return; output.Dirty = data.Dirty; }
    if (data.Editing !== undefined) { if (typeof data.Editing !== "boolean") return; output.Editing = data.Editing; }
    if (data.Selected !== undefined) { if (!integer(data.Selected)) return; output.Selected = data.Selected; }
    for (let index = 1; index <= Object.keys(points).length; index++) {
        const entry = point(points[index]); if (!entry || output.Points.some(other => other.ID === entry.ID)) return; output.Points.push(entry);
    }
    for (let index = 1; index <= Object.keys(sessions).length; index++) {
        const entry = record(sessions[index]);
        if (!entry || !integer(entry.Point, 1) || !integer(entry.Support, 1, 8191) || !integer(entry.Climber, 1, 8191) || entry.Support === entry.Climber ||
            !output.Points.some(item => item.ID === entry.Point) || !["assemble", "mount", "jump", "land"].some(phase => phase === entry.Phase)) return;
        output.Sessions.push({ Point: entry.Point, Support: entry.Support, Climber: entry.Climber, Phase: entry.Phase as ZPBotBoostPhase });
    }
    for (let index = 1; index <= Object.keys(results).length; index++) {
        const entry = record(results[index]);
        if (!entry || !integer(entry.Point, 1) || !integer(entry.Successes, 0, 1e9) || !integer(entry.Failures, 0, 1e9) ||
            !output.Points.some(item => item.ID === entry.Point) || output.Results.some(other => other.Point === entry.Point)) return;
        output.Results.push({ Point: entry.Point, Successes: entry.Successes, Failures: entry.Failures });
    }
    if (output.Selected !== undefined && output.Selected !== 0 && !output.Points.some(point => point.ID === output.Selected)) return;
    return output;
}
_G.ZPBotBoostProtocol = { Point: point, Snapshot: snapshot };
