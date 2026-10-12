-- Generated from src/gamemodes/zombieplague/gamemode/rounds/server/sv_roundmanager.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end
-- End of Lua Library inline imports
local ____exports = {}
local manager = RoundManager
for ____, ____value in ipairs({
    {"zp_min_players", 2, "Minimum players to start a round"},
    {"zp_newround_delay", 10, "Delay before a new round"},
    {"zp_infection_delay", 10, "Delay before infection"},
    {"zp_freeze_time_delay", 10, "Freeze time before a round"},
    {"zp_max_rounds", 10, "Rounds before the map vote"},
    {"zp_round_time", 300, "Round duration"},
    {"zp_should_winning_reward", 1, "Reward round winners"},
    {"zp_winning_reward_prize", 5, "Winner ammo pack reward"}
}) do
    local name = ____value[1]
    local value = ____value[2]
    local description = ____value[3]
    ConvarManager:CreateConVar(name, value, 8, description)
end
manager.Rounds = {}
manager.PlayersToPlay = {}
manager.ExtraRounds = 0
manager.PlayersToReward = {[TEAM_HUMANS] = {}, [TEAM_ZOMBIES] = {}}
include("sv_round_players.lua")
include("sv_round_defaults.lua")
include("sv_round_lifecycle.lua")
manager.SearchRounds = function(self)
    self:AddDefaultRounds()
    for ____, path in pairs(Utils:RecursiveFileSearch("zombieplague/gamemode/rounds", ".lua")) do
        include(path)
    end
end
manager.AddExtraRounds = function(self, amount)
    self.ExtraRounds = self.ExtraRounds + amount
end
manager.AddRoundType = function(self, id, round)
    self.Rounds[id] = round
    for ____, sound in ipairs(round.StartSound or ({})) do
        resource.AddFile("sound/" .. sound)
    end
end
manager.GetServerStatus = function(self)
    return {
        Timer = self:GetTime(),
        RoundState = self:GetRoundState(),
        Round = self:GetRound(),
        Players = __TS__ArrayMap(
            self:GetPlayersToPlay(),
            function(____, ply) return {
                ID = PlayerManager:GetPlayerID(ply),
                AmmoPacks = ply:GetAmmoPacks(),
                Battery = ply:GetMaxBatteryCharge(),
                ZombieClass = ply:GetZombieClass().Name,
                HumanClass = ply:GetHumanClass().Name,
                Light = ply:GetLight(),
                Footstep = ply:GetFootstep(),
                AbilityPower = ply:GetAbilityPower(),
                MaxAbilityPower = ply:GetMaxAbilityPower()
            } end
        )
    }
end
manager.RoundsLeft = function(self)
    return cvars.Number("zp_max_rounds", 10) + self.ExtraRounds - self:GetRound()
end
manager.GetCurrentRoundPlaying = function(self)
    return self.RoundPlaying
end
manager.GetRounds = function(self)
    return self.Rounds
end
manager.GetGoodRounds = function(self)
    local result = {}
    local count = self:CountPlayersToPlayAlive()
    for id, round in pairs(self.Rounds) do
        if count >= round.MinPlayers then
            result[id] = round
        end
    end
    return result
end
manager.ShouldRoundEnd = function(self)
    return self:NoHumans() or self:NoZombies()
end
hook.Add(
    "PostPlayerDeath",
    "RoundEndCheck",
    function(ply)
        if manager:GetRoundState() ~= ROUND_PLAYING then
            return
        end
        local round = manager:GetCurrentRoundPlaying()
        local ____opt_0 = round and round.OnDeathFunction
        if ____opt_0 ~= nil then
            ____opt_0(ply)
        end
        timer.Create(
            "ZPEndRound" .. tostring(CurTime()),
            0.1,
            1,
            function() return manager:CheckRoundEnd() end
        )
    end
)
hook.Add(
    "ZPPrePreparingRound",
    "ZPPrePreparingRoundWinnerClean",
    function()
        manager.PlayersToReward = {[TEAM_HUMANS] = {}, [TEAM_ZOMBIES] = {}}
    end
)
hook.Add(
    "ZPEndRound",
    "ZPEndRoundWinnerReward",
    function(reason)
        if not cvars.Bool("zp_should_winning_reward", true) or reason == ROUND_DRAW then
            return
        end
        local team = reason == ZOMBIES_WIN and TEAM_ZOMBIES or TEAM_HUMANS
        for ____, id in ipairs(manager.PlayersToReward[team] or ({})) do
            local ____opt_4 = manager:ReturnValidPlayerToBeRewardedOrNil(id, team)
            if ____opt_4 ~= nil then
                ____opt_4:GiveAmmoPacks(cvars.Number("zp_winning_reward_prize", 5))
            end
        end
    end
)
for ____, name in ipairs({"SyncTimer", "SendRoundEnd"}) do
    util.AddNetworkString(name)
end
return ____exports
