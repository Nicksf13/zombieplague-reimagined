export function loadOverview(this: void): ZPRadarOverview | undefined {
    const map = game.GetMap();
    if (map.length > 128 || map.includes("..") || !map.split("").every(character =>
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".includes(character))) return;
    // Local server overrides take precedence over shipped configurations and native overviews.
    for (const [path, realm] of [["zombieplague/radar/" + map + ".json", "DATA"],
        ["resource/zombieplague/radar/" + map + ".json", "GAME"]] as const) {
        const text = realm === "DATA" ? file.Read(path, "DATA") : file.Read(path, "GAME");
        if (text === undefined) continue;
        return text.length <= 16384 ? available(ZPRadarRules.Overview(util.JSONToTable(text))) : undefined;
    }
    for (const path of ["scripts/overviews/" + map + ".txt", "resource/overviews/" + map + ".txt"]) {
        const text = file.Read(path, "GAME");
        if (!text || text.length > 16384) continue;
        const root = ZPRadarRules.Record(util.KeyValuesToTable(text));
        const data = ZPRadarRules.Record(root?.[map]) ?? root;
        if (!data) continue;
        const material = typeof data.material === "string" ? data.material : "overviews/" + map;
        const result = available(ZPRadarRules.Overview({ Material: material,
            X: Number(data.pos_x), Y: Number(data.pos_y), Scale: Number(data.scale), Size: 1024 }));
        if (result) return result;
    }
}

function available(this: void, overview: ZPRadarOverview | undefined): ZPRadarOverview | undefined {
    if (!overview) return;
    const materials = [overview.Material, ...(overview.Layers ?? []).map(layer => layer.Material)];
    const paths: string[] = [];
    // Check the whole stack before advertising or distributing any of its images.
    for (const material of materials) {
        const image = material.endsWith(".png") || material.endsWith(".jpg");
        const path = "materials/" + material + (image ? "" : ".vmt");
        if (!file.Exists(path, "GAME")) return;
        if (!paths.includes(path)) paths.push(path);
    }
    for (const path of paths) resource.AddFile(path);
    return overview;
}
