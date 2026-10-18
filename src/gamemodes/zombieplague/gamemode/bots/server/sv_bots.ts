export {};
const { BotController, isProfile } = include("sv_bot_controller.lua") as typeof import("./sv_bot_controller");
const { register } = include("sv_bot_commands.lua") as typeof import("./sv_bot_commands");
const { BotMetricsService } = include("sv_bot_metrics_service.lua") as typeof import("./sv_bot_metrics_service");
const { BotBoostEditorService } = include("sv_bot_boost_editor.lua") as typeof import("./sv_bot_boost_editor");
const { BotPopulationConfig } = include("sv_bot_population_config.lua") as typeof import("./sv_bot_population_config");
const { BotSpawner } = include("sv_bot_spawner.lua") as typeof import("./sv_bot_spawner");
const { BotPopulation } = include("sv_bot_population.lua") as typeof import("./sv_bot_population");
const { BotPopulationService } = include("sv_bot_population_service.lua") as typeof import("./sv_bot_population_service");
const { BotTraining } = include("sv_bot_training.lua") as typeof import("./sv_bot_training");
const { BotStatisticsService } = include("sv_bot_statistics_service.lua") as typeof import("./sv_bot_statistics_service");
ConvarManager.CreateConVar("zp_bot_evaluation", 0, 8, "Freeze copied bot policies and disable learning/exploration for evaluation");
ConvarManager.CreateConVar("zp_bot_stats_scenario", "live", 8, "Scenario ID used for bot statistics");
ConvarManager.CreateConVar("zp_bot_stats_difficulty", "default", 8, "Experiment difficulty label; does not change gameplay");
ConvarManager.CreateConVar("zp_bot_stats_cohort", "trained", 8, "trained, heldout or retention; reserved cohorts force frozen evaluation");
ConvarManager.CreateConVar("zp_bot_stats_opponent", "uncontrolled", 8, "Fixed opponent checkpoint label; uncontrolled disables combat inference");
for (const [name, value] of [["sample", 0.5], ["stuck_speed", 5], ["timeout", 30], ["block", 100], ["retention", 2000]] as const)
    ConvarManager.CreateConVar("zp_bot_stats_" + name, value, 8, "Bot statistics collection/analysis setting");
ConvarManager.CreateConVar("zp_bot_stats_utc_offset", -180, 8, "History timezone offset in minutes; -180 is Sao Paulo (UTC-03:00)");
ConvarManager.CreateConVar("zp_bot_stats_days", 90, 8, "Days of descriptive hourly history to keep, capped at 4096 buckets / 8 MiB");
ConvarManager.CreateConVar("zp_bot_training", 0, 8, "Train AI bots with human spectators and minimal round delays");
ConvarManager.CreateConVar("zp_bot_training_count", 2, 8, "Number of training bots, between 2 and 64, limited by available server slots");
ConvarManager.CreateConVar("zp_bot_ai_enabled", 1, 8, "Enable decisions for managed AI bots");
ConvarManager.CreateConVar("zp_bot_learning", 1, 8, "Learn tactical preferences from managed bots' combat outcomes");
ConvarManager.CreateConVar("zp_bot_learning_trace", 0, 8, "Log bounded learning attribution diagnostics to the server console");
ConvarManager.CreateConVar("zp_bot_learning_trace_bot", 0, 8, "Diagnostic bot identity filter; zero includes every managed bot");
// A single realm instance owns all bots and saved identities. Engine callbacks never use SteamID64 as a bot key.
export const bots = new BotController();
concommand.Add("zp_bot_learning_trace_export", ply => { if (!IsValid(ply) || ply.IsSuperAdmin()) bots.Trace.Export(); });
concommand.Add("zp_bot_learning_trace_mark", (ply, _command, args) => {
    if (IsValid(ply) && !ply.IsSuperAdmin()) return;
    const id = tonumber(args[0] ?? "");
    const label = args[1] ?? "";
    if (id !== undefined && id >= 1 && id <= 64 && Math.floor(id) === id &&
        ["active_start", "active_end", "evaluation_start", "evaluation_end", "manual_fall"].includes(label)) bots.MarkTrace(id, label);
});
const statistics = new BotStatisticsService(bots);
statistics.Register();
util.AddNetworkString("ZPBotStatisticsRequest"); util.AddNetworkString("ZPBotStatisticsReply");
net.Receive("ZPBotStatisticsRequest", (length, ply) => statistics.Receive(length, ply));
hook.Add("PlayerDisconnected", "ZPBotStatistics", ply => statistics.Remove(ply as ZPServerPlayer));
const populationConfig = new BotPopulationConfig();
const spawner = new BotSpawner(bots, () => populationConfig.Enabled ? 1 : 0);
export const population = new BotPopulation(bots, populationConfig, spawner);
const populationService = new BotPopulationService(population);
const training = new BotTraining(bots, new BotSpawner(bots, () => 0), RoundManager as ZPServerRoundManager);
hook.Add("InitPostEntity", "ZPBotTraining", () => training.Ready());
timer.Create("ZPBotTraining", 0.25, 0, () => training.Tick());
util.AddNetworkString("ZPBotPopulationRequest"); util.AddNetworkString("ZPBotPopulationReply");
net.Receive("ZPBotPopulationRequest", (length, ply) => populationService.Receive(length, ply));
hook.Add("PlayerConnect", "ZPBotPopulation", (_name, ip) => { if (ip !== "none") population.Connect(); });
hook.Add("PlayerDisconnected", "ZPBotPopulation", ply => { populationService.Disconnect(ply); population.Disconnect(ply as ZPServerPlayer); });
timer.Create("ZPBotPopulation", 0.25, 0, () => population.Tick());
const boosts = new BotBoostEditorService(bots.Boosts, () => bots.ManagedPlayers());
util.AddNetworkString("ZPBotBoostRequest"); util.AddNetworkString("ZPBotBoostReply");
net.Receive("ZPBotBoostRequest", (length, ply) => boosts.Receive(length, ply));
hook.Add("PlayerDisconnected", "ZPBotBoostEditor", ply => boosts.Remove(ply as ZPServerPlayer));
timer.Create("ZPBotBoostTool", 0.5, 0, () => boosts.Tick());
timer.Create("ZPBotBoostSave", 30, 0, () => bots.Boosts.Save());
hook.Add("ShutDown", "ZPBotBoostSave", () => bots.Boosts.Save());
const metrics = new BotMetricsService(bots);
util.AddNetworkString("ZPBotMetricsRequest");
util.AddNetworkString("ZPBotMetricsReply");
net.Receive("ZPBotMetricsRequest", (length, ply) => metrics.Receive(length, ply));
hook.Add("PlayerDisconnected", "ZPBotMetrics", ply => metrics.Remove(ply));
if (BOT_MODE) {
    register(bots, isProfile, spawner);
    hook.Add("Think", "ZPAdaptiveBots", () => bots.Update());
    hook.Add("StartCommand", "ZPAdaptiveBots", (ply, command) => bots.Command(ply, command));
    hook.Add("PlayerSpawn", "ZPAdaptiveBots", ply => bots.Reset(ply));
    hook.Add("PlayerDisconnected", "ZPAdaptiveBots", ply => bots.Remove(ply as ZPServerPlayer));
    hook.Add("PostEntityTakeDamage", "ZPAdaptiveBots", (target, damage, took) => bots.Damage(target, damage, took));
    // Observe deaths before PostPlayerDeath can end the round and clear the active episode.
    hook.Add("DoPlayerDeath", "ZPAdaptiveBots", (ply, killer, damage) => bots.Death(ply, killer, damage));
    hook.Add("ZPInfectionEvent", "ZPAdaptiveBots", (target, attacker) => bots.Infection(target, attacker));
    hook.Add("ZPCureEvent", "ZPAdaptiveBots", ply => bots.Reset(ply));
    hook.Add("ZPEndRound", "ZPAdaptiveBots", result => bots.EndRound(result));
    hook.Add("ShutDown", "ZPAdaptiveBots", () => {
        for (const ply of player.GetBots()) bots.Reset(ply);
        bots.Save();
    });
    timer.Create("ZPAdaptiveBotsSave", 30, 0, () => bots.Save());
}
