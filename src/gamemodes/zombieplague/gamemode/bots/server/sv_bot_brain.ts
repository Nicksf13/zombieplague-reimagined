import type { BotBehaviorLearner as BehaviorLearnerType, BehaviorWeight } from "./sv_bot_behavior";
import type { ExperienceEnd, ExperienceTrace, Intervention } from "./sv_bot_experience_trace";
const { learningAllowed } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { BotBehaviorLearner, profiles, actions, isProfile, context } = include("sv_bot_behavior.lua") as typeof import("./sv_bot_behavior");
export { profiles, actions, isProfile, context };
const advanceHealth = 0.65;
const healthyZombie = (situation: ZPBotSituation): boolean => situation.Role === "zombie" && situation.Health >= advanceHealth;
interface RetreatAttempt { Seen: number; Observed: number; FirstHit?: number; LastHit?: number; }
interface Episode {
    ID: string; Components: Record<string, number>; Intervention?: Intervention; Executed?: boolean;
    Context: string; Role: ZPBotRole; Profile: ZPBotProfile; LearnBehavior: boolean; Action: ZPBotAction; Reward: number; Started: number;
    Retreat?: RetreatAttempt;
    Health: number; SevereFailure?: boolean;
}
// A small contextual bandit changes tactical preferences, never aim, damage or class stats.
export class BotBrain {
    private episode: Episode | undefined;
    private retreatBlockedUntil = 0;
    private observed = 0;
    private changed = false;
    private reason: ZPBotReason = "profile";
    private decision: ZPBotDecision | undefined;
    private behaviors: BehaviorLearnerType;
    private profile: ZPBotProfile;
    private sequence = 0;
    constructor(private memory: ZPBotMemory, private outcome?: (this: void, action: ZPBotAction, reward: number) => void,
        private rewardObserver?: (this: void, component: string, amount: number) => void, private trace?: ExperienceTrace, private requireExecution = false) {
        this.behaviors = new BotBehaviorLearner(memory);
        this.profile = memory.Profile;
    }
    ActiveProfile(): ZPBotProfile { return this.profile; }
    ExperienceID(): string { return this.episode?.ID ?? ""; }
    Executed(decision: string): void { if (this.episode?.ID === decision) this.episode.Executed = true; }
    Intervene(intervention: Intervention, decision = this.ExperienceID()): void {
        if (!intervention.Tactical || !this.episode || decision !== this.episode.ID) return;
        this.episode.Intervention ??= intervention;
    }
    BehaviorWeights(situation: ZPBotSituation): Record<ZPBotProfile, BehaviorWeight> { return this.behaviors.Weights(situation); }
    Reason(): ZPBotReason { return this.reason; }
    Decision(): ZPBotDecision | undefined { return ZPBotMetricsProtocol.Decision(this.decision); }

    GetMemory(): ZPBotMemory { return { ...this.memory, Experience: { ...this.memory.Experience } }; }
    IsDirty(): boolean { return this.changed; }
    Saved(): void { this.changed = false; }
    Samples(): number {
        let total = 0;
        for (const [, estimate] of pairs(this.memory.Experience)) total += estimate?.Samples ?? 0;
        return total;
    }

    Evaluate(situation: ZPBotSituation, action: ZPBotAction): ZPBotScore {
        const score: ZPBotScore = { Profile: 0, Health: 0, Threat: 0, Distance: 0, Cohesion: 0, Learned: 0, Total: 0, Samples: 0, Eligible: true };
        if (action === "group" && !situation.HasAlly) { score.Cohesion = -100; score.Total = -100; score.Eligible = false; return score; }
        if (action === "retreat" && situation.Role === "zombie" && (this.observed < this.retreatBlockedUntil || healthyZombie(situation))) {
            score.Threat = -100; score.Total = -100; score.Eligible = false; return score;
        }
        const profile = this.profile, zombie = situation.Role === "zombie";
        const low = situation.Health < 0.35, outnumbered = situation.Enemies > situation.Allies + 1;
        const advancing = healthyZombie(situation);
        score.Profile = action === "attack" ? (zombie ? 0.6 : 0.3) : action === "defend" ? (zombie ? 0.1 : 0.45) : 0.05;
        if (action === "attack") {
            score.Profile += profile === "aggressive" ? 0.35 : 0;
            if (zombie && situation.Distance > 250 && !outnumbered) score.Distance += 0.4;
            if (!zombie && situation.Distance > 650) score.Distance += 0.2;
            if (low) score.Health -= 0.35;
            if (advancing) score.Health += 0.3;
        }
        if (action === "defend") {
            if (profile === "defensive") score.Profile += 0.35;
            if (!zombie && situation.Distance < 650) score.Distance += 0.15;
        }
        if (action === "retreat") {
            if (advancing) score.Health -= 0.9;
            if (low) score.Health += 0.8;
            if (outnumbered) score.Threat += advancing ? 0.15 : 0.45;
            // Attribute combined predicates to their first matching signal, preserving the rule's total.
            if (profile === "cautious") {
                if (low) score.Health += 0.4;
                else if (outnumbered) score.Threat += advancing ? 0.15 : 0.4;
                else if (situation.Distance < 250 && !advancing) score.Distance += 0.4;
            }
        }
        if (action === "group") {
            if (profile === "cooperative") score.Profile += 0.7;
            if (outnumbered) score.Threat += 0.35;
            else if (low) score.Health += 0.35;
            // Once together, the group must advance or fight instead of waiting forever.
            if (situation.Allies > 0 && !low && !outnumbered) score.Cohesion -= 0.5;
        }
        const estimate = this.memory.Experience[context(situation) + ":" + action];
        const personality = ((this.memory.ID * 17 + actions.indexOf(action) * 11) % 19 - 9) / 100;
        score.Profile += personality;
        score.Learned = (estimate?.Value ?? 0) * 0.65;
        score.Samples = estimate?.Samples ?? 0;
        score.Total = score.Profile + score.Health + score.Threat + score.Distance + score.Cohesion + score.Learned;
        return score;
    }
    Score(situation: ZPBotSituation, action: ZPBotAction): number { return this.Evaluate(situation, action).Total; }

    private Inspect(situation: ZPBotSituation, held: boolean, age: number, scores?: Record<ZPBotAction, ZPBotScore>): void {
        this.decision = { Health: Math.max(0, Math.min(1, situation.Health)), Distance: Math.min(1e12, situation.Distance),
            Allies: situation.Allies, Enemies: situation.Enemies, HasAlly: situation.HasAlly, Held: held, Age: age,
            Scores: scores ?? { attack: this.Evaluate(situation, "attack"), defend: this.Evaluate(situation, "defend"),
                retreat: this.Evaluate(situation, "retreat"), group: this.Evaluate(situation, "group") } };
    }

    Decide(situation: ZPBotSituation, now: number): ZPBotAction {
        this.observed = now;
        const key = context(situation);
        const retreat = this.episode;
        if (retreat?.Retreat) {
            if (healthyZombie(situation) || situation.Role !== "zombie") this.Finish();
            else if (this.ContinueRetreat(true, now, situation.Health)) {
                this.Inspect(situation, true, now - retreat.Started); return "retreat";
            }
        }
        // Keep a decision briefly to avoid oscillating between attack and flight every tick.
        if (this.episode && this.episode.Context === key && now - this.episode.Started < 2 &&
            (this.episode.Action !== "group" || situation.HasAlly) && (this.episode.Action !== "retreat" || !healthyZombie(situation))) {
            this.Inspect(situation, true, now - this.episode.Started); return this.episode.Action;
        }
        this.Finish();
        // Use one exploration budget: test either another profile or another action.
        const exploring = learningAllowed() && situation.Health >= 0.35 && math.random(1, 100) <= 8;
        const exploreProfile = exploring && math.random(1, 2) === 1;
        const behavior = this.behaviors.Choose(situation, exploreProfile);
        this.profile = behavior.Profile;
        const scores = { attack: this.Evaluate(situation, "attack"), defend: this.Evaluate(situation, "defend"),
            retreat: this.Evaluate(situation, "retreat"), group: this.Evaluate(situation, "group") };
        let best: ZPBotAction = "attack";
        for (const action of actions)
            if (scores[action].Eligible && scores[action].Total > scores[best].Total) best = action;
        this.reason = behavior.Reason === "profile" && this.memory.Experience[key + ":" + best] ? "learned" : behavior.Reason;
        if (exploring && !exploreProfile) {
            const possible = actions.filter(action => scores[action].Eligible && (action !== "retreat" || !healthyZombie(situation)));
            best = possible[math.random(1, possible.length) - 1] ?? best;
            this.reason = "explore";
        }
        this.episode = { ID: this.trace?.NewID("tactical") ?? this.memory.ID + ":tactical:" + ++this.sequence, Components: {},
            Context: key, Role: situation.Role, Profile: this.profile, LearnBehavior: !exploring || exploreProfile, Action: best, Reward: 0, Started: now, Health: Math.max(0, Math.min(1, situation.Health)) };
        this.trace?.Record({ Kind: "start", Learner: "tactical", Experience: this.episode.ID, State: key, Action: best, Reason: this.reason });
        if (situation.Role === "zombie" && best === "retreat") this.episode.Retreat = { Seen: now, Observed: now };
        this.Inspect(situation, false, 0, scores);
        return best;
    }

    Reward(amount: number, component = "external"): void {
        if (this.requireExecution && !this.episode?.Executed) {
            this.trace?.Record({ Kind: "unattributed", Learner: "tactical", Experience: this.ExperienceID(),
                Reason: this.episode ? "no_issued_tactical_execution" : "no_active_tactical_experience", Components: { [component]: amount }, Total: amount, Updated: false });
            return;
        }
        if (this.episode) {
            const previous = this.episode.Reward;
            this.episode.Reward = Math.max(-2, Math.min(2, this.episode.Reward + amount));
            this.episode.Components[component] = (this.episode.Components[component] ?? 0) + amount;
            const clamp = this.episode.Reward - previous - amount;
            if (clamp !== 0) this.episode.Components.clamp = (this.episode.Components.clamp ?? 0) + clamp;
            this.rewardObserver?.(component, this.episode.Reward - previous);
        }
    }
    DamageTaken(damage: number, maxHealth: number, humanAttacker = false, now = CurTime()): void {
        if (!this.episode || damage <= 0 || damage !== damage) return;
        const withdrawing = this.episode.Role === "zombie" && this.episode.Action === "retreat";
        // Keep failed retreats meaningful for high-HP zombies without depending on pellet/event counts.
        const reference = Math.max(1, withdrawing ? Math.min(maxHealth, 1000) : maxHealth);
        this.Reward(-Math.min(1, damage / reference * (withdrawing ? 2 : 1)), "damage_taken");
        const attempt = this.episode.Retreat;
        if (attempt && humanAttacker) {
            // Measure sustained fire by elapsed time, not bullet or shotgun pellet count.
            if (attempt.LastHit === undefined || now - attempt.LastHit > 1.5) attempt.FirstHit = now;
            attempt.LastHit = now;
        }
    }
    Escaped(): void {
        if (this.episode?.Action === "retreat" && this.episode.Role === "human") this.Reward(0.15, "escape");
    }
    ContinueRetreat(visible: boolean, now: number, health?: number): boolean {
        this.observed = now;
        const episode = this.episode, attempt = episode?.Retreat;
        if (!episode || !attempt) return false;
        if (health !== undefined && health >= advanceHealth) { this.Finish(); return false; }
        // An unobserved pause cannot establish that an escape worked.
        if (now - attempt.Observed > 0.75 || now < attempt.Observed) { this.Finish(); return false; }
        attempt.Observed = now;
        if (visible) attempt.Seen = now;
        const underFire = attempt.FirstHit !== undefined && attempt.LastHit !== undefined &&
            attempt.LastHit - attempt.FirstHit >= 2 && now - attempt.LastHit <= 1.5;
        if (!underFire && !visible && now - Math.max(attempt.Seen, attempt.LastHit ?? episode.Started) >= 3) {
            this.Reward(0.15, "escape"); this.Finish(); return false;
        }
        if (underFire || now - episode.Started >= 8) {
            this.FailRetreat(now); this.Finish(); return false;
        }
        return true;
    }
    Reset(reason = "reset"): void { this.Finish(reason, "interrupted"); this.retreatBlockedUntil = 0; }
    private FailRetreat(now: number): void {
        const episode = this.episode; if (!episode?.Retreat) return;
        episode.SevereFailure = episode.Health >= 0.35;
        this.Reward(-(0.6 + episode.Health * 1.4), "retreat_failure");
        this.retreatBlockedUntil = now + (episode.SevereFailure ? 12 : 6);
    }
    Death(): void {
        this.Reward(-1, "death"); this.FailRetreat(CurTime()); this.Finish("death", "failure");
    }
    Finish(reason = "episode_complete", end: ExperienceEnd = "observed"): void {
        const episode = this.episode;
        this.episode = undefined;
        this.decision = undefined;
        if (!episode) return;
        const key = episode.Context + ":" + episode.Action, previous = this.memory.Experience[key];
        const before = previous?.Value ?? 0, valid = episode.Intervention === undefined && episode.Reward !== 0;
        let after = before;
        if (valid) this.outcome?.(episode.Action, episode.Reward);
        if (valid && learningAllowed()) {
            // A forced action or intervention cannot establish the profile's policy outcome.
            const profileBefore = this.memory.Behaviors?.[episode.Context]?.[episode.Profile]?.Value ?? 0;
            if (episode.LearnBehavior) {
                this.behaviors.Observe(episode.Context, episode.Profile, episode.Reward);
                this.trace?.Record({ Kind: "update", Learner: "profile", Experience: episode.ID, Decision: episode.ID,
                    State: episode.Context, Action: episode.Profile, Reason: "profile_outcome", Total: episode.Reward,
                    Before: profileBefore, After: this.memory.Behaviors?.[episode.Context]?.[episode.Profile]?.Value ?? 0, Updated: true });
            }
            after += (episode.SevereFailure ? 0.6 : 0.2) * (Math.max(-1, Math.min(1, episode.Reward)) - before);
            this.memory.Experience[key] = { Value: after, Samples: Math.min(10000, (previous?.Samples ?? 0) + 1) }; this.changed = true;
        }
        this.trace?.Record({ Kind: "finalize", Learner: "tactical", Experience: episode.ID, State: episode.Context, Action: episode.Action,
            Executed: episode.Executed === true, ProfileEligible: episode.LearnBehavior && episode.Intervention === undefined,
            Outcome: episode.Intervention ? "superseded" : end, Reason: episode.Intervention?.Reason ?? (this.requireExecution && !episode.Executed ? "no_issued_tactical_execution" : reason),
            ...(episode.Intervention ? { Controller: episode.Intervention.Controller } : {}), Duration: Math.max(0, CurTime() - episode.Started),
            Components: episode.Components, Total: episode.Reward, Before: before, After: after, Updated: valid && learningAllowed() });
        if (valid && learningAllowed()) this.trace?.Record({ Kind: "update", Learner: "tactical", Experience: episode.ID,
            State: episode.Context, Action: episode.Action, Reason: "outcome_applied_once", Before: before, After: after, Updated: true });
    }
}
