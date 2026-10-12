-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_settings_hud.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
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

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.SettingsHUD = __TS__Class()
local SettingsHUD = ____exports.SettingsHUD
SettingsHUD.name = "SettingsHUD"
function SettingsHUD.prototype.____constructor(self, palette, square)
    self.palette = palette
    self.square = square
    self.signature = ""
end
function SettingsHUD.prototype.Text(self, key, font, x, y, color)
    if color == nil then
        color = self.palette.Text
    end
    draw.DrawText(
        language.GetPhrase(key),
        font,
        x,
        y,
        color,
        TEXT_ALIGN_LEFT
    )
end
function SettingsHUD.prototype.Open(self, state, actions)
    local frame = vgui.Create("DFrame")
    self.frame = frame
    frame:SetTitle("")
    frame:ShowCloseButton(false)
    frame:SetDraggable(false)
    frame:SetDeleteOnClose(true)
    frame:SetSize(
        math.min(
            580,
            ScrW() - 32
        ),
        math.min(
            480,
            ScrH() - 180
        )
    )
    frame:Center()
    frame.Paint = function(____, width, height)
        draw.RoundedBox(
            self.square and 0 or 8,
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
            3,
            self.palette.Accent
        )
        self:Text(
            "ZOMBIE PLAGUE",
            "Trebuchet18",
            24,
            20,
            self.palette.Accent
        )
        self:Text("zombieplague.settingstitle", "DermaLarge", 24, 48)
    end
    local width, height = frame:GetSize()
    self:Button(
        frame,
        "X",
        width - 52,
        18,
        30,
        30,
        function() return actions:Close() end
    )
    self:Button(
        frame,
        "zombieplague.settingsback",
        24,
        height - 40,
        160,
        28,
        function() return actions:Back() end
    )
    frame:MakePopup()
    frame:SetKeyboardInputEnabled(false)
    self:UpdateContent(state, actions)
end
function SettingsHUD.prototype.Button(self, parent, label, x, y, width, height, action, selected)
    if selected == nil then
        selected = function() return false end
    end
    local button = parent:Add("DButton")
    button:SetText("")
    button:SetPos(x, y)
    button:SetSize(width, height)
    button.Paint = function(____, w, h)
        local highlighted = selected() or button:IsHovered()
        draw.RoundedBox(
            self.square and 0 or 4,
            0,
            0,
            w,
            h,
            highlighted and self.palette.Accent or self.palette.Panel
        )
        self:Text(
            label,
            "Trebuchet18",
            12,
            (h - 20) / 2,
            highlighted and Color(12, 18, 22) or self.palette.Text
        )
    end
    button.DoClick = function() return action() end
    return button
end
function SettingsHUD.prototype.UpdateContent(self, state, actions)
    self.state = state
    self.actions = actions
    local signature = table.concat(
        __TS__ArrayMap(
            state.Themes,
            function(____, theme) return (theme.ID .. ":") .. theme.Name end
        ),
        "|"
    )
    if self.content and signature == self.signature then
        return
    end
    self.signature = signature
    local ____opt_0 = self.content
    if ____opt_0 ~= nil then
        ____opt_0:Remove()
    end
    local frame = self.frame
    if not frame then
        return
    end
    local width, height = frame:GetSize()
    local content = vgui.Create("DScrollPanel", frame)
    self.content = content
    content:SetPos(24, 96)
    content:SetSize(width - 48, height - 148)
    local rowWidth = width - 68
    local appearance = content:Add("DPanel")
    appearance:SetPos(0, 0)
    appearance:SetSize(rowWidth, 30)
    appearance.Paint = function() return self:Text(
        "zombieplague.settingsappearance",
        "ZPMenuOptionTitle",
        0,
        0,
        self.palette.Accent
    ) end
    __TS__ArrayForEach(
        state.Themes,
        function(____, theme, index) return self:Button(
            content,
            theme.Name,
            0,
            34 + index * 42,
            rowWidth,
            36,
            function() return actions:UseTheme(theme.ID) end,
            function()
                local ____opt_2 = self.state
                return (____opt_2 and ____opt_2.Theme) == theme.ID
            end
        ) end
    )
    local gameplayY = 44 + #state.Themes * 42
    local gameplay = content:Add("DPanel")
    gameplay:SetPos(0, gameplayY)
    gameplay:SetSize(rowWidth, 30)
    gameplay.Paint = function() return self:Text(
        "zombieplague.settingsgameplay",
        "ZPMenuOptionTitle",
        0,
        0,
        self.palette.Accent
    ) end
    local run = self:Button(
        content,
        "",
        0,
        gameplayY + 34,
        rowWidth,
        80,
        function()
            local ____actions_7 = actions
            local ____actions_SetAlwaysRun_8 = actions.SetAlwaysRun
            local ____opt_4 = self.state
            local ____temp_6 = ____opt_4 and ____opt_4.AlwaysRun
            if ____temp_6 == nil then
                ____temp_6 = false
            end
            return ____actions_SetAlwaysRun_8(____actions_7, not ____temp_6)
        end
    )
    run.Paint = function(____, w, h)
        draw.RoundedBox(
            self.square and 0 or 4,
            0,
            0,
            w,
            h,
            self.palette.Panel
        )
        self:Text("zombieplague.settingsalwaysrun", "ZPMenuOptionTitle", 12, 10)
        local ____self_Text_11 = self.Text
        local ____opt_9 = self.state
        ____self_Text_11(
            self,
            ____opt_9 and ____opt_9.AlwaysRun and "zombieplague.settingsenabled" or "zombieplague.settingsdisabled",
            "Trebuchet18",
            w - 112,
            13,
            self.palette.Accent
        )
        self:Text(
            "zombieplague.settingsalwaysrunhelp",
            "DermaDefault",
            12,
            48,
            self.palette.Muted
        )
    end
end
function SettingsHUD.prototype.Update(self, state)
    if self.actions then
        self:UpdateContent(state, self.actions)
    end
end
function SettingsHUD.prototype.Destroy(self)
    local ____opt_12 = self.frame
    if ____opt_12 ~= nil then
        ____opt_12:Remove()
    end
    self.frame = nil
    self.content = nil
    self.actions = nil
end
_G.ZPCreateSettingsHUD = function(palette, square) return __TS__New(____exports.SettingsHUD, palette, square) end
return ____exports
