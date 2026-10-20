const { selectFloors } = include("cl_radar_capture_floors.lua") as typeof import("./cl_radar_capture_floors");

export function options(this: void, raw: unknown): ZPRadarCaptureOptions | undefined {
    const data = ZPRadarRules.Record(raw);
    if (!data) return;
    const result: ZPRadarCaptureOptions = {};
    for (const key of ["Heights", "Cuts"] as const) {
        if (data[key] === undefined) continue;
        const list = ZPRadarRules.Record(data[key]);
        if (!list) return;
        const entries: Record<number, number> = {};
        let count = 0;
        for (const [index, value] of pairs(list)) {
            const key: unknown = index;
            if (!ZPRadarRules.Finite(key, 1, ZPRadarRules.MaxLayers) || key % 1 !== 0 || count++ >= ZPRadarRules.MaxLayers ||
                !ZPRadarRules.Finite(value, -32700, 32700)) return;
            entries[key] = value;
        }
        const values: number[] = [];
        for (let index = 1; index <= count; index++) {
            const value = entries[index];
            if (value === undefined || (values.length > 0 && value <= values[values.length - 1]!)) return;
            values.push(value);
        }
        if (values.length === 0) return;
        result[key] = values;
    }
    if (result.Cuts && (!result.Heights || result.Cuts.length !== result.Heights.length)) return;
    if (data.HeightRange !== undefined) {
        const range = ZPRadarRules.Record(data.HeightRange);
        if (!range || !ZPRadarRules.Finite(range.MinZ, -32700, 32700) || !ZPRadarRules.Finite(range.MaxZ, -32700, 32700) ||
            range.MinZ >= range.MaxZ) return;
        result.HeightRange = { MinZ: range.MinZ, MaxZ: range.MaxZ };
    }
    if (data.Bounds !== undefined) {
        const bounds = ZPRadarRules.Record(data.Bounds);
        if (!bounds || !ZPRadarRules.Finite(bounds.MinX, -32700, 32700) || !ZPRadarRules.Finite(bounds.MaxX, -32700, 32700) ||
            !ZPRadarRules.Finite(bounds.MinY, -32700, 32700) || !ZPRadarRules.Finite(bounds.MaxY, -32700, 32700) ||
            bounds.MinX >= bounds.MaxX || bounds.MinY >= bounds.MaxY) return;
        result.Bounds = { MinX: bounds.MinX, MaxX: bounds.MaxX, MinY: bounds.MinY, MaxY: bounds.MaxY };
    }
    return result;
}

export function plan(this: void, map: string, samples: readonly ZPRadarCaptureSample[], override: ZPRadarCaptureOptions,
    diagnostic: ZPRadarCapturePlanDiagnostics = {}): ZPRadarCapturePlan | undefined {
    const reject = (code: string): undefined => { diagnostic.Code = code; return undefined; };
    delete diagnostic.Code; delete diagnostic.HeightCount; delete diagnostic.Heights;
    delete diagnostic.CandidateHeightCount; delete diagnostic.ExcludedSamples; delete diagnostic.HeightRange;
    diagnostic.Samples = samples.length;
    if (map.length === 0 || map.length > 100 || !map.split("").every(c => "abcdefghijklmnopqrstuvwxyz0123456789_-".includes(c)))
        return reject("invalid_map");
    const filtered = samples.filter(p => !override.Bounds || (p.x >= override.Bounds.MinX && p.x <= override.Bounds.MaxX &&
        p.y >= override.Bounds.MinY && p.y <= override.Bounds.MaxY));
    if (filtered.length === 0 && (!override.Bounds || !override.Heights)) return reject("no_floor_samples");
    // filter already owns this array. Spreading thousands of samples emits a Lua
    // unpack call and exceeds LuaJIT's result limit on maps such as gm_construct.
    const sorted = filtered.sort((a, b) => a.z - b.z);
    const selection = selectFloors(sorted, override, diagnostic), heights = selection.Heights;
    diagnostic.HeightCount = heights.length; diagnostic.Heights = heights.slice(0, 64);
    if (heights.length === 0) return reject("no_floor_groups");
    if (heights.length > ZPRadarRules.MaxLayers) return reject("too_many_floors");
    const bounds = override.Bounds ?? { MinX: Infinity, MaxX: -Infinity, MinY: Infinity, MaxY: -Infinity };
    if (!override.Bounds) for (const point of selection.Samples) {
        bounds.MinX = Math.min(bounds.MinX, point.x); bounds.MaxX = Math.max(bounds.MaxX, point.x);
        bounds.MinY = Math.min(bounds.MinY, point.y); bounds.MaxY = Math.max(bounds.MaxY, point.y);
    }
    // Each sample covers a face; the analyser also supplies inset edge samples.
    const extent = Math.ceil((Math.max(bounds.MaxX - bounds.MinX, bounds.MaxY - bounds.MinY) + 64) * 1.025);
    if (extent < 64 || extent > 60000) return reject("invalid_capture_extent");
    const X = (bounds.MinX + bounds.MaxX - extent) / 2, Y = (bounds.MinY + bounds.MaxY + extent) / 2;
    const cuts = override.Cuts ?? heights.map((height, index) => Math.min(height + 80, (heights[index + 1] ?? height + 88) - 8));
    if (cuts.some((cut, index) => cut <= heights[index]! + 4)) return reject("insufficient_floor_spacing");
    const material = `zombieplague/radar/${map}`;
    const overview = ZPRadarRules.Overview({ Material: material + ".png", X, Y, Scale: extent / 1024, Size: 1024,
        Layers: heights.map((height, index) => ({ Material: material + `_level_${index + 1}.png`,
            MinZ: index === 0 ? -1000000 : (heights[index - 1]! + height) / 2,
            MaxZ: index === heights.length - 1 ? 1000000 : (height + heights[index + 1]!) / 2 })) });
    return overview ? { Map: map, Overview: overview, Heights: [...heights], Cuts: cuts } : reject("invalid_overview");
}
