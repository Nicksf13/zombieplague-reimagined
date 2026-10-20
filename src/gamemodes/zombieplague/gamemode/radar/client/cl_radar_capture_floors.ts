interface HeightGroup { min: number; height: number; area: number; }

// Treat distant vertical islands as scenery unless an author supplies a range.
// No fixed world-Z ceiling is used: the largest supported band can be high above zero.
function heightRange(this: void, sorted: readonly ZPRadarCaptureSample[]): ZPRadarCaptureHeightRange | undefined {
    let current: { min: number; max: number; area: number } | undefined;
    let largest: { min: number; max: number; area: number } | undefined;
    for (const point of sorted) {
        if (point.area <= 0) continue;
        if (!current || point.z - current.max > 2048) {
            if (current && (!largest || current.area > largest.area)) largest = current;
            current = { min: point.z, max: point.z, area: point.area };
        } else { current.max = point.z; current.area += point.area; }
    }
    if (current && (!largest || current.area > largest.area)) largest = current;
    return largest ? { MinZ: largest.min - 48, MaxZ: largest.max + 48 } : undefined;
}

export function selectFloors(this: void, sorted: ZPRadarCaptureSample[], override: ZPRadarCaptureOptions,
    diagnostic: ZPRadarCapturePlanDiagnostics): { Samples: ZPRadarCaptureSample[]; Heights: number[] } {
    const explicit = override.Heights;
    const range = override.HeightRange ?? (explicit && explicit.length > 0 ?
        { MinZ: explicit[0]! - 48, MaxZ: explicit[explicit.length - 1]! + 48 } : heightRange(sorted));
    const samples = range ? sorted.filter(p => p.z >= range.MinZ && p.z <= range.MaxZ) : sorted;
    diagnostic.ExcludedSamples = sorted.length - samples.length;
    if (range) diagnostic.HeightRange = range;
    const groups: HeightGroup[] = [];
    for (const sample of samples) {
        if (sample.area <= 0) continue;
        const last = groups[groups.length - 1];
        // Initial groups cannot chain a staircase through arbitrarily many storeys.
        if (last && sample.z - last.min <= 48) {
            last.height = (last.height * last.area + sample.z * sample.area) / (last.area + sample.area);
            last.area += sample.area;
        } else groups.push({ min: sample.z, height: sample.z, area: sample.area });
    }
    const totalArea = groups.reduce((sum, group) => sum + group.area, 0);
    const candidates = groups.filter(group => group.area >= Math.max(1024, totalArea * 0.001));
    diagnostic.CandidateHeightCount = candidates.length;
    if (explicit) return { Samples: samples, Heights: explicit };
    // Prefer broad supported surfaces over nearby small landings. This bounds
    // spacing without averaging unrelated floors or selecting a fixed top-N list.
    candidates.sort((a, b) => a.area === b.area ? a.height - b.height : b.area - a.area);
    const selected: number[] = [];
    for (const candidate of candidates)
        if (selected.every(height => Math.abs(height - candidate.height) >= 48)) selected.push(candidate.height);
    selected.sort((a, b) => a - b);
    return { Samples: samples, Heights: selected };
}
