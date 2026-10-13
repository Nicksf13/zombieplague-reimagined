export {};
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const category = (value: unknown): value is ZPWeaponMenuCategory =>
    value === "primary" || value === "secondary" || value === "melee";
const family = (value: unknown): value is ZPWeaponFamily => value === "smg" || value === "machinegun" ||
    value === "rifle" || value === "sniper" || value === "shotgun" || value === "pistol" || value === "revolver" || value === "melee" || value === "other";
const requestID = (value: unknown): value is number =>
    typeof value === "number" && value >= 1 && value <= 2147483647 && value % 1 === 0;
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;

function snapshot(value: unknown): ZPWeaponMenuSnapshot | undefined {
    const data = record(value), selected = record(data?.Selected), canReceive = record(data?.CanReceive);
    const entries = record(data?.Entries);
    if (!data || !selected || !canReceive || !entries || typeof data.Truncated !== "boolean")
        return;
    if (data.Remember !== undefined && typeof data.Remember !== "boolean")
        return;
    for (const kind of ["primary", "secondary", "melee"] as const)
        if (typeof selected[kind] !== "string" || selected[kind].length > 128 || typeof canReceive[kind] !== "boolean")
            return;
    const count = Object.keys(entries).length;
    if (count > 256)
        return;
    const result: ZPWeaponMenuEntry[] = [];
    const seen: Record<string, boolean> = {};
    for (let index = 1; index <= count; index++) {
        const entry = record(entries[index]);
        if (!entry || !identifier(entry.ID) || !identifier(entry.Name) || !category(entry.Kind) ||
            typeof entry.Order !== "number" || entry.Order !== entry.Order || Math.abs(entry.Order) === Infinity)
            return;
        const key = entry.Kind + ":" + entry.ID;
        if ((entry.NamePhrase !== undefined && !identifier(entry.NamePhrase)) ||
            (entry.Description !== undefined && !identifier(entry.Description)))
            return;
        if (entry.Family !== undefined && !family(entry.Family))
            return;
        if (seen[key])
            return;
        seen[key] = true;
        result.push({ ID: entry.ID, Name: entry.Name, Kind: entry.Kind, Order: entry.Order,
            ...(identifier(entry.NamePhrase) ? { NamePhrase: entry.NamePhrase } : {}),
            ...(identifier(entry.Description) ? { Description: entry.Description } : {}),
            Family: family(entry.Family) ? entry.Family : entry.Kind === "secondary" ? "pistol" : entry.Kind === "melee" ? "melee" : "other" });
    }
    return {
        Entries: result,
        Selected: { primary: selected.primary as string, secondary: selected.secondary as string, melee: selected.melee as string },
        CanReceive: { primary: canReceive.primary as boolean, secondary: canReceive.secondary as boolean, melee: canReceive.melee as boolean },
        Truncated: data.Truncated,
        Remember: data.Remember ?? true,
    };
}

_G.ZPWeaponMenuProtocol = {
    Category: category,
    Family: family,
    RequestID: requestID,
    Selection(this: void, value) {
        const data = record(value);
        if (data?.Version !== 1 || !requestID(data.RequestID) || !category(data.Kind) || !identifier(data.ID))
            return;
        return { Version: 1, RequestID: data.RequestID, Kind: data.Kind, ID: data.ID };
    },
    Reply(this: void, value) {
        const data = record(value);
        if (data?.Version !== 1 || !requestID(data.RequestID))
            return;
        const code = data.Code;
        if (code !== "catalog" && code !== "saved" && code !== "issued" && code !== "preferences" && code !== "invalid_weapon" && code !== "rate_limited")
            return;
        const state = snapshot(data.Snapshot);
        if (code === "catalog" || code === "saved" || code === "issued" || code === "preferences") {
            if (!state)
                return;
            return { Version: 1, RequestID: data.RequestID, Code: code, Snapshot: state };
        }
        return { Version: 1, RequestID: data.RequestID, Code: code };
    },
};
