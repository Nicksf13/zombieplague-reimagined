-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_weapon_menu_hud.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
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

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
local function phrase(id)
    return language.GetPhrase("zombieplague.weaponmenu" .. id)
end
local categories = {"primary", "secondary", "melee"}
local WeaponMenuHUD = __TS__Class()
WeaponMenuHUD.name = "WeaponMenuHUD"
function WeaponMenuHUD.prototype.____constructor(self, style, palette)
    self.style = style
    self.palette = palette
end
function WeaponMenuHUD.prototype.Text(self, text, font, x, y, color)
    if color == nil then
        color = self.palette.Text
    end
    draw.DrawText(
        text,
        font,
        x,
        y,
        color,
        TEXT_ALIGN_LEFT
    )
end
function WeaponMenuHUD.prototype.Button(self, parent, text, x, y, width, height, action, selected)
    if selected == nil then
        selected = false
    end
    local button = vgui.Create("DButton", parent)
    button:SetText("")
    button:SetPos(x, y)
    button:SetSize(width, height)
    button.Paint = function(____, _width, _height)
        draw.RoundedBox(
            self.style == "cs16" and 0 or 4,
            0,
            0,
            _width,
            _height,
            (selected or button:IsHovered()) and self.palette.Accent or self.palette.Panel
        )
        self:Text(
            text,
            "Trebuchet18",
            12,
            math.max(4, (_height - 20) / 2),
            (selected or button:IsHovered()) and Color(12, 18, 22) or self.palette.Text
        )
    end
    button.DoClick = function() return action() end
    return button
end
function WeaponMenuHUD.prototype.Open(self, state, actions)
    self.actions = actions
    local frame = vgui.Create("DFrame")
    self.frame = frame
    frame:SetTitle("")
    frame:ShowCloseButton(false)
    frame:SetDraggable(false)
    frame:SetDeleteOnClose(true)
    local maxWidth = self.style == "cs16" and 780 or 960
    frame:SetSize(
        math.min(
            maxWidth,
            ScrW() >= 1100 and ScrW() - 480 or ScrW() - 32
        ),
        math.min(
            560,
            ScrH() - 180
        )
    )
    frame:Center()
    frame.Paint = function(____, width, height)
        draw.RoundedBox(
            self.style == "cs16" and 0 or 8,
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
            phrase("title"),
            "DermaLarge",
            24,
            44
        )
        if height >= 400 then
            self:Text(
                phrase("subtitle"),
                "DermaDefault",
                24,
                82,
                self.palette.Muted
            )
        end
        self:Text(
            phrase("controls"),
            "DermaDefault",
            24,
            height - 28,
            self.palette.Muted
        )
    end
    frame:MakePopup()
    frame:SetKeyboardInputEnabled(false)
    local width = frame:GetSize()
    self:Button(
        frame,
        "X",
        width - 52,
        18,
        30,
        30,
        function()
            local ____opt_0 = self.actions
            return ____opt_0 and ____opt_0:Close()
        end
    )
    self:Update(state)
end
function WeaponMenuHUD.prototype.Update(self, state)
    self.state = state
    local frame = self.frame
    if not frame or not IsValid(frame) then
        return
    end
    if self.content and IsValid(self.content) then
        self.content:Remove()
    end
    local width, height = frame:GetSize()
    local content = vgui.Create("DPanel", frame)
    self.content = content
    local compact = height < 400
    local contentY = compact and 76 or 106
    content:SetPos(16, contentY)
    content:SetSize(width - 32, height - contentY - 40)
    content.Paint = function()
    end
    local w = width - 32
    local h = height - contentY - 40
    local footerHeight = compact and 76 or 90
    local themes = ZPThemes:GetThemes()
    local themeWidth = math.min(
        180,
        (w - 16) / math.max(1, #themes)
    )
    __TS__ArrayForEach(
        themes,
        function(____, theme, index) return self:Button(
            content,
            theme.Name,
            index * (themeWidth + 8),
            0,
            themeWidth,
            30,
            function()
                local ____opt_2 = self.actions
                return ____opt_2 and ____opt_2:UsePresentation(theme.ID)
            end,
            theme.ID == state.Presentation
        ) end
    )
    local horizontal = self.style == "hl2" and height >= 450
    local categoryWidth = horizontal and math.floor((w - 24) / 3) or math.min(176, w * 0.3)
    __TS__ArrayForEach(
        categories,
        function(____, kind, index)
            local x = horizontal and index * (categoryWidth + 12) or 0
            local y = horizontal and 44 or 44 + index * 62
            self:Button(
                content,
                phrase(kind),
                x,
                y,
                categoryWidth,
                48,
                function()
                    local ____opt_4 = self.actions
                    return ____opt_4 and ____opt_4:SetCategory(kind)
                end,
                kind == state.Category
            )
        end
    )
    local listX = horizontal and 0 or categoryWidth + 18
    local listY = horizontal and 104 or 44
    local listWidth = w - listX
    local listHeight = math.max(40, h - listY - footerHeight - 10)
    local scroll = vgui.Create("DScrollPanel", content)
    scroll:SetPos(listX, listY)
    scroll:SetSize(listWidth, listHeight)
    local ____opt_6 = state.Snapshot
    if ____opt_6 ~= nil then
        local ____opt_7 = state.Snapshot
        ____opt_6 = __TS__ArrayFilter(
            ____opt_7 and ____opt_7.Entries,
            function(____, entry) return entry.Kind == state.Category end
        )
    end
    local entries = ____opt_6 or ({})
    local columns = horizontal and listWidth >= 560 and 2 or 1
    local cardWidth = math.floor((listWidth - 20 - (columns - 1) * 10) / columns)
    __TS__ArrayForEach(
        entries,
        function(____, entry, index) return self:WeaponCard(
            scroll,
            entry,
            index,
            columns,
            cardWidth
        ) end
    )
    if #entries == 0 then
        local label = scroll:Add("DLabel")
        label:SetText(phrase(state.Pending and "waiting" or "empty"))
        label:SetPos(12, 12)
        label:SetSize(listWidth - 24, 40)
        label:SetColor(self.palette.Muted)
    end
    local footer = vgui.Create("DPanel", content)
    footer:SetPos(listX, h - footerHeight)
    footer:SetSize(listWidth, footerHeight)
    footer.Paint = function()
        local current = self.state
        if not current then
            return
        end
        self:Text(
            language.GetPhrase(current.Feedback),
            "DermaDefault",
            0,
            4,
            self.palette.Accent
        )
        if current.Snapshot then
            local delivery = current.Snapshot.CanReceive[current.Category] and "receivenow" or "receivelater"
            self:Text(
                phrase(delivery),
                "DermaDefault",
                0,
                compact and 20 or 26,
                self.palette.Muted
            )
        end
        local ____opt_10 = current.Snapshot
        if ____opt_10 and ____opt_10.Truncated then
            self:Text(
                phrase("truncated"),
                "DermaDefault",
                0,
                compact and 34 or 46,
                self.palette.Muted
            )
        end
    end
    self:Button(
        footer,
        phrase("refresh"),
        0,
        compact and 50 or 60,
        130,
        compact and 24 or 28,
        function()
            local ____opt_12 = self.actions
            return ____opt_12 and ____opt_12:Refresh()
        end
    )
    frame:SetKeyboardInputEnabled(false)
end
function WeaponMenuHUD.prototype.WeaponCard(self, parent, entry, index, columns, width)
    local button = parent:Add("DButton")
    button:SetText("")
    local height = self.style == "cs16" and 54 or 66
    button:SetPos(
        index % columns * (width + 10),
        math.floor(index / columns) * (height + 10)
    )
    button:SetSize(width, height)
    button.Paint = function(____, w, h)
        local state = self.state
        local ____opt_14 = state and state.Snapshot
        local selected = (____opt_14 and ____opt_14.Selected[entry.Kind]) == entry.ID
        local color = selected and self.palette.Accent or self.palette.Panel
        draw.RoundedBox(
            self.style == "cs16" and 0 or 4,
            0,
            0,
            w,
            h,
            color
        )
        if button:IsHovered() and not selected then
            draw.RoundedBox(
                0,
                0,
                0,
                3,
                h,
                self.palette.Accent
            )
        end
        local textColor = selected and Color(12, 18, 22) or self.palette.Text
        self:Text(
            entry.Name,
            "Trebuchet18",
            14,
            10,
            textColor
        )
        self:Text(
            phrase(selected and "selected" or (state and state.Pending and "waiting" or "choose")),
            "DermaDefault",
            14,
            height - 22,
            selected and textColor or self.palette.Muted
        )
    end
    button.DoClick = function()
        local ____opt_20 = self.actions
        return ____opt_20 and ____opt_20:Select(entry.ID)
    end
end
function WeaponMenuHUD.prototype.Destroy(self)
    if self.frame and IsValid(self.frame) then
        self.frame:Remove()
    end
    self.frame = nil
    self.content = nil
    self.actions = nil
    self.state = nil
end
local palettes = {
    classic = {
        Accent = Color(239, 190, 76),
        Surface = Color(11, 17, 22, 238),
        Panel = Color(24, 33, 42, 245),
        Text = Color(238, 242, 245),
        Muted = Color(156, 174, 187)
    },
    hl2 = {
        Accent = Color(255, 160, 0),
        Surface = Color(20, 20, 20, 200),
        Panel = Color(45, 43, 36, 235),
        Text = Color(255, 218, 154),
        Muted = Color(195, 174, 140)
    },
    cs16 = {
        Accent = Color(232, 204, 86),
        Surface = Color(62, 70, 56, 245),
        Panel = Color(83, 94, 73, 255),
        Text = Color(230, 230, 214),
        Muted = Color(181, 190, 165)
    }
}
for ____, id in ipairs({"classic", "hl2", "cs16"}) do
    ZPThemes:RegisterTheme(
        id,
        {
            Name = "zombieplague.theme" .. id,
            Palette = palettes[id],
            CreateWeaponMenu = function() return __TS__New(WeaponMenuHUD, id, palettes[id]) end,
            CreateMainMenu = function() return ZPCreateMainMenuHUD(palettes[id], id == "cs16") end,
            CreateScoreboard = function() return ZPCreateScoreboardHUD(palettes[id], id) end,
            PaintPlayerHUD = function(state, palette)
                if id == "classic" then
                    ZPPlayerHUDRenderer:PaintClassic(state, palette)
                elseif id == "hl2" then
                    ZPPlayerHUDRenderer:PaintHL2(state, palette)
                else
                    ZPPlayerHUDRenderer:PaintCS16(state, palette)
                end
            end
        }
    )
end
return ____exports
