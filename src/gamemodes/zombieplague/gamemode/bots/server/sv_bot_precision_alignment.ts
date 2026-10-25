const { supported, walkingTrace } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");

/** A bounded right-angle approach clears a hull corner without exploratory side steps. */
export function alignment(ply: ZPServerPlayer, target: GLuaVector, duck: boolean): GLuaVector | undefined {
    const pos = ply.GetPos();
    let [mins, maxs] = ply.GetHull();
    if (duck) [mins, maxs] = ply.GetHullDuck();
    const clear = (from: GLuaVector, to: GLuaVector): boolean =>
        !walkingTrace(ply, Vector(from.x, from.y, from.z + 4), Vector(to.x, to.y, to.z + 4), mins, maxs).Hit && supported(ply, from, to);
    for (const candidate of [Vector(target.x, pos.y, pos.z), Vector(pos.x, target.y, pos.z)]) {
        const distance = pos.DistToSqr(candidate);
        if (distance < 16 || distance > 64 * 64) continue;
        const floor = util.TraceLine({ start: Vector(candidate.x, candidate.y, pos.z + 18), endpos: Vector(candidate.x, candidate.y, pos.z - 24), filter: ply, mask: MASK_PLAYERSOLID });
        if (!floor.Hit || (floor.HitNormal && floor.HitNormal.z < 0.7) || (IsValid(floor.Entity) && floor.Entity.IsPlayer())) continue;
        const corner = Vector(candidate.x, candidate.y, floor.HitPos.z);
        if (!clear(pos, corner)) continue;
        const dx = target.x - corner.x, dy = target.y - corner.y, length = Math.sqrt(dx * dx + dy * dy);
        if (length < 4) continue;
        const ahead = Vector(corner.x + dx / length * Math.min(16, length), corner.y + dy / length * Math.min(16, length), corner.z);
        if (clear(corner, ahead)) return corner;
    }
}
