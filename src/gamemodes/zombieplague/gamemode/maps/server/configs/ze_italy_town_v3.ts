export {};
MapConfig.MapName = "ze_italy_town_v3";
MapConfig.Start = function (this: ZPMapConfig): void {
    RunConsoleCommand("zp_infection_delay", "20");
    RunConsoleCommand("zp_round_time", "450");
    RunConsoleCommand("sv_gravity", "450");
};
