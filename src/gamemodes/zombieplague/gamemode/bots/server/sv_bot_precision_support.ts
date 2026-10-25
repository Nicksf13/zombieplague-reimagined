export interface BlockedSupport {
    Start: number[]; End: number[]; Sample: number[]; Floor: number[];
    Reason: "missing" | "height" | "slope" | "player";
}
export function supported(ply: ZPServerPlayer, from: GLuaVector, to: GLuaVector,
    rejected?: (this: void, probe: BlockedSupport) => void): boolean {
    const dx = to.x - from.x, dy = to.y - from.y, distance = Math.sqrt(dx * dx + dy * dy);
    const [mins, maxs] = ply.GetHull();
    // Check a small support footprint, not the whole hull: legitimate beams can be narrower than a player.
    const margin = Math.min(3, (maxs.x - mins.x) * 0.08), steps = Math.min(16, Math.max(1, Math.ceil(distance / 4)));
    const x = distance > 0 ? -dy / distance : 0, y = distance > 0 ? dx / distance : 1;
    for (let index = 0; index <= steps; index++) {
        const fraction = index / steps, z = from.z + (to.z - from.z) * fraction;
        for (const side of [0, -margin, margin]) {
            if (index === 0 && side !== 0) continue;
            const px = from.x + dx * fraction + x * side, py = from.y + dy * fraction + y * side;
            const trace = util.TraceLine({ start: Vector(px, py, z + 18), endpos: Vector(px, py, z - 24), filter: ply, mask: MASK_PLAYERSOLID });
            const reason = !trace.Hit ? "missing" : Math.abs(trace.HitPos.z - z) > 24 ? "height" :
                trace.HitNormal && trace.HitNormal.z < 0.7 ? "slope" : IsValid(trace.Entity) && trace.Entity.IsPlayer() ? "player" : undefined;
            if (reason) {
                rejected?.({ Start: [from.x, from.y, from.z], End: [to.x, to.y, to.z], Sample: [px, py, z],
                    Floor: [trace.HitPos.x, trace.HitPos.y, trace.HitPos.z], Reason: reason });
                return false;
            }
        }
    }
    return true;
}

/** Only for a short inward recentering: native grounded hull contact may extend beyond a beam's center line. */
export function supportedOnHull(ply: ZPServerPlayer, from: GLuaVector, to: GLuaVector, destination = to, duck = false): boolean {
    if (!ply.OnGround() || from.DistToSqr(to) > 32 * 32 || from.DistToSqr(destination) > 32 * 32 || !supported(ply, destination, destination)) return false;
    let [mins, maxs] = ply.GetHull();
    if (duck) [mins, maxs] = ply.GetHullDuck();
    const steps = Math.max(1, Math.ceil(Math.sqrt(from.DistToSqr(to)) / 4));
    for (let index = 0; index <= steps; index++) {
        const fraction = index / steps, x = from.x + (to.x - from.x) * fraction, y = from.y + (to.y - from.y) * fraction;
        const z = from.z + (to.z - from.z) * fraction;
        const trace = util.TraceHull({ start: Vector(x, y, z + 18), endpos: Vector(x, y, z - 24), filter: ply, mask: MASK_PLAYERSOLID,
            mins: Vector(mins.x, mins.y, 0), maxs: Vector(maxs.x, maxs.y, 0) });
        if (!trace.Hit || trace.StartSolid || trace.AllSolid || Math.abs(trace.HitPos.z - z) > 24 ||
            !trace.HitNormal || trace.HitNormal.z < 0.7 || (IsValid(trace.Entity) && trace.Entity.IsPlayer())) return false;
    }
    return true;
}

export function nearEdge(ply: ZPServerPlayer, target: GLuaVector, width: number): boolean {
    const pos = ply.GetPos(), dx = target.x - pos.x, dy = target.y - pos.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const margin = width * 0.75 + 8;
    const probe = (forward: number, side: number): boolean => {
        const x = pos.x + dx / length * forward - dy / length * side, y = pos.y + dy / length * forward + dx / length * side;
        const trace = util.TraceLine({ start: Vector(x, y, pos.z + 18), endpos: Vector(x, y, pos.z - 24), filter: ply, mask: MASK_PLAYERSOLID });
        return trace.Hit && Math.abs(trace.HitPos.z - pos.z) <= 24;
    };
    const risk = (forward: number): boolean => probe(forward, 0) && (!probe(forward, margin) || !probe(forward, -margin));
    return risk(0) || risk(Math.min(32, length));
}

/** Sweep origins are four units above the feet; a world hit can be a native walking step. */
export function walkingTrace(ply: ZPServerPlayer, from: GLuaVector, to: GLuaVector, mins: GLuaVector, maxs: GLuaVector): GLuaTrace {
    const trace = (start: GLuaVector, endpos: GLuaVector): GLuaTrace => util.TraceHull({ start, endpos, filter: ply, mask: MASK_PLAYERSOLID, mins, maxs });
    const flat = trace(from, to);
    if (!flat.Hit || !flat.HitWorld || flat.StartSolid || flat.AllSolid || !ply.OnGround()) return flat;
    const size = ply.GetStepSize(), rise = Number.isFinite(size) ? Math.max(0, Math.min(24, size)) : 0;
    if (rise <= 0) return flat;
    const above = Vector(from.x, from.y, from.z + rise), across = Vector(to.x, to.y, to.z + rise);
    if (trace(from, above).Hit) return flat;
    const raised = trace(above, across);
    if (raised.Hit) return flat;
    const landing = trace(across, to);
    if (!landing.Hit || landing.StartSolid || landing.AllSolid || !landing.HitNormal || landing.HitNormal.z < 0.7 ||
        landing.HitPos.z - from.z + 4 > rise || (IsValid(landing.Entity) && landing.Entity.IsPlayer())) return flat;
    return raised;
}

/** Counter-steer through normal player inputs; never set velocity, position or collision rules. */
export function drive(ply: ZPServerPlayer, target: GLuaVector | undefined, limit: number, duck = false, edgeRecovery = false): GLuaVector {
    const pos = ply.GetPos(), velocity = ply.GetVelocity();
    const dx = target ? target.x - pos.x : 0, dy = target ? target.y - pos.y : 0, distance = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.min(limit, distance / 0.25), x = dx / Math.max(1, distance), y = dy / Math.max(1, distance);
    const along = velocity.x * x + velocity.y * y;
    let vx = x * speed - (velocity.x - x * along) * 1.2 - x * Math.max(0, along - speed);
    let vy = y * speed - (velocity.y - y * along) * 1.2 - y * Math.max(0, along - speed);
    const cap = Math.max(1, ply.GetWalkSpeed()), length = Math.sqrt(vx * vx + vy * vy), scale = Math.min(1, cap / Math.max(1, length));
    vx *= scale; vy *= scale;
    let [mins, maxs] = ply.GetHull();
    if (duck) [mins, maxs] = ply.GetHullDuck();
    const horizon = Math.max(engine.TickInterval(), 0.12);
    const safe = (a: number, b: number): boolean => {
        const end = Vector(pos.x + a * horizon, pos.y + b * horizon, pos.z);
        return !walkingTrace(ply, Vector(pos.x, pos.y, pos.z + 4), Vector(end.x, end.y, end.z + 4), mins, maxs).Hit &&
            (supported(ply, pos, end) || (edgeRecovery && target !== undefined && supportedOnHull(ply, pos, end, target, duck)));
    };
    if (safe(vx, vy)) return Vector(vx, vy, 0);
    const brakeScale = Math.min(1, cap / Math.max(1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)));
    const bx = -velocity.x * brakeScale, by = -velocity.y * brakeScale;
    return safe(bx, by) ? Vector(bx, by, 0) : Vector(0, 0, 0);
}
