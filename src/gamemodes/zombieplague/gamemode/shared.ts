// Isolate file-local TypeScript names; GMod ignores the empty module return.
export {};
// Shared weapons call this on both the server and the predicting client.
_G.SafeTableRandom = function <T>(this: void, values: ZPLuaTable<T>): T | undefined {
    // Assign only the first return: callers must not receive table.Random's key.
    const [value] = table.Random(values);
    return value;
};
GM.Name = "Zombie Plague (For GMOD)";
GM.Author = "The Fire Fuchs (Original Author: MeRcyLeZZ)";
GM.Email = "";
GM.Website = "";
_G.TEAM_HUMANS = 3;
_G.TEAM_ZOMBIES = 2;
_G.ZOMBIES_WIN = 1;
_G.HUMANS_WIN = 2;
_G.ROUND_DRAW = 3;
_G.ROUND_WAITING_PLAYERS = 0;
_G.ROUND_STARTING_NEW_ROUND = 1;
_G.ROUND_PLAYING = 2;
_G.ROUND_ENDING = 3;
_G.ROUND_RESTARTING = 4;
_G.ROUND_VOTEMAP = 5;
_G.ROUND_CHANGING_MAP = 6;
_G.NIGHTVISION_COLOR = Color(0, 255, 0);
_G.NEMESIS_COLOR = Color(255, 0, 0);
_G.SURVIVOR_COLOR = Color(0, 0, 255);
_G.HUMANS_COLOR = Color(71, 141, 255, 255);
_G.ZOMBIES_COLOR = Color(255, 56, 56, 255);
_G.ZombieKnifeSound = [
    "zombieplague/knife_slash1.mp3",
    "zombieplague/knife_slash2.mp3",
];
GM.CreateTeams = function (this: ZPGameMode): void {
    team.SetUp(TEAM_HUMANS, "Humans", HUMANS_COLOR, false);
    team.SetUp(TEAM_ZOMBIES, "Zombies", ZOMBIES_COLOR, false);
    team.SetSpawnPoint(TEAM_ZOMBIES, "info_player_terrorist");
    team.SetSpawnPoint(TEAM_HUMANS, "info_player_counterterrorist");
    team.SetColor(TEAM_SPECTATOR, Color(0, 255, 0));
};
include("sh_roundmanager.lua");
include("sh_player.lua");
include("sh_bank.lua");
include("sh_playermanager.lua");
include("sh_weapon_menu_protocol.lua");
include("sh_class_menu_protocol.lua");
include("sh_extra_menu_protocol.lua");
include("sh_admin_config.lua");
