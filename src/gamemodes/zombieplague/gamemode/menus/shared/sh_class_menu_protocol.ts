export {};
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const kind = (value: unknown): value is ZPClassMenuKind => value === "human" || value === "zombie";
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const finite = (value: unknown): value is number => typeof value === "number" && value === value && Math.abs(value) !== Infinity;
const requestID = (value: unknown): value is number => finite(value) && value >= 1 && value <= 2147483647 && value % 1 === 0;

function snapshot(value: unknown): ZPClassMenuSnapshot | undefined {
    const data = record(value), selected = record(data?.Selected), first = record(data?.First), entries = record(data?.Entries);
    if (!data || !selected || !first || !entries || Object.keys(entries).length > 64)
        return;
    if (typeof selected.human !== "string" || selected.human.length > 128 || typeof selected.zombie !== "string" ||
        selected.zombie.length > 128 || typeof first.human !== "boolean" || typeof first.zombie !== "boolean")
        return;
    const result: ZPClassMenuEntry[] = [], seen: Record<string, boolean> = {};
    for (let index = 1; index <= Object.keys(entries).length; index++) {
        const entry = record(entries[index]);
        if (!entry || !identifier(entry.ID) || !kind(entry.Kind) || !identifier(entry.Name) || !identifier(entry.Description) ||
            !finite(entry.Order) || !finite(entry.Health) || entry.Health <= 0 || !finite(entry.Armor) || entry.Armor < 0 ||
            !finite(entry.Speed) || entry.Speed < 0 || !finite(entry.RunSpeed) || entry.RunSpeed < 0 ||
            !finite(entry.Gravity) || entry.Gravity < 0 || !finite(entry.Jump) || entry.Jump < 0 ||
            !finite(entry.Damage) || entry.Damage < 0 || !finite(entry.Ability) || entry.Ability < 0 ||
            !finite(entry.CrouchSpeed) || entry.CrouchSpeed < 0 || !finite(entry.Battery) || entry.Battery < 0 ||
            !finite(entry.Breath) || entry.Breath < 0 || !finite(entry.Scale) || entry.Scale <= 0 ||
            typeof entry.Footstep !== "boolean" || typeof entry.FallDamage !== "boolean" ||
            !finite(entry.AbilityCost) || entry.AbilityCost < 0 || typeof entry.AbilityOnActivation !== "boolean")
            return;
        const key = entry.Kind + ":" + entry.ID;
        if (seen[key]) return;
        seen[key] = true;
        result.push({ ID: entry.ID, Kind: entry.Kind, Name: entry.Name, Description: entry.Description, Order: entry.Order,
            Health: entry.Health, Armor: entry.Armor, Speed: entry.Speed, RunSpeed: entry.RunSpeed, Gravity: entry.Gravity,
            Jump: entry.Jump, Damage: entry.Damage, Ability: entry.Ability, CrouchSpeed: entry.CrouchSpeed,
            Battery: entry.Battery, Breath: entry.Breath, Scale: entry.Scale, Footstep: entry.Footstep,
            FallDamage: entry.FallDamage, AbilityCost: entry.AbilityCost, AbilityOnActivation: entry.AbilityOnActivation });
    }
    return { Entries: result, Selected: { human: selected.human, zombie: selected.zombie }, First: { human: first.human, zombie: first.zombie } };
}

_G.ZPClassMenuProtocol = {
    Kind: kind,
    RequestID: requestID,
    Selection(this: void, value) {
        const data = record(value);
        if (data?.Version === 1 && requestID(data.RequestID) && kind(data.Kind) && identifier(data.ID))
            return { Version: 1, RequestID: data.RequestID, Kind: data.Kind, ID: data.ID };
    },
    Reply(this: void, value) {
        const data = record(value);
        if (data?.Version !== 1 || !requestID(data.RequestID)) return;
        const code = data.Code;
        if (code !== "catalog" && code !== "applied" && code !== "saved" && code !== "invalid" && code !== "rate_limited") return;
        if (code === "invalid" || code === "rate_limited")
            return { Version: 1, RequestID: data.RequestID, Code: code };
        const state = snapshot(data.Snapshot);
        if (state) return { Version: 1, RequestID: data.RequestID, Code: code, Snapshot: state };
    },
};
