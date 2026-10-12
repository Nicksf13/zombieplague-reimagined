-- Generated from src/gamemodes/zombieplague/gamemode/maps/server/configs/ze_maps.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
MapConfig.Prefix = "ze_"
MapConfig.Start = function(self)
    RunConsoleCommand("zp_map_prop_damage_multiplier", "2")
    RunConsoleCommand("zp_round_time", "450")
    RunConsoleCommand("sv_gravity", "450")
    hook.Add(
        "ZPNewRound",
        "ze_zombie_respawn",
        function()
            for ____, ply in ipairs(RoundManager:GetAliveZombies()) do
                ply:Spawn()
            end
        end
    )
end
return ____exports
