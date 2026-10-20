export {};
const maxLayers = 64;

function record(this: void, value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}
function finite(this: void, value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function material(this: void, value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 192 &&
        !value.includes("..") && !value.startsWith("/") && value.split("").every(character =>
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_/.-".includes(character));
}
function overview(this: void, value: unknown): ZPRadarOverview | undefined {
    const data = record(value);
    if (!data || !material(data.Material) ||
        !finite(data.X, -1000000, 1000000) || !finite(data.Y, -1000000, 1000000) ||
        !finite(data.Scale, 0.01, 10000) || !finite(data.Size, 64, 4096) || data.Size % 1 !== 0) return;
    const base = { Material: data.Material, X: data.X, Y: data.Y, Scale: data.Scale, Size: data.Size };
    if (data.Layers === undefined) return base;
    const list = record(data.Layers), layers: ZPRadarLayer[] = [];
    if (!list) return;
    for (const [, raw] of pairs(list)) {
        const layer = record(raw);
        if (layers.length >= maxLayers || !layer || !material(layer.Material) ||
            !finite(layer.MinZ, -1000000, 1000000) || !finite(layer.MaxZ, -1000000, 1000000) ||
            layer.MinZ >= layer.MaxZ) return;
        layers.push({ Material: layer.Material, MinZ: layer.MinZ, MaxZ: layer.MaxZ });
    }
    layers.sort((a, b) => a.MinZ - b.MinZ);
    for (let index = 1; index < layers.length; index++) {
        const previous = layers[index - 1], current = layers[index];
        if (previous && current && previous.MaxZ > current.MinZ) return;
    }
    return layers.length > 0 ? { ...base, Layers: layers } : base;
}
function snapshot(this: void, value: unknown, now: number): ZPRadarSnapshot | undefined {
    const data = record(value);
    if (!data || data.Version !== 1 || (data.Team !== TEAM_HUMANS && data.Team !== TEAM_ZOMBIES && data.Team !== TEAM_SPECTATOR) ||
        typeof data.Enabled !== "boolean" || !finite(data.ScanUntil, 0, now + 601)) return;
    const list = record(data.Contacts);
    if (!list) return;
    const contacts: ZPRadarContact[] = [], seen: Record<number, boolean> = {};
    for (const [, raw] of pairs(list)) {
        if (contacts.length >= 128) return;
        const entry = record(raw), position = record(entry?.Position);
        if (!entry || !position || !finite(entry.ID, 1, 65535) || entry.ID % 1 !== 0 || seen[entry.ID] ||
            (entry.Source !== "attack" && entry.Source !== "scan" && entry.Source !== "ally") || !finite(entry.Created, 0, now + 2) ||
            !finite(entry.Expires, entry.Created, now + 61) ||
            !finite(position.x, -1000000, 1000000) || !finite(position.y, -1000000, 1000000) ||
            !finite(position.z, -1000000, 1000000)) return;
        seen[entry.ID] = true;
        contacts.push({ ID: entry.ID, Position: { x: position.x, y: position.y, z: position.z },
            Source: entry.Source, Created: entry.Created, Expires: entry.Expires });
    }
    return { Version: 1, Team: data.Team, Enabled: data.Enabled, ScanUntil: data.ScanUntil, Contacts: contacts };
}

_G.ZPRadarRules = {
    MaxLayers: maxLayers,
    Record: record, Finite: finite, Overview: overview, Snapshot: snapshot,
    Lifetime: (distance, range, minimum, maximum) => {
        if (range <= 0 || distance > range || distance < 0) return;
        const low = Math.min(minimum, maximum), high = Math.max(minimum, maximum);
        return high + (low - high) * distance / range;
    },
    Point: (map, position) => ({ x: (position.x - map.X) / (map.Scale * map.Size),
        y: (map.Y - position.y) / (map.Scale * map.Size) }),
    Layer: (map, height, previous) => {
        if (!finite(height, -1000000, 1000000) || !map.Layers) return;
        const current = previous === undefined ? undefined : map.Layers[previous];
        // A small dead band prevents floor changes from flickering at a staircase boundary.
        if (current && height >= current.MinZ - 16 && height < current.MaxZ + 16) return previous;
        const index = map.Layers.findIndex(layer => height >= layer.MinZ && height < layer.MaxZ);
        return index < 0 ? undefined : index;
    },
    Elevation: (layer, height, viewerHeight) => {
        if (layer) return height < layer.MinZ - 16 ? -1 : height >= layer.MaxZ + 16 ? 1 : 0;
        // Single-image overviews still convey height, without treating small steps as another floor.
        if (viewerHeight === undefined) return 0;
        return height < viewerHeight - 64 ? -1 : height > viewerHeight + 64 ? 1 : 0;
    },
};
