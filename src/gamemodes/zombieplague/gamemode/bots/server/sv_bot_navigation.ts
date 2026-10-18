import type { BotMotionLearner, MoveOption, MoveFrame } from "./sv_bot_motion";
import type { NavStep, NavRoute } from "./sv_bot_pathfinding";
import type { MotionPhysics } from "./sv_bot_motion_physics";
const routing = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const movement = include("sv_bot_motion_actions.lua") as typeof import("./sv_bot_motion_actions");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const ladder = include("sv_bot_ladder.lua") as typeof import("./sv_bot_ladder");
const { BotDropTraversal } = include("sv_bot_drop.lua") as typeof import("./sv_bot_drop");
const { BotGroundTraversal } = include("sv_bot_ground.lua") as typeof import("./sv_bot_ground");
const { BotPrecisionTraversal } = include("sv_bot_precision.lua") as typeof import("./sv_bot_precision");
const { fallRisk, diagnostic } = include("sv_bot_traversal.lua") as typeof import("./sv_bot_traversal");
export interface BotSteering { Position?: GLuaVector; Jump: boolean; Duck: boolean; Use: boolean; Stuck: boolean; Pick?: MoveOption; Unreachable?: boolean; Precision?: boolean; Blocker?: ZPServerPlayer; Controller?: string; }
export class BotNavigator {
    private path: NavStep[] = [];
    private lastGoal: GLuaVector | undefined;
    private nextPath = 0;
    private lastPosition: GLuaVector | undefined;
    private nextStuckCheck = 0;
    private stuckAttempts = 0;
    private replans = 0;
    private route: ZPBotRoute = "none";
    private remaining = 0;
    private physicsKey = "";
    private waterGoal: GLuaVector | undefined;
    private nextWaterGoal = 0;
    private intent: string | undefined;
    private expectedSpeed = 0;
    private routeKind: NavRoute["Kind"] = "missing";
    private goalArea = 0;
    private failedPlans = 0;
    private drop = new BotDropTraversal();
    private ground = new BotGroundTraversal();
    private precision = new BotPrecisionTraversal();
    private detail: ZPBotNavigationDiagnostic | undefined;
    private blockedEdges = new Map<string, number>();
    private failure: { Detail: ZPBotNavigationDiagnostic; Until: number } | undefined;
    Diagnostic(): ZPBotNavigationDiagnostic | undefined { return ZPBotMotionProtocol.Navigation(this.detail); }
    Status(): { Route: ZPBotRoute; Remaining: number; Replans: number } { return { Route: this.route, Remaining: this.remaining, Replans: this.replans }; }
    IsFollowing(): boolean { return (this.route === "mesh" && this.path.length > 0) || this.routeKind === "partial"; }
    Reset(): void {
        this.path = []; this.lastGoal = undefined; this.nextPath = 0; this.stuckAttempts = 0; this.lastPosition = undefined;
        this.route = "none"; this.remaining = 0; this.replans = 0; this.nextStuckCheck = 0; this.waterGoal = undefined;
        this.expectedSpeed = 0;
        this.routeKind = "missing"; this.goalArea = 0; this.failedPlans = 0;
        this.drop.Reset(); this.ground.Reset(); this.precision.Reset(); this.detail = undefined;
        this.blockedEdges.clear(); this.failure = undefined;
    }
    Wander(ply: ZPServerPlayer): GLuaVector | undefined {
        if (ply.WaterLevel() >= 2) return routing.dryExit(ply) ?? Vector(ply.GetPos().x, ply.GetPos().y, ply.GetPos().z + 96);
        if (!navmesh.IsLoaded()) return;
        const area = routing.nearest(ply.GetPos(), 200, true), state = physics(ply);
        const candidates = area ? routing.connections(area).filter(step => step.Area && !step.Area.IsBlocked(-2) && !step.Area.IsUnderwater() &&
            (step.Ladder !== undefined || (area.ComputeAdjacentConnectionHeightChange(step.Area) <= Math.max(48, state.Jump * state.Jump / (2 * state.Gravity) * 0.85) &&
                fallRisk(ply, -area.ComputeAdjacentConnectionHeightChange(step.Area), state).Allowed))) : [];
        return candidates[math.random(1, Math.max(1, candidates.length)) - 1]?.Position;
    }
    private Remaining(position: GLuaVector, goal: GLuaVector): number {
        let remaining = 0, previous = position;
        for (const step of this.path.length > 0 ? this.path : [{ Position: goal }]) {
            remaining += Math.sqrt(previous.DistToSqr(step.Position)); previous = step.Position;
        }
        return remaining;
    }
    private Arrived(ply: ZPServerPlayer, step: NavStep, final: boolean): boolean {
        const position = ply.GetPos();
        if (step.Ladder && ply.GetMoveType() === MOVETYPE_LADDER) return false;
        if (ply.WaterLevel() >= 2 && step.Area && !step.Area.IsUnderwater()) return false;
        if (ply.WaterLevel() >= 2 && this.waterGoal && step.Position.DistToSqr(this.waterGoal) < 1600) return false;
        if (!ply.OnGround() && ply.WaterLevel() < 2) return false;
        if (final || !step.Area) return Math.abs(position.z - step.Position.z) <= 24 && position.DistToSqr(step.Position) < 1600;
        return step.Area.Contains(position) && Math.abs(step.Area.GetClosestPointOnArea(position).z - position.z) < 24;
    }
    private Frame(ply: ZPServerPlayer, step: NavStep, goal: GLuaVector, state: MotionPhysics, dynamic: boolean, obstacle: boolean, stage = step.Position): MoveFrame {
        const edge = state.Key + ":" + step.From + ">" + step.To;
        const cell = step.From === 0 ? ":" + [step.Position.x, step.Position.y, step.Position.z].map(value => Math.floor(value / 128)).join(".") : "";
        const drain = ply.IsHuman() && RunShouldDrain(ply) && cvars.Number("zp_run_drain", 1) > 0;
        const points: GLuaVector[] = [];
        for (const point of [ply.GetPos(), stage, ...this.path.slice(0, 2).map(item => item.Position), goal]) {
            const previous = points[points.length - 1]; if (!previous || previous.DistToSqr(point) > 1) points.push(point);
        }
        const path = points.slice(0, 5).flatMap(point => [point.x, point.y, point.z]);
        const velocity = ply.GetVelocity();
        return { Key: edge + cell + ":" + state.Mode + ":" + (dynamic ? "dynamic" : obstacle ? "blocked" : "clear") + ":" + (ply.GetBreath() < 20 ? "low" : "normal"),
            Edge: edge, Mode: state.Mode, From: step.From, To: step.To, Position: ply.GetPos(), Remaining: Math.sqrt(ply.GetPos().DistToSqr(stage)),
            RouteRemaining: this.remaining, Speed: this.expectedSpeed || state.Speed, Breath: ply.GetBreath(), Drain: drain, Dynamic: dynamic, Goal: goal,
            Completed: this.Arrived(ply, step, this.routeKind === "complete" && this.path.length <= 1),
            Final: (this.routeKind === "complete" || this.routeKind === "missing") && ply.GetPos().DistToSqr(goal) < 1600, Path: path,
            Ladder: step.Ladder !== undefined, Forced: velocity.x * velocity.x + velocity.y * velocity.y > state.Run * state.Run * 2.25,
            Velocity: velocity, Gravity: state.Gravity, Run: state.Run,
            Stage: Vector(stage.x, stage.y, stage.z), ...(this.intent !== undefined ? { Intent: this.intent } : {}) };
    }
    Steer(ply: ZPServerPlayer, requested: GLuaVector, now: number, learner?: BotMotionLearner, sprintPreferred = false, intent?: string): BotSteering {
        const result: BotSteering = { Jump: false, Duck: false, Use: false, Stuck: false }, position = ply.GetPos(), state = physics(ply);
        if (this.physicsKey !== state.Key) { this.Reset(); learner?.Cancel("physics_changed"); this.physicsKey = state.Key; }
        const landed = this.path[0];
        // Credit the old passage before a nearby target changes pursuit into melee dodging.
        if (landed && this.drop.Active() && this.Arrived(ply, landed, false)) {
            learner?.Choose(this.Frame(ply, landed, this.lastGoal ?? requested, state, false, false), [], now);
            this.path.shift(); this.drop.Reset(); this.ground.Reset(); this.precision.Reset(); this.failedPlans = 0;
            this.detail = diagnostic("ready", landed.From, landed.To);
        }
        this.intent = intent;
        let goal = requested;
        if (state.Mode === "water") {
            if (now >= this.nextWaterGoal) { this.waterGoal = routing.dryExit(ply); this.nextWaterGoal = now + 2; }
            goal = this.waterGoal ?? requested;
        } else this.waterGoal = undefined;
        if (learner?.Replan) {
            const rejected = this.path[0];
            this.path = []; this.failedPlans++; this.nextPath = this.failedPlans >= 3 ? now + 5 : 0;
            if (this.failedPlans >= 3) { this.routeKind = "unreachable"; this.detail = diagnostic("stalled", rejected?.From ?? 0, rejected?.To ?? 0); }
            learner.Replan = false;
        }
        const area = navmesh.IsLoaded() ? routing.floorArea(goal, 400, state.Mode === "water" ? 1000 : 64) : undefined;
        const changedGoal = !this.lastGoal || this.lastGoal.DistToSqr(goal) > 10000 || Math.abs(this.lastGoal.z - goal.z) > 32 || this.goalArea !== (area?.GetID() ?? 0);
        if (changedGoal) this.failedPlans = 0;
        if (!(this.drop.Active() && state.Mode === "air") && (changedGoal || (now >= this.nextPath && this.path.length === 0))) {
            for (const [key, until] of this.blockedEdges) if (now >= until) this.blockedEdges.delete(key);
            const route = routing.findPath(ply, goal, state, (from, to, distance) => this.blockedEdges.has(from + ">" + to) ? Infinity : learner?.Cost(state.Key + ":" + from + ">" + to, distance, state.Speed) ?? 1);
            this.path = route.Steps; this.routeKind = route.Kind; this.goalArea = area?.GetID() ?? 0;
            this.drop.Reset(); this.ground.Reset(); this.precision.Reset(); this.detail = route.Detail ?? diagnostic("ready", this.path[0]?.From ?? 0, this.path[0]?.To ?? 0);
            if (route.Kind === "unreachable" && this.failure && now < this.failure.Until) this.detail = this.failure.Detail;
            this.lastGoal = Vector(goal.x, goal.y, goal.z); this.nextPath = now + (route.Kind === "unreachable" ? 5 : 1); this.replans++;
        } else if (this.routeKind === "complete") {
            const final = this.path[this.path.length - 1]; if (final && final.From === final.To) final.Position = goal;
        }
        this.remaining = this.Remaining(position, goal);
        while (this.path[0] && this.Arrived(ply, this.path[0], this.routeKind === "complete" && this.path.length === 1)) {
            const arrived = this.path[0];
            learner?.Choose(this.Frame(ply, arrived, requested, state, false, false), [], now);
            this.path.shift(); this.drop.Reset(); this.ground.Reset(); this.precision.Reset(); this.failedPlans = 0;
        }
        if (this.path.length === 0 && this.routeKind === "approach") { this.routeKind = "unreachable"; this.nextPath = now + 5; }
        const height = goal.z - position.z, local = this.routeKind === "missing" &&
            (state.Mode === "water" || (height >= -80 && height <= Math.max(48, state.Jump * state.Jump / (2 * state.Gravity) * 0.85)));
        if (this.path.length === 0 && !local && this.routeKind !== "complete") {
            this.route = "none"; this.remaining = Math.sqrt(position.DistToSqr(goal)); learner?.Cancel("route_unavailable", state.Mode === "air");
            result.Stuck = true; result.Unreachable = this.routeKind !== "partial"; return result;
        }
        const step = this.path[0] ?? { Position: goal, From: 0, To: 0 };
        this.route = this.path.length > 0 ? "mesh" : "local"; this.remaining = this.Remaining(position, goal);
        if (now >= this.nextStuckCheck) {
            if (this.lastPosition && position.DistToSqr(this.lastPosition) < 100 && this.remaining > 40) this.stuckAttempts++;
            else this.stuckAttempts = 0;
            this.lastPosition = Vector(position.x, position.y, position.z); this.nextStuckCheck = now + 1;
        }
        result.Stuck = this.stuckAttempts >= 2;
        let target = step.Position, ladderAim: GLuaVector | undefined;
        const descent = this.drop.Control(ply, step, state, now);
        if (descent) {
            this.detail = descent.Detail;
            if (descent.Failed) {
                if (this.blockedEdges.size < 128) this.blockedEdges.set(step.From + ">" + step.To, now + 5);
                this.failure = { Detail: descent.Detail, Until: now + 5 };
                this.route = "none"; this.path = []; this.drop.Reset(); this.routeKind = "unreachable"; this.nextPath = now;
                learner?.Cancel("descent_rejected", state.Mode === "air"); result.Stuck = true; return result;
            }
            target = descent.Target;
        }
        if (step.Ladder) {
            const control = ladder.steer(ply, step, state.Width); target = control.Target; ladderAim = control.Aim;
        }
        const current = navmesh.IsLoaded() ? routing.nearest(position, 100) : undefined;
        const jump = (step.Area?.HasAttributes(NAV_MESH_JUMP) ?? false) || (step.Position.z - position.z > 18 && state.Mode === "ground");
        const duck = (current?.HasAttributes(NAV_MESH_CROUCH) ?? false) || (step.Area?.HasAttributes(NAV_MESH_CROUCH) ?? false);
        const precision = !descent && !step.Ladder && !jump ? this.precision.Control(ply, step, state, duck, now) : undefined;
        if (descent || step.Ladder || jump) this.precision.Reset();
        if (precision) { target = precision.Target; result.Precision = true; }
        let checkpoint = !precision && !descent && !step.Ladder ? this.ground.Control(ply, step, state.Width, state.Speed, false) : undefined;
        if (checkpoint) target = checkpoint.Target;
        let surface = precision?.Surface ?? movement.options(ply, target, state, this.stuckAttempts > 0, jump, duck, sprintPreferred || this.remaining > 350, ladderAim, descent?.Crossing);
        if (!precision && !checkpoint && !descent && !step.Ladder && state.Mode === "ground" && surface.Ground &&
            !surface.Options.some(option => option.Action === "forward" || option.Action === "duck" || option.Action === "sprint")) {
            checkpoint = this.ground.Control(ply, step, state.Width, state.Speed, true);
            if (checkpoint) {
                target = checkpoint.Target;
                surface = movement.options(ply, target, state, this.stuckAttempts > 0, jump, duck, sprintPreferred || this.remaining > 350);
            }
        }
        if (descent || checkpoint) {
            surface.Options = surface.Options.filter(option => !option.Jump && !option.Sprint);
            const pace = descent?.SpeedLimit ?? checkpoint?.SpeedLimit;
            if (pace !== undefined) for (const option of surface.Options) option.SpeedLimit = pace;
        }
        const frame = this.Frame(ply, step, requested, state, surface.Dynamic, surface.Obstacle, target);
        const controller = precision ? "precision" : descent ? "descent" : checkpoint ? "ground_transition" : step.Ladder ? "ladder" : state.Mode === "water" ? "water" : undefined;
        if (controller) result.Controller = controller;
        if (surface.Blocker) result.Blocker = surface.Blocker;
        if (precision) { frame.Precision = true; frame.Key += ":precision"; }
        let pick: MoveOption | undefined;
        if (learner) pick = learner.Choose(frame, surface.Options, now);
        else for (const option of surface.Options) if (!pick || option.Preference > pick.Preference) pick = option;
        if (this.route === "mesh") {
            const height = step.Source && step.Area ? step.Source.ComputeAdjacentConnectionHeightChange(step.Area) : step.Position.z - position.z;
            this.detail = descent?.Detail ?? diagnostic("ready", step.From, step.To, height, fallRisk(ply, -height, state).Damage);
            if (checkpoint) this.detail.Phase = checkpoint.Phase;
            if (precision) this.detail.Phase = precision.Phase;
            if (!pick && !frame.Completed) this.detail.Reason = surface.Dynamic ? "occupied" : surface.Obstacle ? "obstacle" : surface.Ground ? "ground" : "stalled";
        }
        if (pick && !frame.Completed) { result.Pick = pick; result.Position = pick.Position; result.Jump = pick.Jump; result.Duck = pick.Duck; }
        this.expectedSpeed = Math.min(pick?.SpeedLimit ?? Infinity, pick?.Sprint ? state.Run : pick?.Duck ? state.Speed * ply.GetCrouchedWalkSpeed() : state.Speed);
        if (surface.Obstacle) {
            const trace = util.TraceHull({ start: position, endpos: target, filter: ply, mask: MASK_PLAYERSOLID, mins: Vector(-8, -8, 0), maxs: Vector(8, 8, 32) });
            if (IsValid(trace.Entity)) result.Use = ["prop_door_rotating", "func_door", "func_door_rotating"].includes(trace.Entity.GetClass());
        }
        return result;
    }
}
