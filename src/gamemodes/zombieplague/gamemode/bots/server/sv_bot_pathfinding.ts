import type { MotionPhysics } from "./sv_bot_motion_physics";
const { jumpHeight } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const { fallRisk, diagnostic } = include("sv_bot_traversal.lua") as typeof import("./sv_bot_traversal");
export interface NavStep { Position: GLuaVector; Area?: GLuaNavArea; Source?: GLuaNavArea; From: number; To: number; Ladder?: GLuaNavLadder; }
export interface NavRoute { Steps: NavStep[]; Kind: "complete" | "partial" | "approach" | "missing" | "unreachable"; Detail?: ZPBotNavigationDiagnostic; }
export function nearest(position: GLuaVector, distance: number, checkLOS = false): GLuaNavArea | undefined {
    const area = navmesh.GetNearestNavArea(position, false, distance, checkLOS); return area?.IsValid() ? area : undefined;
}
export function floorArea(position: GLuaVector, distance: number, height = 64): GLuaNavArea | undefined {
    const contained = navmesh.GetNavArea(Vector(position.x, position.y, position.z + 4), height);
    const area = contained?.IsValid() ? contained : nearest(position, distance);
    if (!area) return;
    const point = area.GetClosestPointOnArea(position);
    // A nearby area on another floor must not masquerade as the target's floor.
    return Math.abs(point.z - position.z) <= height && point.DistToSqr(position) <= distance * distance ? area : undefined;
}
export function connections(area: GLuaNavArea): NavStep[] {
    const output: NavStep[] = [];
    for (const other of area.GetAdjacentAreas().slice(0, 128)) if (other.IsValid() && other.GetID() !== area.GetID()) output.push({ Position: other.GetCenter(), Area: other, Source: area, From: area.GetID(), To: other.GetID() });
    for (const ladder of area.GetLadders().slice(0, 16)) {
        if (!ladder.IsValid()) continue;
        const bottom = ladder.GetBottomArea(), upward = bottom.IsValid() && bottom.GetID() === area.GetID();
        const destinations = upward ? [ladder.GetTopForwardArea(), ladder.GetTopBehindArea(), ladder.GetTopLeftArea(), ladder.GetTopRightArea()] : [bottom];
        for (const other of destinations) if (other.IsValid() && other.GetID() !== area.GetID())
            output.push({ Position: other.GetCenter(), Area: other, From: area.GetID(), To: other.GetID(), Ladder: ladder });
    }
    return output;
}
export function findPath(ply: ZPServerPlayer, destination: GLuaVector, physics: MotionPhysics,
    multiplier: (this: void, from: number, to: number, distance: number) => number, origin = ply.GetPos()): NavRoute {
    if (!navmesh.IsLoaded()) return { Steps: [], Kind: "missing", Detail: diagnostic("missing", 0, 0) };
    const start = physics.Mode === "water" || physics.Mode === "ladder" ? nearest(origin, 250) : floorArea(origin, 250, physics.Mode === "air" ? Math.max(64, jumpHeight(physics) + 24) : 64);
    const goal = floorArea(destination, 400, physics.Mode === "water" ? 1000 : 64);
    if (!start || !goal) return { Steps: [], Kind: "missing", Detail: diagnostic("missing", start?.GetID() ?? 0, goal?.GetID() ?? 0) };
    if (goal.IsBlocked(-2) || (goal.IsUnderwater() && physics.Mode !== "water")) return { Steps: [], Kind: "unreachable", Detail: diagnostic("obstacle", start.GetID(), goal.GetID()) };
    if (start.GetID() === goal.GetID()) return { Steps: [{ Position: destination, Area: goal, From: start.GetID(), To: goal.GetID() }], Kind: "complete" };
    const open: GLuaNavArea[] = [start], closed: Record<number, boolean> = {};
    const costs: Record<number, number | undefined> = { [start.GetID()]: 0 }, parents: Record<number, NavStep | undefined> = {};
    const distance = (a: GLuaVector, b: GLuaVector): number => Math.sqrt(a.DistToSqr(b));
    const build = (end: GLuaNavArea, complete: boolean): NavStep[] => {
        const path: NavStep[] = complete ? [{ Position: destination, Area: goal, From: goal.GetID(), To: goal.GetID() }] : [];
        let id = end.GetID();
        while (id !== start.GetID() && path.length < 129) { const parent = parents[id]; if (!parent) return []; path.unshift(parent); id = parent.From; }
        return id === start.GetID() ? path : [];
    };
    let edges = 0, frontier = start, rejected: ZPBotNavigationDiagnostic | undefined, rejectionDistance = Infinity;
    for (let visited = 0; visited < 128 && open.length > 0 && edges < 1024; visited++) {
        let best = 0;
        for (let index = 1; index < open.length; index++) {
            const next = open[index], previous = open[best];
            if (next && previous && (costs[next.GetID()] ?? Infinity) + distance(next.GetCenter(), goal.GetCenter()) <
                (costs[previous.GetID()] ?? Infinity) + distance(previous.GetCenter(), goal.GetCenter())) best = index;
        }
        const current = open.splice(best, 1)[0]; if (!current) break;
        if (current.GetID() === goal.GetID()) {
            return { Steps: build(current, true), Kind: "complete" };
        }
        if (distance(current.GetCenter(), destination) < distance(frontier.GetCenter(), destination) - 16) frontier = current;
        closed[current.GetID()] = true;
        for (const step of connections(current)) {
            if (++edges > 1024) break;
            const other = step.Area; if (!other) continue;
            const height = current.ComputeAdjacentConnectionHeightChange(other);
            if (closed[step.To]) continue;
            const risk = fallRisk(ply, -height, physics);
            const reason: ZPBotNavReason | undefined = other.IsBlocked(-2) || (other.IsUnderwater() && physics.Mode !== "water") ? "obstacle" :
                !step.Ladder && height > Math.max(48, jumpHeight(physics)) ? "height" : !step.Ladder && !risk.Allowed ? "fall" : undefined;
            if (reason) {
                const proximity = distance(other.GetCenter(), destination);
                if (proximity < rejectionDistance) { rejected = diagnostic(reason, step.From, step.To, height, risk.Damage); rejectionDistance = proximity; }
                continue;
            }
            const length = distance(current.GetCenter(), other.GetCenter());
            const cost = (costs[current.GetID()] ?? 0) + length * multiplier(step.From, step.To, length) * (other.IsUnderwater() ? 2 : 1) *
                (1 + (!step.Ladder ? risk.Damage / Math.max(1, ply.Health()) * 4 : 0));
            if (cost >= (costs[step.To] ?? Infinity)) continue;
            costs[step.To] = cost; parents[step.To] = step;
            if (!open.some(area => area.GetID() === step.To) && open.length < 256) open.push(other);
        }
    }
    // When the bounded search is unfinished, follow its best frontier and continue
    // from there. Exhausted disconnected graphs only allow a better reachable approach.
    if (open.length > 0) {
        let best = open[0];
        for (const area of open) if (best && (costs[area.GetID()] ?? Infinity) + distance(area.GetCenter(), destination) <
            (costs[best.GetID()] ?? Infinity) + distance(best.GetCenter(), destination)) best = area;
        if (best) frontier = best;
    }
    const steps = frontier.GetID() === start.GetID() ? [] : build(frontier, false);
    const detail = open.length > 0 ? diagnostic("budget", frontier.GetID(), goal.GetID()) : rejected ?? diagnostic("connection", frontier.GetID(), goal.GetID(), goal.GetCenter().z - frontier.GetCenter().z);
    detail.Path = [frontier.GetCenter(), goal.GetCenter()].flatMap(point => [point.x, point.y, point.z]);
    return { Steps: steps, Kind: steps.length > 0 ? open.length > 0 ? "partial" : "approach" : "unreachable", Detail: detail };
}
export function dryExit(ply: ZPServerPlayer): GLuaVector | undefined {
    if (!navmesh.IsLoaded()) return;
    const start = nearest(ply.GetPos(), 1000), queue = start ? [start] : [], seen: Record<number, boolean> = {};
    let best: GLuaVector | undefined, distance = Infinity;
    for (let visited = 0; visited < 64 && queue.length > 0; visited++) {
        const area = queue.shift(); if (!area || seen[area.GetID()]) continue;
        seen[area.GetID()] = true;
        if (!area.IsBlocked(-2) && !area.IsUnderwater()) {
            const point = area.GetClosestPointOnArea(ply.GetPos()), delta = ply.GetPos().DistToSqr(point);
            if (delta < distance) { best = point; distance = delta; }
        }
        for (const other of area.GetAdjacentAreas().slice(0, 32)) if (other.IsValid() && !seen[other.GetID()] && queue.length < 128) queue.push(other);
    }
    return best;
}
