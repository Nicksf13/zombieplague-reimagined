export {};
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const number = (value: unknown, min = 0, max = 1e12): value is number => typeof value === "number" && value === value && value >= min && value <= max;
const counters = ["Visits", "Finds", "Escapes", "Deaths", "Empty", "Damage", "Seconds"] as const;
function totals(value: unknown): ZPBotPlaceTotals | undefined {
    const data = record(value), output: ZPBotPlaceTotals = { Visits: 0, Finds: 0, Escapes: 0, Deaths: 0, Empty: 0, Damage: 0, Seconds: 0 };
    if (!data) return;
    for (const key of counters) {
        const item = data[key]; if (!number(item) || (key !== "Damage" && key !== "Seconds" && item % 1 !== 0)) return;
        output[key] = item;
    }
    if ([output.Finds, output.Escapes, output.Deaths, output.Empty].some(amount => amount > output.Visits)) return;
    return output;
}
function memory(value: unknown): ZPBotPlaceMemory | undefined {
    const data = record(value), records = record(data?.Records), metrics = totals(data?.Totals);
    if (!records || !metrics || Object.keys(records).length > 64) return;
    const output: ZPBotPlaceMemory = { Records: {}, Totals: metrics };
    for (const [key, item] of pairs(records)) {
        const entry = record(item), metrics = totals(entry);
        if (typeof key !== "string" || key.length < 1 || key.length > 80 || !metrics || !entry || !number(entry.Value, -1, 1) || !number(entry.Samples, 0, 10000) || entry.Samples % 1 !== 0 ||
            (entry.Samples === 0 && entry.Value !== 0)) return;
        output.Records[key] = { ...metrics, Value: entry.Value, Samples: entry.Samples };
    }
    return output;
}
function diagnostic(value: unknown): ZPBotPlaceDiagnostic | undefined {
    const data = record(value), metrics = totals(data), point = record(data?.Point);
    if (!data || !metrics || !point || !["patrol", "shelter", "guard", "hunt", "inspect"].some(state => state === data.State) ||
        !["profile", "learned", "clue"].some(reason => reason === data.Reason) || !number(data.Value, -1, 1) || !number(data.Hold, 0, 60) ||
        (Object.keys(point).length !== 0 && Object.keys(point).length !== 3)) return;
    const position: number[] = [];
    for (let i = 1; i <= Object.keys(point).length; i++) { const coordinate = point[i]; if (!number(coordinate, -1e7, 1e7)) return; position.push(coordinate); }
    return { ...metrics, State: data.State as ZPBotPlaceState, Reason: data.Reason as ZPBotPlaceReason, Point: position, Value: data.Value, Hold: data.Hold };
}
_G.ZPBotPlaceProtocol = { Empty: () => ({ Records: {}, Totals: { Visits: 0, Finds: 0, Escapes: 0, Deaths: 0, Empty: 0, Damage: 0, Seconds: 0 } }), Memory: memory, Diagnostic: diagnostic };
