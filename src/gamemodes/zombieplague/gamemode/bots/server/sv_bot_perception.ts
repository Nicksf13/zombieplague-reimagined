export interface BotSenses {
    Target?: ZPServerPlayer; EnemyPosition?: GLuaVector; AimPosition?: GLuaVector;
    AllyPosition?: GLuaVector; Visible: boolean; Allies: number; Enemies: number;
}
export function role(ply: ZPServerPlayer): ZPBotRole | undefined {
    return ply.IsHuman() ? "human" : ply.IsZombie() ? "zombie" : undefined;
}
export function enemy(ply: ZPServerPlayer, target: ZPServerPlayer): boolean {
    return IsValid(target) && target.Alive() && role(target) !== undefined && role(ply) !== role(target);
}
export class BotPerception {
    private target: ZPServerPlayer | undefined;
    private lastPosition: GLuaVector | undefined;
    private lastAim: GLuaVector | undefined;
    private lastSeen = 0;
    private ignored = new Map<ZPServerPlayer, number>();
    private ForgetTarget(): void { this.target = undefined; this.lastPosition = undefined; this.lastAim = undefined; this.lastSeen = 0; }
    Reset(): void { this.ForgetTarget(); this.ignored.clear(); }
    Ignore(target: ZPServerPlayer, now: number): void { this.ignored.set(target, now + 5); if (this.target === target) this.ForgetTarget(); }

    Observe(ply: ZPServerPlayer, participants: ZPServerPlayer[], now: number, followingRoute = false): BotSenses {
        const result: BotSenses = { Visible: false, Allies: 0, Enemies: 0 };
        const origin = ply.EyePos(), forward = ply.GetAimVector();
        let nearestEnemy = Infinity, nearestAlly = Infinity;
        for (const [target, until] of this.ignored) if (now >= until || !IsValid(target)) this.ignored.delete(target);
        for (const other of participants) {
            if (other === ply || !IsValid(other) || !other.Alive() || role(other) === undefined) continue;
            if (enemy(ply, other) && this.ignored.has(other)) continue;
            const aim = other.WorldSpaceCenter(), distance = origin.DistToSqr(aim);
            if (distance > 1800 * 1800) continue;
            const dot = (aim.x - origin.x) * forward.x + (aim.y - origin.y) * forward.y + (aim.z - origin.z) * forward.z;
            if (distance > 120 * 120 && dot < Math.sqrt(distance) * -0.15) continue;
            const trace = util.TraceLine({ start: origin, endpos: aim, filter: ply, mask: MASK_SHOT });
            if (trace.Hit && trace.Entity !== other) continue;
            if (enemy(ply, other)) {
                result.Enemies++;
                if (distance >= nearestEnemy) continue;
                nearestEnemy = distance; this.target = other;
                const position = other.GetPos();
                this.lastPosition = Vector(position.x, position.y, position.z);
                this.lastAim = Vector(aim.x, aim.y, aim.z); this.lastSeen = now;
                result.Visible = true;
            }
            else {
                if (distance < 600 * 600) result.Allies++;
                if (distance < nearestAlly) { nearestAlly = distance; result.AllyPosition = other.GetPos(); }
            }
        }
        // Pursuit keeps the last observed position long enough to follow a detour.
        // Hidden movement never updates that remembered destination.
        if (this.target && enemy(ply, this.target) && now - this.lastSeen <= (followingRoute ? 20 : 3)) {
            result.Target = this.target;
            if (this.lastPosition) result.EnemyPosition = this.lastPosition;
            if (this.lastAim) result.AimPosition = this.lastAim;
        }
        else this.ForgetTarget();
        return result;
    }
}
