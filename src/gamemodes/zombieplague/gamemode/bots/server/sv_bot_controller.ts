import type { BotBrain as BrainType } from "./sv_bot_brain";
import type { BotNavigator as NavigatorType } from "./sv_bot_navigation";
import type { BotPerception as PerceptionType, BotSenses } from "./sv_bot_perception";
import type { BotPlan } from "./sv_bot_motor";
import type { BotMetrics as MetricsType } from "./sv_bot_metrics";
import type { BotMotionLearner as MotionType } from "./sv_bot_motion";
import type { BotPlaces as PlacesType } from "./sv_bot_places";
import type { BotDamageGuard as GuardType } from "./sv_bot_damage_guard";
import type { BotExecutionTracker as ExecutionType } from "./sv_bot_execution";
import type { Intervention } from "./sv_bot_experience_trace";
const { profiles } = include("sv_bot_brain.lua") as typeof import("./sv_bot_brain");
const { BotContexts, scopeFor, isProfile } = include("sv_bot_contexts.lua") as typeof import("./sv_bot_contexts");
export { isProfile };
const { BotNavigator } = include("sv_bot_navigation.lua") as typeof import("./sv_bot_navigation");
const { BotPerception, role } = include("sv_bot_perception.lua") as typeof import("./sv_bot_perception");
const motor = include("sv_bot_motor.lua") as typeof import("./sv_bot_motor");
const { BotPlaces } = include("sv_bot_places.lua") as typeof import("./sv_bot_places");
const { BotPlaceCatalog } = include("sv_bot_place_catalog.lua") as typeof import("./sv_bot_place_catalog");
const { BotBoostManager } = include("sv_bot_boost.lua") as typeof import("./sv_bot_boost");
const { BotStatistics } = include("sv_bot_statistics.lua") as typeof import("./sv_bot_statistics");
const { evaluationRequested } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { BotTrafficManager } = include("sv_bot_traffic.lua") as typeof import("./sv_bot_traffic");
const { BotDamageGuard } = include("sv_bot_damage_guard.lua") as typeof import("./sv_bot_damage_guard");
const { BotExperienceTrace } = include("sv_bot_experience_trace.lua") as typeof import("./sv_bot_experience_trace");
const { BotExecutionTracker } = include("sv_bot_execution.lua") as typeof import("./sv_bot_execution");
const { BotDamageEvents, fallDamage } = include("sv_bot_damage_events.lua") as typeof import("./sv_bot_damage_events");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const { BotObjectives } = include("sv_bot_objectives.lua") as typeof import("./sv_bot_objectives");
const { BotHearing } = include("sv_bot_hearing.lua") as typeof import("./sv_bot_hearing");
const { BotJumpControl } = include("sv_bot_jump_control.lua") as typeof import("./sv_bot_jump_control");
const { BotActivity } = include("sv_bot_activity.lua") as typeof import("./sv_bot_activity");
interface ManagedBot {
    RecordingInput?: { Time: number; Gate: string; AttackGate: string; Forward: number; Side: number; Keys: number; Controllers: string[] };
    Player: ZPServerPlayer; Brain: BrainType; Navigation: NavigatorType; Perception: PerceptionType;
    ID: number; Profile: ZPBotProfile; Role: ZPBotRole; Plan?: BotPlan; NextThink: number; Wander?: GLuaVector;
    Scope: ZPBotScope; Metrics: MetricsType; Motion: MotionType;
    Places: PlacesType;
    Policy: string;
    Guard: GuardType;
    Execution: ExecutionType;
    Objectives: InstanceType<typeof BotObjectives>; Jumps: InstanceType<typeof BotJumpControl>; SafeSince?: number;
}

export class BotController implements ZPBotManager {
    readonly Statistics: InstanceType<typeof BotStatistics> = new BotStatistics(ply => {
        const bot = this.Find(ply);
        const position = ply.GetPos();
        return [bot?.ID ?? 0, scopeFor(ply).Role, scopeFor(ply).ClassID, bot?.Policy ?? "external",
            this.Boosts.Store.Version(), ply.Health(), ply.GetMaxHealth(), ply.GetRunSpeed(), ply.GetJumpPower(),
            ply.GetWeapons().map(weapon => weapon.GetClass()).sort().join(","), position.x, position.y, position.z].join(":");
    });
    readonly Trace: InstanceType<typeof BotExperienceTrace> = new BotExperienceTrace(this.Statistics.Session);
    readonly Hearing = new BotHearing();
    readonly Activity = new BotActivity(this.Statistics.Session, this.Statistics.Code);
    private damageEvents = new BotDamageEvents(this.Statistics.Session);
    private statisticsDeaths = new Set<ZPServerPlayer>();
    private evaluation = false;
    private experiment = "";
    private benchmarks = new Map<ZPServerPlayer, GLuaVector>();
    Benchmark(id: number, goal: GLuaVector): boolean {
        const bot = this.bots.find(entry => entry.ID === id);
        if (!evaluationRequested() || !bot || !bot.Player.Alive() || bot.Player.IsFrozen() || (RoundManager as ZPServerRoundManager).FreezeTimeActive ||
            (RoundManager as ZPServerRoundManager).GetPlayersToPlay(true).some(other => other !== bot.Player && other.Alive() && other.Team() !== bot.Player.Team())) return false;
        this.Clear(bot); this.benchmarks.set(bot.Player, goal); return true;
    }
    readonly Boosts: InstanceType<typeof BotBoostManager> = new BotBoostManager((ply, component, amount) => { const bot = this.Find(ply); if (bot) this.Statistics.Reward(bot.ID, "boost", component, amount); },
        ply => { const bot = this.Find(ply); return bot ? this.Trace.Channel(bot.ID, bot.Scope) : undefined; },
        (ply, name) => { const bot = this.Find(ply); if (bot) this.Activity.Event(bot.ID, name); });
    ManagedPlayers(): ZPServerPlayer[] { return this.bots.map(bot => bot.Player); }
    Snapshot(): object[] {
        return this.bots.filter(bot => IsValid(bot.Player)).slice(0, 128).map(bot => {
            const plan = bot.Plan, goal = plan?.Goal, enemy = plan?.Senses.EnemyPosition, steering = plan?.Steering.Position, aim = plan?.Senses.AimPosition;
            const waypoint = plan?.Steering.Waypoint;
            return { ID: bot.ID, Entity: bot.Player.EntIndex(), Scope: { ...bot.Scope }, Policy: bot.Policy,
                NextThink: bot.NextThink, PlanAt: plan?.Updated, ReadyAt: plan?.ReadyAt, Action: plan?.Action,
                Visible: plan?.Senses.Visible, Target: plan?.Senses.Target?.EntIndex(),
                Enemy: enemy ? [enemy.x, enemy.y, enemy.z] : [], Goal: goal ? [goal.x, goal.y, goal.z] : [],
                Steering: steering ? [steering.x, steering.y, steering.z] : [], Aim: aim ? [aim.x, aim.y, aim.z] : [],
                Wait: plan?.Wait === true, Stuck: plan?.Steering.Stuck, Move: plan?.Steering.Pick?.Action,
                Route: bot.Navigation.Status(), Navigation: bot.Navigation.Diagnostic(), Boost: plan?.Boost, Input: bot.RecordingInput,
                BlockedProbe: plan?.Steering.Probe,
                BlockedSupport: plan?.Steering.SupportProbe,
                Waypoint: waypoint ? [waypoint.x, waypoint.y, waypoint.z] : [],
                Traffic: this.traffic.Diagnostic(bot.Player, CurTime()),
                Decision: plan?.DecisionID, Motion: plan?.MotionID, Stage: plan?.StageID };
        });
    }
    MarkTrace(id: number, label: string): void {
        const bot = this.bots.find(entry => entry.ID === id); if (!bot) return;
        const trace = this.Trace.Channel(id, bot.Scope), tactical = bot.Brain.ExperienceID(), place = bot.Places.ExperienceID(), boost = this.Boosts.ExperienceID(bot.Player);
        trace.Record({ Kind: "marker", Learner: "motion", Experience: trace.NewID("marker"), Reason: label,
            Open: { Tactical: tactical !== "" ? [tactical] : [], Motion: bot.Motion.PendingExperiences(),
                Place: place !== "" ? [place] : [], Boost: boost !== "" ? [boost] : [] } });
    }
    private bots: ManagedBot[] = [];
    private contexts = new BotContexts((id, system, component, amount) => this.Statistics.Reward(id, system, component, amount), (id, scope) => this.Trace.Channel(id, scope), true);
    private placeCatalog = new BotPlaceCatalog();
    private cursor = 0;
    private traffic = new BotTrafficManager();
    Available(): number { return 64 - this.bots.length; }
    Attach(ply: ZPServerPlayer, requested?: ZPBotProfile): void {
        if (!IsValid(ply) || !ply.IsBot() || ply.ZPIdleTestBot || this.Find(ply) || this.Available() <= 0) return;
        let id = 1;
        while (this.bots.some(bot => bot.ID === id)) id++;
        const savedProfile = this.contexts.Profile(ply, id);
        const counts = profiles.map(profile => this.bots.filter(bot => bot.Profile === profile).length);
        const choices = profiles.filter((_profile, index) => counts[index] === Math.min(...counts));
        const profile = (evaluationRequested() ? savedProfile : requested) ?? savedProfile ?? choices[math.random(1, choices.length) - 1] ?? "aggressive";
        const experience = this.contexts.Get(ply, id, profile);
        this.Statistics.Attach(id);
        experience.Metrics.Reset();
        this.bots.push({ Player: ply, Brain: experience.Brain, Metrics: experience.Metrics, Scope: experience.Scope, Motion: experience.Motion,
            Navigation: new BotNavigator(), Perception: new BotPerception(),
            Places: new BotPlaces(this.placeCatalog, experience.Places, id, profile, this.Trace.Channel(id, experience.Scope), name => this.Activity.Event(id, name), true), Policy: experience.Policy, Guard: new BotDamageGuard(id),
            Execution: new BotExecutionTracker(this.Trace.Channel(id, experience.Scope)),
            Objectives: new BotObjectives(name => this.Activity.Event(id, name)), Jumps: new BotJumpControl(),
            ID: id, Profile: profile, Role: role(ply) ?? "human", NextThink: CurTime() + (id % 5) * 0.04 });
    }
    private Find(ply: ZPServerPlayer): ManagedBot | undefined { return this.bots.find(bot => bot.Player === ply); }
    private CanMove(): boolean {
        const state = RoundManager.GetRoundState();
        return !(RoundManager as ZPServerRoundManager).FreezeTimeActive &&
            (state === ROUND_PLAYING || state === ROUND_STARTING_NEW_ROUND);
    }
    GetStatus(ply: ZPServerPlayer): ZPBotStatus | undefined {
        const bot = this.Find(ply);
        return bot ? { ID: bot.ID, Profile: bot.Brain.ActiveProfile(), Role: bot.Role, Action: bot.Plan?.Action ?? "defend", Samples: bot.Brain.Samples() } : undefined;
    }
    private Clear(bot: ManagedBot, reason = "reset_or_inactive"): void {
        motor.resetWeapons(bot.Player);
        bot.Objectives.Reset(); bot.Jumps.Reset(); delete bot.SafeSince;
        bot.Execution.Reset(CurTime());
        this.traffic.Remove(bot.Player); bot.Guard.Reset();
        this.Boosts.Cancel(bot.Player);
        this.Activity.Reset(bot.ID);
        bot.Brain.Reset(reason); bot.Navigation.Reset(); bot.Perception.Reset();
        bot.Metrics.Reset();
        bot.Motion.Cancel(reason);
        bot.Places.Reset();
        this.Statistics.Finish(bot.ID, "interrupted", reason);
        delete bot.Plan; delete bot.Wander; bot.NextThink = CurTime();
    }
    private SyncScope(bot: ManagedBot): void {
        if (!IsValid(bot.Player) || !role(bot.Player) || ZPBotMetricsProtocol.Key(scopeFor(bot.Player)) === ZPBotMetricsProtocol.Key(bot.Scope)) return;
        this.Clear(bot, "scope_changed");
        this.benchmarks.delete(bot.Player);
        const experience = this.contexts.Get(bot.Player, bot.ID, bot.Profile);
        bot.Brain = experience.Brain; bot.Metrics = experience.Metrics; bot.Scope = experience.Scope; bot.Motion = experience.Motion;
        bot.Places = new BotPlaces(this.placeCatalog, experience.Places, bot.ID, bot.Profile, this.Trace.Channel(bot.ID, experience.Scope), name => this.Activity.Event(bot.ID, name), true);
        bot.Policy = experience.Policy;
        bot.Execution = new BotExecutionTracker(this.Trace.Channel(bot.ID, experience.Scope));
        bot.Role = experience.Scope.Role; bot.Metrics.Reset();
    }
    Reset(ply: ZPServerPlayer): void { this.statisticsDeaths.delete(ply); this.benchmarks.delete(ply); const bot = this.Find(ply); if (bot) { this.Clear(bot); this.SyncScope(bot); } }
    Remove(ply: ZPServerPlayer): void {
        this.statisticsDeaths.delete(ply);
        const bot = this.Find(ply);
        if (!bot) return;
        this.Clear(bot);
        this.benchmarks.delete(ply);
        this.bots = this.bots.filter(other => other !== bot);
    }

    private Plan(bot: ManagedBot, players: ZPServerPlayer[], now: number): void {
        const ply = bot.Player, currentRole = role(ply);
        if (!IsValid(ply) || !ply.Alive() || !currentRole || ply.IsFrozen()) { this.Clear(bot); bot.NextThink = now + 1; return; }
        this.SyncScope(bot);
        this.Activity.Context(bot.ID, bot.Scope);
        const observedPhysics = physics(ply);
        bot.Motion.Observe({ Mode: observedPhysics.Mode, Position: ply.GetPos(), Velocity: ply.GetVelocity(), Run: observedPhysics.Run, Controlled: true, Moving: false });
        const benchmark = this.benchmarks.get(ply);
        if (benchmark && players.some(other => other !== ply && other.Alive() && other.Team() !== ply.Team())) {
            this.Statistics.Finish(bot.ID, "interrupted", "opponent_joined"); this.benchmarks.delete(ply); this.Clear(bot); return;
        }
        const playing = !benchmark && RoundManager.GetRoundState() === ROUND_PLAYING;
        // The infection countdown is unfrozen preparation: explore without combat decisions.
        const senses: BotSenses = playing ? bot.Perception.Observe(ply, players, now, bot.Navigation.IsFollowing()) : { Visible: false, Allies: 0, Enemies: 0 };
        senses.RecentDamage = bot.Objectives.UnderFire(now);
        const sound = playing ? this.Hearing.Listen(ply, now) : undefined;
        if (sound) senses.Sound = sound;
        if (currentRole === "zombie" && bot.Objectives.Inspected(senses, now)) { delete senses.EnemyPosition; delete senses.AimPosition; delete senses.Target; }
        const distance = senses.EnemyPosition ? Math.sqrt(ply.GetPos().DistToSqr(senses.EnemyPosition)) : Infinity;
        let action = senses.Visible ? bot.Brain.Decide({ Role: currentRole, Health: ply.Health() / Math.max(1, ply.GetMaxHealth()),
            Distance: distance, Allies: senses.Allies, Enemies: senses.Enemies, HasAlly: senses.AllyPosition !== undefined, RecentDamage: senses.RecentDamage }, now) : "group";
        if (!senses.Visible) {
            if (playing && bot.Brain.ContinueRetreat(false, now, ply.Health() / Math.max(1, ply.GetMaxHealth()))) action = "retreat";
            else {
                bot.Brain.Finish();
            }
        }
        const profile = bot.Brain.ActiveProfile();
        bot.Places.SetProfile(profile);
        const requested = motor.request(ply, senses, action, profile), interventions: Intervention[] = [...requested.Interventions];
        const movementAction = requested.Withdraw ? "retreat" : action;
        const objective = bot.Objectives.Resolve(ply, senses, movementAction, requested, now);
        let goal = objective.Goal;
        const cooperating = this.Boosts.Token(ply) !== undefined || this.traffic.Control(ply, now) !== undefined;
        const place = benchmark || cooperating || objective.Mode === "investigate" ? undefined : bot.Places.Update(ply, senses, movementAction, now);
        if (place) {
            goal = place.Goal;
            // Cover implements a selected retreat/defense; it does not replace its tactical purpose.
            if (action !== "retreat" && action !== "defend") interventions.push({ Controller: "places", Reason: "place_destination", Tactical: true, Motion: false });
        }
        if (benchmark) goal = benchmark;
        if (!goal) {
            if (!bot.Wander || ply.GetPos().DistToSqr(bot.Wander) < 2500) {
                const wander = bot.Navigation.Wander(ply);
                if (wander) bot.Wander = wander;
            }
            goal = bot.Wander;
        }
        const chasing = goal !== undefined && goal === senses.EnemyPosition;
        const intent = benchmark ? "benchmark:" + benchmark.x + ":" + benchmark.y + ":" + benchmark.z : place ? "place:" + place.Key : objective.Key + (goal === bot.Wander && goal ? ":" + goal.x + ":" + goal.y + ":" + goal.z : "");
        let boost = this.Boosts.Control(ply, now);
        if (boost) goal = boost.Goal;
        let steering = boost?.Steering ?? (goal ? bot.Navigation.Steer(ply, goal, now, bot.Motion, movementAction === "retreat" || (currentRole === "zombie" && action === "attack"), boost ? "boost:" + boost.Token : intent,
            !boost && !place && chasing ? requested.ArrivalTolerance : undefined) :
            { Jump: false, Duck: false, Use: false, Stuck: false });
        const availablePeers = this.ManagedPlayers().filter(other => {
            if (other === ply) return true;
            const peer = this.Find(other);
            return peer !== undefined && senses.KnownAllies?.includes(other) === true && !peer.Objectives.UnderFire(now) && !peer.Plan?.Senses.Visible;
        });
        if (!boost && steering.Unreachable && goal && ((movementAction === "retreat" && senses.EnemyPosition && this.Boosts.Escape(ply, senses.EnemyPosition, availablePeers, now)) ||
            this.Boosts.Start(ply, goal, availablePeers, now))) {
            boost = this.Boosts.Control(ply, now);
            if (boost) { goal = boost.Goal; steering = boost.Steering ?? bot.Navigation.Steer(ply, goal, now, bot.Motion, false, "boost:" + boost.Token); }
        }
        const motionID = bot.Motion.ExperienceID(), stageID = bot.Motion.Stage();
        const localRequest = { Local: steering.Pick?.Action ?? "wait", Waypoint: steering.Position ? [steering.Position.x, steering.Position.y, steering.Position.z] : [] };
        if (boost?.Steering) bot.Motion.Cancel("controller_substitution", false, { Controller: "boost", Reason: "cooperative_boost", Tactical: true, Motion: true });
        if (boost) interventions.push({ Controller: "boost", Reason: "cooperative_boost", Tactical: true, Motion: boost.Steering !== undefined });
        if (boost && steering.Unreachable) { this.Boosts.Cancel(ply); boost = undefined; }
        if (!goal) bot.Motion.Cancel("no_destination");
        if (!boost) {
            this.traffic.Request(ply, steering, this.bots.map(other => ({ Player: other.Player, ID: other.ID,
                Target: other.Plan?.Steering.Position ?? other.Plan?.Steering.Waypoint, Busy: other.Plan?.Boost !== undefined })), now);
            const negotiated = this.traffic.Control(ply, now);
            if (negotiated) {
                steering = negotiated; bot.Motion.Cancel("controller_substitution", false, { Controller: "traffic", Reason: "negotiated_passage", Tactical: true, Motion: true });
                interventions.push({ Controller: "traffic", Reason: "negotiated_passage", Tactical: true, Motion: true });
            }
        } else this.traffic.Remove(ply);
        if (place && steering.Unreachable) bot.Places.Failed();
        if (steering.Unreachable && !boost) bot.Objectives.Failed(now);
        if (steering.Unreachable && chasing && senses.Target && (!senses.Visible || distance > 160)) {
            bot.Perception.Ignore(senses.Target, now); bot.Brain.Finish(); action = "group";
            senses.Visible = false; delete senses.Target; delete senses.AimPosition; delete senses.EnemyPosition;
        }
        if (steering.Unreachable && goal && goal === bot.Wander) { bot.Navigation.SearchFailed(goal, now); delete bot.Wander; }
        const sameContact = senses.Target !== undefined && senses.Target === bot.Plan?.Senses.Target;
        const recentContact = sameContact && now - (bot.Plan?.LastVisibleAt ?? -Infinity) <= 0.6;
        const acquired = senses.Visible && (!bot.Plan?.Senses.Visible || !sameContact) && !recentContact;
        const lastVisibleAt = senses.Visible ? now : sameContact ? bot.Plan?.LastVisibleAt : undefined;
        if (steering.Controller) interventions.push({ Controller: steering.Controller, Reason: "validated_traversal", Tactical: false, Motion: false });
        if (interventions.some(value => value.Controller === "traffic" || value.Controller === "boost")) bot.Places.Intervene(interventions.find(value => value.Controller === "traffic" || value.Controller === "boost"));
        for (const intervention of interventions) bot.Brain.Intervene(intervention);
        bot.Plan = { Senses: senses, Steering: steering, Action: action, Updated: now,
            WithdrawForAmmo: requested.Withdraw === true,
            Wait: place?.Holding === true || (!!boost && !steering.Position),
            DecisionID: bot.Brain.ExperienceID(), MotionID: motionID, StageID: stageID, Interventions: interventions,
            Requested: { Goal: requested.Goal ? [requested.Goal.x, requested.Goal.y, requested.Goal.z] : [], Move: requested.Move, ...localRequest },
            ReadyAt: acquired ? now + 0.2 + (bot.ID % 5) * 0.05 : bot.Plan?.ReadyAt ?? now + 0.2 };
        if (goal) bot.Plan.Goal = goal;
        if (lastVisibleAt !== undefined) bot.Plan.LastVisibleAt = lastVisibleAt;
        if (boost) bot.Plan.Boost = boost.Token;
        if (steering.Jump) this.Activity.Event(bot.ID, "Jump:" + (boost ? "boost" : steering.Pick?.JumpReason ?? steering.Controller ?? "unknown") + ":requested");
        if (place?.Look) bot.Plan.Look = place.Look;
        if (place?.Holding && !interventions.some(value => value.Motion)) { bot.Plan.Steering.Duck = place.Duck; bot.Plan.Steering.Stuck = false; }
        if (action === "retreat" && currentRole === "human" && bot.Objectives.Safe(ply, senses, now) && !interventions.some(value => value.Tactical)) {
            bot.SafeSince ??= now;
            if (now - bot.SafeSince >= 3) { bot.Brain.Escaped(true); bot.Brain.Finish("confirmed_escape", "success"); delete bot.SafeSince; }
        } else delete bot.SafeSince;
        bot.Metrics.Observe(ply, bot.Plan, goal, bot.Navigation.Status(), now);
        this.Statistics.Observe(bot.ID, ply, bot.Scope, () => util.SHA256(this.contexts.Version({ Brain: bot.Brain, Motion: bot.Motion }) + this.Boosts.Store.Version()), bot.Plan, goal, intent, bot.Navigation.Status(), now);
        if (benchmark && this.Statistics.NavigationFinished(bot.ID)) { this.benchmarks.delete(ply); this.Clear(bot); }
        bot.NextThink = now + 0.2;
    }

    Update(): void {
        const evaluating = evaluationRequested();
        const experiment = ["zp_bot_stats_scenario", "zp_bot_stats_difficulty", "zp_bot_stats_cohort", "zp_bot_stats_opponent", "zp_bot_stats_sample", "zp_bot_stats_timeout", "zp_bot_stats_stuck_speed", "zp_bot_learning", "zp_run_drain", "zp_run_should_drain", "zp_realistic_mode", "sv_gravity"]
            .map(name => { const value = GetConVar(name)?.GetString() ?? ""; return value.length + ":" + value; }).join("");
        if (evaluating !== this.evaluation || (this.experiment !== "" && experiment !== this.experiment)) {
            for (const bot of this.bots) this.Clear(bot);
            this.contexts.Save(); this.contexts.SetEvaluation(evaluating); this.evaluation = evaluating;
            for (const bot of this.bots) {
                const entry = this.contexts.Get(bot.Player, bot.ID, bot.Profile);
                bot.Brain = entry.Brain; bot.Motion = entry.Motion; bot.Metrics = entry.Metrics; bot.Policy = entry.Policy;
                bot.Places = new BotPlaces(this.placeCatalog, entry.Places, bot.ID, bot.Profile, this.Trace.Channel(bot.ID, entry.Scope), name => this.Activity.Event(bot.ID, name), true);
                bot.Execution = new BotExecutionTracker(this.Trace.Channel(bot.ID, entry.Scope));
            }
        }
        this.experiment = experiment;
        for (const bot of [...this.bots]) if (!IsValid(bot.Player)) this.Remove(bot.Player);
        if (!evaluating) this.benchmarks.clear();
        if (!cvars.Bool("zp_bot_ai_enabled", true) || (!this.CanMove() && this.benchmarks.size === 0)) {
            for (const bot of this.bots) if (bot.Plan) this.Clear(bot);
            return;
        }
        const players = (RoundManager as ZPServerRoundManager).GetPlayersToPlay(true), start = SysTime();
        let planned = 0;
        for (let checked = 0; checked < this.bots.length && planned < 2; checked++) {
            if ((SysTime() - start) * 1000 >= 2) break;
            this.cursor = this.cursor % this.bots.length;
            const bot = this.bots[this.cursor++];
            if (bot && CurTime() >= bot.NextThink) {
                if (this.CanMove() || this.benchmarks.has(bot.Player)) this.Plan(bot, players, CurTime());
                else this.Clear(bot);
                planned++;
            }
        }
    }
    Command(ply: ZPServerPlayer, command: GLuaUserCommand): void {
        const bot = this.Find(ply);
        if (!bot) return;
        command.ClearButtons(); command.ClearMovement(); command.SetImpulse(0);
        bot.Motion.Input(0, ply.EyeAngles().p);
        const blocked = !cvars.Bool("zp_bot_ai_enabled", true) ? "ai_disabled" : (!this.CanMove() && !this.benchmarks.has(ply)) ? "round_inactive" :
            !ply.Alive() ? "dead" : ply.IsFrozen() ? "frozen" : role(ply) !== bot.Role ? "role_changed" : !bot.Plan ? "missing_plan" :
            CurTime() - bot.Plan.Updated > 0.75 ? "plan_expired" : undefined;
        if (blocked || !bot.Plan) { this.SuppressCommand(bot, blocked ?? "missing_plan"); return; }
        if (bot.Plan.Boost && this.Boosts.Token(ply) !== bot.Plan.Boost) { this.SuppressCommand(bot, "boost_session_changed"); return; }
        const negotiated = this.traffic.Control(ply, CurTime()), defensive = !bot.Plan.Senses.Visible && bot.Plan.Action !== "retreat" ? bot.Guard.Look(ply, CurTime()) : undefined;
        const interventions = [...(bot.Plan.Interventions ?? [])];
        if (negotiated && !interventions.some(value => value.Controller === "traffic")) interventions.push({ Controller: "traffic", Reason: "negotiated_passage", Tactical: true, Motion: true });
        const plan: BotPlan = { ...bot.Plan, Steering: negotiated ?? bot.Plan.Steering, Interventions: interventions, ...(defensive ? { DefensiveLook: defensive } : {}) };
        const crouchFlight = bot.Jumps.Crouch(ply, CurTime());
        if (crouchFlight || plan.Steering.Pick?.Action === "jumpduck") plan.Steering = { ...plan.Steering, Duck: crouchFlight };
        if (plan.Steering.Jump && !plan.JumpIssued && ply.OnGround() && CurTime() - plan.Updated < 0.12 && !bot.Jumps.Allow(ply, plan.Steering, CurTime())) {
            plan.Steering = { ...plan.Steering, Jump: false };
            interventions.push({ Controller: "jump_control", Reason: "launch_cooldown_or_no_progress", Tactical: false, Motion: true });
        }
        const keys = motor.apply(ply, command, plan, bot.ID, RoundManager.GetRoundState() === ROUND_PLAYING && !this.benchmarks.has(ply), execution => {
            const motionID = bot.Motion.ExperienceID() || plan.MotionID || "";
            const issued = execution.Commanded;
            bot.RecordingInput = { Time: CurTime(), Gate: "", AttackGate: execution.AttackGate ?? "unknown", Forward: issued.Forward, Side: issued.Side, Keys: issued.Keys,
                Controllers: execution.Interventions.map(value => value.Controller + ":" + value.Reason) };
            const moving = Math.abs(issued.Forward) + Math.abs(issued.Side) > 1;
            const tacticalInput = moving || Math.floor(issued.Keys / IN_ATTACK) % 2 === 1 || (plan.Action === "defend" && plan.Wait === true);
            for (const intervention of execution.Interventions) bot.Brain.Intervene(intervention, plan.DecisionID);
            if (tacticalInput && !execution.Interventions.some(value => value.Tactical)) bot.Brain.Executed(plan.DecisionID ?? "");
            const controlled = !execution.Interventions.some(value => value.Motion);
            if (controlled && (moving || plan.Wait) && plan.Goal) bot.Places.Executed(plan.Goal);
            if (!controlled) { const intervention = execution.Interventions.find(value => value.Motion); bot.Motion.Cancel("controller_substitution", false, intervention); bot.Places.Intervene(intervention); }
            bot.Execution.Command({ Decision: plan.DecisionID ?? "", Experience: motionID, Stage: plan.StageID ?? bot.Motion.Stage(), Action: plan.Action,
                Requested: plan.Requested ?? { Goal: [], Move: plan.Steering.Pick?.Action ?? "none" } }, execution, CurTime());
            const state = physics(ply);
            this.Activity.Observe(bot.ID, bot.Scope, ply, plan, execution, bot.Objectives.UnderFire(CurTime()), CurTime());
            bot.Motion.Input(issued.Keys, ply.EyeAngles().p, { Mode: state.Mode, Position: ply.GetPos(), Velocity: ply.GetVelocity(), Run: state.Run,
                Controlled: controlled, Moving: Math.abs(issued.WorldX) + Math.abs(issued.WorldY) > 1 });
        });
        bot.Plan.JumpIssued = plan.JumpIssued === true;
        bot.Jumps.Issued(plan.Steering, keys, CurTime());
        this.Boosts.Input(ply, keys);
    }
    private SuppressCommand(bot: ManagedBot, reason: string): void {
        motor.resetWeapons(bot.Player);
        bot.Jumps.CancelFlight();
        bot.RecordingInput = { Time: CurTime(), Gate: reason, AttackGate: "command_gated", Forward: 0, Side: 0, Keys: 0, Controllers: [] };
        this.Activity.Gate(bot.ID);
        const plan = bot.Plan; if (!plan) return;
        const intervention = { Controller: "command_gate", Reason: reason, Tactical: true, Motion: true };
        bot.Brain.Intervene(intervention, plan.DecisionID); bot.Motion.Cancel("controller_substitution", false, intervention); bot.Places.Intervene(intervention); this.Boosts.Cancel(bot.Player);
        bot.Execution.Command({ Decision: plan.DecisionID ?? "", Experience: plan.MotionID ?? "", Stage: plan.StageID ?? "", Action: plan.Action,
            Requested: plan.Requested ?? { Goal: [], Move: "none" } }, { Interventions: [intervention],
            Commanded: { Forward: 0, Side: 0, Keys: 0, Yaw: bot.Player.EyeAngles().y, WorldX: 0, WorldY: 0 } }, CurTime());
    }

    private JumpDamage(bot: ManagedBot, damage: GLuaDamageInfo): void {
        if (fallDamage(damage) || damage.IsDamageType(DMG_DROWN) || damage.IsDamageType(DMG_DROWNRECOVER)) return;
        const target = bot.Player, plan = bot.Plan, attacker = damage.GetAttacker();
        const hunting = plan && (plan.Action === "attack" || (plan.Action !== "retreat" && plan.Goal !== undefined && plan.Goal === plan.Senses.EnemyPosition));
        if (hunting && CurTime() - plan.Updated <= 0.75 && this.CanMove() && cvars.Bool("zp_bot_ai_enabled", true) &&
            RoundManager.GetRoundState() === ROUND_PLAYING && !target.IsFrozen() && role(target) === "zombie" &&
            IsValid(attacker) && attacker.IsPlayer() && role(attacker) === "human" &&
            !target.OnGround() && target.WaterLevel() < 2 && target.GetMoveType() !== MOVETYPE_LADDER)
            bot.Motion.ShotWhileJumping(damage.GetDamage());
    }
    Damage(target: GLuaEntity, damage: GLuaDamageInfo, took: boolean): void {
        if (took && cvars.Bool("zp_bot_ai_enabled", true) && IsValid(target) && target.IsPlayer() && (this.CanMove() || this.benchmarks.has(target))) {
            const movementVictim = this.Find(target);
            if (movementVictim) this.SyncScope(movementVictim);
            if (movementVictim && !this.statisticsDeaths.has(target)) this.EnvironmentDamage(movementVictim, damage);
        }
        if (!took || RoundManager.GetRoundState() !== ROUND_PLAYING || !IsValid(target) || !target.IsPlayer() || damage.GetDamage() <= 0) return;
        if (!this.damageEvents.Claim(damage, target.EntIndex(), "combat")) return;
        const attacker = damage.GetAttacker();
        const victim = this.Find(target);
        const source = IsValid(attacker) && attacker.IsPlayer() ? this.Find(attacker) : undefined;
        if (attacker === target || (IsValid(attacker) && attacker.IsPlayer() && attacker.Team() === target.Team())) return;
        if (victim) this.SyncScope(victim);
        if (victim && IsValid(attacker) && attacker.IsPlayer() && attacker.Team() !== target.Team() &&
            IsValid(attacker.GetActiveWeapon()) && attacker.GetActiveWeapon().GetMaxClip1() > 0) {
            const known = victim.Plan?.Senses;
            if (known?.Target === attacker && known.EnemyPosition) victim.Guard.Damage(damage.GetDamage(), target.GetMaxHealth(), known.EnemyPosition, CurTime());
        }
        if (source) this.SyncScope(source);
        if (victim && IsValid(attacker) && attacker.IsPlayer()) victim.Objectives.Damage(CurTime());
        if (victim) this.JumpDamage(victim, damage);
        if (victim && IsValid(attacker) && attacker.IsPlayer()) victim.Motion.InvalidateCausality("combat_damage_possible_displacement");
        victim?.Brain.DamageTaken(damage.GetDamage(), target.GetMaxHealth(), IsValid(attacker) && attacker.IsPlayer() && role(attacker) === "human", CurTime());
        victim?.Places.Damage(damage.GetDamage(), target.GetMaxHealth());
        victim?.Metrics.Event("DamageTaken", damage.GetDamage());
        if (victim) this.Statistics.Event(victim.ID, "Taken", damage.GetDamage());
        if (IsValid(attacker) && attacker.IsPlayer() && role(attacker) && role(target))
            source?.Brain.Reward(Math.min(1, damage.GetDamage() / Math.max(1, target.GetMaxHealth())) * 0.8, "damage_dealt");
        source?.Metrics.Event("DamageDealt", damage.GetDamage());
        if (source) this.Statistics.Event(source.ID, "Dealt", damage.GetDamage());
    }
    private EnvironmentDamage(bot: ManagedBot, damage: GLuaDamageInfo): void {
        const fall = fallDamage(damage);
        if (!fall && !damage.IsDamageType(DMG_DROWN) && !damage.IsDamageType(DMG_DROWNRECOVER)) return;
        if (damage.GetDamage() <= 0) return;
        const event = this.damageEvents.Claim(damage, bot.ID, "environment"); if (!event) return;
        bot.Motion.Harm(damage.GetDamage(), event, fall);
        if (fall) this.Statistics.Fall(bot.ID);
    }
    Infection(target: ZPServerPlayer, attacker: ZPServerPlayer): void {
        // This hook runs after infection. Credit only an active human episode, never round setup.
        const victim = this.Find(target), source = this.Find(attacker);
        if (source) this.SyncScope(source);
        if (target !== attacker && RoundManager.GetRoundState() === ROUND_PLAYING && victim?.Role === "human") {
            victim.Brain.Reward(-1, "infection_taken"); victim.Brain.Finish("infection", "failure"); victim.Places.Death();
        }
        if (target !== attacker && RoundManager.GetRoundState() === ROUND_PLAYING && source?.Role === "zombie") {
            this.Activity.Event(source.ID, "Infections");
            source.Brain.Reward(1, "infection_dealt"); source.Metrics.Event("Infections", 1);
        }
        if (victim) { this.Clear(victim); this.SyncScope(victim); }
    }
    Death(ply: ZPServerPlayer, killer: GLuaEntity, damage?: GLuaDamageInfo): void {
        if (this.statisticsDeaths.has(ply) || (damage && !this.damageEvents.Claim(damage, ply.EntIndex(), "death"))) return;
        const victim = this.Find(ply);
        if (victim) this.SyncScope(victim);
        // Process the lethal event before closing experiences. Post-damage will claim the same receipt and skip it.
        if (damage) this.Damage(ply, damage, true);
        if (this.CanMove() && damage && victim) this.EnvironmentDamage(victim, damage);
        if (RoundManager.GetRoundState() === ROUND_PLAYING) {
            victim?.Brain.Death();
            victim?.Places.Death();
            victim?.Metrics.Event("Deaths", 1);
            if (killer !== ply && IsValid(killer) && killer.IsPlayer() && killer.Team() !== ply.Team()) {
                const source = this.Find(killer);
                if (source) { this.SyncScope(source); source.Brain.Reward(0.6, "kill"); source.Metrics.Event("Kills", 1); }
            }
        }
        if (!this.statisticsDeaths.has(ply)) {
            this.statisticsDeaths.add(ply);
            victim?.Motion.Cancel();
            const hostile = killer !== ply && IsValid(killer) && killer.IsPlayer() && killer.Team() !== ply.Team();
            if (victim) this.Statistics.Death(victim.ID, damage && fallDamage(damage) ? "fall" : hostile ? "enemy" : IsValid(killer) ? "environment" : "unknown");
            if (hostile && RoundManager.GetRoundState() === ROUND_PLAYING) {
                const source = hostile ? this.Find(killer as ZPServerPlayer) : undefined;
                if (source) this.Statistics.Event(source.ID, "Kills", 1);
            }
        }
        if (victim) this.Clear(victim, "death");
    }
    EndRound(result: ZPRoundEndReason): void {
        this.Hearing.Reset();
        for (const bot of this.bots) {
            const won = bot.Role === "human" ? result === HUMANS_WIN : result === ZOMBIES_WIN;
            if (bot.Player.Alive() && bot.Plan?.Senses.Visible) {
                bot.Brain.Reward(won ? 0.35 : -0.15, "round_result"); bot.Brain.Finish("round_result", won ? "success" : "failure");
            }
            bot.Places.Finish();
        }
        this.Statistics.EndRound(result);
        for (const bot of this.bots) {
            this.Clear(bot, "round_end");
        }
        this.Save();
    }
    Save(): void {
        this.Boosts.Save();
        this.contexts.Save();
        for (const bot of this.bots) if (IsValid(bot.Player)) bot.Policy = this.contexts.Get(bot.Player, bot.ID, bot.Profile).Policy;
        this.Statistics.Save();
    }
    Diagnostics(page: number, requestID: number): ZPBotMetricsSnapshot {
        const rows: ZPBotDiagnostic[] = [];
        const bots = this.bots.filter(bot => IsValid(bot.Player));
        for (const bot of bots.slice(page * 16, page * 16 + 16)) {
            this.SyncScope(bot);
            const ply = bot.Player, plan = bot.Plan, route = bot.Navigation.Status();
            const goal = plan?.Goal;
            const diagnostic: ZPBotDiagnostic = { ID: bot.ID, EntityID: ply.EntIndex(), Name: ply.Name().substring(0, 128), Profile: bot.Brain.ActiveProfile(),
                Scope: { ...bot.Scope }, Action: plan?.Action ?? "defend", Reason: plan?.Senses.Visible ? bot.Brain.Reason() : "search",
                Alive: ply.Alive(), Active: plan !== undefined && CurTime() - plan.Updated <= 0.75 && ply.Alive() && !ply.IsFrozen() &&
                    this.CanMove() && cvars.Bool("zp_bot_ai_enabled", true),
                Route: route.Route, Remaining: route.Remaining, Goal: goal ? string.format("%d, %d, %d", Math.floor(goal.x), Math.floor(goal.y), Math.floor(goal.z)) : "",
                Replans: route.Replans, Blocked: bot.Metrics.Blocked,
                Breath: Math.max(0, ply.GetBreath()), MaxBreath: Math.max(0, ply.GetMaxBreath()), Sprinting: bot.Metrics.Sprinting,
                DrainEnabled: ply.IsHuman() && RunShouldDrain(ply) && cvars.Number("zp_run_drain", 1) > 0,
                Samples: bot.Brain.Samples(), LastReward: bot.Metrics.LastReward, Totals: bot.Metrics.Totals() };
            const decision = plan?.Senses.Visible ? bot.Brain.Decision() : undefined;
            if (decision) diagnostic.Decision = decision;
            diagnostic.Motion = bot.Motion.Diagnostic();
            const navigation = bot.Navigation.Diagnostic();
            if (navigation) {
                diagnostic.Motion.Navigation = navigation;
                // Send one projected path per bot so a full diagnostics page remains bounded.
                if (navigation.Path.length > 0) diagnostic.Motion.Path = [];
            }
            diagnostic.Place = bot.Places.Diagnostic(CurTime());
            rows.push(diagnostic);
        }
        return { Version: 1, RequestID: requestID, Page: page, Total: bots.length, Learning: cvars.Bool("zp_bot_learning", true), Rows: rows };
    }
}
