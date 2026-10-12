-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_scoreboard.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
end

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
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

local function __TS__ArrayFilter(self, callbackfn, thisArg)
    local result = {}
    local len = 0
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            len = len + 1
            result[len] = self[i]
        end
    end
    return result
end

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end
-- End of Lua Library inline imports
local ____exports = {}
local frame
local updates = {}
local function centerLabel(label, text, font, x, maxWidth)
    local measured = HudManager:CalculateTextSize(
        tostring(text),
        font
    )
    local width = math.min(measured, maxWidth)
    label:SetSize(width, 25)
    label:SetPos(x + (maxWidth - width) / 2, 0)
    label:SetText(tostring(text))
end
local function label(source, font, color, x, maxWidth)
    local panel = vgui.Create("DLabel")
    if type(source) == "function" then
        updates[#updates + 1] = {
            Component = panel,
            ShouldUpdateFunction = function() return true end,
            UpdateFunction = function() return centerLabel(
                panel,
                source(),
                font,
                x,
                maxWidth
            ) end
        }
    end
    centerLabel(
        panel,
        type(source) == "function" and source() or source,
        font,
        x,
        maxWidth
    )
    panel:SetFont(font)
    panel:SetColor(color)
    return panel
end
local function playerLine(values, muted, color)
    local panel = vgui.Create("DPanel")
    panel:SetSize(600, 20)
    panel.Paint = function(self)
    end
    local positions = {
        {0, 190},
        {200, 80},
        {290, 80},
        {380, 70},
        {460, 80}
    }
    __TS__ArrayForEach(
        positions,
        function(____, ____bindingPattern0, index)
            local width
            local x
            x = ____bindingPattern0[1]
            width = ____bindingPattern0[2]
            return panel:Add(label(
                values[index + 1] or "",
                "DermaDefault",
                color,
                x,
                width
            ))
        end
    )
    if muted and IsValid(muted) and muted ~= LocalPlayer() then
        local button = vgui.Create("DButton")
        button:SetSize(20, 20)
        button:SetPos(530, 0)
        button:SetText("")
        local function refresh()
            return button:SetImage(muted:IsMuted() and "icon16/sound_mute.png" or "icon16/sound.png")
        end
        refresh()
        button.DoClick = function(self)
            if not IsValid(muted) then
                return
            end
            muted:SetMuted(not muted:IsMuted())
            refresh()
        end
        button.Paint = function(self)
        end
        panel:Add(button)
    end
    return panel
end
local function createTeam(teamID)
    local panel = vgui.Create("DPanel")
    panel.Paint = function(self)
    end
    local height = 0
    local function add(child)
        child:SetPos(0, height)
        local ____, h = child:GetSize()
        panel:Add(child)
        height = height + h
    end
    local phrase = teamID == TEAM_HUMANS and "ScoreBoardTitleHumans" or (teamID == TEAM_ZOMBIES and "ScoreBoardTitleZombies" or "ScoreBoardTitleSpectators")
    local title = vgui.Create("DLabel")
    local text = language.GetPhrase("zombieplague." .. string.lower(phrase))
    title:SetText(text)
    title:SetFont("DermaLarge")
    local titleWidth, titleHeight = HudManager:CalculateTextSize(text, "DermaLarge")
    title:SetSize(titleWidth, titleHeight)
    add(title)
    local color = team.GetColor(teamID)
    add(playerLine(
        __TS__ArrayMap(
            {
                "ScoreBoardHeaderName",
                "ScoreBoardHeaderPoints",
                "ScoreBoardHeaderDeaths",
                "ScoreBoardHeaderStatus",
                "ScoreBoardHeaderPing"
            },
            function(____, id) return language.GetPhrase("zombieplague." .. string.lower(id)) end
        ),
        nil,
        color
    ))
    local line = vgui.Create("DPanel")
    line:SetSize(560, 2)
    line.Paint = function(self, width, h)
        HudManager:CreateBox(
            0,
            2,
            nil,
            color,
            0,
            0,
            width,
            h
        )
    end
    add(line)
    local players = team.GetPlayers(teamID)
    __TS__ArraySort(
        players,
        function(____, a, b) return b:GetPoints() - a:GetPoints() end
    )
    for ____, ply in ipairs(players) do
        if IsValid(ply) then
            add(playerLine(
                {
                    function() return IsValid(ply) and ply:Name() or "" end,
                    function() return IsValid(ply) and ply:GetPoints() or "" end,
                    function() return IsValid(ply) and ply:Deaths() or "" end,
                    function() return not IsValid(ply) and "" or language.GetPhrase("zombieplague." .. string.lower(ply:Team() == TEAM_SPECTATOR and "ScoreBoardStatusSpectating" or (ply:Alive() and "ScoreBoardStatusAlive" or "ScoreBoardStatusDead"))) end,
                    function() return IsValid(ply) and ply:Ping() or "" end
                },
                ply,
                color
            ))
        end
    end
    panel:SetSize(600, height)
    return panel
end
GM.ScoreboardShow = function(self)
    if frame and IsValid(frame) then
        frame:Close()
    end
    updates = {}
    frame = vgui.Create("DFrame")
    frame:SetDraggable(false)
    frame:ShowCloseButton(false)
    frame:SetDeleteOnClose(true)
    frame:SetTitle("")
    frame:SetSize(600, 600)
    frame:Center()
    frame.Paint = function(self, width, height)
        HudManager:CreateBox(
            0,
            2,
            Color(0, 0, 0, 0),
            Color(0, 0, 0, 250),
            0,
            0,
            width,
            height
        )
    end
    local scroll = vgui.Create("DScrollPanel", frame)
    scroll:SetPos(0, 20)
    scroll:SetSize(600, 560)
    scroll.Paint = function(self)
    end
    local counts = {}
    local function fill()
        updates = __TS__ArrayFilter(
            updates,
            function(____, update) return update.Component == scroll end
        )
        scroll:Clear()
        local y = 0
        for ____, teamID in ipairs({TEAM_HUMANS, TEAM_ZOMBIES, TEAM_SPECTATOR}) do
            do
                local __continue35
                repeat
                    counts[teamID] = #team.GetPlayers(teamID)
                    if counts[teamID] == 0 then
                        __continue35 = true
                        break
                    end
                    local panel = createTeam(teamID)
                    panel:SetPos(20, y)
                    scroll:Add(panel)
                    local ____, h = panel:GetSize()
                    y = y + (h + (teamID == TEAM_SPECTATOR and 0 or 10))
                    __continue35 = true
                until true
                if not __continue35 then
                    break
                end
            end
        end
    end
    fill()
    updates[#updates + 1] = {
        Component = scroll,
        ShouldUpdateFunction = function() return __TS__ArraySome(
            {TEAM_HUMANS, TEAM_ZOMBIES, TEAM_SPECTATOR},
            function(____, id) return counts[id] ~= #team.GetPlayers(id) end
        ) end,
        UpdateFunction = fill
    }
    frame:MakePopup()
    timer.Create(
        "ScoreBoardUpdater",
        1,
        0,
        function()
            updates = __TS__ArrayFilter(
                updates,
                function(____, update) return IsValid(update.Component) end
            )
            for ____, update in ipairs({unpack(updates)}) do
                if IsValid(update.Component) and update.ShouldUpdateFunction() then
                    update.UpdateFunction()
                end
            end
        end
    )
end
GM.ScoreboardHide = function(self)
    updates = {}
    timer.Destroy("ScoreBoardUpdater")
    if frame and IsValid(frame) then
        frame:Close()
    end
    frame = nil
end
return ____exports
