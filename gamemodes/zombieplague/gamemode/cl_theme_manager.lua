-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_theme_manager.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.ThemeManager = __TS__Class()
local ThemeManager = ____exports.ThemeManager
ThemeManager.name = "ThemeManager"
function ThemeManager.prototype.____constructor(self)
    self.themes = {}
    self.order = {}
    self.activeID = "classic"
    self.preferredID = "classic"
    self.saveFile = "zombieplague/theme.json"
    local saved = file.Read(self.saveFile, "DATA")
    local ____temp_0
    if saved == nil then
        ____temp_0 = nil
    else
        ____temp_0 = ZPClientData.Record(util.JSONToTable(saved))
    end
    local data = ____temp_0
    if data and type(data.Theme) == "string" and #data.Theme > 0 and #data.Theme <= 64 then
        self.preferredID = data.Theme
    end
end
function ThemeManager.prototype.RegisterTheme(self, id, theme)
    if #id == 0 or #id > 64 or self.themes[id] then
        return
    end
    self.themes[id] = theme
    local ____self_order_1 = self.order
    ____self_order_1[#____self_order_1 + 1] = id
    ZPWeaponMenu:RegisterPresentation(id, theme.CreateWeaponMenu)
    if id == self.preferredID then
        self:UseTheme(id)
    end
end
function ThemeManager.prototype.UseTheme(self, id)
    if not self.themes[id] then
        return false
    end
    local changed = self.activeID ~= id
    self.activeID = id
    if ZPWeaponMenu:GetState().Presentation ~= id then
        ZPWeaponMenu:UsePresentation(id)
    end
    if changed then
        ZPMainMenu:Rebuild()
        local ____opt_2 = _G.ZPScoreboard
        if ____opt_2 ~= nil then
            ____opt_2:Rebuild()
        end
    end
    if self.preferredID ~= id then
        self.preferredID = id
        if not file.Exists("zombieplague", "DATA") then
            file.CreateDir("zombieplague")
        end
        file.Write(
            self.saveFile,
            util.TableToJSON({Theme = id})
        )
    end
    return true
end
function ThemeManager.prototype.GetActiveID(self)
    return self.activeID
end
function ThemeManager.prototype.GetTheme(self)
    return self.themes[self.activeID]
end
function ThemeManager.prototype.GetThemes(self)
    local result = {}
    for ____, id in ipairs(self.order) do
        local theme = self.themes[id]
        if theme then
            result[#result + 1] = {
                ID = id,
                Name = language.GetPhrase(theme.Name)
            }
        end
    end
    return result
end
local themes = __TS__New(____exports.ThemeManager)
_G.ZPThemes = themes
concommand.Add(
    "zp_theme",
    function(_ply, _command, args)
        local id = args[1]
        if id ~= nil and themes:UseTheme(id) then
            return
        end
        print("[ZP] " .. language.GetPhrase("zombieplague.themeusage"))
        for ____, theme in ipairs(themes:GetThemes()) do
            print((theme.ID .. " - ") .. theme.Name)
        end
    end
)
return ____exports
