import type { BotSteering } from "./sv_bot_navigation";
interface JumpContract {
    Allow(ply: ZPServerPlayer, steering: BotSteering, now: number): boolean;
    Crouch(ply: ZPServerPlayer, now: number): boolean;
    Issued(steering: BotSteering, keys: number, now: number): void;
    CancelFlight(): void; Reset(): void;
}
/** Launch budget survives plan renewal and route replans. Swimming keeps native held input. */
export class BotJumpControl implements JumpContract {
    private origin: GLuaVector | undefined;
    private attempts = 0;
    private last = -Infinity;
    private blocked = 0;
    private flight: { Started: number; Airborne: boolean } | undefined;
    CancelFlight(): void { this.flight = undefined; }
    Reset(): void { this.origin = undefined; this.attempts = 0; this.last = -Infinity; this.blocked = 0; this.CancelFlight(); }
    Issued(steering: BotSteering, keys: number, now: number): void {
        if (steering.Pick?.Action === "jumpduck" && Math.floor(keys / IN_JUMP) % 2 === 1)
            this.flight = { Started: now, Airborne: false };
    }
    Crouch(ply: ZPServerPlayer, now: number): boolean {
        const flight = this.flight;
        if (!flight) return false;
        if (!ply.Alive() || ply.WaterLevel() >= 2 || ply.GetMoveType() === MOVETYPE_LADDER || now - flight.Started > 2 ||
            (ply.OnGround() && (flight.Airborne || now - flight.Started > 0.2))) { this.CancelFlight(); return false; }
        if (ply.OnGround()) return false;
        flight.Airborne = true;
        return true;
    }
    Allow(ply: ZPServerPlayer, steering: BotSteering, now: number): boolean {
        if (!steering.Jump || ply.WaterLevel() >= 2) return true;
        if (!ply.OnGround()) return false;
        const position = ply.GetPos();
        if (!this.origin || position.DistToSqr(this.origin) > 64 * 64) { this.origin = Vector(position.x, position.y, position.z); this.attempts = 0; this.blocked = 0; }
        if (now < this.blocked || now - this.last < 0.8) return false;
        if (this.attempts >= 2) { this.blocked = now + 3; this.attempts = 0; return false; }
        this.last = now; this.attempts++; return true;
    }
}
