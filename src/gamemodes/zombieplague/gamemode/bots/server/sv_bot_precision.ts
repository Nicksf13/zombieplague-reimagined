import type { NavStep } from "./sv_bot_pathfinding";
import type { MotionPhysics } from "./sv_bot_motion_physics";
import type { MotionSurface } from "./sv_bot_motion_actions";
const { BotGroundTraversal } = include("sv_bot_ground.lua") as typeof import("./sv_bot_ground");
const movement = include("sv_bot_motion_actions.lua") as typeof import("./sv_bot_motion_actions");
const { nearEdge, supported } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");
export interface PrecisionControl { Target: GLuaVector; SpeedLimit: number; Phase: "align" | "cross"; Surface: MotionSurface; }
interface PrecisionContract { Reset(): void; Control(ply: ZPServerPlayer, step: NavStep, physics: MotionPhysics, duck: boolean, now: number): PrecisionControl | undefined; }
function narrow(area: GLuaNavArea | undefined, width: number): boolean {
    if (!area) return false;
    const low = area.GetClosestPointOnArea(Vector(-1e7, -1e7, 0)), high = area.GetClosestPointOnArea(Vector(1e7, 1e7, 0));
    return Math.min(high.x - low.x, high.y - low.y) <= Math.max(48, width * 2);
}
function recenter(area: GLuaNavArea | undefined, position: GLuaVector, width: number): GLuaVector | undefined {
    if (!area || !area.Contains(position)) return;
    const low = area.GetClosestPointOnArea(Vector(-1e7, -1e7, 0)), high = area.GetClosestPointOnArea(Vector(1e7, 1e7, 0));
    const x = high.x - low.x, y = high.y - low.y, margin = Math.min(6, Math.min(x, y) / 4);
    const center = area.GetCenter();
    if (x < y && x <= width * 2 && (position.x < low.x + margin || position.x > high.x - margin))
        return area.GetClosestPointOnArea(Vector(center.x, position.y, position.z));
    if (y < x && y <= width * 2 && (position.y < low.y + margin || position.y > high.y - margin))
        return area.GetClosestPointOnArea(Vector(position.x, center.y, position.z));
}
export class BotPrecisionTraversal implements PrecisionContract {
    private ground = new BotGroundTraversal();
    private edge = "";
    private active = false;
    private previous: GLuaVector | undefined;
    private progressed = 0;
    private trail: GLuaVector[] = [];
    private recovery: { Target: GLuaVector; Until: number } | undefined;
    private nextRecovery = 0;
    Reset(): void {
        this.ground.Reset(); this.edge = ""; this.active = false; this.previous = undefined;
        this.trail = []; this.recovery = undefined; this.progressed = 0; this.nextRecovery = 0;
    }
    Control(ply: ZPServerPlayer, step: NavStep, physics: MotionPhysics, duck: boolean, now: number): PrecisionControl | undefined {
        if (physics.Mode !== "ground" || step.Ladder || !step.Area || step.Area.HasAttributes(NAV_MESH_JUMP) ||
            Math.abs(step.Area.GetClosestPointOnArea(ply.GetPos()).z - ply.GetPos().z) > 24) { this.Reset(); return; }
        const edge = step.From + ">" + step.To, pos = ply.GetPos();
        if (edge !== this.edge) { this.Reset(); this.edge = edge; }
        this.active = this.active || narrow(step.Source ?? step.Area, physics.Width) || narrow(step.Area, physics.Width) || nearEdge(ply, step.Position, physics.Width);
        if (!this.active) return;
        const checkpoint = this.ground.Control(ply, step, physics.Width, physics.Speed, true, 4);
        const center = recenter(step.Source ?? step.Area, pos, physics.Width);
        let target = center ?? checkpoint?.Target ?? step.Position;
        const distance = Math.sqrt(pos.DistToSqr(target));
        let pace = Math.min(80, physics.Speed * 0.45, checkpoint?.SpeedLimit ?? Infinity, Math.max(4, distance / 0.25));
        if (!this.previous || pos.DistToSqr(this.previous) > 36) {
            if (this.previous && supported(ply, this.previous, pos)) this.trail = [...this.trail.slice(-5), this.previous];
            this.previous = Vector(pos.x, pos.y, pos.z); this.progressed = now;
        }
        const options = (point: GLuaVector, speed: number): MotionSurface => movement.options(ply, point, physics, false, false, duck, false, undefined, false, speed);
        let surface = options(target, pace);
        if (surface.Dynamic) { this.progressed = now; this.recovery = undefined; }
        if (this.recovery && (now >= this.recovery.Until || pos.DistToSqr(this.recovery.Target) < 4)) this.recovery = undefined;
        if (!surface.Dynamic && !this.recovery && now >= this.nextRecovery && now - this.progressed >= 1.2) {
            // A short, previously supported retreat lets the next approach re-align without random side steps.
            const retreat = [...this.trail].reverse().find(point => pos.DistToSqr(point) >= 16 && pos.DistToSqr(point) <= 576 && options(point, 32).Options.length > 0);
            if (retreat) { this.recovery = { Target: retreat, Until: now + 0.6 }; this.nextRecovery = now + 2; this.progressed = now; }
        }
        if (this.recovery) {
            target = this.recovery.Target; pace = Math.min(pace, 32); surface = options(target, pace);
            for (const option of surface.Options) option.Action = "back";
        }
        return { Target: target, SpeedLimit: pace, Phase: this.recovery || center ? "align" : checkpoint?.Phase ?? "align", Surface: surface };
    }
}
