export {};
_G.BOT_MODE = true;
include("shared.lua");
include("sv_utils.lua");
include("sv_commands.lua");
include("sv_convar.lua");
include("sv_config.lua");
include("sv_player.lua");
include("sv_localization.lua");
include("sv_message.lua");
include("sv_classmanager.lua");
include("sv_roundmanager.lua");
include("sv_eventmanager.lua");
include("sv_infectionmanager.lua");
include("sv_weaponmanager.lua");
include("sv_extraitems.lua");
include("sv_particlemanager.lua");
include("sv_votemap.lua");
include("sv_mapmanager.lua");
include("sv_bank.lua");
AddCSLuaFile("shared.lua");
AddCSLuaFile("sh_bank.lua");
AddCSLuaFile("sh_roundmanager.lua");
AddCSLuaFile("sh_player.lua");
AddCSLuaFile("sh_playermanager.lua");
AddCSLuaFile("cl_hud.lua");
AddCSLuaFile("cl_data.lua");
AddCSLuaFile("cl_message.lua");
AddCSLuaFile("cl_player.lua");
AddCSLuaFile("cl_roundmanager.lua");
AddCSLuaFile("cl_particlemanager.lua");
AddCSLuaFile("cl_keymanager.lua");
AddCSLuaFile("cl_scoreboard.lua");
_G.SafeTableRandom = function <T>(this: void, values: ZPLuaTable<T>): T | undefined {
    // Assign only the first return: callers must not receive table.Random's key.
    const [value] = table.Random(values);
    return value;
};
hook.Add("PlayerDisconnected", "ZombiePlagueDisconnect", (ply) => {
    (RoundManager as ZPServerRoundManager).RemovePlayerToPlay(ply);
});
hook.Add("Initialize", "ServerReady", () => {
    ClassManager.SearchClasses();
    (RoundManager as ZPServerRoundManager).SearchRounds();
    WeaponManager.SearchWeapons();
    ExtraItemsManager.Search();
    MapManager.SearchConfigs();
});
net.Receive("RequestServerStatus", (_length, ply) => {
    (RoundManager as ZPServerRoundManager).AddPlayerToPlay(ply);
    const status = (RoundManager as ZPServerRoundManager).GetServerStatus(ply);
    net.Start("SendServerStatus");
    net.WriteTable(status);
    net.Send(ply);
});
util.AddNetworkString("RequestServerStatus");
util.AddNetworkString("SendServerStatus");
