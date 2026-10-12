-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_main_menu_hud.ts. DO NOT EDIT; run npm run build.
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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
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
____exports.MainMenuHUD = __TS__Class()
local MainMenuHUD = ____exports.MainMenuHUD
MainMenuHUD.name = "MainMenuHUD"
function MainMenuHUD.prototype.____constructor(self, palette, square)
    self.palette = palette
    self.square = square
    self.signature = ""
end
function MainMenuHUD.prototype.Open(self, state, actions)
    self.actions = actions
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
            440,
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
        draw.DrawText(
            "ZOMBIE PLAGUE",
            "Trebuchet18",
            24,
            20,
            self.palette.Accent,
            TEXT_ALIGN_LEFT
        )
        draw.DrawText(
            language.GetPhrase("zombieplague.mainmenutitle"),
            "DermaLarge",
            24,
            48,
            self.palette.Text,
            TEXT_ALIGN_LEFT
        )
        draw.DrawText(
            language.GetPhrase("zombieplague.mainmenucontrols"),
            "DermaDefault",
            24,
            height - 28,
            self.palette.Muted,
            TEXT_ALIGN_LEFT
        )
    end
    local width = frame:GetSize()
    self:Button(
        frame,
        "X",
        width - 52,
        18,
        30,
        function() return actions:Close() end
    )
    local themes = ZPThemes:GetThemes()
    local themeWidth = (width - 48 - math.max(0, #themes - 1) * 8) / math.max(1, #themes)
    __TS__ArrayForEach(
        themes,
        function(____, theme, index) return self:Button(
            frame,
            theme.Name,
            24 + index * (themeWidth + 8),
            100,
            themeWidth,
            function() return ZPThemes:UseTheme(theme.ID) end
        ) end
    )
    frame:MakePopup()
    self:Update(state)
end
function MainMenuHUD.prototype.Update(self, state)
    local frame = self.frame
    if not frame or not IsValid(frame) then
        return
    end
    local signature = table.concat(
        __TS__ArrayMap(
            state.Entries,
            function(____, entry) return (((entry.ID .. ":") .. entry.Label) .. ":") .. entry.Description end
        ),
        "|"
    )
    if self.list and signature == self.signature then
        return
    end
    self.signature = signature
    local ____opt_0 = self.list
    if ____opt_0 ~= nil then
        ____opt_0:Remove()
    end
    local width, height = frame:GetSize()
    local list = vgui.Create("DScrollPanel", frame)
    self.list = list
    list:SetPos(24, 148)
    list:SetSize(width - 48, height - 196)
    __TS__ArrayForEach(
        state.Entries,
        function(____, entry, index)
            local button = self:Button(
                list,
                language.GetPhrase(entry.Label),
                0,
                index * 84,
                width - 70,
                function()
                    local ____opt_2 = self.actions
                    return ____opt_2 and ____opt_2:Activate(entry.ID)
                end,
                72
            )
            button.Paint = function(____, w, h)
                draw.RoundedBox(
                    self.square and 0 or 4,
                    0,
                    0,
                    w,
                    h,
                    button:IsHovered() and self.palette.Accent or self.palette.Panel
                )
                local color = button:IsHovered() and Color(12, 18, 22) or self.palette.Text
                draw.DrawText(
                    language.GetPhrase(entry.Label),
                    "Trebuchet24",
                    16,
                    10,
                    color,
                    TEXT_ALIGN_LEFT
                )
                draw.DrawText(
                    language.GetPhrase(entry.Description),
                    "DermaDefault",
                    16,
                    44,
                    color,
                    TEXT_ALIGN_LEFT
                )
            end
        end
    )
    frame:SetKeyboardInputEnabled(false)
end
function MainMenuHUD.prototype.Button(self, parent, text, x, y, width, action, height)
    if height == nil then
        height = 30
    end
    local button = parent:Add("DButton")
    button:SetText("")
    button:SetPos(x, y)
    button:SetSize(width, height)
    button.Paint = function(____, w, h)
        draw.RoundedBox(
            self.square and 0 or 4,
            0,
            0,
            w,
            h,
            self.palette.Panel
        )
        draw.DrawText(
            text,
            "Trebuchet18",
            8,
            5,
            self.palette.Accent,
            TEXT_ALIGN_LEFT
        )
    end
    button.DoClick = function() return action() end
    return button
end
function MainMenuHUD.prototype.Destroy(self)
    local ____opt_4 = self.frame
    if ____opt_4 ~= nil then
        ____opt_4:Remove()
    end
    self.frame = nil
    self.list = nil
end
_G.ZPCreateMainMenuHUD = function(palette, square) return __TS__New(____exports.MainMenuHUD, palette, square) end
return ____exports
