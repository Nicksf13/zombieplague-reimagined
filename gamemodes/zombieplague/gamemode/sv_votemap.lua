-- Generated from src/gamemodes/zombieplague/gamemode/rounds/server/sv_votemap.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
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

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end

local function __TS__ArraySort(self, compareFn)
    if compareFn ~= nil then
        table.sort(
            self,
            function(a, b) return compareFn(nil, a, b) < 0 end
        )
    else
        table.sort(self)
    end
    return self
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
local rounds = RoundManager
ConvarManager:CreateConVar("zp_can_repeat_map", 1, 8, "Allow extending the current map")
ConvarManager:CreateConVar("zp_rounds_to_extend", 10, 8, "Extra rounds when extending the map")
ConvarManager:CreateConVar("zp_notify_rounds_left", 1, 8, "Notify players about remaining rounds")
____exports.VoteMapManager = __TS__Class()
local VoteMapManager = ____exports.VoteMapManager
VoteMapManager.name = "VoteMapManager"
function VoteMapManager.prototype.____constructor(self)
    self.MapsToVote = {}
    self.Voting = false
    self.Voters = {}
end
function VoteMapManager.prototype.StartVotemap(self, prefixes)
    local candidates = {}
    local maps = file.Find("maps/*.bsp", "GAME")
    local current = game.GetMap()
    table.RemoveByValue(maps, current .. ".bsp")
    local count = 0
    if cvars.Bool("zp_can_repeat_map", true) then
        candidates[current] = 0
        count = count + 1
    end
    while #maps > 0 and count < cvars.Number("zp_maps_to_vote", 7) do
        do
            local __continue5
            repeat
                local filename = __TS__ArraySplice(
                    maps,
                    math.random(1, #maps) - 1,
                    1
                )[1]
                if not filename then
                    __continue5 = true
                    break
                end
                local map = string.sub(filename, 1, -5)
                if __TS__ArraySome(
                    prefixes,
                    function(____, prefix) return string.StartWith(map, prefix) end
                ) then
                    candidates[map] = 0
                    count = count + 1
                end
                __continue5 = true
            until true
            if not __continue5 then
                break
            end
        end
    end
    self.MapsToVote = candidates
    self.Voters = {}
    if count == 0 then
        rounds:AddExtraRounds(cvars.Number("zp_rounds_to_extend", 5))
        rounds:SetTimer(
            5,
            function() return rounds:TryNewRound() end
        )
        return
    end
    self.Voting = true
    rounds:SetRoundState(ROUND_VOTEMAP)
    rounds:SetTimer(
        10,
        function() return self:EndVotemap() end
    )
end
function VoteMapManager.prototype.EndVotemap(self)
    self.Voting = false
    local results = {}
    for map, votes in pairs(self.MapsToVote) do
        results[#results + 1] = {Map = map, Votes = votes}
    end
    __TS__ArraySort(
        results,
        function(____, a, b) return b.Votes - a.Votes end
    )
    local winner = results[1]
    if not winner then
        return
    end
    local phrase = "NoticeVotemapEnded"
    local replacement = winner.Map
    if winner.Map == game.GetMap() then
        phrase = "NoticeVotemapProlong"
        replacement = cvars.String("zp_rounds_to_extend", "5")
        rounds:AddExtraRounds(cvars.Number("zp_rounds_to_extend", 5))
        rounds:SetTimer(
            5,
            function() return rounds:TryNewRound() end
        )
    else
        rounds:SetRoundState(ROUND_CHANGING_MAP)
        rounds:SetTimer(
            5,
            function() return RunConsoleCommand("changelevel", winner.Map) end
        )
    end
    for ____, ply in ipairs(player.GetAll()) do
        SendColorMessage(
            ply,
            {
                Phrase = "zombieplague." .. string.lower(phrase),
                Arguments = {replacement}
            },
            Color(0, 255, 0)
        )
    end
end
local voteMap = __TS__New(____exports.VoteMapManager)
_G.ZPVoteMap = voteMap
local function notify(ply)
    local left = rounds:RoundsLeft()
    SendColorMessage(
        ply,
        left > 0 and ({Phrase = "zombieplague.roundsleft", Arguments = {left}}) or ({Phrase = "zombieplague.finalround"}),
        left > 0 and Color(0, 255, 0) or Color(255, 0, 0)
    )
end
Commands:AddCommand("rounds_left", "Check how many rounds are left.", notify)
hook.Add(
    "ZPNewRound",
    "zp_round_start_notify_rounds_left",
    function()
        if cvars.Bool("zp_notify_rounds_left", true) then
            for ____, ply in ipairs(player.GetAll()) do
                notify(ply)
            end
        end
    end
)
return ____exports
