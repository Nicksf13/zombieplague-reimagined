import type { MotionPhysics } from "./sv_bot_motion_physics";
const routing = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const { jumpReach, physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const { fallRisk } = include("sv_bot_traversal.lua") as typeof import("./sv_bot_traversal");
export interface BotPlacePoint { Key: string; Position: GLuaVector; Area: GLuaNavArea; Distance: number; Native: boolean; SafeID?: number | undefined; }
interface CatalogContract { Points(ply: ZPServerPlayer, physics: MotionPhysics, now: number): BotPlacePoint[]; Release(owner: number): void; }
export class BotPlaceCatalog implements CatalogContract {
    private cache = new Map<number, { Until: number; Points: GLuaVector[] }>();
    private leases = new Map<string, { Owner: number; Until: number }>();
    Points(ply: ZPServerPlayer, physics: MotionPhysics, now: number): BotPlacePoint[] {
        if (!navmesh.IsLoaded()) return [];
        const start = routing.floorArea(ply.GetPos(), 200); if (!start) return [];
        const queue = [{ Area: start, Distance: 0 }], seen = new Set<number>(), keys = new Set<string>(), result: BotPlacePoint[] = [];
        const authored = (_G.ZPBotSafePoints?.Points() ?? []).filter(point => point.Role === "both" || point.Role === (ply.IsZombie() ? "zombie" : "human"));
        let fallback = 0;
        for (let visited = 0; visited < 48 && queue.length > 0 && result.length < 32; visited++) {
            const current = queue.shift(); if (!current || seen.has(current.Area.GetID())) continue;
            const area = current.Area; seen.add(area.GetID());
            if (area.IsBlocked(-2) || area.IsUnderwater() || current.Distance > 1800) continue;
            let cached = this.cache.get(area.GetID());
            if (!cached || cached.Until < now) {
                if (this.cache.size >= 96) { const first = [...this.cache.keys()][0]; if (first !== undefined) this.cache.delete(first); }
                cached = { Until: now + 60, Points: area.GetHidingSpots(1).slice(0, 2) }; this.cache.set(area.GetID(), cached);
            }
            const native = cached.Points.length > 0;
            const automatic = native ? cached.Points : fallback++ < 8 ? [area.GetClosestPointOnArea(Vector(area.GetCenter().x + 96, area.GetCenter().y + 96, area.GetCenter().z))] : [];
            const points: { Position: GLuaVector; SafeID?: number; Native: boolean }[] = authored.map(point => ({
                Position: Vector(point.Position[0] ?? 0, point.Position[1] ?? 0, point.Position[2] ?? 0), SafeID: point.ID, Native: false
            }));
            points.push(...automatic.map(point => ({ Position: point, Native: native })));
            for (const entry of points) {
                const point = entry.Position;
                if (result.length >= 32) break;
                if (!area.Contains(point) || Math.abs(area.GetClosestPointOnArea(point).z - point.z) > 24 || ply.GetPos().DistToSqr(point) < 80 * 80) continue;
                // Native hiding flags at a marked destination must share its reservation.
                if (result.some(other => (entry.SafeID !== undefined || other.SafeID !== undefined) && other.Position.DistToSqr(point) < 32 * 32)) continue;
                const key = entry.SafeID !== undefined ? "safe:" + entry.SafeID + ":" + [point.x, point.y, point.z].join(".") :
                    "v2:" + area.GetID() + ":" + [point.x, point.y, point.z].map(value => Math.round(value / 16)).join(".");
                if (keys.has(key)) continue; keys.add(key);
                result.push({ Key: key,
                    Position: Vector(point.x, point.y, point.z), Area: area, Distance: current.Distance, Native: entry.Native, SafeID: entry.SafeID });
            }
            for (const step of routing.connections(area).slice(0, 48)) {
                const other = step.Area; if (!other || seen.has(other.GetID()) || queue.length >= 128) continue;
                const height = area.ComputeAdjacentConnectionHeightChange(other);
                if (!step.Ladder && (height > Math.max(48, jumpReach(physics)) || !fallRisk(ply, -height, physics).Allowed)) continue;
                queue.push({ Area: other, Distance: current.Distance + Math.sqrt(area.GetCenter().DistToSqr(other.GetCenter())) });
            }
        }
        return result;
    }
    Available(point: BotPlacePoint, role: ZPBotRole, owner: number, now: number): boolean {
        const lease = this.leases.get(role + ":" + point.Key); return !lease || lease.Owner === owner || lease.Until <= now;
    }
    Reserve(point: BotPlacePoint, role: ZPBotRole, owner: number, now: number): void {
        for (const [key, lease] of this.leases) if (lease.Until <= now) this.leases.delete(key);
        this.leases.set(role + ":" + point.Key, { Owner: owner, Until: now + 45 });
    }
    Release(owner: number): void { for (const [key, lease] of this.leases) if (lease.Owner === owner) this.leases.delete(key); }
    Validate(ply: ZPServerPlayer, point: BotPlacePoint, requireCover = true): { Duck: boolean; Cover: number } | undefined {
        // Geometry ignores every player, so querying a remote spot never reveals an unseen human.
        const filter = player.GetAll() as ZPServerPlayer[], position = point.Position;
        const start = Vector(position.x, position.y, position.z + 4), [mins, maxs] = ply.GetHull(), [duckMins, duckMaxs] = ply.GetHullDuck();
        const standing = util.TraceHull({ start, endpos: start, filter, mask: MASK_PLAYERSOLID, mins, maxs });
        if (standing.Hit && util.TraceHull({ start, endpos: start, filter, mask: MASK_PLAYERSOLID, mins: duckMins, maxs: duckMaxs }).Hit) return;
        if (!util.TraceLine({ start: Vector(position.x, position.y, position.z + 16), endpos: Vector(position.x, position.y, position.z - 24), filter, mask: MASK_PLAYERSOLID }).Hit) return;
        const state = physics(ply);
        if (!routing.connections(point.Area).some(step => {
            const area = step.Area; if (!area || area.IsBlocked(-2) || area.IsUnderwater()) return false;
            const height = point.Area.ComputeAdjacentConnectionHeightChange(area);
            return step.Ladder !== undefined || (height <= Math.max(48, jumpReach(state)) && fallRisk(ply, -height, state).Allowed);
        })) return;
        let cover = 0;
        for (const [x, y] of [[96, 0], [-96, 0], [0, 96], [0, -96]])
            if (util.TraceLine({ start: Vector(position.x, position.y, position.z + 48), endpos: Vector(position.x + (x ?? 0), position.y + (y ?? 0), position.z + 48), filter, mask: MASK_PLAYERSOLID }).Hit) cover++;
        if (requireCover && point.SafeID === undefined && !point.Native && cover < 2) return;
        return { Duck: standing.Hit, Cover: cover };
    }
}
