import type { BotSteering } from "./sv_bot_navigation";
const { supported } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");
const { options } = include("sv_bot_motion_actions.lua") as typeof import("./sv_bot_motion_actions");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
export interface TrafficPeer { Player: ZPServerPlayer; ID: number; Target: GLuaVector | undefined; Busy: boolean; }
interface Passage { Passer: ZPServerPlayer; Yielder: ZPServerPlayer; Started: number; Origin: GLuaVector; X: number; Y: number; Points: GLuaVector[]; Ready: boolean; }
interface TrafficContract { Remove(ply: ZPServerPlayer): void; Request(ply: ZPServerPlayer, steering: BotSteering, peers: TrafficPeer[], now: number): void; Control(ply: ZPServerPlayer, now: number): BotSteering | undefined; }
const wait = (): BotSteering => ({ Jump: false, Duck: false, Use: false, Stuck: false, Precision: true });
export class BotTrafficManager implements TrafficContract {
    private passages = new Map<ZPServerPlayer, Passage>();
    private retry = new Map<ZPServerPlayer, number>();
    Remove(ply: ZPServerPlayer): void {
        const passage = this.passages.get(ply);
        if (passage) { this.passages.delete(passage.Passer); this.passages.delete(passage.Yielder); }
        this.retry.delete(ply);
    }
    private Available(ply: ZPServerPlayer): boolean { return IsValid(ply) && ply.Alive() && !ply.IsFrozen() && ply.OnGround() && ply.WaterLevel() < 2 && ply.GetMoveType() !== MOVETYPE_LADDER; }
    private Parking(ply: ZPServerPlayer, x: number, y: number): GLuaVector[] | undefined {
        const pos = ply.GetPos(), state = physics(ply), [mins, maxs] = ply.GetHull(), margin = state.Width + 12;
        const clear = (from: GLuaVector, to: GLuaVector): boolean => supported(ply, from, to) &&
            !util.TraceHull({ start: Vector(from.x, from.y, from.z + 4), endpos: Vector(to.x, to.y, to.z + 4), filter: ply, mask: MASK_PLAYERSOLID, mins, maxs }).Hit;
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
        const origin = yielder.GetPos();
        const passage: Passage = { Passer: passer, Yielder: yielder, Started: now, Origin: Vector(origin.x, origin.y, origin.z), X: x, Y: y, Points: points, Ready: false };
        this.passages.set(passer, passage); this.passages.set(yielder, passage);
    }
    Control(ply: ZPServerPlayer, now: number): BotSteering | undefined {
        const passage = this.passages.get(ply); if (!passage) return;
        const a = passage.Passer, b = passage.Yielder;
        if (!this.Available(a) || !this.Available(b)) { this.Remove(ply); return; }
        const pos = a.GetPos();
        if (a.Team() !== b.Team() || now - passage.Started > 12 ||
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
