import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import fengari from "fengari";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { lua, lauxlib, lualib, to_luastring } = fengari;
const names = ["init", "shared", "sh_roundmanager", "sh_player", "sh_bank", "sh_playermanager", "sh_weapon_menu_protocol", "sh_class_menu_protocol", "sh_extra_menu_protocol", "sh_map_vote_protocol", "sh_admin_config", "sh_server_cvars", "sh_server_cvar_catalog", "sh_radar_rules", "sh_spectator_protocol", "sh_bot_metrics_protocol", "sh_bot_motion_protocol", "sh_bot_place_protocol", "sh_bot_safe_protocol", "sh_bot_boost_protocol", "sh_bot_boost_rules"];
const files = Object.fromEntries(await Promise.all(names.map(async name => [
    `${name}.lua`, await readFile(path.join(root, "gamemodes/zombieplague/gamemode", `${name}.lua`), "utf8"),
])));

function quoteLua(value) {
    let equals = "";
    while (value.includes(`]${equals}]`)) equals += "=";
    return `[${equals}[${value}]${equals}]`;
}

// A deliberately small engine substitute. It checks calling conventions and
// keeps bool/int globals separate, as GMod's networking API does.
const bootstrap = `
unpack = table.unpack
GM = {}
TEAM_SPECTATOR = 1002
FCVAR_REPLICATED = 8192
local meta = {}
local players = {}
local bools, ints, convars, registeredTeams = {}, {}, {}, {}
local includeOrder = {}

function Color(r, g, b, a)
    assert(type(r) == "number" and type(g) == "number" and type(b) == "number")
    return {r = r, g = g, b = b, a = a or 255}
end
function FindMetaTable(name)
    assert(name == "Player")
    return meta
end
function CreateConVar(name, value, flags, help)
    assert(type(name) == "string" and type(value) == "string")
    assert(type(flags) == "number" and type(help) == "string")
    convars[name] = {value = value, flags = flags, help = help}
    return {}
end
function SetGlobalBool(name, value)
    assert(type(name) == "string" and type(value) == "boolean")
    bools[name] = value
end
function GetGlobalBool(name, fallback)
    assert(type(name) == "string" and type(fallback) == "boolean")
    if bools[name] == nil then return fallback end
    return bools[name]
end
function SetGlobalInt(name, value)
    assert(type(name) == "string" and type(value) == "number")
    ints[name] = value
end
function GetGlobalInt(name, fallback)
    assert(type(name) == "string" and type(fallback) == "number")
    if ints[name] == nil then return fallback end
    return ints[name]
end

team = {}
function team.SetUp(id, name, color, joinable)
    assert(type(id) == "number" and type(name) == "string")
    assert(color.a == 255 and joinable == false)
    registeredTeams[id] = {name = name, color = color}
end
function team.SetSpawnPoint(id, entity)
    assert(type(id) == "number" and type(entity) == "string")
    registeredTeams[id].spawn = entity
end
function team.SetColor(id, color)
    assert(type(id) == "number" and color.g == 255)
    registeredTeams[id] = registeredTeams[id] or {}
    registeredTeams[id].color = color
end
function team.GetPlayers(id)
    assert(type(id) == "number")
    local result = {}
    for _, ply in ipairs(players) do
        if ply:Team() == id then result[#result + 1] = ply end
    end
    return result
end
player = {GetAll = function() return players end}
cvars = {Bool = function(name, fallback)
    assert(name == "zp_realistic_mode" and fallback == false)
    return false
end}

function meta:Team() assert(self.teamID ~= nil); return self.teamID end
function meta:Alive() assert(self.alive ~= nil); return self.alive end
function meta:SteamID64() assert(self.id ~= nil); return self.id end
function addPlayer(teamID, alive, id)
    local ply = setmetatable({teamID = teamID, alive = alive, id = id}, {__index = meta})
    players[#players + 1] = ply
    return ply
end
function require(name) error("Unexpected require dependency: " .. name) end
`;

function runLua(scenario, server = true, { entry = "shared.lua", setup = "" } = {}) {
    const state = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(state);
    const loader = Object.entries(files).map(([name, content]) =>
        `[ ${quoteLua(name)} ] = ${quoteLua(content)}`).join(",\n");
    const source = `${bootstrap}
        SERVER = ${server}; CLIENT = ${!server}
        local sources = {${loader}}
        local legacyIncludes = {}
        function include(name)
            includeOrder[#includeOrder + 1] = name
            if sources[name] then
                return assert(load(sources[name], "@" .. name))()
            else
                return assert(legacyIncludes[name], "Missing include: " .. name)()
            end
        end
        ${setup}
        include(${quoteLua(entry)})
        ${scenario}
    `;
    try {
        const status = lauxlib.luaL_dostring(state, to_luastring(source));
        assert.equal(status, lua.LUA_OK, lua.lua_tojsstring(state, -1) ?? "Lua execution failed");
    } finally {
        lua.lua_close(state);
    }
}

for (const server of [true, false]) {
    test(`SafeTableRandom is available to shared weapons in the ${server ? "server" : "client"} realm`, () => runLua(`
        function table.Random(values)
            for key, value in pairs(values) do return value, key end
            return nil, nil
        end
        assert(type(SafeTableRandom) == "function")
        local sound = SafeTableRandom(ZombieKnifeSound)
        assert(sound == ZombieKnifeSound[1] or sound == ZombieKnifeSound[2])
        assert(SafeTableRandom({enabled = false}) == false)
        assert(SafeTableRandom({count = 0}) == 0)
        assert(select("#", SafeTableRandom({key = "value"})) == 1)
        assert(select("#", SafeTableRandom({})) == 1)
    `, server));
    test(`shared entry point loads in the ${server ? "server" : "client"} realm`, () => runLua(`
        assert(GM.Name == "Zombie Plague (For GMOD)")
        assert(TEAM_HUMANS == 3 and TEAM_ZOMBIES == 2)
        assert(ROUND_WAITING_PLAYERS == 0 and ROUND_CHANGING_MAP == 6)
        assert(table.concat(includeOrder, ",") == "shared.lua,sh_roundmanager.lua,sh_player.lua,sh_bank.lua,sh_playermanager.lua,sh_weapon_menu_protocol.lua,sh_class_menu_protocol.lua,sh_extra_menu_protocol.lua,sh_map_vote_protocol.lua,sh_admin_config.lua,sh_server_cvars.lua,sh_server_cvar_catalog.lua,sh_radar_rules.lua,sh_spectator_protocol.lua,sh_bot_metrics_protocol.lua,sh_bot_motion_protocol.lua,sh_bot_place_protocol.lua,sh_bot_safe_protocol.lua,sh_bot_boost_protocol.lua,sh_bot_boost_rules.lua")
        assert(PLAYER == nil, "Player metatable alias leaked into globals")
        assert(#ZombieKnifeSound == 2 and NIGHTVISION_COLOR.g == 255)
        assert(convars.zp_givetake_ammopacks_allowed.value == "1")
        assert(convars.zp_givetake_ammopacks_allowed.flags == FCVAR_REPLICATED)
        GM:CreateTeams()
        assert(registeredTeams[TEAM_HUMANS].name == "Humans")
        assert(registeredTeams[TEAM_ZOMBIES].spawn == "info_player_terrorist")
        assert(registeredTeams[TEAM_HUMANS].spawn == "info_player_counterterrorist")
        assert(registeredTeams[TEAM_SPECTATOR].color.g == 255)
    `, server));
}

test("round flags round-trip true and false through the boolean API", () => runLua(`
    assert(RoundManager:IsSpecialRound() == false)
    assert(RoundManager:IsRespawn() == false)
    RoundManager:SetSpecialRound(true)
    RoundManager:SetRespawn(true)
    assert(RoundManager:IsSpecialRound() == true)
    assert(RoundManager:IsRespawn() == true)
    RoundManager:SetSpecialRound(false)
    RoundManager:SetRespawn(false)
    assert(RoundManager:IsSpecialRound() == false)
    assert(RoundManager:IsRespawn() == false)
    assert(ints.SpecialRound == nil and ints.Respawn == nil)
`));

test("round number, state and realistic-mode calls preserve the public API", () => runLua(`
    assert(RoundManager:GetRound() == 0)
    assert(RoundManager:GetRoundState() == ROUND_WAITING_PLAYERS)
    assert(not RoundManager:IsPlayingRound())
    RoundManager:SetRound(12)
    assert(RoundManager:GetRound() == 12)
    for state = ROUND_WAITING_PLAYERS, ROUND_CHANGING_MAP do
        RoundManager:SetRoundState(state)
        assert(RoundManager:GetRoundState() == state)
        assert(RoundManager:IsPlayingRound() == (state == ROUND_PLAYING))
    end
    assert(RoundManager:IsRealisticMod() == false)
`));

test("alive-player queries handle empty teams, deaths, spectators and multiple survivors", () => runLua(`
    assert(RoundManager:NoHumans() and RoundManager:NoZombies())
    assert(not RoundManager:LastHuman() and not RoundManager:LastZombie())
    assert(#RoundManager:GetAlivePlayers() == 0)
    local human = addPlayer(TEAM_HUMANS, true, "human")
    local zombie = addPlayer(TEAM_ZOMBIES, true, "zombie")
    local deadHuman = addPlayer(TEAM_HUMANS, false, "dead-human")
    local deadZombie = addPlayer(TEAM_ZOMBIES, false, "dead-zombie")
    addPlayer(TEAM_SPECTATOR, true, "spectator")
    assert(RoundManager:LastHuman() and RoundManager:LastZombie())
    assert(not RoundManager:NoHumans() and not RoundManager:NoZombies())
    assert(RoundManager:CountHumansAlive() == 1 and RoundManager:CountZombiesAlive() == 1)
    assert(RoundManager:GetAliveHumans()[1] == human)
    assert(RoundManager:GetAliveZombies()[1] == zombie)
    local both = RoundManager:GetAlivePlayers()
    assert(#both == 2 and both[1] == human and both[2] == zombie)
    deadHuman.alive = true; deadZombie.alive = true
    assert(not RoundManager:LastHuman() and not RoundManager:LastZombie())
    assert(RoundManager:CountHumansAlive() == 2 and RoundManager:CountZombiesAlive() == 2)
    both = RoundManager:GetAlivePlayers()
    assert(#both == 4 and both[1] == human and both[2] == deadHuman and both[3] == zombie and both[4] == deadZombie)
    human.alive = false; deadHuman.alive = false
    assert(RoundManager:NoHumans() and not RoundManager:LastHuman())
    assert(#RoundManager:GetAliveHumans() == 0)
`));

test("Player metatable methods receive self and reflect team changes", () => runLua(`
    local ply = addPlayer(TEAM_HUMANS, true, "test")
    assert(ply:IsHuman() and not ply:IsZombie())
    ply.teamID = TEAM_ZOMBIES
    assert(ply:IsZombie() and not ply:IsHuman())
    ply.teamID = TEAM_SPECTATOR
    assert(not ply:IsZombie() and not ply:IsHuman())
`));

test("player lookup keeps SteamID64 exact and returns nil for missing players", () => runLua(`
    local first = addPlayer(TEAM_HUMANS, true, "76561198000000001")
    local second = addPlayer(TEAM_ZOMBIES, false, "76561198000000002")
    assert(PlayerManager:GetPlayerID(first) == "76561198000000001")
    assert(PlayerManager:DiscoverPlayerByTextID("76561198000000001") == first)
    assert(PlayerManager:DiscoverPlayerByTextID("76561198000000002") == second)
    assert(PlayerManager:DiscoverPlayerByTextID("missing") == nil)
    table.remove(players, 1)
    assert(PlayerManager:DiscoverPlayerByTextID("76561198000000001") == nil)
`));

test("unmigrated Lua can extend shared managers without replacing them", () => runLua(`
    local originalRoundManager = RoundManager
    function RoundManager:LegacyMethod() return self:GetRoundState() end
    function PlayerManager:LegacyMethod(ply) return self:GetPlayerID(ply) end
    RoundManager:SetRoundState(ROUND_ENDING)
    assert(RoundManager == originalRoundManager)
    assert(RoundManager:LegacyMethod() == ROUND_ENDING)
    assert(PlayerManager:LegacyMethod(addPlayer(TEAM_HUMANS, true, "legacy")) == "legacy")
`));

// Stub only the server dependencies of init.lua; shared Lua is executed above.
// Callbacks are invoked with the same argument convention as the GMod engine.
const serverSetup = `
    local initialized, hooks, receivers, clientFiles, networkStrings = {}, {}, {}, {}, {}
    local networkEvents, addedPlayers, removedPlayers = {}, {}, {}
    local lastStatus, lastRecipient
    local expectedServerIncludes = {
        "sv_utils.lua", "sv_commands.lua", "sv_convar.lua", "sv_config.lua",
        "sv_player.lua", "sv_localization.lua", "sv_message.lua", "sv_classmanager.lua",
        "sv_roundmanager.lua", "sv_eventmanager.lua", "sv_player_participation.lua", "sv_infectionmanager.lua",
        "sv_weaponmanager.lua", "sv_weapon_menu.lua", "sv_class_menu_apply.lua", "sv_class_menu.lua", "sv_extraitems.lua", "sv_extra_menu.lua", "sv_particlemanager.lua",
        "sv_votemap.lua", "sv_map_nominations.lua", "sv_mapmanager.lua", "sv_map_environment.lua", "sv_radar.lua", "sv_spectator_overview.lua", "sv_decoy.lua", "sv_admin_settings.lua", "sv_admin_rounds.lua", "sv_bank.lua", "sv_bots.lua", "sv_server_cvars.lua", "sv_dance.lua"
    }
    for _, name in ipairs(expectedServerIncludes) do
        legacyIncludes[name] = function() assert(BOT_MODE == true) end
    end
    legacyIncludes["sv_classmanager.lua"] = function()
        ClassManager = {SearchClasses = function(self)
            assert(self == ClassManager)
            initialized[#initialized + 1] = "classes"
        end}
    end
    legacyIncludes["sv_roundmanager.lua"] = function()
        function RoundManager:SearchRounds()
            assert(self == RoundManager)
            initialized[#initialized + 1] = "rounds"
        end
        function RoundManager:AddPlayerToPlay(ply)
            assert(self == RoundManager and ply.id ~= nil)
            addedPlayers[#addedPlayers + 1] = ply
            networkEvents[#networkEvents + 1] = "add-player"
        end
        function RoundManager:RemovePlayerToPlay(ply)
            assert(self == RoundManager and ply.id ~= nil)
            removedPlayers[#removedPlayers + 1] = ply
        end
        function RoundManager:GetServerStatus(ply)
            assert(self == RoundManager and ply.id ~= nil)
            networkEvents[#networkEvents + 1] = "status"
            return {Timer = 20, RoundState = ROUND_PLAYING, Round = 4, Players = {{ID = ply.id}}}
        end
    end
    legacyIncludes["sv_weaponmanager.lua"] = function()
        WeaponManager = {SearchWeapons = function(self)
            assert(self == WeaponManager)
            initialized[#initialized + 1] = "weapons"
        end}
    end
    legacyIncludes["sv_extraitems.lua"] = function()
        ExtraItemsManager = {Search = function(self)
            assert(self == ExtraItemsManager)
            initialized[#initialized + 1] = "items"
        end}
    end
    legacyIncludes["sv_mapmanager.lua"] = function()
        MapManager = {SearchConfigs = function(self)
            assert(self == MapManager)
            initialized[#initialized + 1] = "maps"
        end}
    end
    function AddCSLuaFile(name)
        assert(type(name) == "string")
        clientFiles[#clientFiles + 1] = name
    end
    hook = {Call = function(name, gm, ply)
        assert(name == "ZPPlayerEnvironmentReady" and gm == GM and ply.id ~= nil)
    end, Add = function(name, id, callback)
        assert(type(name) == "string" and type(id) == "string" and type(callback) == "function")
        hooks[name] = hooks[name] or {}
        assert(hooks[name][id] == nil)
        hooks[name][id] = callback
    end}
    util = {AddNetworkString = function(name)
        assert(type(name) == "string")
        networkStrings[#networkStrings + 1] = name
        return #networkStrings
    end}
    net = {
        Receive = function(name, callback)
            assert(name == "RequestServerStatus" and type(callback) == "function")
            receivers[name] = callback
        end,
        ReadString = function() error("Status requests must not contain a language") end,
        Start = function(name)
            assert(name == "SendServerStatus")
            networkEvents[#networkEvents + 1] = "start"
        end,
        WriteTable = function(status)
            assert(status.Round == 4 and status.RoundState == ROUND_PLAYING and status.Timer == 20)
            lastStatus = status
            networkEvents[#networkEvents + 1] = "write"
        end,
        Send = function(ply)
            assert(ply.id ~= nil)
            lastRecipient = ply
            networkEvents[#networkEvents + 1] = "send"
        end
    }
    function table.Random(values)
        for key, value in pairs(values) do return value, key end
        return nil, nil
    end
`;

const runServer = scenario => runLua(scenario, true, { entry: "init.lua", setup: serverSetup });

test("server init preserves include order, client downloads and network registration", () => runServer(`
    assert(BOT_MODE == true)
    local expectedIncludes = {"init.lua", "shared.lua", "sh_roundmanager.lua", "sh_player.lua", "sh_bank.lua", "sh_playermanager.lua", "sh_weapon_menu_protocol.lua", "sh_class_menu_protocol.lua", "sh_extra_menu_protocol.lua", "sh_map_vote_protocol.lua", "sh_admin_config.lua", "sh_server_cvars.lua", "sh_server_cvar_catalog.lua", "sh_radar_rules.lua", "sh_spectator_protocol.lua", "sh_bot_metrics_protocol.lua", "sh_bot_motion_protocol.lua", "sh_bot_place_protocol.lua", "sh_bot_safe_protocol.lua", "sh_bot_boost_protocol.lua", "sh_bot_boost_rules.lua"}
    for _, name in ipairs(expectedServerIncludes) do expectedIncludes[#expectedIncludes + 1] = name end
    assert(table.concat(includeOrder, ",") == table.concat(expectedIncludes, ","))
    local expectedClientFiles = {
        "shared.lua", "sh_bank.lua", "sh_roundmanager.lua", "sh_player.lua", "sh_playermanager.lua",
        "cl_hud.lua", "cl_theme_manager.lua", "cl_menu_controls.lua", "cl_theme_hud.lua", "cl_player_hud.lua",
        "cl_data.lua", "cl_message.lua", "cl_player.lua", "cl_special_aura.lua", "sh_dance.lua", "cl_dance.lua", "cl_dance_camera.lua", "sh_emotes.lua", "cl_emote_wheel.lua", "cl_emote_wheel_hud.lua", "cl_nightvision.lua", "cl_roundmanager.lua",
        "cl_particlemanager.lua", "cl_keymanager.lua", "cl_key_input.lua", "cl_scoreboard.lua", "cl_scoreboard_hud.lua",
        "sh_weapon_menu_protocol.lua", "sh_class_menu_protocol.lua", "sh_extra_menu_protocol.lua", "sh_map_vote_protocol.lua", "cl_map_vote.lua", "cl_map_vote_hud.lua", "cl_extra_menu.lua", "cl_extra_menu_hud.lua", "cl_class_menu.lua", "cl_class_menu_hud.lua",
        "cl_weapon_menu.lua", "cl_weapon_menu_hud.lua", "cl_main_menu.lua", "cl_main_menu_hud.lua",
        "cl_settings.lua", "cl_settings_hud.lua", "sh_admin_config.lua", "sh_server_cvars.lua", "sh_server_cvar_catalog.lua", "cl_server_cvars.lua", "cl_server_cvars_hud.lua", "cl_admin_menu.lua", "cl_admin_menu_hud.lua", "cl_admin_rounds.lua", "cl_admin_rounds_hud.lua",
        "sh_bot_metrics_protocol.lua", "sh_bot_statistics_analysis.lua", "cl_bot_statistics.lua", "cl_bot_statistics_hud.lua", "cl_bot_statistics_graph.lua", "sh_bot_motion_protocol.lua", "sh_bot_place_protocol.lua", "sh_bot_safe_protocol.lua", "cl_bot_safe_points.lua", "cl_bot_safe_hud.lua", "cl_bot_safe_markers.lua", "cl_bot_tool_screen.lua", "sh_bot_boost_protocol.lua", "sh_bot_boost_rules.lua", "cl_bot_boost.lua", "cl_bot_boost_hud.lua", "cl_bot_boost_markers.lua", "cl_bot_boost_preview.lua", "cl_bot_boost_presentation.lua", "cl_bot_boost_screen.lua", "cl_bot_metrics.lua", "cl_bot_recording.lua", "cl_bot_population.lua", "cl_bot_population_hud.lua", "cl_bot_metrics_hud.lua",
        "cl_bot_metrics_card.lua", "cl_bot_decision_graph.lua", "cl_bot_motion_hud.lua",
        "cl_map_environment.lua", "cl_map_material_catalog.lua",
        "sh_radar_rules.lua", "sh_spectator_protocol.lua", "cl_spectator_overview.lua", "cl_spectator_overview_hud.lua", "cl_spectator_overview_map.lua", "cl_radar.lua", "cl_radar_hud.lua",
        "cl_radar_capture.lua", "cl_radar_capture_analysis.lua", "cl_radar_capture_plan.lua", "cl_radar_capture_floors.lua", "cl_radar_capture_skybox.lua", "cl_radar_capture_render.lua",
    }
    assert(table.concat(clientFiles, ",") == table.concat(expectedClientFiles, ","))
    assert(table.concat(networkStrings, ",") == "RequestServerStatus,SendServerStatus")
    assert(type(hooks.Initialize.ServerReady) == "function")
    assert(type(hooks.PlayerDisconnected.ZombiePlagueDisconnect) == "function")
    assert(type(receivers.RequestServerStatus) == "function")
    assert(#initialized == 0, "Managers must wait for the Initialize hook")
`));

test("server initialization and disconnect hooks preserve self and player arguments", () => runServer(`
    hooks.Initialize.ServerReady()
    assert(table.concat(initialized, ",") == "classes,rounds,weapons,items,maps")
    local ply = addPlayer(TEAM_HUMANS, true, "disconnected")
    hooks.PlayerDisconnected.ZombiePlagueDisconnect(ply)
    assert(#removedPlayers == 1 and removedPlayers[1] == ply)
`));

test("server status request registers the sender and replies without a custom language", () => runServer(`
    local first = addPlayer(TEAM_HUMANS, true, "first")
    local second = addPlayer(TEAM_ZOMBIES, true, "second")
    receivers.RequestServerStatus(128, first)
    assert(#addedPlayers == 1 and addedPlayers[1] == first)
    assert(lastRecipient == first and lastStatus.Players[1].ID == "first")
    assert(table.concat(networkEvents, ",") == "add-player,status,start,write,send")
    receivers.RequestServerStatus(64, second)
    assert(#addedPlayers == 2 and addedPlayers[2] == second)
    assert(lastRecipient == second and lastStatus.Players[1].ID == "second")
`));

test("SafeTableRandom returns only the value, including false, zero and an empty table", () => runServer(`
    assert(SafeTableRandom({"sound.mp3"}) == "sound.mp3")
    local class = {Name = "Zombie"}
    assert(SafeTableRandom({DefaultZombie = class}) == class)
    assert(SafeTableRandom({enabled = false}) == false)
    assert(SafeTableRandom({count = 0}) == 0)
    assert(SafeTableRandom({}) == nil)
    assert(select("#", SafeTableRandom({key = "value"})) == 1)
    assert(select("#", SafeTableRandom({})) == 1)
`));
