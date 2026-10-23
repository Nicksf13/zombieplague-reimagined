export {};

function snapshot(this: void, value: unknown): ZPSpectatorSnapshot | undefined {
    const record = ZPRadarRules.Record, finite = ZPRadarRules.Finite, data = record(value);
    if (!data || data.Version !== 1 || typeof data.Active !== "boolean" || typeof data.Restricted !== "boolean" ||
        (data.Team !== TEAM_HUMANS && data.Team !== TEAM_ZOMBIES && data.Team !== TEAM_SPECTATOR)) return;
    const list = record(data.Contacts), contacts: ZPSpectatorContact[] = [], seen: Record<number, boolean> = {};
    if (!list || (data.Team === TEAM_SPECTATOR && data.Restricted)) return;
    for (const [, raw] of pairs(list)) {
        const entry = record(raw), position = record(entry?.Position);
        if (contacts.length >= 128 || !entry || !position || !finite(entry.ID, 1, 65535) || entry.ID % 1 !== 0 || seen[entry.ID] ||
            typeof entry.Name !== "string" || entry.Name.length > 128 || !finite(entry.Yaw, -360, 360) ||
            (entry.Team !== TEAM_HUMANS && entry.Team !== TEAM_ZOMBIES) ||
            (data.Restricted && entry.Team !== data.Team) ||
            (entry.Role !== undefined && entry.Role !== "nemesis" && entry.Role !== "survivor") ||
            !finite(position.x, -1000000, 1000000) || !finite(position.y, -1000000, 1000000) ||
            !finite(position.z, -1000000, 1000000)) return;
        seen[entry.ID] = true;
        contacts.push({ ID: entry.ID, Name: entry.Name, Team: entry.Team, Yaw: entry.Yaw,
            Position: { x: position.x, y: position.y, z: position.z },
            ...(entry.Role === undefined ? {} : { Role: entry.Role }) });
    }
    if (!data.Active && contacts.length > 0) return;
    return { Version: 1, Team: data.Team, Restricted: data.Restricted, Active: data.Active, Contacts: contacts };
}
_G.ZPSpectatorProtocol = { Snapshot: snapshot };
