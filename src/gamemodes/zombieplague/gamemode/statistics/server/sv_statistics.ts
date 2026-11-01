const { StatisticsRecords } = include("sv_statistics_records.lua") as typeof import("./sv_statistics_records");
const { StatisticsTracking } = include("sv_statistics_tracking.lua") as typeof import("./sv_statistics_tracking");
const { StatisticsCombat } = include("sv_statistics_combat.lua") as typeof import("./sv_statistics_combat");

ConvarManager.CreateConVar("zp_statistics_enabled", 1, FCVAR_ARCHIVE, "Enable persistent player statistics and the public statistics menu.");

export class PlayerStatistics implements ZPPlayerStatisticsService {
    readonly Records = new StatisticsRecords();
    readonly Tracking = new StatisticsTracking(this.Records);
    readonly Combat = new StatisticsCombat(this.Tracking);
    IsEnabled(): boolean { return cvars.Bool("zp_statistics_enabled", true); }
    IsReady(): boolean { return this.Records.Ready; }
    GetPlayerID(ply: ZPServerPlayer): string | undefined { return this.Tracking.Identities.Get(ply); }
    SetStorage(storage: ZPStatisticsStorage): boolean { return this.Records.SetStorage(storage); }
    Initialize(): void { if (this.IsEnabled()) this.Records.Initialize(); this.Sync(); }
    Sync(): void {
        const enabled = this.IsEnabled(); SetGlobalBool("ZPStatisticsEnabled", enabled);
        if (enabled) this.Records.Initialize();
        if (enabled && this.Records.Ready && RoundManager.GetRoundState() === ROUND_PLAYING) {
            this.Tracking.Start(); this.Tracking.Tick();
        } else { this.Tracking.Stop(); this.Combat.Clear(); }
    }
    Flush(): void { this.Tracking.Tick(); this.Records.Flush(); }
    Report(id: string, query: ZPStatisticsQuery): ZPStatisticsReport {
        this.Sync(); return this.Records.Report(id, query);
    }
    End(reason?: ZPRoundEndReason): void { this.Tracking.Stop(reason); this.Combat.Clear(); this.Records.Flush(); }
}
export const statistics = new PlayerStatistics();
GM.PlayerStatistics = statistics;
hook.Add("Initialize", "ZPPlayerStatistics", () => {
    hook.Call("ZPStatisticsStorage", GAMEMODE, statistics); statistics.Initialize();
});
hook.Add("ZPNewRound", "ZPPlayerStatistics", () => statistics.Sync());
hook.Add("ZPEndRound", "ZPPlayerStatistics", reason => statistics.End(reason));
hook.Add("ZPPrePreparingRound", "ZPPlayerStatistics", () => statistics.End());
hook.Add("ZPRestartRound", "ZPPlayerStatistics", () => statistics.End());
hook.Add("ZPFirstZombieEvent", "ZPPlayerStatistics", ply => statistics.Tracking.FirstZombie(ply));
hook.Add("ZPPlayerRoleChanged", "ZPPlayerStatistics", ply => { statistics.Tracking.Update(ply); });
hook.Add("OnPlayerChangedTeam", "ZPPlayerStatistics", ply => { statistics.Tracking.Update(ply); statistics.Combat.Reset(ply, true); });
hook.Add("PlayerSpawn", "ZPPlayerStatistics", ply => { statistics.Tracking.Update(ply); statistics.Combat.Reset(ply); });
hook.Add("DoPlayerDeath", "ZPPlayerStatistics", (ply, killer, damage) => statistics.Combat.CaptureDeath(ply, killer, damage));
hook.Add("PlayerDeath", "ZPPlayerStatistics", (ply, weapon, killer) => statistics.Combat.Death(ply, killer, weapon));
hook.Add("PlayerSilentDeath", "ZPPlayerStatistics", (ply: ZPServerPlayer) => { statistics.Tracking.Update(ply); });
hook.Add("PlayerDisconnected", "ZPPlayerStatistics", ply => {
    const target = ply as ZPServerPlayer;
    statistics.Tracking.Disconnect(target); statistics.Combat.Reset(target); statistics.Records.Flush();
});
hook.Add("ZPStatisticsDamageStarted", "ZPPlayerStatistics", (target, damage) => statistics.Combat.Begin(target, damage));
hook.Add("PostEntityTakeDamage", "ZPPlayerStatistics", (target, damage, tookDamage) => statistics.Combat.End(target, damage, tookDamage));
hook.Add("ZPPreInfectionEvent", "ZPPlayerStatistics", (target, attacker, inflictor) => statistics.Combat.BeforeConversion(target, attacker, inflictor));
hook.Add("ZPPreCureEvent", "ZPPlayerStatistics", (target, attacker) => statistics.Combat.BeforeConversion(target, attacker));
hook.Add("ZPInfectionEvent", "ZPPlayerStatistics", (target, attacker) => statistics.Combat.Conversion(target, attacker, "infection"));
hook.Add("ZPCureEvent", "ZPPlayerStatistics", (target, attacker) => statistics.Combat.Conversion(target, attacker, "cure"));
hook.Add("ShutDown", "ZPPlayerStatistics", () => statistics.End());
cvars.AddChangeCallback("zp_statistics_enabled", () => { statistics.Sync(); statistics.Records.Flush(); }, "ZPPlayerStatistics");
cvars.AddChangeCallback("zp_bot_training", () => statistics.Sync(), "ZPPlayerStatistics");
timer.Create("ZPPlayerStatisticsSample", 0.5, 0, () => statistics.Sync());
timer.Create("ZPPlayerStatisticsSave", 30, 0, () => statistics.Flush());
include("sv_statistics_network.lua");
