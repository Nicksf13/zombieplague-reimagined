const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const routing = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const rules = include("sh_bot_boost_rules.lua") as typeof import("../shared/sh_bot_boost_rules");
export const vector = (point: number[]): GLuaVector => Vector(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0);
export function grounded(point: number[]): boolean {
    if (point.length !== 3) return false;
    const position = vector(point), trace = util.TraceLine({ start: Vector(position.x, position.y, position.z + 12),
        endpos: Vector(position.x, position.y, position.z - 16), filter: player.GetAll() as ZPServerPlayer[], mask: MASK_PLAYERSOLID });
    return trace.Hit && Math.abs(trace.HitPos.z - position.z) <= 8 && (!trace.HitNormal || trace.HitNormal.z >= 0.7);
}
export function validPoint(point: ZPBotBoostPoint): boolean {
    return validate(point) === undefined;
}
export function validate(point: ZPBotBoostPoint): ZPBotBoostIssue | undefined {
    if (!navmesh.IsLoaded()) return rules.issue("nav");
    for (const [index, position] of rules.positions(point).entries()) {
        if (position.length !== 3) return rules.issue("incomplete", index + 2);
        if (!grounded(position)) return rules.issue("floor", index + 2);
        if (!routing.floorArea(vector(position), 64, 24)) return rules.issue("nav", index + 2);
    }
    return rules.dimensions(point);
}
export function eligible(support: ZPServerPlayer, climber: ZPServerPlayer, point: ZPBotBoostPoint): boolean {
    return eligibility(support, climber, point) === undefined;
}
export function eligibility(support: ZPServerPlayer, climber: ZPServerPlayer, point: ZPBotBoostPoint): ZPBotBoostIssue | undefined {
    const invalid = validate(point); if (invalid) return invalid;
    const state = physics(climber), [, duckTop] = support.GetHullDuck(), [mins, maxs] = climber.GetHull(), [duckMin, duckMax] = climber.GetHullDuck();
    const lift = Math.min(18, Math.max(0, ((maxs.z - mins.z) - (duckMax.z - duckMin.z)) / 2));
    const reach = state.Jump * state.Jump / (2 * state.Gravity) * 0.9 + lift;
    const base = vector(point.Base), exit = vector(point.Exit), rise = exit.z - base.z - duckTop.z;
    if (duckTop.z > reach) return rules.issue("physics", 2, duckTop.z, 0, reach);
    if (rise > reach || rise < -8) return rules.issue("physics", 4, rise, -8, reach);
    const filter = player.GetAll() as ZPServerPlayer[], [supportMin, supportMax] = support.GetHullDuck();
    for (const [index, check] of [{ Point: base, Min: supportMin, Max: supportMax }, { Point: vector(point.Approach), Min: mins, Max: maxs }, { Point: exit, Min: duckMin, Max: duckMax }].entries()) {
        const position = Vector(check.Point.x, check.Point.y, check.Point.z + 2);
        if (util.TraceHull({ start: position, endpos: position, filter, mask: MASK_PLAYERSOLID, mins: check.Min, maxs: check.Max }).Hit) return rules.issue("obstacle", index + 2);
    }
    const seconds = (state.Jump + Math.sqrt(Math.max(0, state.Jump * state.Jump - 2 * state.Gravity * Math.max(0, rise - lift)))) / state.Gravity;
    const distance = Math.sqrt((exit.x - base.x) ** 2 + (exit.y - base.y) ** 2), maximum = state.Speed * seconds * 0.8;
    if (distance > maximum) return rules.issue("physics", 4, distance, 0, maximum);
}
export function reachable(ply: ZPServerPlayer, goal: GLuaVector, origin?: GLuaVector): boolean {
    return routing.findPath(ply, goal, physics(ply), () => 1, origin).Kind === "complete";
}
