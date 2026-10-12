export {};
MapConfig.Prefix = "ze_";
MapConfig.Start = function (this: ZPMapConfig): void {
    RunConsoleCommand("zp_map_prop_damage_multiplier", "2");
    RunConsoleCommand("zp_round_time", "450");
    RunConsoleCommand("sv_gravity", "450");
    hook.Add("ZPNewRound", "ze_zombie_respawn", () => {
        for (const ply of (RoundManager as ZPServerRoundManager).GetAliveZombies())
            ply.Spawn();
    });
};
