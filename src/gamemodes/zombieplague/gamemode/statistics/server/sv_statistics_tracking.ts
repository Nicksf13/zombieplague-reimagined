import type { StatisticsRecords } from "./sv_statistics_records";
const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
const { StatisticsIdentities } = include("sv_statistics_identities.lua") as typeof import("./sv_statistics_identities");
interface StatisticsSession {
    Row: ZPStatisticsRecord; Role: ZPStatisticsRole; Time: number; Position: GLuaVector;
    Alive: boolean; Segment: number; Seen: Set<ZPStatisticsRole>; Round: Record<ZPStatisticsRole, ZPStatisticsCounters>;
}
interface TrackingContract { Start(): void; Stop(reason?: ZPRoundEndReason): void; Tick(): void; }
export class StatisticsTracking implements TrackingContract {
    Active = false;
    readonly Identities = new StatisticsIdentities();
    private sessions = new Map<ZPServerPlayer, StatisticsSession>();
    private firstZombie: ZPServerPlayer | undefined;
    constructor(private records: StatisticsRecords) {}

    Role(ply: ZPServerPlayer): ZPStatisticsRole | undefined {
        if (ply.IsZombie()) return ply.IsNemesis() ? "nemesis" : "zombie";
        if (ply.IsHuman()) return ply.IsSurvivor() ? "survivor" : "human";
        return;
    }
    Eligible(ply: ZPServerPlayer): boolean {
        return IsValid(ply) && this.Role(ply) !== undefined && this.Identities.Get(ply) !== undefined;
    }
    Participating(ply: ZPServerPlayer): boolean {
        return IsValid(ply) && this.Role(ply) !== undefined &&
            (RoundManager as ZPServerRoundManager).GetPlayersToPlay().includes(ply);
    }
    Start(): void {
        if (this.Active || !this.records.Ready) return;
        this.Active = true; this.sessions.clear(); this.Tick();
    }
    FirstZombie(ply: ZPServerPlayer): void { this.firstZombie = ply; }
    private Credit(session: StatisticsSession, role: ZPStatisticsRole, key: ZPStatisticsMetric, amount: number): void {
        if (!schema.finite(amount) || amount === 0) return;
        const total = session.Row.Roles[role], round = session.Round[role];
        total[key] = Math.min(1e15, total[key] + amount); round[key] = Math.min(1e15, round[key] + amount);
        for (const [metric, best] of [["Kills", "BestKills"], ["DamageDealt", "BestDamage"], ["Infections", "BestInfections"]] as const)
            if (key === metric) total[best] = Math.max(total[best], round[key]);
        this.records.Touch(session.Row);
    }
    private CloseSegment(session: StatisticsSession): void {
        const total = session.Row.Roles[session.Role];
        if (session.Segment > total.BestSurvival) { total.BestSurvival = session.Segment; this.records.Touch(session.Row); }
        session.Segment = 0;
    }
    Update(ply: ZPServerPlayer): StatisticsSession | undefined {
        if (!this.Active) return;
        let session = this.sessions.get(ply);
        const now = CurTime(), role = this.Role(ply), alive = ply.Alive();
        if (session) {
            const elapsed = Math.max(0, now - session.Time);
            if (session.Alive) {
                this.Credit(session, session.Role, "AliveTime", elapsed); session.Segment += elapsed;
                if (alive && role === session.Role && elapsed > 0 && elapsed <= 2) {
                    const distance = Math.sqrt(ply.GetPos().DistToSqr(session.Position));
                    const velocity = ply.GetVelocity();
                    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
                    if (distance <= Math.max(256, speed * elapsed * 2 + 64))
                        this.Credit(session, session.Role, "Distance", distance);
                }
                this.CloseBest(session);
            }
            if (!alive || role !== session.Role) this.CloseSegment(session);
            session.Time = now; session.Position = ply.GetPos(); session.Alive = alive;
        }
        if (!this.Eligible(ply) || !this.Participating(ply) || !role) { this.sessions.delete(ply); return; }
        if (!session) {
            if (!alive) return;
            const id = this.Identities.Get(ply);
            if (id === undefined) return;
            const row = this.records.Get(game.GetMap(), id, ply.Name());
            session = { Row: row, Role: role, Time: now, Position: ply.GetPos(), Alive: alive, Segment: 0,
                Seen: new Set(), Round: schema.empty(row.Map, row.ID, row.Name).Roles };
            this.sessions.set(ply, session);
        }
        session.Role = role;
        if (alive && !session.Seen.has(role)) { session.Seen.add(role); this.Credit(session, role, "Rounds", 1); }
        return session;
    }
    private CloseBest(session: StatisticsSession): void {
        const total = session.Row.Roles[session.Role];
        if (session.Segment > total.BestSurvival) { total.BestSurvival = session.Segment; this.records.Touch(session.Row); }
    }
    Add(ply: ZPServerPlayer, metric: ZPStatisticsMetric, amount = 1, role?: ZPStatisticsRole): void {
        const session = this.Update(ply);
        if (session) this.Credit(session, role ?? session.Role, metric, amount);
    }
    Weapon(ply: ZPServerPlayer, metric: ZPStatisticsWeaponMetric, weapon: string, amount = 1, role?: ZPStatisticsRole): void {
        if (!weapons.counter(amount, metric) || amount === 0) return;
        const session = this.Update(ply);
        if (!session) return;
        const counters = weapons.entry(session.Row.Weapons, weapon)[role ?? session.Role];
        counters[metric] = Math.min(1e15, counters[metric] + amount);
        this.records.Touch(session.Row);
    }
    Tick(): void {
        if (!this.Active) return;
        this.Identities.Prune();
        for (const ply of this.sessions.keys()) if (!IsValid(ply)) this.sessions.delete(ply);
        for (const ply of (RoundManager as ZPServerRoundManager).GetPlayersToPlay()) this.Update(ply);
    }
    Death(ply: ZPServerPlayer, killer: GLuaEntity, weapon = weapons.unknown): void {
        if (!this.Active || !this.Participating(ply)) return;
        this.Add(ply, "Deaths");
        if (!IsValid(killer) || !killer.IsPlayer() || killer === ply || !this.Participating(killer) || killer.Team() === ply.Team()) return;
        this.Add(killer, "Kills");
        this.Weapon(killer, "Kills", weapon);
        const role = this.Role(ply);
        if (role === "nemesis") this.Add(killer, "NemesisKills");
        if (role === "survivor") this.Add(killer, "SurvivorKills");
    }
    Conversion(target: ZPServerPlayer, attacker: ZPServerPlayer, kind: "infection" | "cure", oldRole: ZPStatisticsRole, weapon = weapons.unknown): void {
        if (!this.Active || !this.Participating(target) || !this.Participating(attacker)) return;
        if (kind === "infection") {
            this.Add(target, "Infected", 1, oldRole);
            if (target !== attacker) {
                this.Add(attacker, "Infections");
                this.Weapon(attacker, "Infections", weapon);
                if (attacker === this.firstZombie) this.Add(attacker, "FirstZombieInfections");
            }
        } else {
            this.Add(target, "Cured", 1, oldRole);
            this.Add(attacker, target === attacker ? "SelfCures" : "Cures", 1, target === attacker ? oldRole : undefined);
        }
    }
    Disconnect(ply: ZPServerPlayer): void {
        if (this.sessions.has(ply)) this.Update(ply);
        this.sessions.delete(ply);
        this.Identities.Forget(ply);
    }
    Stop(reason?: ZPRoundEndReason): void {
        if (!this.Active) { this.firstZombie = undefined; return; }
        for (const ply of [...this.sessions.keys()]) {
            if (!IsValid(ply)) continue;
            const session = this.Update(ply);
            if (!session) continue;
            this.CloseSegment(session);
            if (reason !== undefined) {
                if ((ply.IsHuman() && reason === HUMANS_WIN) || (ply.IsZombie() && reason === ZOMBIES_WIN)) this.Credit(session, session.Role, "Wins", 1);
                if (ply.Alive()) this.Credit(session, session.Role, "SurvivedRounds", 1);
            }
        }
        this.sessions.clear(); this.Active = false; this.firstZombie = undefined;
    }
}
