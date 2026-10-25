export {};
const actions: readonly ZPBotMove[] = ["forward", "back", "left", "right", "diagonalleft", "diagonalright", "jump", "jumpleft", "jumpright", "duck", "duckleft", "duckright", "sprint", "swim", "climb", "jumpduck"];
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const number = (value: unknown, min = 0, max = 1e12): value is number => typeof value === "number" && value === value && value >= min && value <= max;
const integer = (value: unknown, max = 1e9): value is number => number(value, 0, max) && value % 1 === 0;
function empty(): ZPBotMoveMemory {
    return { Estimates: {}, Passages: {}, Totals: { Attempts: 0, Successes: 0, Failures: 0, Goals: 0, Recoveries: 0, WaterEscapes: 0, Ladders: 0,
        Distance: 0, Progress: 0, Seconds: 0, StuckSeconds: 0, BreathSpent: 0, Harm: 0 } };
}
function memory(value: unknown): ZPBotMoveMemory | undefined {
    const data = record(value), estimates = record(data?.Estimates), passages = record(data?.Passages), totals = record(data?.Totals), result = empty();
    if (!estimates || !passages || !totals || Object.keys(estimates).length > 256 || Object.keys(passages).length > 128) return;
    if (data?.Places !== undefined) {
        const places = ZPBotPlaceProtocol.Memory(data.Places); if (!places) return; result.Places = places;
    }
    for (const key of ["Attempts", "Successes", "Failures", "Goals", "Recoveries", "WaterEscapes", "Ladders", "Distance", "Progress", "Seconds", "StuckSeconds", "BreathSpent", "Harm"] as const) {
        const amount = totals[key]; if (!number(amount)) return; result.Totals[key] = amount;
    }
    for (const [key, value] of pairs(estimates)) {
        const entry = record(value);
        if (key.length < 1 || key.length > 160 || !entry || !number(entry.Value, -1, 1) || !integer(entry.Samples, 10000) || entry.Samples < 1) return;
        result.Estimates[key] = { Value: entry.Value, Samples: entry.Samples };
    }
    for (const [key, value] of pairs(passages)) {
        const entry = record(value);
        if (key.length < 1 || key.length > 128 || !entry || !integer(entry.Attempts) || !integer(entry.Successes) || !integer(entry.Failures) ||
            entry.Successes + entry.Failures !== entry.Attempts || !number(entry.Seconds)) return;
        result.Passages[key] = { Attempts: entry.Attempts, Successes: entry.Successes, Failures: entry.Failures, Seconds: entry.Seconds };
    }
    return result;
}
function navigation(value: unknown): ZPBotNavigationDiagnostic | undefined {
    const data = record(value), path = record(data?.Path);
    if (!data || !path || !["ready", "missing", "connection", "height", "fall", "landing", "obstacle", "stalled", "budget", "ground", "occupied"].some(reason => reason === data.Reason) ||
        !["route", "align", "cross", "land"].some(phase => phase === data.Phase) || !integer(data.From) || !integer(data.To) ||
        !number(data.Height, -1e7, 1e7) || !number(data.Damage) || Object.keys(path).length > 12 || Object.keys(path).length % 3 !== 0) return;
    const result: ZPBotNavigationDiagnostic = { Reason: data.Reason as ZPBotNavReason, Phase: data.Phase as ZPBotNavPhase,
        From: data.From, To: data.To, Height: data.Height, Damage: data.Damage, Path: [] };
    for (let index = 1; index <= Object.keys(path).length; index++) {
        const point = path[index]; if (!number(point, -1e7, 1e7)) return; result.Path.push(point);
    }
    return result;
}
function diagnostic(value: unknown): ZPBotMoveDiagnostic | undefined {
    const data = record(value), path = record(data?.Path), values = record(data?.Values), passage = record(data?.Passage);
    if (!data || !path || !values || !passage || Object.keys(passage).length !== 3 || !actions.some(action => action === data.Action) || !["ground", "air", "water", "ladder"].some(mode => mode === data.Mode) ||
        !integer(data.From) || !integer(data.To) || !integer(data.Samples) || !number(data.Reward, -2, 2) || !number(data.Progress, -1e12) ||
        !integer(data.Keys, 2147483647) || !number(data.Look, -89, 89) || Object.keys(path).length > 15 || Object.keys(path).length % 3 !== 0 ||
        (Object.keys(values).length !== actions.length && Object.keys(values).length !== actions.length - 1)) return;
    const output: ZPBotMoveDiagnostic = { Action: data.Action as ZPBotMove, Mode: data.Mode as ZPBotMoveMode, From: data.From, To: data.To,
        Samples: data.Samples, Reward: data.Reward, Progress: data.Progress, Keys: data.Keys, Look: data.Look, Path: [], Values: [], Passage: [],
        Attempts: 0, Successes: 0, Failures: 0, Seconds: 0, Stuck: 0, Breath: 0, Goals: 0, Recoveries: 0, Water: 0, Ladders: 0, Harm: 0 };
    for (const key of ["Attempts", "Successes", "Failures", "Seconds", "Stuck", "Breath", "Goals", "Recoveries", "Water", "Ladders", "Harm"] as const) {
        const amount = data[key]; if (!number(amount)) return; output[key] = amount;
    }
    for (let i = 1; i <= Object.keys(path).length; i++) { const item = path[i]; if (!number(item, -1e7, 1e7)) return; output.Path.push(item); }
    // jumpduck was appended; preserve the positions of existing diagnostic values.
    for (let i = 1; i <= actions.length; i++) {
        const item = i === actions.length && Object.keys(values).length === actions.length - 1 ? 0 : values[i];
        if (!number(item, -2, 2)) return; output.Values.push(item);
    }
    for (let i = 1; i <= 3; i++) { const item = passage[i]; if (!number(item)) return; output.Passage.push(item); }
    if ((output.Passage[1] ?? 0) > (output.Passage[0] ?? 0)) return;
    if (data.Navigation !== undefined) {
        const detail = navigation(data.Navigation);
        if (!detail || (detail.Path.length > 0 && output.Path.length > 0)) return;
        output.Navigation = detail;
    }
    return output;
}
_G.ZPBotMotionProtocol = { Empty: empty, Memory: memory, Diagnostic: diagnostic, Navigation: navigation, Actions: actions };
