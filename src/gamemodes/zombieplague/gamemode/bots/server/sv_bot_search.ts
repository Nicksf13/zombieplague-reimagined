const routing = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const { physics, jumpReach } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const { fallRisk } = include("sv_bot_traversal.lua") as typeof import("./sv_bot_traversal");
interface SearchVisit { Time: number; BlockedUntil: number; }
interface SearchCandidate { Key: string; Position: GLuaVector; Distance: number; Seen: number; }
interface SearchContract { Reset(): void; Choose(ply: ZPServerPlayer, now: number): GLuaVector | undefined; Failed(position: GLuaVector, now: number): void; }
/** Explore reachable geometry using temporary visits, without querying enemy presence. */
export class BotSearch implements SearchContract {
    private visits = new Map<string, SearchVisit>();
    private selected: SearchCandidate | undefined;
    Reset(): void { this.visits.clear(); this.selected = undefined; }
    private Key(area: GLuaNavArea, point: GLuaVector): string {
        return area.GetID() + ":" + [point.x, point.y, point.z].map(value => Math.round(value / 32)).join(".");
    }
    private Visit(key: string, time: number, blockedUntil = 0): void {
        if (this.visits.size >= 96 && !this.visits.has(key)) { const first = [...this.visits.keys()][0]; if (first !== undefined) this.visits.delete(first); }
        this.visits.set(key, { Time: time, BlockedUntil: blockedUntil });
    }
    Failed(position: GLuaVector, now: number): void {
        if (this.selected && position.DistToSqr(this.selected.Position) < 1) this.Visit(this.selected.Key, now, now + 20);
    }
    Choose(ply: ZPServerPlayer, now: number): GLuaVector | undefined {
        if (!navmesh.IsLoaded()) return;
        const position = ply.GetPos(), state = physics(ply), start = routing.floorArea(position, 200);
        if (!start) return;
        this.Visit(this.Key(start, start.GetCenter()), now);
        const queue = [{ Area: start, Distance: 0 }], seen = new Set<number>([start.GetID()]);
        const candidates: SearchCandidate[] = [];
        const candidate = (area: GLuaNavArea, point: GLuaVector): void => {
            const distance = Math.sqrt(position.DistToSqr(point)), key = this.Key(area, point), visit = this.visits.get(key);
            if (distance <= 80 || (visit?.BlockedUntil ?? 0) > now) return;
            candidates.push({ Key: key, Position: point, Distance: distance, Seen: visit?.Time ?? -Infinity });
        };
        let edges = 0;
        for (let checked = 0; checked < 48 && queue.length > 0 && edges < 256; checked++) {
            const current = queue.shift(); if (!current) break;
            const area = current.Area;
            if (area.IsBlocked(-2) || area.IsUnderwater() || current.Distance > 1800) continue;
            candidate(area, area.GetCenter());
            for (const step of routing.connections(area).slice(0, 48)) {
                if (++edges > 256) break;
                const next = step.Area;
                if (!next || seen.has(next.GetID()) || seen.size >= 128 || next.IsBlocked(-2) || next.IsUnderwater()) continue;
                const height = area.ComputeAdjacentConnectionHeightChange(next);
                if (!step.Ladder && (height > Math.max(48, jumpReach(state)) || !fallRisk(ply, -height, state).Allowed)) continue;
                seen.add(next.GetID()); queue.push({ Area: next, Distance: current.Distance + Math.sqrt(area.GetCenter().DistToSqr(next.GetCenter())) });
            }
        }
        // An isolated large area still has useful viewpoints beyond its already-arrived center.
        if (candidates.length === 0) for (const [x, y] of [[400, 0], [-400, 0], [0, 400], [0, -400]])
            candidate(start, start.GetClosestPointOnArea(Vector(position.x + (x ?? 0), position.y + (y ?? 0), position.z)));
        candidates.sort((a, b) => a.Seen === b.Seen ? Math.abs(a.Distance - 400) - Math.abs(b.Distance - 400) : a.Seen - b.Seen);
        const selected = candidates[0];
        if (!selected) return;
        this.Visit(selected.Key, now); this.selected = selected;
        return Vector(selected.Position.x, selected.Position.y, selected.Position.z);
    }
}
