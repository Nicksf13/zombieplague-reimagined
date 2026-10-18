import type { BotSteering } from "./sv_bot_navigation";
import type { ExperienceTrace } from "./sv_bot_experience_trace";
const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { BotBoostStore } = include("sv_bot_boost_store.lua") as typeof import("./sv_bot_boost_store");
const geometry = include("sv_bot_boost_geometry.lua") as typeof import("./sv_bot_boost_geometry");
const actions = include("sv_bot_boost_actions.lua") as typeof import("./sv_bot_boost_actions");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const rules = include("sh_bot_boost_rules.lua") as typeof import("../shared/sh_bot_boost_rules");
interface Pair {
    Point: ZPBotBoostPoint; Support: ZPServerPlayer; Climber: ZPServerPlayer; Key: string; SupportKey: string; ClimberKey: string;
    Phase: ZPBotBoostPhase; Started: number; PhaseAt: number; LastJump: number; Issued: boolean; Launched: boolean; Position: Map<ZPServerPlayer, { Point: GLuaVector; Time: number }>;
    Experience: string;
}
export interface BoostControl { Goal: GLuaVector; Token: string; Steering?: BotSteering; }
interface BoostContract { Cancel(ply: ZPServerPlayer): void; Control(ply: ZPServerPlayer, now: number): BoostControl | undefined; Save(): void; }
export class BotBoostManager implements BoostContract {
    constructor(private reward?: (this: void, ply: ZPServerPlayer, component: string, amount: number) => void,
        private trace?: (this: void, ply: ZPServerPlayer) => ExperienceTrace | undefined) {}
    readonly Store = new BotBoostStore();
    private pairs: Pair[] = [];
    private cooldown = new Map<string, number>();
    private nextChoice = new Map<ZPServerPlayer, number>();
    private navigation = util.SHA256(file.Read("maps/" + game.GetMap() + ".nav", "GAME") ?? "missing").substring(0, 64);
    Feedback: ZPBotBoostFeedback = "ready";
    TestFailure: ZPBotBoostIssue | undefined;
    private Scope(ply: ZPServerPlayer): string {
        const definition = ply.IsZombie() ? ply.GetZombieClass() : ply.GetHumanClass();
        return [ply.Team(), definition.ID ?? definition.Name, ply.IsNemesis() ? "nemesis" : ply.IsSurvivor() ? "survivor" : "normal", physics(ply).Key].join(":");
    }
    private Ready(ply: ZPServerPlayer): boolean {
        return IsValid(ply) && ply.Alive() && !ply.IsFrozen() && (ply.IsHuman() || ply.IsZombie()) && ply.WaterLevel() < 2 && ply.GetMoveType() !== MOVETYPE_LADDER;
    }
    private CanMove(): boolean { return cvars.Bool("zp_bot_ai_enabled", true) && !(RoundManager as ZPServerRoundManager).FreezeTimeActive && RoundManager.GetRoundState() === ROUND_PLAYING; }
    private Pair(ply: ZPServerPlayer): Pair | undefined { return this.pairs.find(pair => pair.Support === ply || pair.Climber === ply); }
    Token(ply: ZPServerPlayer): string | undefined { return this.Pair(ply)?.Key; }
    ExperienceID(ply: ZPServerPlayer): string { return this.pairs.find(pair => pair.Climber === ply)?.Experience ?? ""; }
    Sessions(): ZPBotBoostSession[] { return this.pairs.map(pair => ({ Point: pair.Point.ID, Support: pair.Support.EntIndex(), Climber: pair.Climber.EntIndex(), Phase: pair.Phase })); }
    Cancel(ply: ZPServerPlayer): void {
        const pair = this.Pair(ply); if (pair) this.End(pair);
        this.nextChoice.delete(ply);
    }
    Invalidate(id: number): void { for (const pair of [...this.pairs]) if (pair.Point.ID === id) this.End(pair); }
    private End(pair: Pair, success?: boolean): void {
        const before = this.Store.Score(pair.Key);
        this.pairs = this.pairs.filter(item => item !== pair);
        if (this.pairs.length === 0) this.Feedback = "ready";
        if (success !== undefined) {
            if (pair.Issued) { this.Store.Outcome(pair.Point, pair.Key, success); this.reward?.(pair.Climber, success ? "success" : "failure", success ? 1 : -1); }
            this.Feedback = success ? "success" : "failed";
            const key = pair.Support.Team() + ":" + pair.Point.ID;
            if (this.cooldown.size >= 128) { const first = [...this.cooldown.keys()][0]; if (first !== undefined) this.cooldown.delete(first); }
            this.cooldown.set(key, CurTime() + (success ? 5 : 15));
        }
        this.trace?.(pair.Climber)?.Record({ Kind: "finalize", Learner: "boost", Experience: pair.Experience,
            State: pair.Key, Stage: "boost:" + pair.Point.ID, Action: "climb", Executed: pair.Issued,
            Outcome: success === undefined || !pair.Issued ? "interrupted" : success ? "success" : "failure",
            Reason: success === undefined ? "pair_interrupted" : !pair.Issued ? "no_issued_boost" : "boost_outcome",
            Total: success === undefined || !pair.Issued ? 0 : success ? 1 : -1,
            Before: before, After: this.Store.Score(pair.Key), Updated: success !== undefined && pair.Issued && learningAllowed() });
    }
    Start(climber: ZPServerPlayer, goal: GLuaVector, players: ZPServerPlayer[], now: number, selected?: number): boolean {
        if (!this.CanMove() || !this.Ready(climber) || !climber.OnGround() || this.Pair(climber) || this.pairs.length >= 4 || now < (this.nextChoice.get(climber) ?? 0)) return false;
        this.nextChoice.set(climber, now + 2);
        const choices = this.Store.Points().filter(point => (selected === undefined || point.ID === selected) &&
            geometry.vector(point.Base).DistToSqr(climber.GetPos()) < 800 * 800 && now >= (this.cooldown.get(climber.Team() + ":" + point.ID) ?? 0) &&
            !this.pairs.some(pair => pair.Point.ID === point.ID && pair.Climber.Team() === climber.Team()));
        choices.sort((a, b) => geometry.vector(a.Exit).DistToSqr(goal) - geometry.vector(b.Exit).DistToSqr(goal));
        for (const point of choices.slice(0, 4)) {
            const approach = geometry.vector(point.Approach);
            if (!geometry.reachable(climber, approach) || (selected === undefined && !geometry.reachable(climber, goal, geometry.vector(point.Exit)))) {
                if (selected !== undefined) this.TestFailure = rules.issue("path", 3); continue;
            }
            const allies = players.filter(ply => ply !== climber && ply.Team() === climber.Team() && this.Ready(ply) && ply.OnGround() && !this.Pair(ply) && ply.GetPos().DistToSqr(geometry.vector(point.Base)) < 800 * 800);
            allies.sort((a, b) => a.GetPos().DistToSqr(geometry.vector(point.Base)) - b.GetPos().DistToSqr(geometry.vector(point.Base)));
            const feasible = allies.slice(0, 4).filter(support => {
                const invalid = geometry.eligibility(support, climber, point);
                if (invalid) { if (selected !== undefined) this.TestFailure = invalid; return false; }
                if (!geometry.reachable(support, geometry.vector(point.Base))) { if (selected !== undefined) this.TestFailure = rules.issue("path", 2); return false; }
                return true;
            })
                .map(support => {
                    const supportKey = this.Scope(support), climberKey = this.Scope(climber);
                    const key = util.SHA256([this.Store.Definition(point), this.navigation, climberKey, supportKey].join("|")).substring(0, 128);
                    return { Support: support, SupportKey: supportKey, ClimberKey: climberKey, Key: key, Score: this.Store.Score(key) };
                });
            feasible.sort((a, b) => b.Score - a.Score);
            const chosen = feasible[0]; if (!chosen) continue;
            const experience = this.trace?.(climber)?.NewID("boost") ?? "boost:" + chosen.Key + ":" + now;
            this.trace?.(climber)?.Record({ Kind: "start", Learner: "boost", Experience: experience, State: chosen.Key,
                Stage: "boost:" + point.ID, Action: "climb", Reason: "pair_selected" });
            this.pairs.push({ Point: point, Support: chosen.Support, Climber: climber, Key: chosen.Key, SupportKey: chosen.SupportKey, ClimberKey: chosen.ClimberKey,
                Experience: experience,
                Phase: "assemble", Started: now, PhaseAt: now, LastJump: -Infinity, Issued: false, Launched: false, Position: new Map() });
            this.Feedback = "testing"; this.TestFailure = undefined; return true;
        }
        return false;
    }
    Test(id: number, players: ZPServerPlayer[], now: number): boolean {
        this.TestFailure = undefined;
        const fail = (code: ZPBotBoostIssueCode): false => { this.TestFailure = rules.issue(code); this.Feedback = "busy"; return false; };
        if (!cvars.Bool("zp_bot_ai_enabled", true)) return fail("disabled");
        if (RoundManager.GetRoundState() !== ROUND_PLAYING) return fail("round");
        if ((RoundManager as ZPServerRoundManager).FreezeTimeActive) return fail("frozen");
        const point = this.Store.Points().find(item => item.ID === id); if (!point) return fail("selection");
        const invalid = geometry.validate(point); if (invalid) { this.TestFailure = invalid; this.Feedback = "busy"; return false; }
        const nearby = players.filter(ply => ply.IsBot() && this.Ready(ply) && ply.OnGround() && !this.Pair(ply) && ply.GetPos().DistToSqr(geometry.vector(point.Base)) < 800 * 800);
        if (!nearby.some(ply => nearby.some(other => other !== ply && other.Team() === ply.Team()))) return fail("bots");
        const available = nearby.filter(ply => now >= (this.nextChoice.get(ply) ?? 0) && now >= (this.cooldown.get(ply.Team() + ":" + id) ?? 0) && !this.pairs.some(pair => pair.Point.ID === id && pair.Climber.Team() === ply.Team()));
        if (this.pairs.length >= 4 || available.length === 0) return fail("busy");
        this.TestFailure = rules.issue("physics");
        for (const climber of available.slice(0, 64)) if (this.Start(climber, geometry.vector(point.Exit), players, now, id)) return true;
        this.Feedback = "busy"; return false;
    }
    Control(ply: ZPServerPlayer, now: number): BoostControl | undefined {
        const pair = this.Pair(ply); if (!pair) return;
        if (!this.CanMove() || !this.Ready(pair.Support) || !this.Ready(pair.Climber) || pair.Support.Team() !== pair.Climber.Team() ||
            this.Scope(pair.Support) !== pair.SupportKey || this.Scope(pair.Climber) !== pair.ClimberKey) { this.End(pair); return; }
        const previous = pair.Position.get(ply), position = ply.GetPos();
        if (previous && (now - previous.Time > 1 || now < previous.Time || position.DistToSqr(previous.Point) > Math.max(128, ply.GetRunSpeed() * (now - previous.Time) * 3) ** 2)) { this.End(pair); return; }
        pair.Position.set(ply, { Point: Vector(position.x, position.y, position.z), Time: now });
        if (now - pair.Started > 15) { this.End(pair, false); return; }
        const base = geometry.vector(pair.Point.Base), approach = geometry.vector(pair.Point.Approach), exit = geometry.vector(pair.Point.Exit);
        const support = pair.Support, climber = pair.Climber, climbing = ply === climber;
        const supportReady = support.OnGround() && support.GetPos().DistToSqr(base) <= 144;
        const nearApproach = climber.OnGround() && climber.GetPos().DistToSqr(approach) <= 256;
        if (pair.Phase === "assemble" && supportReady && support.Ducking() && nearApproach) { pair.Phase = "mount"; pair.PhaseAt = now; }
        if (pair.Phase === "mount" && climber.OnGround() && climber.GetGroundEntity() === support) { pair.Phase = "jump"; pair.PhaseAt = now; }
        if (pair.Phase === "jump" && pair.Launched && !climber.OnGround()) { pair.Phase = "land"; pair.PhaseAt = now; }
        if (pair.Phase === "jump" && !pair.Launched && !climber.OnGround()) { this.End(pair, false); return; }
        if (pair.Phase === "land" && climber.OnGround()) {
            if (climber.GetGroundEntity() !== support && climber.GetPos().DistToSqr(exit) <= 1024 && Math.abs(climber.GetPos().z - exit.z) <= 12) { this.End(pair, true); return; }
            if (now - pair.PhaseAt > 0.4) { this.End(pair, false); return; }
        }
        if (pair.Phase !== "assemble" && (!supportReady || !geometry.grounded(pair.Point.Exit))) { this.End(pair, false); return; }
        if (!climbing) {
            const precision = support.OnGround() && support.GetPos().DistToSqr(base) <= 48 * 48;
            return { Goal: base, Token: pair.Key, ...(supportReady ? { Steering: actions.hold(true) } : precision ? { Steering: actions.move(support, climber, base, false, true, true) } : {}) };
        }
        if (pair.Phase === "assemble") {
            const precision = climber.OnGround() && climber.GetPos().DistToSqr(approach) <= 48 * 48;
            return { Goal: approach, Token: pair.Key, ...(nearApproach ? { Steering: actions.hold(false) } : precision ? { Steering: actions.move(climber, support, approach, false, false, true) } : {}) };
        }
        const target = pair.Phase === "mount" ? support.GetPos() : exit;
        const jump = climber.OnGround() && now - pair.LastJump >= 0.8;
        if (pair.Phase === "jump" && !jump && climber.OnGround()) return { Goal: target, Token: pair.Key, Steering: actions.hold(false) };
        const duck = !climber.OnGround();
        return { Goal: target, Token: pair.Key, Steering: actions.move(climber, support, target, jump, duck) };
    }
    Input(ply: ZPServerPlayer, keys: number): void {
        const pair = this.Pair(ply);
        if (pair && pair.Climber === ply && Math.floor(keys / IN_JUMP) % 2 === 1) { pair.Issued = true; pair.Launched = pair.Phase === "jump" || pair.Launched; pair.LastJump = CurTime(); }
    }
    Save(): void { this.Store.Save(); }
}
