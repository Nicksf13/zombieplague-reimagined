import type { MoveOption } from "./sv_bot_motion";
import type { MotionPhysics } from "./sv_bot_motion_physics";
import type { BlockedSupport } from "./sv_bot_precision_support";
const { supported, supportedOnHull, walkingTrace } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");
const { jumpHeight } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
export interface BlockedProbe { Start: number[]; End: number[]; Entity: number; Class: string; World: boolean; StartSolid: boolean; }
export interface MotionSurface { Options: MoveOption[]; Dynamic: boolean; Obstacle: boolean; Ground: boolean; Blocker?: ZPServerPlayer; Probe?: BlockedProbe; SupportProbe?: BlockedSupport; }
interface ActionRule { Action: ZPBotMove; Rotation: number; Jump?: boolean; Duck?: boolean; Sprint?: boolean; }
const rules: readonly ActionRule[] = [
    { Action: "forward", Rotation: 0 }, { Action: "back", Rotation: Math.PI }, { Action: "left", Rotation: Math.PI / 2 }, { Action: "right", Rotation: -Math.PI / 2 },
    { Action: "diagonalleft", Rotation: 0.65 }, { Action: "diagonalright", Rotation: -0.65 },
    { Action: "jump", Rotation: 0, Jump: true }, { Action: "jumpleft", Rotation: 0.65, Jump: true }, { Action: "jumpright", Rotation: -0.65, Jump: true },
    { Action: "duck", Rotation: 0, Duck: true }, { Action: "duckleft", Rotation: 0.65, Duck: true }, { Action: "duckright", Rotation: -0.65, Duck: true },
    { Action: "sprint", Rotation: 0, Sprint: true },
    { Action: "jumpduck", Rotation: 0, Jump: true, Duck: true },
];
export function options(ply: ZPServerPlayer, target: GLuaVector, physics: MotionPhysics, recovery: boolean, jumpRequired: boolean,
    duckRequired: boolean, sprintPreferred: boolean, ladderAim?: GLuaVector, controlledDrop = false, precisionSpeed?: number, edgeRecovery = false): MotionSurface {
    const result: MotionSurface = { Options: [], Dynamic: false, Obstacle: false, Ground: false }, position = ply.GetPos();
    const dx = target.x - position.x, dy = target.y - position.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const [mins, maxs] = ply.GetHull(), [duckMins, duckMaxs] = ply.GetHullDuck();
    const water = physics.Mode === "water", climbing = physics.Mode === "ladder";
    const drain = ply.IsHuman() && RunShouldDrain(ply) && cvars.Number("zp_run_drain", 1) > 0;
    const freeSprint = !cvars.Bool("zp_run_should_drain", false) && !cvars.Bool("zp_realistic_mode", false) &&
        physics.Mode === "ground" && length > 64 && !recovery && !jumpRequired && !duckRequired;
    for (const rule of rules) {
        if (precisionSpeed !== undefined && (rule.Rotation !== 0 || rule.Jump || rule.Sprint)) continue;
        // A controlled departure still needs a forward action when the nav area requires crouching.
        if (controlledDrop && rule.Action !== (duckRequired ? "duck" : "forward")) continue;
        if ((climbing || ladderAim) && rule.Action !== "forward") continue;
        if ((rule.Jump || rule.Duck) && !(rule.Jump && physics.Mode === "air") && !recovery && !jumpRequired && !duckRequired && !result.Obstacle) continue;
        if (water && (rule.Duck || rule.Sprint || rule.Jump)) continue;
        if (!recovery && (rule.Action === "back" || rule.Action === "left" || rule.Action === "right")) continue;
        if (rule.Jump && physics.Mode !== "ground" && physics.Mode !== "air") continue;
        if (rule.Jump && physics.Mode === "ground" && !jumpRequired && !result.Obstacle) continue;
        if (rule.Sprint && (physics.Run <= physics.Speed || (drain && ply.GetBreath() < Math.max(10, ply.GetMaxBreath() * 0.2)))) continue;
        if (duckRequired && !rule.Duck && !climbing && !ladderAim) continue;
        const crouchJump = rule.Action === "jumpduck";
        if (crouchJump && (physics.CrouchLift <= 0 || (duckRequired && physics.Mode === "ground"))) continue;
        const x = dx / length * Math.cos(rule.Rotation) - dy / length * Math.sin(rule.Rotation);
        const y = dx / length * Math.sin(rule.Rotation) + dy / length * Math.cos(rule.Rotation);
        const stride = precisionSpeed !== undefined ? Math.min(32, Math.max(4, precisionSpeed * 0.25), length) : rule.Rotation === 0 ? Math.min(48, length) : 48;
        let ahead = Vector(position.x + x * stride, position.y + y * stride, position.z + 4);
        const lift = rule.Jump && physics.Mode === "ground" ? crouchJump ? jumpHeight(physics) + physics.CrouchLift : Math.min(48, jumpHeight(physics)) : 0;
        // Launch standing before tucking in flight; a small hull at the apex alone cannot validate takeoff headroom.
        if (crouchJump && physics.Mode === "ground" && util.TraceHull({ start: Vector(position.x, position.y, position.z + 4),
            endpos: Vector(position.x, position.y, position.z + 4 + jumpHeight(physics)), filter: ply, mask: MASK_PLAYERSOLID, mins, maxs }).Hit) continue;
        const start = Vector(position.x, position.y, position.z + 4 + lift), end = Vector(ahead.x, ahead.y, ahead.z + lift);
        const hullMins = rule.Duck ? duckMins : mins, hullMaxs = rule.Duck ? duckMaxs : maxs;
        const trace = physics.Mode === "ground" && !rule.Jump && !controlledDrop ? walkingTrace(ply, start, end, hullMins, hullMaxs) :
            util.TraceHull({ start, endpos: end, filter: ply, mask: MASK_PLAYERSOLID, mins: hullMins, maxs: hullMaxs });
        const temporary = trace.Hit && IsValid(trace.Entity) && (trace.Entity.IsPlayer() || trace.Entity.GetClass() === "prop_physics" || trace.Entity.GetClass() === "prop_physics_multiplayer");
        if (temporary) result.Dynamic = true;
        if (trace.Hit && IsValid(trace.Entity) && trace.Entity.IsPlayer()) result.Blocker = trace.Entity;
        // A future body collision does not mean that the entire sweep is blocked.
        // Keep a margin before contact; normal hull collision and ground validation still apply.
        const fraction = trace.Fraction;
        const clearance = physics.Mode === "ground" && trace.Hit && temporary && trace.Entity.IsPlayer() && !rule.Jump && !trace.StartSolid && !trace.AllSolid &&
            typeof fraction === "number" && Number.isFinite(fraction) && fraction > 0 && fraction < 1 ? stride * fraction - 2 : 0;
        if (clearance >= 4) ahead = Vector(position.x + x * clearance, position.y + y * clearance, position.z + 4);
        if (trace.Hit && clearance < 4 && (temporary || (!climbing && !ladderAim))) {
            if (rule.Rotation === 0 && !rule.Jump && !rule.Duck) {
                result.Obstacle = true;
                result.Probe = { Start: [position.x, position.y, position.z + 4 + lift], End: [ahead.x, ahead.y, ahead.z + lift],
                    Entity: IsValid(trace.Entity) ? trace.Entity.EntIndex() : 0,
                    Class: trace.HitWorld === true ? "worldspawn" : IsValid(trace.Entity) ? trace.Entity.GetClass() : "unknown",
                    World: trace.HitWorld === true, StartSolid: trace.StartSolid === true };
            }
            continue;
        }
        if (precisionSpeed !== undefined) {
            // The hull sweep covers only a short part of the checkpoint approach.
            // Project its height over that same distance, including shortened player-clearance sweeps.
            const advance = Math.sqrt((ahead.x - position.x) ** 2 + (ahead.y - position.y) ** 2);
            const height = position.z + (target.z - position.z) * Math.min(1, advance / length);
            if (!supported(ply, position, Vector(ahead.x, ahead.y, height), probe => { result.SupportProbe = probe; }) &&
                !(edgeRecovery && supportedOnHull(ply, position, target, target, rule.Duck === true))) { result.Ground = true; continue; }
        }
        else if (!water && !climbing && !ladderAim && !controlledDrop) {
            const drop = physics.Mode === "air" ? Math.min(256, Math.max(80, physics.Jump * physics.Jump / (2 * physics.Gravity) + 24)) : 80;
            const ground = util.TraceLine({ start: Vector(ahead.x, ahead.y, ahead.z + lift + 24), endpos: Vector(ahead.x, ahead.y, ahead.z - drop), filter: ply, mask: MASK_PLAYERSOLID });
            if (!ground.Hit) { result.Ground = true; continue; }
            if (rule.Jump && physics.Mode === "ground" && ground.HitPos.z > position.z + jumpHeight(physics) + (crouchJump ? physics.CrouchLift : 0) + 4) continue;
            if (crouchJump && ((ground.HitNormal && ground.HitNormal.z < 0.7) || (IsValid(ground.Entity) && ground.Entity.IsPlayer()))) continue;
        }
        let preference = rule.Action === "forward" ? 0.4 : rule.Rotation === 0 ? 0.1 : 0.05;
        if (rule.Jump) preference = jumpRequired || result.Obstacle ? 0.6 : -0.2;
        if (rule.Duck) preference = duckRequired || result.Obstacle ? 0.55 : -0.15;
        if (crouchJump) preference = 0.58;
        // On open ground, free running outranks even old walking estimates (+/-0.75).
        // Recovery and specialized traversal keep their existing candidates and priorities.
        if (rule.Sprint) preference = freeSprint && !result.Obstacle && !result.Dynamic ? 2 : sprintPreferred ? 0.5 : 0.25;
        const choice: MoveOption = { Action: rule.Action, Position: ahead, Jump: rule.Jump === true && physics.Mode === "ground",
            Duck: rule.Duck === true && (!crouchJump || physics.Mode === "air"), Sprint: rule.Sprint === true, Preference: preference, Keys: 0 };
        if (choice.Jump) choice.JumpReason = jumpRequired ? "traversal" : "obstacle";
        if (precisionSpeed !== undefined) { choice.Position = target; choice.SpeedLimit = precisionSpeed; choice.Precision = true; }
        if (edgeRecovery) choice.EdgeRecovery = true;
        if (climbing || ladderAim) { choice.Action = "climb"; choice.Aim = ladderAim ?? Vector(target.x, target.y, target.z + 64); choice.Preference = 0.7; choice.Duck = duckRequired; }
        result.Options.push(choice);
    }
    if (water && result.Options.length > 0) {
        const forward = result.Options[0];
        if (forward) result.Options.push({ ...forward, Action: "swim", Jump: true, JumpReason: "swim", Preference: 0.6,
            Aim: Vector(position.x + dx, position.y + dy, Math.max(position.z + 160, target.z + 64)) });
    }
    return result;
}
