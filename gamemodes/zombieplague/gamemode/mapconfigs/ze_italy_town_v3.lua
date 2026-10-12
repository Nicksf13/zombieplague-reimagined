-- Generated from src/gamemodes/zombieplague/gamemode/maps/server/configs/ze_italy_town_v3.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
MapConfig.MapName = "ze_italy_town_v3"
MapConfig.Start = function(self)
    RunConsoleCommand("zp_infection_delay", "20")
    RunConsoleCommand("zp_round_time", "450")
    RunConsoleCommand("sv_gravity", "450")
end
return ____exports
