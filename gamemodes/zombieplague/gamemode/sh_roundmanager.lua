-- Generated from src/gamemodes/zombieplague/gamemode/rounds/shared/sh_roundmanager.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.RoundManager = __TS__Class()
local RoundManager = ____exports.RoundManager
RoundManager.name = "RoundManager"
function RoundManager.prototype.____constructor(self)
end
function RoundManager.prototype.SetSpecialRound(self, specialRound)
    SetGlobalBool("SpecialRound", specialRound)
end
function RoundManager.prototype.SetRespawn(self, respawn)
    SetGlobalBool("Respawn", respawn)
end
function RoundManager.prototype.SetRound(self, round)
    SetGlobalInt("Round", round)
end
function RoundManager.prototype.SetRoundState(self, state)
    SetGlobalInt("RoundState", state)
end
function RoundManager.prototype.IsSpecialRound(self)
    return GetGlobalBool("SpecialRound", false)
end
function RoundManager.prototype.IsRespawn(self)
    return GetGlobalBool("Respawn", false)
end
function RoundManager.prototype.GetRound(self)
    return GetGlobalInt("Round", 0)
end
function RoundManager.prototype.GetRoundState(self)
    return GetGlobalInt("RoundState", ROUND_WAITING_PLAYERS)
end
function RoundManager.prototype.IsPlayingRound(self)
    return self:GetRoundState() == ROUND_PLAYING
end
function RoundManager.prototype.IsRealisticMod(self)
    return cvars.Bool("zp_realistic_mode", false)
end
function RoundManager.prototype.LastHuman(self)
    local count = 0
    for ____, ply in ipairs(team.GetPlayers(TEAM_HUMANS)) do
        if ply:Alive() then
            count = count + 1
            if count > 1 then
                return false
            end
        end
    end
    return count == 1
end
function RoundManager.prototype.LastZombie(self)
    local count = 0
    for ____, ply in ipairs(team.GetPlayers(TEAM_ZOMBIES)) do
        if ply:Alive() then
            count = count + 1
            if count > 1 then
                return false
            end
        end
    end
    return count == 1
end
function RoundManager.prototype.NoHumans(self)
    for ____, ply in ipairs(team.GetPlayers(TEAM_HUMANS)) do
        if ply:Alive() then
            return false
        end
    end
    return true
end
function RoundManager.prototype.NoZombies(self)
    for ____, ply in ipairs(team.GetPlayers(TEAM_ZOMBIES)) do
        if ply:Alive() then
            return false
        end
    end
    return true
end
function RoundManager.prototype.CountHumansAlive(self)
    local count = 0
    for ____, ply in ipairs(team.GetPlayers(TEAM_HUMANS)) do
        if ply:Alive() then
            count = count + 1
        end
    end
    return count
end
function RoundManager.prototype.CountZombiesAlive(self)
    local count = 0
    for ____, ply in ipairs(team.GetPlayers(TEAM_ZOMBIES)) do
        if ply:Alive() then
            count = count + 1
        end
    end
    return count
end
function RoundManager.prototype.GetAliveHumans(self)
    local aliveHumans = {}
    for ____, ply in ipairs(team.GetPlayers(TEAM_HUMANS)) do
        if ply:Alive() then
            aliveHumans[#aliveHumans + 1] = ply
        end
    end
    return aliveHumans
end
function RoundManager.prototype.GetAliveZombies(self)
    local aliveZombies = {}
    for ____, ply in ipairs(team.GetPlayers(TEAM_ZOMBIES)) do
        if ply:Alive() then
            aliveZombies[#aliveZombies + 1] = ply
        end
    end
    return aliveZombies
end
function RoundManager.prototype.GetAlivePlayers(self)
    local alivePlayers = self:GetAliveHumans()
    for ____, ply in ipairs(self:GetAliveZombies()) do
        alivePlayers[#alivePlayers + 1] = ply
    end
    return alivePlayers
end
local roundManager = __TS__New(____exports.RoundManager)
_G.RoundManager = roundManager
return ____exports
