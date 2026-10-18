import type { NavStep } from "./sv_bot_pathfinding";
export interface LadderSteering { Target: GLuaVector; Aim?: GLuaVector; }
export function steer(ply: ZPServerPlayer, step: NavStep, width: number): LadderSteering {
    const ladder = step.Ladder; if (!ladder) return { Target: step.Position };
    const position = ply.GetPos(), normal = ladder.GetNormal(), bottom = ladder.GetBottom(), top = ladder.GetTop();
    const upward = ladder.GetBottomArea().GetID() === step.From, endpoint = upward ? bottom : top;
    const standOff = Math.max(20, width * 0.65);
    let entry = Vector(endpoint.x + normal.x * standOff, endpoint.y + normal.y * standOff, endpoint.z);
    const source = upward ? ladder.GetBottomArea() : [ladder.GetTopForwardArea(), ladder.GetTopBehindArea(), ladder.GetTopLeftArea(), ladder.GetTopRightArea()]
        .find(area => area.IsValid() && area.GetID() === step.From);
    if (source?.IsValid()) entry = source.GetClosestPointOnArea(entry);
    const attached = ply.GetMoveType() === MOVETYPE_LADDER;
    const aligned = (position.x - entry.x) ** 2 + (position.y - entry.y) ** 2 <= Math.max(32, width) ** 2 && Math.abs(position.z - entry.z) < 64;
    if (!attached && !aligned) return { Target: entry };
    const end = upward ? top : bottom;
    const landing = step.Area?.GetClosestPointOnArea(Vector(end.x + normal.x * standOff, end.y + normal.y * standOff, end.z)) ?? step.Position;
    if (attached && (upward ? position.z >= landing.z - 18 : position.z <= landing.z + 24)) {
        return { Target: landing, Aim: Vector(landing.x, landing.y, landing.z + ply.EyePos().z - position.z) };
    }
    const fraction = Math.max(0, Math.min(1, (position.z - bottom.z) / Math.max(1, top.z - bottom.z)));
    const x = bottom.x + (top.x - bottom.x) * fraction, y = bottom.y + (top.y - bottom.y) * fraction;
    return { Target: Vector(x - normal.x * 8, y - normal.y * 8, position.z),
        Aim: Vector(x - normal.x * 100, y - normal.y * 100, position.z + (upward ? 220 : -160)) };
}
