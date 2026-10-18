import type { BotSteering } from "./sv_bot_navigation";
import type { MoveOption } from "./sv_bot_motion";
export function hold(duck: boolean): BotSteering { return { Jump: false, Duck: duck, Use: false, Stuck: false }; }
export function move(ply: ZPServerPlayer, partner: ZPServerPlayer, target: GLuaVector, jump: boolean, duck: boolean, checkGround = false): BotSteering {
    const position = ply.GetPos(), dx = target.x - position.x, dy = target.y - position.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy)), stride = Math.min(32, length);
    const [standingMin, standingMax] = ply.GetHull(), [duckMin, duckMax] = ply.GetHullDuck();
    const mins = duck || jump ? duckMin : standingMin, maxs = duck || jump ? duckMax : standingMax;
    const crouchLift = Math.min(18, Math.max(0, ((standingMax.z - standingMin.z) - (duckMax.z - duckMin.z)) / 2));
    // Predict the airborne crouch used after takeoff; the engine still executes ordinary input.
    const lift = jump ? ply.GetJumpPower() ** 2 / (2 * Math.max(1, cvars.Number("sv_gravity", 600) * ply.GetAuxGravity())) * 0.9 + crouchLift : 0;
    const ahead = Vector(position.x + dx / length * stride, position.y + dy / length * stride, position.z);
    const trace = util.TraceHull({ start: Vector(position.x, position.y, position.z + lift + 2), endpos: Vector(ahead.x, ahead.y, ahead.z + lift + 2),
        filter: checkGround ? ply : [ply, partner], mask: MASK_PLAYERSOLID, mins, maxs });
    if (trace.Hit) return hold(duck);
    if (checkGround && !util.TraceLine({ start: Vector(ahead.x, ahead.y, ahead.z + 16), endpos: Vector(ahead.x, ahead.y, ahead.z - 24),
        filter: ply, mask: MASK_PLAYERSOLID }).Hit) return hold(duck);
    const pick: MoveOption = { Action: jump ? "jump" : duck ? "duck" : "forward", Position: ahead,
        Jump: jump, Duck: duck, Sprint: false, Preference: 1, Keys: 0, SpeedLimit: Math.min(ply.GetWalkSpeed(), Math.max(20, length / 0.25)) };
    return { Position: ahead, Pick: pick, Jump: jump, Duck: duck, Use: false, Stuck: false };
}
