import type { BotPlan } from "./sv_bot_motor";
const { BotStatisticsStore } = include("sv_bot_statistics_store.lua") as typeof import("./sv_bot_statistics_store");
const analysis = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
const { evaluationRequested } = include("sv_bot_learning_gate.lua") as typeof import("./sv_bot_learning_gate");
const { physics } = include("sv_bot_motion_physics.lua") as typeof import("./sv_bot_motion_physics");
const { BotStatisticsTimeline } = include("sv_bot_statistics_timeline.lua") as typeof import("./sv_bot_statistics_timeline");
const { BotMinuteHistory } = include("sv_bot_statistics_minutes.lua") as typeof import("./sv_bot_statistics_minutes");
interface Observation { Position: GLuaVector; Time: number; Replans: number; Blocked: boolean; Wanted: boolean; }
interface Tracking { Life: number; Incarnation: number; Combat?: ZPBotTrial | undefined; Navigation?: ZPBotTrial | undefined; Previous?: Observation | undefined; Goal?: GLuaVector | undefined; Intent?: string | undefined; Closed?: boolean; Next: number; }
interface StatisticsContract { Finish(id: number, end: ZPBotTrialEnd, detail: string): void; Save(): boolean; }
const point = (position: GLuaVector): number[] => [position.x, position.y, position.z];
const live = (state: Tracking | undefined): ZPBotTrial[] => {
    const rows: ZPBotTrial[] = []; if (state?.Combat) rows.push(state.Combat); if (state?.Navigation) rows.push(state.Navigation); return rows;
};
export const setting = (name: string, fallback: number, min: number, max: number): number => {
    const value = cvars.Number("zp_bot_stats_" + name, fallback); return value === value ? Math.max(min, Math.min(max, value)) : fallback;
};
export class BotStatistics implements StatisticsContract {
    private store = new BotStatisticsStore();
    private timeline = new BotStatisticsTimeline();
    private minutes = new BotMinuteHistory();
    private rows = this.store.Rows;
    private dropped = this.store.Dropped;
    private tracked = new Map<number, Tracking>();
    private sequence = 0;
    private round = 1;
    private serial = 0;
    private dirty = true;
    readonly Session = tostring(os.time()) + "-" + util.SHA256(tostring(SysTime())).substring(0, 16);
    readonly Code: string;
    private rewards: string;
    private navigation = util.SHA256(file.Read("maps/" + game.GetMap() + ".nav", "GAME") ?? "missing");
    constructor(private opponent?: (this: void, ply: ZPServerPlayer) => string) {
        const [files] = file.Find("gamemodes/zombieplague/gamemode/*.lua", "GAME");
        const names = files.filter(name => name.startsWith("sv_bot") || name.startsWith("sh_bot"));
        const read = (name: string): string => file.Read("gamemodes/zombieplague/gamemode/" + name, "GAME") ?? "missing";
        names.sort(); this.Code = names.length > 0 ? util.SHA256(names.map(name => name + read(name)).join("\n")) : "unavailable";
        this.rewards = "objectives-v3:" + util.SHA256(["sv_bot_brain", "sv_bot_behavior", "sv_bot_controller", "sv_bot_objectives", "sv_bot_hearing", "sv_bot_jump_control", "sv_bot_motion", "sv_bot_motion_actions", "sv_bot_motion_experiences", "sv_bot_motion_causality", "sv_bot_places", "sv_bot_place_learning", "sv_bot_boost_store"].map(name => name + read(name + ".lua")).join("\n"));
    }
    Attach(id: number): void { this.tracked.set(id, { Life: 0, Incarnation: ++this.serial, Next: 0 }); }
    private Start(id: number, state: Tracking, ply: ZPServerPlayer, scope: ZPBotScope, policy: string | ((this: void) => string), kind: ZPBotTrial["Kind"], goal?: GLuaVector): ZPBotTrial {
        const evaluation = evaluationRequested(), cohort = GetConVar("zp_bot_stats_cohort")?.GetString() ?? "trained";
        const opponents = (RoundManager as ZPServerRoundManager).GetPlayersToPlay(true).filter(other => other !== ply && other.Alive() && other.Team() !== ply.Team());
        const timestamp = os.time(), offset = setting("utc_offset", -180, -720, 840), localTime = timestamp + offset * 60;
        const suffix = string.format("%s%02d:%02d", offset < 0 ? "-" : "+", Math.floor(Math.abs(offset) / 60), Math.abs(offset) % 60);
        return { ID: this.Session + ":" + ++this.sequence, Session: this.Session, Round: this.round, Bot: id, Incarnation: state.Incarnation, Life: state.Life,
            Kind: kind, Mode: evaluation ? "evaluation" : cvars.Bool("zp_bot_learning", true) ? "training" : "observation", Code: this.Code, Policy: typeof policy === "string" ? policy : policy(),
            Rewards: this.rewards, Map: scope.Map, Scenario: (GetConVar("zp_bot_stats_scenario")?.GetString() ?? "live").substring(0, 128),
            Difficulty: (GetConVar("zp_bot_stats_difficulty")?.GetString() ?? "default").substring(0, 128),
            Cohort: cohort === "heldout" || cohort === "retention" ? cohort : "trained", Role: scope.Role, ClassID: scope.ClassID, Variant: scope.Variant,
            Equipment: ply.GetWeapons().map(weapon => weapon.GetClass()).sort().join(",").substring(0, 2048), Speed: ply.GetRunSpeed(), Jump: ply.GetJumpPower(), Health: ply.GetMaxHealth(),
            Resources: analysis.canonical({ Health: ply.Health(), Breath: ply.GetBreath(), Armor: ply.Armor(),
                Ammunition: ply.GetWeapons().map(weapon => [weapon.GetClass(), weapon.Clip1(), ply.GetAmmoCount(weapon.GetPrimaryAmmoType())].join(":")) }).substring(0, 2048),
            Reference: (GetConVar("zp_bot_stats_opponent")?.GetString() ?? "uncontrolled").substring(0, 128),
            Physics: physics(ply).Key, Navigation: this.navigation,
            Settings: analysis.canonical({ Timeout: setting("timeout", 30, 1, 600), Sample: setting("sample", 0.5, 0.1, 1), StuckSpeed: setting("stuck_speed", 5, 0, 100),
                Drain: cvars.Number("zp_run_drain", 1), DrainEnabled: cvars.Bool("zp_run_should_drain", false), Realistic: cvars.Bool("zp_realistic_mode", false),
                Bots: player.GetBots().length, Tick: engine.TickInterval(),
                FrozenExploration: evaluation, Opponent: GetConVar("zp_bot_stats_opponent")?.GetString() ?? "uncontrolled",
                Seed: "engine_rng_uncontrolled" }),
            Opponents: opponents.length === 0 ? "" : util.SHA256(opponents.map(other => this.opponent?.(other) ?? (other.IsBot() ? "bot:" : "human:") + (other.IsZombie() ? "zombie" : "human") + ":" + other.GetMaxHealth()).sort().join("\n")),
            Start: point(ply.GetPos()), Goal: goal ? point(goal) : [], Started: CurTime(), Timestamp: timestamp, EndedAt: timestamp,
            RecordedAt: os.date("!%Y-%m-%d %H:%M:%S", localTime) + " " + suffix,
            Day: os.date("!%Y-%m-%d", localTime) + " " + suffix, Hour: os.date("!%Y-%m-%d %H:00", localTime) + " " + suffix, UTCOffset: offset,
            Seconds: 0, Active: 0, Distance: 0, Stuck: 0, Replans: 0, Recoveries: 0,
            Falls: 0, Kills: 0, Deaths: 0, Dealt: 0, Taken: 0, Win: 0, Reward: 0, Components: {}, End: "interrupted", Detail: "pending" };
    }
    Observe(id: number, ply: ZPServerPlayer, scope: ZPBotScope, policy: string | ((this: void) => string), plan: BotPlan, goal: GLuaVector | undefined,
        intent: string, route: { Remaining: number; Replans: number }, now: number): void {
        const state = this.tracked.get(id); if (!state) return;
        this.dirty = true;
        const cohort = GetConVar("zp_bot_stats_cohort")?.GetString();
        // Reserved scenarios are observable only with frozen learning.
        if ((cohort === "heldout" || cohort === "retention") && !evaluationRequested()) { this.Finish(id, "interrupted", "reserved_requires_evaluation"); return; }
        if (!state.Combat && RoundManager.GetRoundState() === ROUND_PLAYING && !intent.startsWith("benchmark:")) { state.Life++; state.Combat = this.Start(id, state, ply, scope, policy, "combat"); }
        if (goal && (intent !== state.Intent || !state.Goal || goal.DistToSqr(state.Goal) > 10000)) {
            this.CloseNavigation(state, "interrupted", "destination_changed"); state.Intent = intent; state.Goal = Vector(goal.x, goal.y, goal.z); state.Closed = false;
        }
        if (goal && !state.Navigation && !state.Closed) state.Navigation = this.Start(id, state, ply, scope, policy, "navigation", goal);
        if (!goal) { this.CloseNavigation(state, "interrupted", "no_destination"); state.Goal = undefined; state.Intent = undefined; }
        if (!goal && !navmesh.IsLoaded() && !state.Closed) {
            state.Navigation = this.Start(id, state, ply, scope, policy, "navigation"); this.CloseNavigation(state, "missing_nav", "navmesh_unavailable");
        }
        if (now < state.Next) return;
        state.Next = now + setting("sample", 0.5, 0.1, 1);
        const position = ply.GetPos(), previous = state.Previous;
        let blocked = plan.Steering.Stuck || (plan.Steering.Position === undefined && goal !== undefined && route.Remaining > 40);
        if (previous) {
            const dt = now - previous.Time, distance = Math.sqrt(position.DistToSqr(previous.Position));
            const velocity = ply.GetVelocity(), ordinary = distance <= Math.max(100, ply.GetRunSpeed() * dt * 3 + Math.abs(velocity.z) * dt * 1.5 + cvars.Number("sv_gravity", 600) * dt * dt);
            if (dt < 0 || dt > 1.5 || !ordinary) this.CloseNavigation(state, "interrupted", ordinary ? "sampling_gap" : "teleport");
            blocked = blocked || (previous.Wanted && distance < dt * setting("stuck_speed", 5, 0, 100));
            if (dt > 0 && dt <= 1.5) for (const row of live(state)) {
                const active = Math.max(0, now - Math.max(previous.Time, row.Started));
                row.Active += active;
                if (ordinary) row.Distance += distance * active / dt;
                if (blocked) row.Stuck += active;
                if (previous.Blocked && !blocked && distance > 10) row.Recoveries++;
                row.Replans += Math.max(0, route.Replans - previous.Replans);
            }
        }
        state.Previous = { Position: Vector(position.x, position.y, position.z), Time: now, Replans: route.Replans, Blocked: blocked, Wanted: plan.Steering.Position !== undefined };
        for (const current of live(state)) this.minutes.Observe(current);
        const row = state.Navigation;
        if (row) {
            const destination = Vector(row.Goal[0] ?? 0, row.Goal[1] ?? 0, row.Goal[2] ?? 0);
            if (!navmesh.IsLoaded() && ply.WaterLevel() < 2) this.CloseNavigation(state, "missing_nav", "navmesh_unavailable");
            else if (plan.Steering.Unreachable) this.CloseNavigation(state, "path_failure", "navigator_unreachable");
            else if (position.DistToSqr(destination) < 1600 && Math.abs(position.z - destination.z) <= 24 && (ply.OnGround() || ply.WaterLevel() >= 2)) this.CloseNavigation(state, "success", "destination_reached");
            else if (now - row.Started >= setting("timeout", 30, 1, 600)) this.CloseNavigation(state, "timeout", "deadline");
        }
    }
    private Push(row: ZPBotTrial, end: ZPBotTrialEnd, detail: string): void {
        row.End = end; row.Detail = detail; row.Seconds = Math.max(0, CurTime() - row.Started); row.EndedAt = os.time(); this.rows.push(row); this.timeline.Add(row); this.minutes.Observe(row, true); this.dirty = true; this.Trim();
    }
    private Trim(): void {
        const limit = Math.floor(setting("retention", 2000, 100, 2000)), excess = Math.max(0, this.rows.length - limit);
        if (excess > 0) { this.dropped += excess; this.rows = this.rows.slice(excess); this.dirty = true; }
    }
    private CloseNavigation(state: Tracking, end: ZPBotTrialEnd, detail: string): void {
        if (state.Navigation) { this.Push(state.Navigation, end, detail); state.Navigation = undefined; state.Closed = true; }
    }
    Finish(id: number, end: ZPBotTrialEnd, detail: string): void {
        const state = this.tracked.get(id); if (!state) return;
        this.CloseNavigation(state, end, detail);
        if (state.Combat) { this.Push(state.Combat, end, detail); state.Combat = undefined; }
        state.Previous = undefined; state.Intent = undefined; state.Goal = undefined; state.Closed = false;
    }
    Event(id: number, key: "Dealt" | "Taken" | "Kills" | "Deaths", amount: number): void {
        if (amount <= 0 || amount !== amount || amount === Infinity) return;
        const state = this.tracked.get(id);
        if (live(state).length > 0) this.dirty = true;
        for (const row of live(state)) row[key] = Math.min(1e12, row[key] + amount);
    }
    Fall(id: number): void {
        const state = this.tracked.get(id); if (!state?.Navigation) return;
        state.Navigation.Falls = 1; if (state.Combat) state.Combat.Falls++;
        this.CloseNavigation(state, "fall", "fall_damage");
    }
    Death(id: number, cause: ZPBotTrialEnd): boolean {
        const state = this.tracked.get(id); if (!state || (!state.Combat && !state.Navigation)) return false;
        this.Event(id, "Deaths", 1); this.Finish(id, cause, "death"); return true;
    }
    NavigationFinished(id: number): boolean { return this.tracked.get(id)?.Closed === true; }
    Reward(id: number, system: string, component: string, amount: number): void {
        const state = this.tracked.get(id); if (amount !== amount || Math.abs(amount) > 1e6) return;
        if (live(state).length > 0) this.dirty = true;
        for (const row of live(state)) {
            const key = system + ":" + component; row.Components[key] = (row.Components[key] ?? 0) + amount; row.Reward += amount;
        }
    }
    EndRound(result: ZPRoundEndReason): void {
        for (const [id] of this.tracked) this.Finish(id, "interrupted", "round_end");
        const credited = new Set<string>();
        for (let index = this.rows.length - 1; index >= 0; index--) {
            const row = this.rows[index];
            if (!row || row.Session !== this.Session || row.Round !== this.round || row.Kind !== "combat" || (result !== HUMANS_WIN && result !== ZOMBIES_WIN)) continue;
            const key = row.Bot + ":" + row.Role;
            if (!credited.has(key)) { credited.add(key); row.Win = (row.Role === "human" ? result === HUMANS_WIN : result === ZOMBIES_WIN) ? 1 : -1; this.timeline.Win(row); this.minutes.Win(row); this.dirty = true; }
        }
        this.round++; this.Save();
    }
    Save(): boolean {
        if (!this.dirty) return this.timeline.Save() && this.minutes.Save();
        this.Trim(); const open: ZPBotTrial[] = [];
        for (const [, state] of this.tracked) for (const row of live(state)) open.push({ ...row, EndedAt: os.time(), Seconds: Math.max(0, CurTime() - row.Started) });
        const saved = this.store.Save(this.rows, open, this.dropped);
        const archived = this.timeline.Save() && this.minutes.Save();
        if (saved && archived) this.dirty = false;
        if (!saved || !archived) print("[ZP statistics] History save failed; keeping the bounded in-memory buffer for retry.");
        return saved && archived;
    }
    Report(query: ZPBotStatisticsFilter): ZPBotStatisticsReport {
        for (const [, state] of this.tracked) for (const row of live(state)) this.minutes.Observe(row);
        const report = analysis.report(this.rows, query, this.Session, this.dropped, Math.floor(setting("block", 100, 10, 1000)));
        const minuteGroups = this.minutes.Report(query); report.Minutes = minuteGroups.slice(-120);
        report.Truncated += Math.max(0, minuteGroups.length - 120);
        const timeline = this.timeline.Report(query); report.Timeline = timeline.slice(-120); report.TimelineDropped = this.timeline.Dropped;
        report.Bots = [...new Set([...this.tracked.keys(), ...this.rows.map(row => row.Bot), ...this.timeline.Identities()])].sort((a, b) => a - b);
        report.Truncated += Math.max(0, timeline.length - 120); return report;
    }
    Export(query: ZPBotStatisticsFilter): boolean { return this.store.Export(this.rows.filter(row => analysis.matches(row, query)), this.Report(query), this.timeline.Report(query)); }
}
