export interface MotionPhysics { Key: string; Speed: number; Run: number; Jump: number; Gravity: number; Width: number; Height: number; CrouchLift: number; Mode: ZPBotMoveMode; }
export function physics(ply: ZPServerPlayer): MotionPhysics {
    const [mins, maxs] = ply.GetHull(), [duckMin, duckMax] = ply.GetHullDuck();
    const speed = Math.max(1, ply.GetWalkSpeed()), run = Math.max(1, ply.GetRunSpeed()), jump = Math.max(1, ply.GetJumpPower());
    const gravity = Math.max(1, cvars.Number("sv_gravity", 600) * Math.max(0.05, ply.GetAuxGravity()));
    const width = Math.max(maxs.x - mins.x, maxs.y - mins.y), height = maxs.z - mins.z;
    const values = [speed, run, jump, gravity, width, height, duckMax.z - duckMin.z, ply.GetCrouchedWalkSpeed() * 100];
    // Active physics, not just class labels, separates temporary abilities and server settings.
    const key = values.map(value => Math.round(value)).join(".");
    return { Key: key, Speed: speed, Run: run, Jump: jump, Gravity: gravity, Width: width, Height: height,
        CrouchLift: Math.max(0, Math.min(36, height - (duckMax.z - duckMin.z))),
        Mode: ply.GetMoveType() === MOVETYPE_LADDER ? "ladder" : ply.WaterLevel() >= 2 ? "water" : ply.OnGround() ? "ground" : "air" };
}
export function jumpHeight(physics: MotionPhysics): number { return Math.min(256, physics.Jump * physics.Jump / (2 * physics.Gravity) * 0.85); }
/** Conservative candidate reach; only the engine's observed landing confirms a passage. */
export function jumpReach(physics: MotionPhysics): number { return Math.max(48, Math.min(256, jumpHeight(physics) + physics.CrouchLift)); }
