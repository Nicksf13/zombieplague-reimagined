import type { NavStep } from "./sv_bot_pathfinding";
import type { MotionPhysics } from "./sv_bot_motion_physics";
const { fallRisk, diagnostic } = include("sv_bot_traversal.lua") as typeof import("./sv_bot_traversal");
interface DropPlan { Align: GLuaVector; Exit: GLuaVector; Landing: GLuaVector; Height: number; Damage: number; Pace: number; }
interface DropState { Step: NavStep; Plan: DropPlan; Phase: "align" | "cross" | "land"; Started: number; }
export interface DropControl { Target: GLuaVector; Crossing: boolean; Detail: ZPBotNavigationDiagnostic; SpeedLimit?: number; Failed?: boolean; }
interface DropContract { Reset(): void; Active(): boolean; Control(ply: ZPServerPlayer, step: NavStep, physics: MotionPhysics, now: number): DropControl | undefined; }
const horizontal = (a: GLuaVector, b: GLuaVector): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
export class BotDropTraversal implements DropContract {
    private state: DropState | undefined;
    Reset(): void { this.state = undefined; }
    Active(): boolean { return this.state !== undefined; }
    private Geometry(ply: ZPServerPlayer, step: NavStep, physics: MotionPhysics): DropPlan | ZPBotNavReason {
        const source = step.Source, area = step.Area;
        if (!source || !area) return "missing";
        const origin = source.GetCenter(), end = area.GetCenter(), dx = end.x - origin.x, dy = end.y - origin.y;
        const closest = source.GetClosestPointOnArea(end);
        if (horizontal(closest, end) > 1) {
            const length = horizontal(closest, end);
            const direct = this.Candidate(ply, source, area, physics, (end.x - closest.x) / length, (end.y - closest.y) / length, closest);
            if (typeof direct !== "string") return direct;
        }
        const distance = Math.sqrt(dx * dx + dy * dy);
        const directions = distance > 1 ? [[dx / distance, dy / distance], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let reason: ZPBotNavReason | undefined;
        let best: DropPlan | undefined, cost = Infinity;
        for (const direction of directions) {
            const result = this.Candidate(ply, source, area, physics, direction[0] ?? 0, direction[1] ?? 0);
            if (typeof result === "string") { reason = reason ?? result; continue; }
            const approach = horizontal(ply.GetPos(), result.Align);
            if (approach < cost) { cost = approach; best = result; }
        }
        return best ?? reason ?? "landing";
    }
    private Candidate(ply: ZPServerPlayer, source: GLuaNavArea, area: GLuaNavArea, physics: MotionPhysics, x: number, y: number, selectedEdge?: GLuaVector): DropPlan | ZPBotNavReason {
        const origin = source.GetClosestPointOnArea(ply.GetPos()), end = area.GetCenter();
        const edge = selectedEdge ?? source.GetClosestPointOnArea(Vector(origin.x + x * 65536, origin.y + y * 65536, origin.z));
        const margin = physics.Width / 2 + 8;
        const align = source.GetClosestPointOnArea(Vector(edge.x - x * margin, edge.y - y * margin, edge.z));
        const exit = Vector(edge.x + x * (margin + 4), edge.y + y * (margin + 4), edge.z);
        const near = area.GetClosestPointOnArea(exit), inward = horizontal(near, end);
        const inset = horizontal(near, exit) < 1 ? 0 : Math.min(margin, inward);
        const landing = area.GetClosestPointOnArea(Vector(near.x + (end.x - near.x) / Math.max(1, inward) * inset,
            near.y + (end.y - near.y) / Math.max(1, inward) * inset, near.z));
        const height = landing.z - edge.z, risk = fallRisk(ply, -height, physics);
        if (height >= -24 || !risk.Allowed) return "fall";
        const seconds = Math.sqrt(-2 * height / physics.Gravity);
        if (horizontal(exit, landing) > physics.Speed * seconds * 0.8) return "height";
        const filter = player.GetAll() as ZPServerPlayer[], [mins, maxs] = ply.GetHull();
        const support = util.TraceLine({ start: Vector(landing.x, landing.y, landing.z + 16), endpos: Vector(landing.x, landing.y, landing.z - 24), filter, mask: MASK_PLAYERSOLID });
        if (!support.Hit || Math.abs(support.HitPos.z - landing.z) > 32 || (support.HitNormal && support.HitNormal.z < 0.7)) return "landing";
        const stand = Vector(landing.x, landing.y, landing.z + 4);
        if (util.TraceHull({ start: stand, endpos: stand, filter, mask: MASK_PLAYERSOLID, mins, maxs }).Hit) return "obstacle";
        // Validate a swept standing hull along the descent; player occupancy is handled locally.
        let previous = Vector(align.x, align.y, align.z + 4);
        if (util.TraceHull({ start: previous, endpos: Vector(exit.x, exit.y, exit.z + 4), filter, mask: MASK_PLAYERSOLID, mins, maxs }).Hit) return "obstacle";
        previous = Vector(exit.x, exit.y, exit.z + 4);
        for (let index = 1; index <= 8; index++) {
            const fraction = index / 8;
            const point = Vector(exit.x + (landing.x - exit.x) * fraction, exit.y + (landing.y - exit.y) * fraction, exit.z + height * fraction * fraction + 4);
            if (util.TraceHull({ start: previous, endpos: point, filter, mask: MASK_PLAYERSOLID, mins, maxs }).Hit) return "obstacle";
            previous = point;
        }
        const departure = Vector(edge.x + x * (physics.Width / 2 + 1), edge.y + y * (physics.Width / 2 + 1), edge.z);
        const pace = Math.min(physics.Speed, Math.max(8, horizontal(departure, landing) / Math.max(0.1, seconds)));
        return { Align: align, Exit: exit, Landing: landing, Height: height, Damage: risk.Damage, Pace: pace };
    }
    Control(ply: ZPServerPlayer, step: NavStep, physics: MotionPhysics, now: number): DropControl | undefined {
        const source = step.Source, area = step.Area;
        if (!source || !area || step.Ladder || source.ComputeAdjacentConnectionHeightChange(area) >= -24) { this.Reset(); return; }
        if (this.state?.Step.From !== step.From || this.state.Step.To !== step.To) {
            const geometry = this.Geometry(ply, step, physics);
            if (typeof geometry === "string") return { Target: step.Position, Crossing: false, Failed: true,
                Detail: diagnostic(geometry, step.From, step.To, source.ComputeAdjacentConnectionHeightChange(area)) };
            this.state = { Step: step, Plan: geometry, Phase: "align", Started: now };
        }
        const state = this.state, plan = state.Plan, position = ply.GetPos();
        const detail = diagnostic("ready", step.From, step.To, plan.Height, plan.Damage);
        detail.Path = [position, plan.Align, plan.Exit, plan.Landing].flatMap(point => [point.x, point.y, point.z]);
        if (physics.Mode === "air") state.Phase = "land";
        if (state.Phase === "align" && horizontal(position, plan.Align) <= 12 && Math.abs(position.z - plan.Align.z) < 24) state.Phase = "cross";
        const risk = fallRisk(ply, -plan.Height, physics);
        detail.Damage = risk.Damage; detail.Phase = state.Phase;
        if (state.Phase === "land" && physics.Mode === "ground" &&
            (!area.Contains(position) || Math.abs(position.z - area.GetClosestPointOnArea(position).z) > 24)) {
            detail.Reason = "landing"; return { Target: plan.Landing, Crossing: false, Failed: true, Detail: detail };
        }
        if ((state.Phase !== "land" && !risk.Allowed) || now - state.Started > 15) {
            detail.Reason = !risk.Allowed ? "fall" : "stalled";
            return { Target: plan.Landing, Crossing: false, Failed: true, Detail: detail };
        }
        const target = state.Phase === "align" ? plan.Align : state.Phase === "cross" && horizontal(position, plan.Exit) > 8 ? plan.Exit : plan.Landing;
        return { Target: target, Crossing: state.Phase !== "align", Detail: detail,
            SpeedLimit: state.Phase === "align" ? Math.min(physics.Speed, Math.max(8, horizontal(position, target) / 0.25)) : plan.Pace };
    }
}
