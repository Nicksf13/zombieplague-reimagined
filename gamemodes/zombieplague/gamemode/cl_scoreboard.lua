-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_scoreboard.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end

local function __TS__ArrayFind(self, predicate, thisArg)
    for i = 1, #self do
        local elem = self[i]
        if predicate(thisArg, elem, i - 1, self) then
            return elem
        end
    end
    return nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.ScoreboardController = __TS__Class()
local ScoreboardController = ____exports.ScoreboardController
ScoreboardController.name = "ScoreboardController"
function ScoreboardController.prototype.____constructor(self)
    self.opened = false
    self.botMuted = {}
end
function ScoreboardController.prototype.GetState(self)
    local groups = {{ID = TEAM_HUMANS, Label = "zombieplague.scoreboardtitlehumans", Players = {}}, {ID = TEAM_ZOMBIES, Label = "zombieplague.scoreboardtitlezombies", Players = {}}, {ID = TEAM_SPECTATOR, Label = "zombieplague.scoreboardtitlespectators", Players = {}}}
    local players = player.GetAll()
    local localPlayer = LocalPlayer()
    local teams = __TS__ArrayMap(
        groups,
        function(____, group)
            local entries = {}
            for ____, ply in ipairs(players) do
                do
                    local __continue5
                    repeat
                        if not IsValid(ply) or ply:Team() ~= group.ID then
                            __continue5 = true
                            break
                        end
                        local ____temp_2 = ply:UserID()
                        local ____temp_3 = ply:Name()
                        local ____temp_4 = ply:GetPoints()
                        local ____temp_5 = ply:Deaths()
                        local ____temp_6 = ply:Ping()
                        local ____temp_7 = group.ID == TEAM_SPECTATOR and "spectating" or (ply:Alive() and "alive" or "dead")
                        local ____temp_8 = ply == localPlayer
                        local ____temp_9 = ply ~= localPlayer
                        local ____temp_10 = not ply:IsBot()
                        local ____ply_IsBot_result_1
                        if ply:IsBot() then
                            local ____self_botMuted_index_0 = self.botMuted[ply:UserID()]
                            if ____self_botMuted_index_0 == nil then
                                ____self_botMuted_index_0 = false
                            end
                            ____ply_IsBot_result_1 = ____self_botMuted_index_0
                        else
                            ____ply_IsBot_result_1 = ply:IsMuted()
                        end
                        entries[#entries + 1] = {
                            ID = ____temp_2,
                            Name = ____temp_3,
                            Points = ____temp_4,
                            Deaths = ____temp_5,
                            Ping = ____temp_6,
                            Status = ____temp_7,
                            Local = ____temp_8,
                            CanMute = ____temp_9,
                            CanViewProfile = ____temp_10,
                            Muted = ____ply_IsBot_result_1
                        }
                        __continue5 = true
                    until true
                    if not __continue5 then
                        break
                    end
                end
            end
            __TS__ArraySort(
                entries,
                function(____, a, b) return a.Points ~= b.Points and b.Points - a.Points or (a.Name < b.Name and -1 or (a.Name > b.Name and 1 or a.ID - b.ID)) end
            )
            return {ID = group.ID, Label = group.Label, Players = entries}
        end
    )
    return {
        Open = self.opened,
        Theme = ZPThemes:GetActiveID(),
        Width = ScrW(),
        Height = ScrH(),
        Teams = teams
    }
end
function ScoreboardController.prototype.Show(self)
    if self.opened then
        self:Refresh()
        return
    end
    self.opened = true
    self:Rebuild()
    timer.Create(
        "ScoreBoardUpdater",
        0.5,
        0,
        function() return self:Refresh() end
    )
end
function ScoreboardController.prototype.Hide(self)
    self.opened = false
    timer.Destroy("ScoreBoardUpdater")
    local ____opt_11 = self.presentation
    if ____opt_11 ~= nil then
        ____opt_11:Destroy()
    end
    self.presentation = nil
end
function ScoreboardController.prototype.Rebuild(self)
    if not self.opened then
        return
    end
    local ____opt_13 = self.presentation
    if ____opt_13 ~= nil then
        ____opt_13:Destroy()
    end
    self.presentation = nil
    local theme = ZPThemes:GetTheme()
    if theme then
        self.presentation = theme.CreateScoreboard and theme.CreateScoreboard() or ZPCreateScoreboardHUD(theme.Palette, "classic")
        self.presentation:Open(
            self:GetState(),
            self
        )
    end
end
function ScoreboardController.prototype.Refresh(self)
    if self.opened then
        local ____opt_15 = self.presentation
        if ____opt_15 ~= nil then
            ____opt_15:Update(self:GetState())
        end
    end
end
function ScoreboardController.prototype.ViewProfile(self, id)
    if not self.opened then
        return
    end
    local ply = __TS__ArrayFind(
        player.GetAll(),
        function(____, entry) return IsValid(entry) and entry:UserID() == id end
    )
    if ply and not ply:IsBot() then
        ply:ShowProfile()
    end
end
function ScoreboardController.prototype.ToggleMute(self, id)
    if not self.opened then
        return
    end
    local players = player.GetAll()
    local ply = __TS__ArrayFind(
        players,
        function(____, entry) return IsValid(entry) and entry:UserID() == id end
    )
    if not ply or ply == LocalPlayer() then
        return
    end
    if ply:IsBot() then
        local ____self_botMuted_18 = self.botMuted
        local ____id_19 = id
        local ____self_botMuted_id_17 = self.botMuted[id]
        if ____self_botMuted_id_17 == nil then
            ____self_botMuted_id_17 = false
        end
        ____self_botMuted_18[____id_19] = not ____self_botMuted_id_17
    else
        ply:SetMuted(not ply:IsMuted())
    end
    self:Refresh()
end
local controller = __TS__New(____exports.ScoreboardController)
_G.ZPScoreboard = controller
GM.ScoreboardShow = function(self)
    controller:Show()
end
GM.ScoreboardHide = function(self)
    controller:Hide()
end
return ____exports
