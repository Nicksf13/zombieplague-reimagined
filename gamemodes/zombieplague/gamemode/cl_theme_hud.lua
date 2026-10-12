-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_theme_hud.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
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

local function __TS__ArraySlice(self, first, last)
    local len = #self
    first = first or 0
    if first < 0 then
        first = len + first
        if first < 0 then
            first = 0
        end
    else
        if first > len then
            first = len
        end
    end
    last = last or len
    if last < 0 then
        last = len + last
        if last < 0 then
            last = 0
        end
    else
        if last > len then
            last = len
        end
    end
    local out = {}
    first = first + 1
    last = last + 1
    local n = 1
    while first < last do
        out[n] = self[first]
        first = first + 1
        n = n + 1
    end
    return out
end

local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.PlayerHUDRenderer = __TS__Class()
local PlayerHUDRenderer = ____exports.PlayerHUDRenderer
PlayerHUDRenderer.name = "PlayerHUDRenderer"
function PlayerHUDRenderer.prototype.____constructor(self)
end
function PlayerHUDRenderer.prototype.Text(self, text, font, x, y, color)
    draw.DrawText(
        tostring(text),
        font,
        x,
        y,
        color,
        TEXT_ALIGN_LEFT
    )
end
function PlayerHUDRenderer.prototype.Value(self, state, id)
    return __TS__ArrayFind(
        state.Entries,
        function(____, entry) return entry.ID == id end
    )
end
function PlayerHUDRenderer.prototype.Ammo(self, channel)
    if not channel then
        return "--"
    end
    return channel.Clip < 0 and tostring(channel.Reserve) or (tostring(channel.Clip) .. " / ") .. tostring(channel.Reserve)
end
function PlayerHUDRenderer.prototype.Card(self, label, value, x, y, width, palette, style)
    if style == "classic" then
        draw.RoundedBox(
            5,
            x,
            y,
            width,
            64,
            palette.Surface
        )
        draw.RoundedBox(
            0,
            x,
            y,
            width,
            2,
            palette.Accent
        )
    elseif style == "hl2" then
        draw.RoundedBox(
            8,
            x,
            y,
            width,
            64,
            palette.Surface
        )
    else
        draw.RoundedBox(
            0,
            x,
            y,
            width,
            64,
            palette.Surface
        )
    end
    self:Text(
        label,
        "DermaDefault",
        x + 10,
        y + 7,
        style == "classic" and palette.Muted or palette.Accent
    )
    self:Text(
        value,
        "DermaLarge",
        x + 10,
        y + 26,
        palette.Accent
    )
end
function PlayerHUDRenderer.prototype.Details(self, state, palette, y, margin)
    local entries = __TS__ArrayFilter(
        state.Entries,
        function(____, entry) return entry.ID ~= "HUDHealth" and entry.ID ~= "HUDArmor" and entry.ID ~= "HUDAP" end
    )
    local maxWidth = math.min(520, state.Width - (state.Width < 900 and 172 or 206) - margin * 2 - 32)
    local lines = {}
    surface.SetFont("DermaDefault")
    for ____, entry in ipairs(entries) do
        local line = ""
        for ____, word in ipairs(__TS__StringSplit(
            (entry.Label .. ": ") .. tostring(entry.Value),
            " "
        )) do
            local candidate = #line > 0 and (line .. " ") .. word or word
            local width = surface.GetTextSize(candidate)
            if width > maxWidth and #line > 0 then
                lines[#lines + 1] = line
                line = word
            else
                line = candidate
            end
        end
        lines[#lines + 1] = line
    end
    local visible = __TS__ArraySlice(
        lines,
        -math.max(
            1,
            math.floor((y - 90) / 20)
        )
    )
    __TS__ArrayForEach(
        visible,
        function(____, line, index)
            local lineY = y - (#visible - index) * 20
            local width = surface.GetTextSize(line)
            draw.RoundedBox(
                2,
                margin,
                lineY,
                math.min(width + 16, maxWidth + 16),
                19,
                palette.Surface
            )
            self:Text(
                line,
                "DermaDefault",
                margin + 8,
                lineY + 2,
                palette.Text
            )
        end
    )
end
function PlayerHUDRenderer.prototype.Paint(self, state, palette, style)
    local margin = state.Width < 800 and 12 or 24
    local y = state.Height - margin - 64
    local compact = state.Width < 900
    local cell = compact and 104 or 132
    local timerWidth = 108
    local timerX = (state.Width - timerWidth) / 2
    local health = self:Value(state, "HUDHealth")
    local armor = self:Value(state, "HUDArmor")
    local packs = self:Value(state, "HUDAP")
    if health then
        self:Card(
            health.Label,
            health.Value,
            margin,
            y,
            cell,
            palette,
            style
        )
    end
    if armor then
        self:Card(
            armor.Label,
            armor.Value,
            margin + cell + 8,
            y,
            cell,
            palette,
            style
        )
    end
    if packs then
        local top = compact or margin + (cell + 8) * 3 > timerX
        self:Card(
            packs.Label,
            packs.Value,
            top and state.Width - margin - cell or margin + (cell + 8) * 2,
            top and margin or y,
            cell,
            palette,
            style
        )
    end
    self:Card(
        language.GetPhrase("zombieplague.hudtimer"),
        state.Timer,
        timerX,
        y,
        timerWidth,
        palette,
        style
    )
    if state.Ammo then
        local width = compact and 172 or 206
        local x = state.Width - margin - width
        if state.Ammo.Primary then
            self:Card(
                language.GetPhrase("zombieplague.hudprimaryammo"),
                self:Ammo(state.Ammo.Primary),
                x,
                y,
                width,
                palette,
                style
            )
        end
        if state.Ammo.Secondary then
            self:Card(
                language.GetPhrase("zombieplague.hudsecondaryammo"),
                self:Ammo(state.Ammo.Secondary),
                x,
                y - 72,
                width,
                palette,
                style
            )
        end
    end
    self:Details(state, palette, y - 8, margin)
end
function PlayerHUDRenderer.prototype.PaintClassic(self, state, palette)
    self:Paint(state, palette, "classic")
end
function PlayerHUDRenderer.prototype.PaintHL2(self, state, palette)
    self:Paint(state, palette, "hl2")
end
function PlayerHUDRenderer.prototype.PaintCS16(self, state, palette)
    self:Paint(state, palette, "cs16")
end
_G.ZPPlayerHUDRenderer = __TS__New(____exports.PlayerHUDRenderer)
return ____exports
