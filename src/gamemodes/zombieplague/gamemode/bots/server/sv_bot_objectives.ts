import type { BotSenses } from "./sv_bot_perception";
import type { DestinationRequest } from "./sv_bot_motor";
const routing = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
interface Goal { Position: GLuaVector; Threat: GLuaVector; Until: number; Best: number; Progress: number; }
interface Investigation { Position: GLuaVector; Key: string; Until: number; }
export interface ObjectiveIntent { Goal?: GLuaVector; Mode: string; Key: string; }
interface ObjectivesContract { Reset(): void; Resolve(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, request: DestinationRequest, now: number): ObjectiveIntent; }
/** Owns destination persistence; navigation and cooperative controllers still own physical execution. */
export class BotObjectives implements ObjectivesContract {
    constructor(private event?: (this: void, name: string) => void) {}
    private withdrawal: Goal | undefined;
    private investigation: Investigation | undefined;
    private visits = new Map<string, number>();
    private serial = 0;
    private lastDamage = -Infinity;
    Reset(): void { this.withdrawal = undefined; this.investigation = undefined; this.visits.clear(); this.lastDamage = -Infinity; }
    Damage(now: number): void { this.lastDamage = now; }
    UnderFire(now: number): boolean { return now - this.lastDamage <= 2; }
    private Visit(key: string, now: number): void {
        this.visits.set(key, now + 25);
        if (this.visits.size > 64) { const first = [...this.visits.keys()][0]; if (first !== undefined) this.visits.delete(first); }
    }
    Failed(now: number): void { if (this.investigation) { this.Visit(this.investigation.Key, now); this.event?.("Investigation:unreachable"); } this.investigation = undefined; this.withdrawal = undefined; }
    private MemoryKey(point: GLuaVector): string { return "visual:" + [point.x, point.y, point.z].map(value => Math.round(value / 128)).join(":"); }
    Inspected(senses: BotSenses, now: number): boolean {
        return !senses.Visible && senses.EnemyPosition !== undefined && (this.visits.get(this.MemoryKey(senses.EnemyPosition)) ?? 0) > now;
    }
    Safe(ply: ZPServerPlayer, senses: BotSenses, now: number): boolean {
        const threat = senses.EnemyPosition;
        return !senses.Visible && !this.UnderFire(now) && threat !== undefined && ply.OnGround() && ply.GetPos().DistToSqr(threat) > 320 * 320 &&
            util.TraceLine({ start: Vector(threat.x, threat.y, threat.z + 48), endpos: ply.EyePos(), filter: player.GetAll() as ZPServerPlayer[], mask: MASK_SHOT }).Hit;
    }
    private Reposition(ply: ZPServerPlayer, threat: GLuaVector, ally: GLuaVector | undefined, fallback: GLuaVector): GLuaVector {
        const position = ply.GetPos(), dx = threat.x - position.x, dy = threat.y - position.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const side = ply.EntIndex() % 2 === 0 ? 1 : -1;
        const candidates = [side, -side].map(direction => Vector(position.x - dx / length * 100 - dy / length * 240 * direction,
            position.y - dy / length * 100 + dx / length * 240 * direction, position.z));
        if (ally && position.DistToSqr(ally) > 160 * 160 && position.DistToSqr(ally) < 450 * 450) candidates.push(ally);
        let best = fallback, score = -Infinity;
        for (const candidate of candidates) {
            const range = Math.sqrt(candidate.DistToSqr(threat));
            if (range < 160 || range > length + 220) continue;
            if (navmesh.IsLoaded() && routing.findPath(ply, candidate, physics(ply), () => 1).Kind !== "complete") continue;
            const protectedPoint = util.TraceLine({ start: Vector(threat.x, threat.y, threat.z + 48), endpos: Vector(candidate.x, candidate.y, candidate.z + 48),
                filter: player.GetAll() as ZPServerPlayer[], mask: MASK_SHOT }).Hit;
            const value = (protectedPoint ? 1 : 0) + (candidate === ally ? 0.25 : 0) - Math.max(0, range - length) / 600;
            if (value > score) { score = value; best = candidate; }
        }
        return best;
    }
    Resolve(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, request: DestinationRequest, now: number): ObjectiveIntent {
        const position = ply.GetPos(), threat = senses.EnemyPosition;
        if (senses.Visible && this.investigation) {
            if (threat && threat.DistToSqr(this.investigation.Position) < 400 * 400) this.event?.("Investigation:real_encounter");
            this.investigation = undefined;
        }
        if (action === "retreat" && threat && request.Goal) {
            const previous = this.withdrawal;
            const distance = previous ? Math.sqrt(position.DistToSqr(previous.Position)) : Infinity;
            if (previous && distance < previous.Best - 12) { previous.Best = distance; previous.Progress = now; }
            if (!previous || now >= previous.Until || now - previous.Progress > 2 || distance < 48 || previous.Threat.DistToSqr(threat) > 160 * 160) {
                let goal = request.Goal;
                if (ply.IsZombie()) {
                    // A lateral approach changes exposure without indefinitely running away from the human objective.
                    goal = this.Reposition(ply, threat, senses.AllyPosition, goal);
                }
                this.withdrawal = { Position: goal, Threat: Vector(threat.x, threat.y, threat.z), Until: now + 2.5, Best: Math.sqrt(position.DistToSqr(goal)), Progress: now };
                this.serial++;
            }
            return { Goal: this.withdrawal?.Position ?? request.Goal, Mode: ply.IsZombie() ? "reposition" : "escape", Key: "withdraw:" + this.serial };
        }
        this.withdrawal = undefined;
        if (ply.IsZombie() && !senses.Visible && action !== "retreat") {
            const clue = senses.Sound;
            const point = threat ?? clue?.Position;
            const key = threat ? this.MemoryKey(threat) : clue ? "sound:" + clue.ID : "";
            if (!this.investigation && point && (this.visits.get(key) ?? 0) <= now) {
                const area = navmesh.IsLoaded() ? navmesh.GetNearestNavArea(point, false, 300, false, true) : undefined;
                if (area && area.IsValid() && !area.IsBlocked(-2) && !area.IsUnderwater()) {
                    this.investigation = { Position: area.GetClosestPointOnArea(point), Key: key, Until: Math.min(now + 12, threat ? now + 12 : clue?.Expires ?? now) };
                    this.event?.("Investigation:" + (threat ? "visual" : "sound") + ":started");
                }
            }
            const search = this.investigation;
            if (search && (now >= search.Until || position.DistToSqr(search.Position) < 80 * 80)) {
                this.event?.(now >= search.Until ? "Investigation:expired" : "Investigation:inspected_empty");
                this.Visit(search.Key, now); this.investigation = undefined;
            }
            if (this.investigation) return { Goal: this.investigation.Position, Mode: "investigate", Key: this.investigation.Key };
            // An inspected last sighting must not immediately become another remembered pursuit.
            return { Mode: "search_places", Key: "search" };
        }
        return { ...(request.Goal ? { Goal: request.Goal } : {}), Mode: request.Move, Key: action + ":" + (senses.Target?.EntIndex() ?? "none") };
    }
}
