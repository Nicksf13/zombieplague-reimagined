-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
include("sv_player_classes.lua")
include("sv_player_abilities.lua")
include("sv_player_combat.lua")
include("sv_player_resources.lua")
include("sv_player_weapons.lua")
include("sv_player_state.lua")
include("sv_player_infection.lua")
net.Receive(
    "SendVoice",
    function(_length, ply) return ply:SetTalking(net.ReadBool()) end
)
util.AddNetworkString("SendAmmoPacks")
util.AddNetworkString("SendBatteryCharge")
util.AddNetworkString("SendMaxBatteryCharge")
util.AddNetworkString("SendZombieClass")
util.AddNetworkString("SendHumanClass")
util.AddNetworkString("SendNemesis")
util.AddNetworkString("SendSurvivor")
util.AddNetworkString("SendNightvision")
util.AddNetworkString("SendVoice")
util.AddNetworkString("SendLight")
util.AddNetworkString("SendFoostep")
util.AddNetworkString("SendAbilityPower")
util.AddNetworkString("SendMaxAbilityPower")
util.AddNetworkString("SendBreath")
util.AddNetworkString("SendMaxBreath")
util.AddNetworkString("SendScreenFilter")
util.AddNetworkString("SendPoints")
return ____exports
