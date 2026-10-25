import type { BotSteering } from "./sv_bot_navigation";
const { supported, walkingTrace } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");
const { options } = include("sv_bot_motion_actions.lua") as typeof import("./sv_bot_motion_actions");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
/** Target is the immediate movement target or blocked waypoint, rather than the final pursuit goal. */
export interface TrafficPeer { Player: ZPServerPlayer; ID: number; Target: GLuaVector | undefined; Busy: boolean; }
interface Passage {
    Passer: ZPServerPlayer; Yielder: ZPServerPlayer; Started: number; Origin: GLuaVector;
    X: number; Y: number; Points: GLuaVector[]; Ready: boolean;
    ProgressAt: number; PasserPosition: GLuaVector; YielderPosition: GLuaVector;
}
export interface TrafficDiagnostic { Passer: number; Yielder: number; Ready: boolean; Seconds: number; Idle: number; Parking: number[]; }
interface TrafficContract {
    Remove(ply: ZPServerPlayer): void;
    Request(ply: ZPServerPlayer, steering: BotSteering, peers: TrafficPeer[], now: number): void;
    Control(ply: ZPServerPlayer, now: number): BotSteering | undefined;
    Diagnostic(ply: ZPServerPlayer, now: number): TrafficDiagnostic | undefined;
}
const wait = (): BotSteering => ({ Jump: false, Duck: false, Use: false, Stuck: false, Precision: true });
export class BotTrafficManager implements TrafficContract {
    private passages = new Map<ZPServerPlayer, Passage>();
    private retry = new Map<ZPServerPlayer, number>();
    Diagnostic(ply: ZPServerPlayer, now: number): TrafficDiagnostic | undefined {
        const passage = this.passages.get(ply); if (!passage) return;
        if (!IsValid(passage.Passer) || !IsValid(passage.Yielder)) return;
        const target = passage.Points[0];
        return { Passer: passage.Passer.EntIndex(), Yielder: passage.Yielder.EntIndex(), Ready: passage.Ready,
            Seconds: Math.max(0, now - passage.Started), Idle: Math.max(0, now - passage.ProgressAt),
            Parking: target ? [target.x, target.y, target.z] : [] };
    }
    Remove(ply: ZPServerPlayer): void {
        const passage = this.passages.get(ply);
        if (passage) { this.passages.delete(passage.Passer); this.passages.delete(passage.Yielder); }
        this.retry.delete(ply);
    }
    private Available(ply: ZPServerPlayer): boolean { return IsValid(ply) && ply.Alive() && !ply.IsFrozen() && ply.OnGround() && ply.WaterLevel() < 2 && ply.GetMoveType() !== MOVETYPE_LADDER; }
    private Parking(ply: ZPServerPlayer, x: number, y: number): GLuaVector[] | undefined {
        const pos = ply.GetPos(), state = physics(ply), [mins, maxs] = ply.GetHull(), margin = state.Width + 12;
        const clear = (from: GLuaVector, to: GLuaVector): boolean => supported(ply, from, to) &&
            !walkingTrace(ply, Vector(from.x, from.y, from.z + 4), Vector(to.x, to.y, to.z + 4), mins, maxs).Hit;
        // Reach a wider section before stepping sideways; never sidestep off a beam.
        for (const back of [0, 32, 64, 96, 128]) {
            const approach = Vector(pos.x + x * back, pos.y + y * back, pos.z);
            if (!clear(pos, approach)) continue;
            for (const side of [1, -1]) {
                const park = Vector(approach.x - y * margin * side, approach.y + x * margin * side, pos.z);
                if (clear(approach, park)) return back > 0 ? [approach, park] : [park];
            }
        }
    }
    Request(ply: ZPServerPlayer, steering: BotSteering, peers: TrafficPeer[], now: number): void {
        const blocker = steering.Blocker;
        if (!blocker || steering.Position || steering.Pick || this.passages.has(ply) || this.passages.has(blocker) || now < (this.retry.get(ply) ?? 0) ||
            !this.Available(ply) || !this.Available(blocker) || ply.Team() !== blocker.Team() || ply.GetPos().DistToSqr(blocker.GetPos()) > 160 * 160) return;
        const requester = peers.find(peer => peer.Player === ply), other = peers.find(peer => peer.Player === blocker);
        if (!requester || !other || requester.Busy || other.Busy) return;
        this.retry.set(ply, now + 1);
        const a = ply.GetPos(), b = blocker.GetPos(), dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const otherTarget = other.Target;
        const toward = otherTarget ? (otherTarget.x - b.x) * dx + (otherTarget.y - b.y) * dy : 0;
        if (otherTarget && toward > 4) return; // A following bot waits for the leader instead of pushing it backwards.
        const opposite = otherTarget && toward < -4;
        const passer = opposite && other.ID < requester.ID ? blocker : ply, yielder = passer === ply ? blocker : ply;
        const x = passer === ply ? dx / distance : -dx / distance, y = passer === ply ? dy / distance : -dy / distance;
        const points = this.Parking(yielder, x, y); if (!points) return;
        const origin = yielder.GetPos(), passerPosition = passer.GetPos();
        const passage: Passage = { Passer: passer, Yielder: yielder, Started: now, Origin: Vector(origin.x, origin.y, origin.z), X: x, Y: y, Points: points, Ready: false,
            ProgressAt: now, PasserPosition: Vector(passerPosition.x, passerPosition.y, passerPosition.z), YielderPosition: Vector(origin.x, origin.y, origin.z) };
        this.passages.set(passer, passage); this.passages.set(yielder, passage);
    }
    Control(ply: ZPServerPlayer, now: number): BotSteering | undefined {
        const passage = this.passages.get(ply); if (!passage) return;
        const a = passage.Passer, b = passage.Yielder;
        if (!this.Available(a) || !this.Available(b)) { this.Remove(ply); return; }
        const pos = a.GetPos();
        const otherPosition = b.GetPos();
        if (pos.DistToSqr(passage.PasserPosition) > 16 || otherPosition.DistToSqr(passage.YielderPosition) > 16) {
            passage.ProgressAt = now;
            passage.PasserPosition = Vector(pos.x, pos.y, pos.z);
            passage.YielderPosition = Vector(otherPosition.x, otherPosition.y, otherPosition.z);
        }
        // A failed parking maneuver must release both bots before the absolute lease timeout.
        if (now - passage.ProgressAt > 3 || now - passage.Started > 12) {
            this.Remove(ply); this.retry.set(a, now + 2); this.retry.set(b, now + 2); return;
        }
        if (a.Team() !== b.Team() ||
            (pos.x - b.GetPos().x) * passage.X + (pos.y - b.GetPos().y) * passage.Y > physics(a).Width + 16) {
            this.Remove(ply); return;
        }
        if (ply === a) return passage.Ready ? undefined : wait();
        const position = ply.GetPos();
        while (passage.Points[0] && position.DistToSqr(passage.Points[0]) < 16) passage.Points.shift();
        const target = passage.Points[0];
        if (!target) { passage.Ready = true; return wait(); }
        const surface = options(ply, target, physics(ply), false, false, false, false, undefined, false, 48);
        const pick = surface.Options[0];
        return pick ? { ...wait(), Position: pick.Position, Pick: pick, Duck: pick.Duck } : wait();
    }
}
