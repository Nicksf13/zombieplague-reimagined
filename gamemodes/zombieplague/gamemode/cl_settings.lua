-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_settings.ts. DO NOT EDIT; run npm run build.
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
____exports.SettingsController = __TS__Class()
local SettingsController = ____exports.SettingsController
SettingsController.name = "SettingsController"
function SettingsController.prototype.____constructor(self)
    self.opened = false
    self.alwaysRun = CreateClientConVar(
        "zp_always_run",
        "0",
        true,
        false,
        "Always hold the sprint input while alive."
    )
end
function SettingsController.prototype.GetState(self)
    return {
        Open = self.opened,
        Theme = ZPThemes:GetActiveID(),
        Themes = ZPThemes:GetThemes(),
        AlwaysRun = self.alwaysRun:GetBool()
    }
end
function SettingsController.prototype.Open(self)
    ZPMainMenu:Close()
    ZPWeaponMenu:Close()
    self.opened = true
    self:Rebuild()
end
function SettingsController.prototype.Rebuild(self)
    if not self.opened then
        return
    end
    local ____opt_0 = self.presentation
    if ____opt_0 ~= nil then
        ____opt_0:Destroy()
    end
    self.presentation = nil
    local theme = ZPThemes:GetTheme()
    if theme then
        self.presentation = theme.CreateSettingsMenu and theme.CreateSettingsMenu() or ZPCreateSettingsHUD(
            theme.Palette,
            ZPThemes:GetActiveID() == "cs16"
        )
        self.presentation:Open(
            self:GetState(),
            self
        )
    end
end
function SettingsController.prototype.UseTheme(self, id)
    if self.opened then
        ZPThemes:UseTheme(id)
    end
end
function SettingsController.prototype.SetAlwaysRun(self, enabled)
    self.alwaysRun:SetBool(enabled)
    local ____opt_2 = self.presentation
    if ____opt_2 ~= nil then
        ____opt_2:Update(self:GetState())
    end
end
function SettingsController.prototype.Close(self)
    self.opened = false
    local ____opt_4 = self.presentation
    if ____opt_4 ~= nil then
        ____opt_4:Destroy()
    end
    self.presentation = nil
end
function SettingsController.prototype.Back(self)
    self:Close()
    ZPMainMenu:Open()
end
function SettingsController.prototype.Tick(self)
    if not self.opened then
        return
    end
    if input.IsKeyDown(KEY_ESCAPE) then
        self:Close()
    else
        local ____opt_6 = self.presentation
        if ____opt_6 ~= nil then
            ____opt_6:Update(self:GetState())
        end
    end
end
function SettingsController.prototype.ApplyMovement(self, command)
    local ply = LocalPlayer()
    if self.alwaysRun:GetBool() and IsValid(ply) and ply:Alive() and ply:Team() ~= TEAM_SPECTATOR then
        command:AddKey(IN_SPEED)
    end
end
local settings = __TS__New(____exports.SettingsController)
_G.ZPSettings = settings
ZPMainMenu:RegisterOption({
    ID = "settings",
    Label = "zombieplague.settingstitle",
    Description = "zombieplague.settingsdescription",
    Action = function() return settings:Open() end
})
hook.Add(
    "Think",
    "ZPSettingsController",
    function() return settings:Tick() end
)
hook.Add(
    "CreateMove",
    "ZPAlwaysRun",
    function(command) return settings:ApplyMovement(command) end
)
return ____exports
