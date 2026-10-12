-- Generated from src/gamemodes/zombieplague/gamemode/rounds/server/sv_round_players.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end

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
manager.AddPlayerToPlay = function(self, entry)
    local ply = entry
    if __TS__ArrayIncludes(self.PlayersToPlay, ply) then
        return
    end
    local ____self_PlayersToPlay_0 = self.PlayersToPlay
    ____self_PlayersToPlay_0[#____self_PlayersToPlay_0 + 1] = ply
    ply:SetTeam(TEAM_HUMANS)
    if self:GetRoundState() == ROUND_WAITING_PLAYERS and self:CountPlayersToPlay() >= cvars.Number("zp_min_players", 2) then
        self:RestartRound()
    end
end
manager.RemovePlayerToPlay = function(self, entry)
    local ply = entry
    local previousTeam = ply:Team()
    ply:SetTeam(TEAM_SPECTATOR)
    do
        local i = #self.PlayersToPlay - 1
        while i >= 0 do
            if self.PlayersToPlay[i + 1] == ply then
                __TS__ArraySplice(self.PlayersToPlay, i, 1)
            end
            i = i - 1
        end
    end
    local replaceZombie = previousTeam == TEAM_ZOMBIES and self:CountZombiesAlive() == 0 and self:CountHumansAlive() > 1
    local replaceHuman = previousTeam == TEAM_HUMANS and self:CountHumansAlive() == 0 and self:CountZombiesAlive() > 1
    if replaceZombie or replaceHuman then
        local replacement = SafeTableRandom(replaceZombie and self:GetAliveHumans() or self:GetAliveZombies())
        if replacement then
            if replaceZombie then
                replacement:Infect()
            else
                replacement:Cure()
            end
            for ____, entry in ipairs(player.GetAll()) do
                local receiver = entry
                SendPopupMessage(
                    receiver,
                    {
                        Phrase = "zombieplague." .. string.lower(replaceZombie and "LastZombieLeft" or "LastHumanLeft"),
                        Arguments = {replacement:Name()}
                    }
                )
            end
        end
    end
    if self:GetRoundState() == ROUND_PLAYING then
        self:CheckRoundEnd()
    end
    hook.Call(
        "ZPResetAbilityEvent" .. ply:SteamID64(),
        GAMEMODE
    )
end
manager.CountPlayersToPlay = function(self)
    return #self:GetPlayersToPlay()
end
manager.CountPlayersToPlayAlive = function(self)
    return #self:GetPlayersToPlay(true)
end
manager.GetPlayersToPlay = function(self, alive)
    local result = {}
    do
        local i = #self.PlayersToPlay - 1
        while i >= 0 do
            local ply = self.PlayersToPlay[i + 1]
            if not ply or not IsValid(ply) then
                __TS__ArraySplice(self.PlayersToPlay, i, 1)
            end
            i = i - 1
        end
    end
    for ____, ply in ipairs(self.PlayersToPlay) do
        if not alive or ply:Alive() then
            result[#result + 1] = ply
        end
    end
    return result
end
manager.AddPlayerToBeRewarded = function(self, ply)
    local team = ply:Team()
    local rewards = self.PlayersToReward[team]
    if rewards then
        rewards[#rewards + 1] = ply:SteamID64()
    end
end
manager.ReturnValidPlayerToBeRewardedOrNil = function(self, id, team)
    local ply = player.GetBySteamID64(id)
    return ply and IsValid(ply) and ply:Team() == team and ply or nil
end
return ____exports
