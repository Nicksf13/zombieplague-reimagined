import type { BotSteering } from "./sv_bot_navigation";
import type { BotSenses } from "./sv_bot_perception";
export interface BreakableTarget { Entity: GLuaEntity; Aim: GLuaVector; }
export interface BreakableIntent extends BreakableTarget { Steering: BotSteering; }
interface Attempt { Entity: GLuaEntity; Started: number; Progress: number; Health: number; Observed: number; }
interface BreakerContract { Reset(): void; Resolve(ply: ZPServerPlayer, steering: BotSteering, senses: BotSenses, now: number): BreakableIntent | undefined; }
const classes = ["func_breakable", "func_breakable_surf", "prop_physics", "prop_physics_multiplayer", "prop_dynamic"];
export function breakable(entity: GLuaEntity): boolean {
    if (!IsValid(entity) || !classes.includes(entity.GetClass())) return false;
    const health = entity.Health();
    return Number.isFinite(health) && health > 0 && entity.GetInternalVariable("m_takedamage") === 2 &&
        !(entity.GetClass() === "func_breakable" && entity.GetInternalVariable("m_Material") === 7);
}
/** Validate a local physical obstruction again at command time, including intervening players. */
export function visibleSurface(ply: ZPServerPlayer, entity: GLuaEntity): GLuaVector | undefined {
    if (!breakable(entity)) return;
    const eye = ply.EyePos(), nearest = entity.NearestPoint(eye);
    const distance = Math.sqrt(eye.DistToSqr(nearest));
    if (!Number.isFinite(distance) || distance < 1 || distance > 96) return;
    const end = Vector(nearest.x + (nearest.x - eye.x) / distance * 4, nearest.y + (nearest.y - eye.y) / distance * 4,
        nearest.z + (nearest.z - eye.z) / distance * 4);
    const trace = util.TraceLine({ start: eye, endpos: end, filter: ply, mask: MASK_SHOT });
    return trace.Hit && trace.Entity === entity && !trace.StartSolid ? trace.HitPos : undefined;
}
export class BotBreaker implements BreakerContract {
    private attempt: Attempt | undefined;
    private ignored = new Map<GLuaEntity, number>();
    Reset(): void { this.attempt = undefined; this.ignored.clear(); }
    Resolve(ply: ZPServerPlayer, steering: BotSteering, senses: BotSenses, now: number): BreakableIntent | undefined {
        for (const [entity, until] of this.ignored) if (!IsValid(entity) || now >= until) this.ignored.delete(entity);
        const entity = steering.Obstruction;
        if (senses.Visible || senses.RecentDamage || !ply.OnGround() || ply.WaterLevel() >= 2 || !entity ||
            (this.ignored.get(entity) ?? 0) > now) { this.attempt = undefined; return; }
        const aim = visibleSurface(ply, entity);
        if (!aim) { this.attempt = undefined; return; }
        const health = entity.Health();
        if (!this.attempt || this.attempt.Entity !== entity || now < this.attempt.Observed || now - this.attempt.Observed > 1)
            this.attempt = { Entity: entity, Started: now, Progress: now, Health: health, Observed: now };
        const attempt = this.attempt;
        attempt.Observed = now;
        if (health < attempt.Health) { attempt.Progress = now; attempt.Health = health; }
        if (now - attempt.Progress >= 4 || now - attempt.Started >= 20) {
            if (this.ignored.size >= 16) { const first = [...this.ignored.keys()][0]; if (first !== undefined) this.ignored.delete(first); }
            this.ignored.set(entity, now + 20); this.attempt = undefined; return;
        }
        const weapon = ply.GetActiveWeapon(), rawReach = IsValid(weapon) ? weapon.HitDistance : undefined;
        const reach = typeof rawReach === "number" && Number.isFinite(rawReach) ? Math.max(16, Math.min(256, rawReach)) : 40;
        const ranged = ply.IsHuman() && IsValid(weapon) && weapon.GetMaxClip1() > 0;
        const distance = Math.sqrt(ply.EyePos().DistToSqr(aim));
        const result: BotSteering = { Jump: false, Duck: steering.Duck, Use: false, Stuck: false, Controller: "breakable" };
        if (!ranged && distance > reach - 4) {
            const pos = ply.GetPos(), dx = aim.x - pos.x, dy = aim.y - pos.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const advance = Math.min(24, Math.max(0, distance - reach + 4));
            const target = Vector(pos.x + dx / length * advance, pos.y + dy / length * advance, pos.z);
            result.Position = target; result.Precision = true;
            result.Pick = { Action: "forward", Position: target, Jump: false, Duck: steering.Duck, Sprint: false, Preference: 0,
                Keys: 0, Precision: true, SpeedLimit: 80 };
        }
        return { Entity: entity, Aim: Vector(aim.x, aim.y, aim.z), Steering: result };
    }
}
