const { readSkybox } = include("cl_radar_capture_skybox.lua") as typeof import("./cl_radar_capture_skybox");

interface RadarFloorAnalysis {
    Step(this: RadarFloorAnalysis): boolean;
    Samples(this: RadarFloorAnalysis): readonly ZPRadarCaptureSample[];
    Diagnostics(this: RadarFloorAnalysis): ZPRadarCaptureAnalysisDiagnostics;
}
class FloorAnalysis implements RadarFloorAnalysis {
    private index = 0;
    private candidates = 0;
    private floorHits = 0;
    private clearSamples = 0;
    private skyboxSamples = 0;
    private readonly samples: ZPRadarCaptureSample[] = [];
    constructor(private readonly surfaces: GLuaBrushSurface[], private readonly player: ZPClientPlayer,
        private readonly skybox: ReturnType<typeof readSkybox>) {}
    Samples(): readonly ZPRadarCaptureSample[] { return this.samples; }
    Diagnostics(): ZPRadarCaptureAnalysisDiagnostics {
        return { Surfaces: this.surfaces.length, Processed: this.index, Candidates: this.candidates,
            FloorHits: this.floorHits, ClearSamples: this.clearSamples,
            SkyboxSamples: this.skyboxSamples, SkyboxFilter: this.skybox !== undefined };
    }
    Step(): boolean {
        const deadline = SysTime() + 0.004;
        let count = 0;
        while (this.index < this.surfaces.length && count++ < 64 && SysTime() <= deadline) {
            const surface = this.surfaces[this.index++];
            if (surface) this.Analyse(surface);
        }
        return this.index >= this.surfaces.length;
    }
    private Analyse(surface: GLuaBrushSurface): void {
        if (surface.IsSky() || surface.IsNoDraw()) return;
        const vertices = surface.GetVertices();
        if (vertices.length < 3) return;
        let x = 0, y = 0, z = 0, area = 0, minZ = Infinity, maxZ = -Infinity;
        for (let index = 0; index < vertices.length; index++) {
            const a = vertices[index]!, b = vertices[(index + 1) % vertices.length]!;
            if (![a.x, a.y, a.z].every(v => ZPRadarRules.Finite(v, -32700, 32700))) return;
            x += a.x; y += a.y; z += a.z;
            area += a.x * b.y - b.x * a.y;
            minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
        }
        area = Math.abs(area) / 2;
        if (area < 512 || maxZ - minZ > 24) return;
        this.candidates++;
        const center = Vector(x / vertices.length, y / vertices.length, z / vertices.length);
        // Collision checks determine which side is playable, independent of surface winding.
        const points = [center, ...vertices.map(v => Vector(v.x * 0.9 + center.x * 0.1,
            v.y * 0.9 + center.y * 0.1, v.z * 0.9 + center.z * 0.1))];
        const valid: ZPRadarCaptureSample[] = [];
        for (const point of points) {
            // util.IsInWorld is server-only. The floor and clearance traces below
            // already reject invalid/solid positions using APIs available on clients.
            const floor = util.TraceLine({ start: Vector(point.x, point.y, point.z + 4),
                endpos: Vector(point.x, point.y, point.z - 8), mask: MASK_PLAYERSOLID, filter: this.player });
            if (!floor.Hit || floor.StartSolid || floor.HitSky || floor.HitNormal.z < 0.7) continue;
            this.floorHits++;
            const pos = floor.HitPos;
            if (this.skybox?.Contains({ x: pos.x, y: pos.y, z: pos.z + 4 })) { this.skyboxSamples++; continue; }
            const clearance = util.TraceHull({ start: Vector(pos.x, pos.y, pos.z + 2), endpos: Vector(pos.x, pos.y, pos.z + 3),
                mins: Vector(-16, -16, 0), maxs: Vector(16, 16, 72), mask: MASK_PLAYERSOLID, filter: this.player });
            if (clearance.Hit || clearance.StartSolid) continue;
            this.clearSamples++;
            valid.push({ x: pos.x, y: pos.y, z: pos.z, area: 0 });
        }
        for (const point of valid) this.samples.push({ ...point, area: area / valid.length });
        // Zero-weight corners retain the full footprint even when a wall blocks edge clearance.
        if (valid.length > 0) for (const vertex of vertices) {
            if (!this.skybox?.Contains({ x: vertex.x, y: vertex.y, z: vertex.z + 4 }))
                this.samples.push({ x: vertex.x, y: vertex.y, z: vertex.z, area: 0 });
        }
    }
}
export function analyse(this: void, player: ZPClientPlayer): RadarFloorAnalysis {
    return new FloorAnalysis(game.GetWorld().GetBrushSurfaces() ?? [], player, readSkybox());
}
