export {};
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const kind = (value: unknown): value is ZPExtraMenuKind => value === "human" || value === "zombie";
const amount = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 2147483647 && value % 1 === 0;
const requestID = (value: unknown): value is number => amount(value) && value > 0;
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const availability = (value: unknown): value is ZPExtraMenuAvailability => value === "available" || value === "wrong_team" ||
    value === "not_alive" || value === "restricted" || value === "insufficient";

function snapshot(value: unknown): ZPExtraMenuSnapshot | undefined {
    const data = record(value), entries = record(data?.Entries);
    if (!data || !entries || Object.keys(entries).length > 128 || !amount(data.Balance) ||
        (!kind(data.Team) && data.Team !== "spectator") || typeof data.Alive !== "boolean" || typeof data.Truncated !== "boolean") return;
    const result: ZPExtraMenuEntry[] = [], seen: Record<string, boolean> = {};
    for (let index = 1; index <= Object.keys(entries).length; index++) {
        const entry = record(entries[index]);
        if (!entry || !identifier(entry.ID) || !identifier(entry.Name) || !kind(entry.Kind) || !amount(entry.Price) ||
            typeof entry.Order !== "number" || entry.Order !== entry.Order || Math.abs(entry.Order) === Infinity || !availability(entry.Availability)) return;
        const key = entry.Kind + ":" + entry.ID;
        if (seen[key]) return;
        seen[key] = true;
        result.push({ ID: entry.ID, Name: entry.Name, Kind: entry.Kind, Price: entry.Price, Order: entry.Order, Availability: entry.Availability });
    }
    return { Entries: result, Balance: data.Balance, Team: data.Team, Alive: data.Alive, Truncated: data.Truncated };
}
_G.ZPExtraMenuProtocol = {
    Kind: kind, Amount: amount, RequestID: requestID,
    Purchase(this: void, value) {
        const data = record(value);
        if (data?.Version === 1 && requestID(data.RequestID) && kind(data.Kind) && identifier(data.ID))
            return { Version: 1, RequestID: data.RequestID, Kind: data.Kind, ID: data.ID };
    },
    Reply(this: void, value) {
        const data = record(value);
        if (data?.Version !== 1 || !requestID(data.RequestID)) return;
        const code = data.Code;
        if (code === "rate_limited") return { Version: 1, RequestID: data.RequestID, Code: code };
        if (code !== "catalog" && code !== "bought" && code !== "invalid_item" && code !== "restricted" && code !== "insufficient") return;
        const state = snapshot(data.Snapshot);
        if (state) return { Version: 1, RequestID: data.RequestID, Code: code, Snapshot: state };
    },
};
