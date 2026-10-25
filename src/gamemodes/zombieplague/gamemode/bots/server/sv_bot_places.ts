import type { BotPlaceLearning } from "./sv_bot_place_learning";
import type { BotPlaceCatalog, BotPlacePoint } from "./sv_bot_place_catalog";
import type { BotSenses } from "./sv_bot_perception";
import type { ExperienceTrace, Intervention } from "./sv_bot_experience_trace";
const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
export interface BotPlaceIntent { Goal: GLuaVector; Look?: GLuaVector; Duck: boolean; Holding: boolean; Key: string; }
interface Visit { ID: string; Point: BotPlacePoint; Started: number; Observed: number; Position: GLuaVector; Arrived?: number; SafeSince?: number; Until: number; Duck: boolean; Reward: number; Components: Record<string, number>; Danger: number; Escaped: boolean; Found: boolean; Exit: boolean; }
interface PlacesContract { SetProfile(profile: ZPBotProfile): void; Reset(): void; Damage(amount: number, health: number): void; Death(): void; Update(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, now: number): BotPlaceIntent | undefined; }
const humanChance: Record<ZPBotProfile, number> = { aggressive: 20, cooperative: 35, defensive: 65, cautious: 75 };
export class BotPlaces implements PlacesContract {
    SetProfile(profile: ZPBotProfile): void { this.profile = profile; }
    private visit: Visit | undefined;
    private cooldown = new Map<string, number>();
    private nextChoice = 0;
    private nextUrgent = 0;
    private lastHuman: { Position: GLuaVector; Time: number } | undefined;
    private reason: ZPBotPlaceReason = "profile";
    private role: ZPBotRole = "human";
    private executed = false;
    constructor(private catalog: BotPlaceCatalog, private learning: BotPlaceLearning, private owner: number, private profile: ZPBotProfile, private trace?: ExperienceTrace,
        private event?: (this: void, name: string) => void, private requireExecution = false) {}
    ExperienceID(): string { return this.visit?.ID ?? ""; }
    private Reward(visit: Visit, amount: number, component: string): void {
        visit.Reward += amount; visit.Components[component] = (visit.Components[component] ?? 0) + amount;
    }
    private End(now: number, neutral = false, intervention?: Intervention): void {
        const visit = this.visit;
        if (visit) {
            neutral = neutral && visit.Reward === 0;
            this.cooldown.set(visit.Point.Key, now + math.random(35, 65));
            if (this.cooldown.size > 64) { const first = [...this.cooldown.keys()][0]; if (first !== undefined) this.cooldown.delete(first); }
            const before = this.learning.Value(visit.Point.Key);
            if (!neutral) this.learning.Reward(visit.Point.Key, visit.Reward, "outcome", visit.Components);
            const updated = !neutral && visit.Reward !== 0 && learningAllowed();
            this.trace?.Record({ Kind: "finalize", Learner: "place", Experience: visit.ID, State: visit.Point.Key, Action: this.role,
                Outcome: neutral ? intervention ? "superseded" : "interrupted" : visit.Reward > 0 ? "success" : visit.Reward < 0 ? "failure" : "observed",
                Reason: intervention?.Reason ?? (neutral ? "visit_interrupted" : "visit_outcome"),
                ...(intervention ? { Controller: intervention.Controller } : {}), Components: visit.Components, Total: visit.Reward,
                Before: before, After: this.learning.Value(visit.Point.Key), Updated: updated });
            this.nextChoice = Math.max(this.nextChoice, now + math.random(5, 9));
        }
        this.catalog.Release(this.owner); this.visit = undefined;
        this.executed = false;
    }
    Reset(): void { this.End(CurTime(), true); this.lastHuman = undefined; this.nextChoice = CurTime() + this.owner % 5; }
    Executed(goal?: GLuaVector): void { if (this.visit && (!goal || goal.DistToSqr(this.visit.Point.Position) < 1)) this.executed = true; }
    Intervene(intervention?: Intervention): void { this.End(CurTime(), this.visit?.Reward === 0, intervention); this.nextChoice = Math.max(this.nextChoice, CurTime() + 0.5); }
    Damage(amount: number, health: number): void {
        const visit = this.visit; if (!visit || amount <= 0 || (this.requireExecution && !this.executed)) return;
        this.learning.Event(visit.Point.Key, "Damage", amount); this.Reward(visit, -Math.min(1, amount / Math.max(1, health)), "damage");
        visit.Danger = CurTime(); if (amount / Math.max(1, health) >= 0.1) visit.Exit = true;
    }
    Death(): void { if (this.visit && (!this.requireExecution || this.executed)) { this.learning.Event(this.visit.Point.Key, "Deaths"); this.Reward(this.visit, -1, "death"); this.End(CurTime()); } }
    Finish(): void { this.End(CurTime()); }
    Failed(): void { if (this.visit) { this.event?.("Place:unreachable"); this.Reward(this.visit, -0.25, "unreachable"); this.End(CurTime()); } }
    private Protected(ply: ZPServerPlayer, point: GLuaVector, threat: GLuaVector): boolean {
        return util.TraceLine({ start: Vector(threat.x, threat.y, threat.z + 48), endpos: Vector(point.x, point.y, point.z + 48),
            filter: player.GetAll() as ZPServerPlayer[], mask: MASK_SHOT }).Hit;
    }
    Update(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, now: number): BotPlaceIntent | undefined {
        this.role = ply.IsZombie() ? "zombie" : "human";
        if (this.role === "zombie" && senses.Visible && senses.EnemyPosition)
            this.lastHuman = { Position: Vector(senses.EnemyPosition.x, senses.EnemyPosition.y, senses.EnemyPosition.z), Time: now };
        let visit = this.visit;
        if (visit?.Point.SafeID !== undefined && !(_G.ZPBotSafePoints?.Points() ?? []).some(point => point.ID === visit?.Point.SafeID)) {
            this.End(now, true); visit = undefined;
        }
        if (visit) {
            const dt = now - visit.Observed, moved = Math.sqrt(ply.GetPos().DistToSqr(visit.Position));
            if (dt < 0 || dt > 1 || moved > Math.max(100, ply.GetRunSpeed() * dt * 3)) { this.End(now, true); this.nextChoice = now + 8; return; }
        }
        if (visit && (!this.requireExecution || this.executed) && this.role === "zombie" && senses.Visible && senses.EnemyPosition && senses.EnemyPosition.DistToSqr(visit.Point.Position) < 256 * 256 &&
            ply.GetPos().DistToSqr(visit.Point.Position) < 400 * 400 && !visit.Found) {
            visit.Found = true; this.Reward(visit, 0.8, "find"); this.learning.Event(visit.Point.Key, "Finds");
        }
        const eligible = this.role === "human" ? !senses.Visible || action === "defend" || action === "retreat" : !senses.EnemyPosition || action === "retreat";
        const threat = senses.EnemyPosition;
        const closeThreat = threat && ply.GetPos().DistToSqr(threat) < 160 * 160;
        const compromised = visit && closeThreat && threat && (visit.Arrived !== undefined || !this.Protected(ply, visit.Point.Position, threat));
        const exposed = visit?.Arrived !== undefined && threat && senses.Visible && !this.Protected(ply, visit.Point.Position, threat);
        if (!eligible || compromised || exposed || visit?.Exit) { this.End(now); return; }
        if (visit && visit.Arrived === undefined && now - visit.Started > 25) { this.Failed(); return; }
        const urgent = senses.EnemyPosition !== undefined && (action === "retreat" || (this.role === "human" && (senses.RecentDamage || !senses.Visible)));
        if (!visit && (now >= this.nextChoice || (urgent && now >= this.nextUrgent)) && ply.WaterLevel() < 2 && ply.GetMoveType() !== MOVETYPE_LADDER) {
            if (urgent) this.nextUrgent = now + 1;
            this.nextChoice = now + math.random(8, 14);
            const chance = this.role === "human" ? humanChance[this.profile] : this.profile === "aggressive" ? 40 : 30;
            if (!urgent && this.role === "human" && math.random(1, 100) > chance) return;
            const clue = senses.Sound?.Position ?? (this.lastHuman && now - this.lastHuman.Time < 45 ? this.lastHuman.Position : undefined);
            const candidates = this.catalog.Points(ply, physics(ply), now).filter(point => (this.cooldown.get(point.Key) ?? 0) <= now && this.catalog.Available(point, this.role, this.owner, now))
                .map(point => ({ Point: point, Score: (point.SafeID !== undefined ? 0.9 : point.Native ? 0.6 : 0.3) - Math.min(0.4, point.Distance / 4000) + this.learning.Score(point.Key) +
                    (clue && point.Position.DistToSqr(clue) < 400 * 400 ? 0.25 : 0) + math.random(0, 20) / 100 }));
            candidates.sort((a, b) => b.Score - a.Score);
            const choices: { Point: BotPlacePoint; Duck: boolean; Score: number }[] = [];
            for (const candidate of candidates.slice(0, 6)) {
                const point = candidate.Point, valid = this.catalog.Validate(ply, point, this.role === "human"); if (!valid) continue;
                if (senses.EnemyPosition && (point.Position.DistToSqr(senses.EnemyPosition) < 200 * 200 || !this.Protected(ply, point.Position, senses.EnemyPosition))) continue;
                let exposure = 0;
                if (senses.EnemyPosition) {
                    const origin = ply.GetPos(), threat = senses.EnemyPosition;
                    const dx = point.Position.x - origin.x, dy = point.Position.y - origin.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    const along = ((threat.x - origin.x) * dx + (threat.y - origin.y) * dy) / (length * length);
                    const crossing = Vector(origin.x + dx * Math.max(0, Math.min(1, along)), origin.y + dy * Math.max(0, Math.min(1, along)), origin.z);
                    if (crossing.DistToSqr(threat) < 160 * 160) continue;
                    // This coarse route-exposure estimate is rechecked by actual route feasibility in the navigator.
                    for (const fraction of [0.33, 0.66]) if (!this.Protected(ply, Vector(origin.x + dx * fraction, origin.y + dy * fraction, origin.z), threat)) exposure += 0.2;
                }
                choices.push({ Point: point, Duck: valid.Duck, Score: candidate.Score + valid.Cover * 0.1 - exposure });
            }
            choices.sort((a, b) => b.Score - a.Score);
            const chosen = choices[urgent ? 0 : math.random(1, Math.min(3, Math.max(1, choices.length))) - 1];
            if (!chosen) return;
            this.reason = clue && chosen.Point.Position.DistToSqr(clue) < 400 * 400 ? "clue" : this.learning.Score(chosen.Point.Key) > 0.05 ? "learned" : "profile";
            visit = { ID: this.trace?.NewID("place") ?? "place:" + this.owner + ":" + now, Point: chosen.Point, Started: now, Observed: now, Position: Vector(ply.GetPos().x, ply.GetPos().y, ply.GetPos().z), Until: 0, Duck: chosen.Duck, Reward: 0, Components: {}, Danger: senses.Visible ? now : -Infinity, Escaped: false, Found: false, Exit: false };
            this.trace?.Record({ Kind: "start", Learner: "place", Experience: visit.ID, State: chosen.Point.Key, Action: this.role, Reason: this.reason });
            this.visit = visit; this.catalog.Reserve(visit.Point, this.role, this.owner, now); this.learning.Event(visit.Point.Key, "Visits");
            this.event?.("Place:" + (this.role === "human" ? "shelter" : action === "retreat" ? "cover" : "investigation") + ":started");
        }
        if (!visit) return;
        if (senses.Visible) visit.Danger = now;
        const arrived = ply.OnGround() && ply.GetPos().DistToSqr(visit.Point.Position) < 40 * 40 && Math.abs(ply.GetPos().z - visit.Point.Position.z) < 24;
        if (arrived && visit.Arrived === undefined) {
            visit.Arrived = now; visit.Until = now + (this.role === "human" ? math.random(6, 14) : math.random(2, 4));
            this.trace?.Record({ Kind: "marker", Learner: "place", Experience: visit.ID, Reason: "place_arrived", Duration: now - visit.Started });
            this.event?.("Place:arrived");
        }
        if (visit.Arrived !== undefined) {
            if (!arrived) { this.End(now); return; }
            if (now - visit.Observed <= 1) this.learning.Event(visit.Point.Key, "Seconds", Math.max(0, now - Math.max(visit.Arrived, visit.Observed)));
            const safe = !senses.Visible && !senses.RecentDamage && now - visit.Danger >= 2 && senses.EnemyPosition &&
                ply.GetPos().DistToSqr(senses.EnemyPosition) > 320 * 320 && this.Protected(ply, visit.Point.Position, senses.EnemyPosition);
            if (safe) visit.SafeSince ??= now; else delete visit.SafeSince;
            if ((!this.requireExecution || this.executed) && this.role === "human" && !visit.Escaped && visit.SafeSince !== undefined && now - visit.SafeSince >= 3) {
                visit.Escaped = true; this.Reward(visit, 0.6, "escape"); this.learning.Event(visit.Point.Key, "Escapes");
                this.event?.("Place:confirmed_escape");
            }
            if (now >= visit.Until) {
                if (this.role === "zombie" && !visit.Found) { this.Reward(visit, -0.15, "empty"); this.learning.Event(visit.Point.Key, "Empty"); }
                this.End(now); return;
            }
        }
        const output: BotPlaceIntent = { Goal: visit.Point.Position, Duck: visit.Duck, Holding: visit.Arrived !== undefined, Key: visit.Point.Key };
        visit.Observed = now;
        visit.Position = Vector(ply.GetPos().x, ply.GetPos().y, ply.GetPos().z);
        if (output.Holding) {
            const exits = visit.Point.Area.GetAdjacentAreas().filter(area => area.IsValid() && !area.IsBlocked(-2));
            const facing = exits[(Math.floor(now / 2) + this.owner) % Math.max(1, exits.length)]?.GetCenter() ?? Vector(visit.Point.Position.x + 160, visit.Point.Position.y, visit.Point.Position.z);
            output.Look = Vector(facing.x, facing.y, ply.EyePos().z);
        }
        return output;
    }
    Diagnostic(now: number): ZPBotPlaceDiagnostic {
        const visit = this.visit;
        return { ...this.learning.Totals(), State: !visit ? "patrol" : this.role === "human" ? visit.Arrived === undefined ? "shelter" : "guard" : visit.Arrived === undefined ? "hunt" : "inspect",
            Reason: this.reason, Point: visit ? [visit.Point.Position.x, visit.Point.Position.y, visit.Point.Position.z] : [],
            Value: visit ? this.learning.Value(visit.Point.Key) : 0, Hold: visit?.Arrived === undefined ? 0 : Math.max(0, visit.Until - now) };
    }
}
