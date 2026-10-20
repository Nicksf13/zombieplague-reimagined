// Source BSP structures: https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/public/bspfile.h
interface Lump { start: number; length: number; version: number; }
interface Plane { x: number; y: number; z: number; distance: number; }
interface Node { plane: number; front: number; back: number; }
interface Leaf { area: number; solid: boolean; }
interface SkyboxFilter { Contains(this: void, position: ZPRadarPosition): boolean; }

function lump(this: void, map: GLuaMapFile, index: number): Lump | undefined {
    map.Seek(8 + index * 16);
    const start = map.ReadLong(), length = map.ReadLong(), version = map.ReadLong(), compressed = map.ReadLong();
    if (compressed !== 0 || start < 1036 || length <= 0 || length > 8 * 1024 * 1024 || start > map.Size() - length) return;
    return { start, length, version };
}

function origins(this: void, text: string): { sky: ZPRadarPosition[]; players: ZPRadarPosition[] } {
    const result: { sky: ZPRadarPosition[]; players: ZPRadarPosition[] } = { sky: [], players: [] };
    for (const block of string.gmatch(text, "%b{}")) {
        const fields: Record<string, string> = {};
        for (const [key, value] of string.gmatch(block, '"([^"]+)"%s*"([^"]*)"')) fields[key.toLowerCase()] = value;
        const classname = fields.classname?.toLowerCase();
        if (!classname || (classname !== "sky_camera" && !classname.startsWith("info_player_")) || !fields.origin) continue;
        const values: number[] = [];
        for (const part of string.gmatch(fields.origin, "%S+")) values.push(Number(part));
        if (values.length === 3 && values.every(value => ZPRadarRules.Finite(value, -32768, 32768)))
            (classname === "sky_camera" ? result.sky : result.players).push({ x: values[0]!, y: values[1]!, z: values[2]! });
    }
    return result;
}

function read(this: void, map: GLuaMapFile): SkyboxFilter | undefined {
    if (map.Size() < 1036 || map.Read(4) !== "VBSP") return;
    const version = map.ReadLong();
    if (version < 19 || version > 21) return;
    const entities = lump(map, 0), planeLump = lump(map, 1), nodesLump = lump(map, 5), leafLump = lump(map, 10), models = lump(map, 14);
    if (!entities || !planeLump || !nodesLump || !leafLump || !models || entities.version !== 0 ||
        planeLump.version !== 0 || nodesLump.version !== 0 || models.version !== 0 || models.length < 48 ||
        planeLump.length % 20 !== 0 || nodesLump.length % 32 !== 0 || (leafLump.version !== 0 && leafLump.version !== 1)) return;
    const leafSize = leafLump.version === 0 ? 56 : 32;
    if (leafLump.length % leafSize !== 0 || planeLump.length / 20 > 65536 || nodesLump.length / 32 > 65536 ||
        leafLump.length / leafSize > 65536) return;
    map.Seek(entities.start);
    const positions = origins(map.Read(entities.length));
    if (positions.sky.length === 0) return { Contains: () => false };
    const planes: Plane[] = [], nodes: Node[] = [], leaves: Leaf[] = [];
    for (let index = 0; index < planeLump.length / 20; index++) {
        map.Seek(planeLump.start + index * 20);
        const plane = { x: map.ReadFloat(), y: map.ReadFloat(), z: map.ReadFloat(), distance: map.ReadFloat() };
        if (![plane.x, plane.y, plane.z, plane.distance].every(value => Number.isFinite(value))) return;
        planes.push(plane);
    }
    for (let index = 0; index < nodesLump.length / 32; index++) {
        map.Seek(nodesLump.start + index * 32);
        const node = { plane: map.ReadLong(), front: map.ReadLong(), back: map.ReadLong() };
        if (node.plane < 0 || node.plane >= planes.length) return;
        nodes.push(node);
    }
    for (let index = 0; index < leafLump.length / leafSize; index++) {
        map.Seek(leafLump.start + index * leafSize);
        const contents = map.ReadLong(), packed = map.ReadLong();
        const unsigned = packed < 0 ? packed + 4294967296 : packed;
        leaves.push({ solid: contents % 2 !== 0, area: Math.floor(unsigned / 65536) % 512 });
    }
    map.Seek(models.start + 36);
    const root = map.ReadLong();
    const areaAt = (position: ZPRadarPosition): number | undefined => {
        let cursor = root, steps = 0;
        while (cursor >= 0) {
            const node = nodes[cursor];
            if (!node || steps++ >= nodes.length) return;
            const plane = planes[node.plane]!;
            cursor = position.x * plane.x + position.y * plane.y + position.z * plane.z >= plane.distance ? node.front : node.back;
        }
        const leaf = leaves[-cursor - 1];
        return leaf && !leaf.solid && leaf.area > 0 ? leaf.area : undefined;
    };
    const skyAreas: Record<number, boolean> = {};
    const playerAreas: Record<number, boolean> = {};
    for (const origin of positions.players) {
        const area = areaAt(origin);
        if (area !== undefined) playerAreas[area] = true;
    }
    for (const origin of positions.sky) {
        const area = areaAt(origin);
        // A malformed/unsealed map can share an area with a spawn. Never erase
        // known playable rooms just because a sky camera was placed there.
        if (area !== undefined && !playerAreas[area]) skyAreas[area] = true;
    }
    return { Contains: position => {
        const area = areaAt(position);
        return area !== undefined && skyAreas[area] === true;
    } };
}

export function readSkybox(this: void): SkyboxFilter | undefined {
    const map = file.Open(`maps/${game.GetMap()}.bsp`, "rb", "GAME");
    if (!map) return;
    try { return read(map); } finally { map.Close(); }
}
