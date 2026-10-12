-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_scoreboard_hud.ts. DO NOT EDIT; run npm run build.
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

local function __TS__ArrayReduce(self, callbackFn, ...)
    local len = #self
    local k = 0
    local accumulator = nil
    if __TS__CountVarargs(...) ~= 0 then
        accumulator = ...
    elseif len > 0 then
        accumulator = self[1]
        k = 1
    else
        error("Reduce of empty array with no initial value", 0)
    end
    for i = k + 1, len do
        accumulator = callbackFn(
            nil,
            accumulator,
            self[i],
            i - 1,
            self
        )
    end
    return accumulator
end

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end

local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
end

local __TS__StringSplit
do
    local sub = string.sub
    local find = string.find
    function __TS__StringSplit(source, separator, limit)
        if limit == nil then
            limit = 4294967295
        end
        if limit == 0 then
            return {}
        end
        local result = {}
        local resultIndex = 1
        if separator == nil or separator == "" then
            for i = 1, #source do
                result[resultIndex] = sub(source, i, i)
                resultIndex = resultIndex + 1
            end
        else
            local currentPos = 1
            while resultIndex <= limit do
                local startPos, endPos = find(source, separator, currentPos, true)
                if not startPos then
                    break
                end
                result[resultIndex] = sub(source, currentPos, startPos - 1)
                resultIndex = resultIndex + 1
                currentPos = endPos + 1
            end
            if resultIndex <= limit then
                result[resultIndex] = sub(source, currentPos)
            end
        end
        return result
    end
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.ScoreboardHUD = __TS__Class()
local ScoreboardHUD = ____exports.ScoreboardHUD
ScoreboardHUD.name = "ScoreboardHUD"
function ScoreboardHUD.prototype.____constructor(self, palette, style)
    self.palette = palette
    self.style = style
    self.players = {}
    self.signature = ""
end
function ScoreboardHUD.prototype.Radius(self)
    return self.style == "cs16" and 0 or (self.style == "hl2" and 8 or 4)
end
function ScoreboardHUD.prototype.Text(self, text, font, x, y, color)
    draw.DrawText(
        text,
        font,
        x,
        y,
        color,
        TEXT_ALIGN_LEFT
    )
end
function ScoreboardHUD.prototype.Open(self, state, actions)
    self.actions = actions
    local frame = vgui.Create("DFrame")
    self.frame = frame
    frame:SetTitle("")
    frame:ShowCloseButton(false)
    frame:SetDraggable(false)
    frame:SetDeleteOnClose(true)
    frame.Paint = function(____, width, height)
        draw.RoundedBox(
            self:Radius(),
            0,
            0,
            width,
            height,
            self.palette.Surface
        )
        draw.RoundedBox(
            0,
            0,
            0,
            width,
            self.style == "cs16" and 28 or 3,
            self.style == "cs16" and self.palette.Panel or self.palette.Accent
        )
        self:Text(
            "ZOMBIE PLAGUE",
            "Trebuchet18",
            24,
            20,
            self.palette.Accent
        )
        self:Text(
            language.GetPhrase("zombieplague.scoreboardtitle"),
            "DermaLarge",
            24,
            46,
            self.palette.Text
        )
        local ____opt_0 = self.state
        if ____opt_0 ~= nil then
            local ____opt_1 = self.state
            ____opt_0 = __TS__ArrayReduce(
                ____opt_1 and ____opt_1.Teams,
                function(____, total, group) return total + #group.Players end,
                0
            )
        end
        local count = ____opt_0 or 0
        self:Text(
            (language.GetPhrase("zombieplague.scoreboardplayers") .. ": ") .. tostring(count),
            "DermaDefault",
            width - 122,
            54,
            self.palette.Muted
        )
        self:Text(
            language.GetPhrase("zombieplague.scoreboardcontrols"),
            "DermaDefault",
            24,
            height - 26,
            self.palette.Muted
        )
    end
    frame:MakePopup()
    self:Update(state)
end
function ScoreboardHUD.prototype.Update(self, state)
    local ____state_Width_6 = state.Width
    local ____opt_4 = self.state
    local ____temp_10 = ____state_Width_6 ~= (____opt_4 and ____opt_4.Width)
    if not ____temp_10 then
        local ____state_Height_9 = state.Height
        local ____opt_7 = self.state
        ____temp_10 = ____state_Height_9 ~= (____opt_7 and ____opt_7.Height)
    end
    local resized = ____temp_10
    self.state = state
    self.players = {}
    for ____, group in ipairs(state.Teams) do
        for ____, entry in ipairs(group.Players) do
            self.players[entry.ID] = entry
        end
    end
    local frame = self.frame
    if not frame or not IsValid(frame) then
        return
    end
    if resized then
        frame:SetSize(
            math.min(self.style == "cs16" and 800 or 920, state.Width - 32),
            math.min(620, state.Height - 180)
        )
        frame:Center()
    end
    local signature = table.concat(
        __TS__ArrayMap(
            state.Teams,
            function(____, group) return (tostring(group.ID) .. ":") .. table.concat(
                __TS__ArrayMap(
                    group.Players,
                    function(____, entry) return entry.ID end
                ),
                ","
            ) end
        ),
        "|"
    )
    if not resized and signature == self.signature then
        return
    end
    self.signature = signature
    local ____opt_11 = self.content
    if ____opt_11 ~= nil then
        ____opt_11:Remove()
    end
    local width, height = frame:GetSize()
    local content = vgui.Create("DScrollPanel", frame)
    self.content = content
    content:SetPos(24, 96)
    content:SetSize(width - 48, height - 136)
    local rowWidth = width - 68
    local rowHeight = self.style == "cs16" and 28 or 34
    local y = 0
    for ____, group in ipairs(state.Teams) do
        do
            local __continue18
            repeat
                if #group.Players == 0 then
                    __continue18 = true
                    break
                end
                local heading = content:Add("DPanel")
                heading:SetPos(0, y)
                heading:SetSize(rowWidth, 28)
                heading.Paint = function()
                    self:Text(
                        ((language.GetPhrase(group.Label) .. "  (") .. tostring(#group.Players)) .. ")",
                        "Trebuchet24",
                        4,
                        2,
                        self.palette.Accent
                    )
                end
                y = y + 30
                local header = content:Add("DPanel")
                header:SetPos(0, y)
                header:SetSize(rowWidth, 24)
                header.Paint = function(____, w, h) return draw.RoundedBox(
                    0,
                    0,
                    0,
                    w,
                    h,
                    self.palette.Panel
                ) end
                local labels = {
                    "name",
                    "points",
                    "deaths",
                    "status",
                    "ping",
                    "sound"
                }
                __TS__ArrayForEach(
                    self:Columns(rowWidth),
                    function(____, column, index) return self:Cell(
                        header,
                        function() return language.GetPhrase("zombieplague.scoreboardheader" .. tostring(labels[index + 1])) end,
                        column.X,
                        column.Width,
                        24,
                        self.palette.Muted,
                        index > 0
                    ) end
                )
                y = y + 26
                __TS__ArrayForEach(
                    group.Players,
                    function(____, entry, index) return self:Row(
                        content,
                        entry.ID,
                        y + index * (rowHeight + 4),
                        rowWidth,
                        rowHeight
                    ) end
                )
                y = y + (#group.Players * (rowHeight + 4) + 4)
                __continue18 = true
            until true
            if not __continue18 then
                break
            end
        end
    end
    if y == 0 then
        self:Cell(
            content,
            function() return language.GetPhrase("zombieplague.scoreboardempty") end,
            0,
            rowWidth,
            30,
            self.palette.Muted,
            false
        )
    end
    frame:SetKeyboardInputEnabled(false)
end
function ScoreboardHUD.prototype.Columns(self, width)
    local x = 12
    return __TS__ArrayMap(
        {
            width - 380,
            64,
            64,
            100,
            52,
            36
        },
        function(____, size)
            local column = {X = x, Width = size}
            x = x + (size + 8)
            return column
        end
    )
end
function ScoreboardHUD.prototype.Cell(self, parent, text, x, width, height, color, centered, clicked)
    local cell = parent:Add(clicked and "DButton" or "DPanel")
    if clicked then
        cell:SetText("")
        cell.DoClick = function() return clicked() end
    end
    cell:SetPos(x, 0)
    cell:SetSize(width, height)
    cell.Paint = function()
        local value = table.concat(
            __TS__StringSplit(
                table.concat(
                    __TS__StringSplit(
                        text(),
                        "\n"
                    ),
                    " "
                ),
                "\r"
            ),
            " "
        )
        surface.SetFont("DermaDefault")
        local measured = surface.GetTextSize(value)
        self:Text(
            value,
            "DermaDefault",
            centered and math.max(0, (width - measured) / 2) or 0,
            math.floor((height - 16) / 2),
            color
        )
    end
end
function ScoreboardHUD.prototype.Row(self, parent, id, y, width, height)
    local row = parent:Add("DPanel")
    row:SetPos(0, y)
    row:SetSize(width, height)
    row.Paint = function(____, w, h)
        draw.RoundedBox(
            self:Radius(),
            0,
            0,
            w,
            h,
            self.palette.Panel
        )
        local ____opt_13 = self.players[id]
        if ____opt_13 and ____opt_13.Local then
            draw.RoundedBox(
                0,
                0,
                0,
                3,
                h,
                self.palette.Accent
            )
        end
    end
    local values = {
        function()
            local ____opt_15 = self.players[id]
            return ____opt_15 and ____opt_15.Name or ""
        end,
        function()
            local ____tostring_19 = tostring
            local ____opt_17 = self.players[id]
            return ____tostring_19(____opt_17 and ____opt_17.Points or 0)
        end,
        function()
            local ____tostring_22 = tostring
            local ____opt_20 = self.players[id]
            return ____tostring_22(____opt_20 and ____opt_20.Deaths or 0)
        end,
        function()
            local ____language_GetPhrase_25 = language.GetPhrase
            local ____opt_23 = self.players[id]
            return ____language_GetPhrase_25("zombieplague.scoreboardstatus" .. (____opt_23 and ____opt_23.Status or "dead"))
        end,
        function()
            local ____tostring_28 = tostring
            local ____opt_26 = self.players[id]
            return ____tostring_28(____opt_26 and ____opt_26.Ping or 0)
        end
    }
    local columns = self:Columns(width)
    __TS__ArrayForEach(
        values,
        function(____, value, index)
            local column = columns[index + 1]
            if column then
                self:Cell(
                    row,
                    value,
                    column.X,
                    column.Width,
                    height,
                    self.palette.Text,
                    index > 0,
                    index == 0 and (function() return self:OpenPlayerMenu(id) end) or nil
                )
            end
        end
    )
    local sound = columns[6]
    local ____sound_31 = sound
    if ____sound_31 then
        local ____opt_29 = self.players[id]
        ____sound_31 = ____opt_29 and ____opt_29.CanMute
    end
    if ____sound_31 then
        local button = row:Add("DButton")
        button:SetText("")
        button:SetPos(sound.X, 4)
        button:SetSize(sound.Width, height - 8)
        button:SetTooltip(language.GetPhrase("zombieplague.scoreboardmutetoggle"))
        button.Paint = function(____, w, h)
            local ____opt_32 = self.players[id]
            local muted = ____opt_32 and ____opt_32.Muted
            local highlighted = muted or button:IsHovered()
            draw.RoundedBox(
                self:Radius(),
                0,
                0,
                w,
                h,
                highlighted and self.palette.Accent or self.palette.Surface
            )
            local label = muted and "OFF" or "ON"
            surface.SetFont("DermaDefault")
            local textWidth, textHeight = surface.GetTextSize(label)
            self:Text(
                label,
                "DermaDefault",
                (w - textWidth) / 2,
                (h - textHeight) / 2,
                highlighted and Color(12, 18, 22) or self.palette.Text
            )
        end
        button.DoClick = function()
            local ____opt_34 = self.actions
            return ____opt_34 and ____opt_34:ToggleMute(id)
        end
    end
end
function ScoreboardHUD.prototype.OpenPlayerMenu(self, id)
    local ____opt_36 = self.dropdown
    if ____opt_36 ~= nil then
        ____opt_36:Remove()
    end
    local entry = self.players[id]
    if not entry then
        return
    end
    local menu = DermaMenu()
    self.dropdown = menu
    local profile = menu:AddOption(
        language.GetPhrase("zombieplague.scoreboardviewprofile"),
        function()
            local ____opt_38 = self.actions
            return ____opt_38 and ____opt_38:ViewProfile(id)
        end
    )
    profile:SetEnabled(entry.CanViewProfile)
    menu:Open()
end
function ScoreboardHUD.prototype.Destroy(self)
    local ____opt_40 = self.dropdown
    if ____opt_40 ~= nil then
        ____opt_40:Remove()
    end
    self.dropdown = nil
    local ____opt_42 = self.frame
    if ____opt_42 ~= nil then
        ____opt_42:Remove()
    end
    self.frame = nil
    self.content = nil
    self.players = {}
    self.actions = nil
end
_G.ZPCreateScoreboardHUD = function(palette, style) return __TS__New(____exports.ScoreboardHUD, palette, style) end
return ____exports
