export function supported(ply: ZPServerPlayer, from: GLuaVector, to: GLuaVector): boolean {
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
            if (!trace.Hit || Math.abs(trace.HitPos.z - z) > 24 || (trace.HitNormal && trace.HitNormal.z < 0.7) ||
                (IsValid(trace.Entity) && trace.Entity.IsPlayer())) return false;
        }
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

/** Counter-steer through normal player inputs; never set velocity, position or collision rules. */
export function drive(ply: ZPServerPlayer, target: GLuaVector | undefined, limit: number, duck = false): GLuaVector {
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
        return !util.TraceHull({ start: Vector(pos.x, pos.y, pos.z + 4), endpos: Vector(end.x, end.y, end.z + 4), filter: ply,
            mask: MASK_PLAYERSOLID, mins, maxs }).Hit && supported(ply, pos, end);
    };
    if (safe(vx, vy)) return Vector(vx, vy, 0);
    const brakeScale = Math.min(1, cap / Math.max(1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)));
    const bx = -velocity.x * brakeScale, by = -velocity.y * brakeScale;
    return safe(bx, by) ? Vector(bx, by, 0) : Vector(0, 0, 0);
}
