-- Generated from src/gamemodes/zombieplague/gamemode/rounds/server/sv_round_defaults.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__CountVarargs(...)
    return select("#", ...)
end

local function __TS__ArraySplice(self, ...)
    local args = {...}
    local len = #self
    local actualArgumentCount = __TS__CountVarargs(...)
    local start = args[1]
    local deleteCount = args[2]
    if start < 0 then
        start = len + start
        if start < 0 then
            start = 0
        end
    elseif start > len then
        start = len
    end
    local itemCount = actualArgumentCount - 2
    if itemCount < 0 then
        itemCount = 0
    end
    local actualDeleteCount
    if actualArgumentCount == 0 then
        actualDeleteCount = 0
    elseif actualArgumentCount == 1 then
        actualDeleteCount = len - start
    else
        actualDeleteCount = deleteCount or 0
        if actualDeleteCount < 0 then
            actualDeleteCount = 0
        end
        if actualDeleteCount > len - start then
            actualDeleteCount = len - start
        end
    end
    local out = {}
    for k = 1, actualDeleteCount do
        local from = start + k
        if self[from] ~= nil then
            out[k] = self[from]
        end
    end
    if itemCount < actualDeleteCount then
        for k = start + 1, len - actualDeleteCount do
            local from = k + actualDeleteCount
            local to = k + itemCount
            if self[from] then
                self[to] = self[from]
            else
                self[to] = nil
            end
        end
        for k = len - actualDeleteCount + itemCount + 1, len do
            self[k] = nil
        end
    elseif itemCount > actualDeleteCount then
        for k = len - actualDeleteCount, start + 1, -1 do
            local from = k + actualDeleteCount
            local to = k + itemCount
            if self[from] then
                self[to] = self[from]
            else
                self[to] = nil
            end
        end
    end
    local j = start + 1
    for i = 3, actualArgumentCount do
        self[j] = args[i]
        j = j + 1
    end
    for k = #self, len - actualDeleteCount + itemCount + 1, -1 do
        self[k] = nil
    end
    return out
end
-- End of Lua Library inline imports
local ____exports = {}
local manager = RoundManager
manager.AddDefaultRounds = function(self)
    local splitTeams
    local function reward(ply)
        return self:AddPlayerToBeRewarded(ply)
    end
    local simple = {
        Name = "RoundSimpleName",
        MinPlayers = cvars.Number("zp_min_players", 2),
        Chance = 100,
        SpecialRound = false,
        Respawn = false,
        Order = 1,
        StartFunction = function(selected)
            local players = self:GetPlayersToPlay(true)
            local first = selected or SafeTableRandom(players)
            if not first then
                return
            end
            first:Infect()
            for ____, ply in ipairs(players) do
                reward(ply)
                SendNotifyMessage(
                    ply,
                    {Phrase = "zombieplague.roundsimple"},
                    5,
                    Color(0, 255, 0)
                )
                SendPopupMessage(
                    ply,
                    {
                        Phrase = "zombieplague.noticefirstzombie",
                        Arguments = {first:Name()}
                    }
                )
            end
        end,
        RespawnFunction = function()
            return manager:CountHumansAlive() > 1
        end
    }
    local multi = {
        Name = "RoundMultiInfectionName",
        Chance = 15,
        MinPlayers = 4,
        Order = 2,
        Respawn = false,
        StartFunction = function()
            local players = self:GetPlayersToPlay(true)
            do
                local i = 0
                while i < 2 and #players > 0 do
                    local selected = __TS__ArraySplice(
                        players,
                        math.random(1, #players) - 1,
                        1
                    )[1]
                    if selected then
                        selected:Infect()
                    end
                    i = i + 1
                end
            end
            for ____, ply in ipairs(players) do
                reward(ply)
                SendNotifyMessage(
                    ply,
                    {Phrase = "zombieplague.noticemultiinfection"},
                    5,
                    Color(0, 255, 0)
                )
            end
        end,
        RespawnFunction = function()
            return manager:CountHumansAlive() > 1
        end
    }
    local nemesis
    nemesis = {
        Name = "RoundNemesisName",
        Chance = 5,
        MinPlayers = 5,
        SpecialRound = true,
        Respawn = false,
        StartSound = {"zombieplague/nemesis1.mp3", "zombieplague/nemesis2.mp3"},
        Order = 3,
        StartFunction = function()
            local players = self:GetPlayersToPlay(true)
            local selected = SafeTableRandom(players)
            if not selected then
                return
            end
            selected:MakeNemesis()
            for ____, ply in ipairs(players) do
                reward(ply)
                SendPopupMessage(
                    ply,
                    {
                        Phrase = "zombieplague.noticenemesis",
                        Arguments = {selected:Name()}
                    }
                )
                if nemesis.Respawn and ply:IsHuman() then
                    ply.Lifes = 5
                end
            end
        end
    }
    local survivor
    survivor = {
        Name = "RoundSurvivorName",
        Chance = 5,
        MinPlayers = 3,
        SpecialRound = true,
        StartSound = {"zombieplague/survivor1.mp3", "zombieplague/survivor2.mp3"},
        Order = 4,
        StartFunction = function()
            local players = self:GetPlayersToPlay(true)
            local selected = SafeTableRandom(players)
            if not selected then
                return
            end
            table.RemoveByValue(players, selected)
            for ____, ply in ipairs(players) do
                if survivor.Respawn then
                    ply.Lifes = 5
                end
                ply:Infect()
                reward(ply)
                SendNotifyMessage(
                    ply,
                    {
                        Phrase = "zombieplague.noticesurvivor",
                        Arguments = {selected:Name()}
                    },
                    5,
                    SURVIVOR_COLOR
                )
            end
            selected:MakeSurvivor()
            reward(selected)
        end
    }
    for ____, round in ipairs({nemesis, survivor}) do
        if round.Respawn then
            round.OnDeathFunction = function(ply)
                ply.Lifes = (ply.Lifes or 0) - 1
            end
            round.RespawnFunction = function(ply)
                return (ply.Lifes or 0) > 0
            end
        end
    end
    local swarm = {
        Name = "RoundSwarmName",
        Chance = 10,
        MinPlayers = 4,
        SpecialRound = true,
        StartSound = {"zombieplague/swarmmode.mp3"},
        Order = 5,
        StartFunction = function() return splitTeams("NoticeSwarm") end
    }
    local plague = {
        Name = "RoundPlagueName",
        Chance = 10,
        MinPlayers = 4,
        SpecialRound = true,
        StartSound = {"zombieplague/plaguemode.mp3"},
        Order = 6,
        StartFunction = function()
            splitTeams("NoticePlague")
            local ____opt_0 = SafeTableRandom(self:GetAliveZombies())
            if ____opt_0 ~= nil then
                ____opt_0:MakeNemesis()
            end
            local ____opt_2 = SafeTableRandom(self:GetAliveHumans())
            if ____opt_2 ~= nil then
                ____opt_2:MakeSurvivor()
            end
        end
    }
    splitTeams = function(phrase)
        local players = self:GetPlayersToPlay(true)
        local index = 1
        while #players > 0 do
            local selected = SafeTableRandom(players)
            if not selected then
                break
            end
            table.RemoveByValue(players, selected)
            if index % 2 == 0 then
                selected:Infect()
            end
            index = index + 1
            reward(selected)
            SendNotifyMessage(
                selected,
                {Phrase = "zombieplague." .. string.lower(phrase)},
                5,
                Color(0, 255, 0)
            )
        end
    end
    for ____, ____value in ipairs({
        {"SimpleRound", simple},
        {"MultiInfectionRound", multi},
        {"NemesisRound", nemesis},
        {"SurvivalRound", survivor},
        {"SwarmRound", swarm},
        {"PlagueRound", plague}
    }) do
        local id = ____value[1]
        local round = ____value[2]
        self:AddRoundType(id, round)
    end
end
return ____exports
