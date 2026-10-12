-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_main_menu.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
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
____exports.MainMenuController = __TS__Class()
local MainMenuController = ____exports.MainMenuController
MainMenuController.name = "MainMenuController"
function MainMenuController.prototype.____constructor(self)
    self.options = {}
    self.opened = false
end
function MainMenuController.prototype.RegisterOption(self, option)
    if #option.ID == 0 or __TS__ArraySome(
        self.options,
        function(____, entry) return entry.ID == option.ID end
    ) then
        return
    end
    local ____self_options_0 = self.options
    ____self_options_0[#____self_options_0 + 1] = option
    local ____opt_1 = self.presentation
    if ____opt_1 ~= nil then
        ____opt_1:Update(self:GetState())
    end
end
function MainMenuController.prototype.GetState(self)
    return {
        Open = self.opened,
        Theme = ZPThemes:GetActiveID(),
        Entries = __TS__ArrayMap(
            __TS__ArrayFilter(
                self.options,
                function(____, option)
                    local ____opt_3 = option.IsVisible
                    local ____temp_5 = ____opt_3 and ____opt_3()
                    if ____temp_5 == nil then
                        ____temp_5 = true
                    end
                    return ____temp_5
                end
            ),
            function(____, option) return {ID = option.ID, Label = option.Label, Description = option.Description} end
        )
    }
end
function MainMenuController.prototype.Open(self)
    local ____opt_6 = _G.ZPSettings
    if ____opt_6 ~= nil then
        ____opt_6:Close()
    end
    ZPWeaponMenu:Close()
    self.opened = true
    self:Rebuild()
end
function MainMenuController.prototype.Rebuild(self)
    if not self.opened then
        return
    end
    local ____opt_8 = self.presentation
    if ____opt_8 ~= nil then
        ____opt_8:Destroy()
    end
    self.presentation = nil
    local theme = ZPThemes:GetTheme()
    if theme then
        self.presentation = theme.CreateMainMenu and theme.CreateMainMenu() or ZPCreateMainMenuHUD(theme.Palette, false)
        self.presentation:Open(
            self:GetState(),
            self
        )
    end
end
function MainMenuController.prototype.Close(self)
    self.opened = false
    local ____opt_10 = self.presentation
    if ____opt_10 ~= nil then
        ____opt_10:Destroy()
    end
    self.presentation = nil
end
function MainMenuController.prototype.Toggle(self)
    if self.opened then
        self:Close()
    else
        self:Open()
    end
end
function MainMenuController.prototype.Activate(self, id)
    if not self.opened then
        return
    end
    local option = __TS__ArrayFind(
        self.options,
        function(____, entry) return entry.ID == id end
    )
    local ____temp_15 = not option
    if not ____temp_15 then
        local ____opt_12 = option.IsVisible
        local ____temp_14 = ____opt_12 and ____opt_12()
        if ____temp_14 == nil then
            ____temp_14 = true
        end
        ____temp_15 = not ____temp_14
    end
    if ____temp_15 then
        return
    end
    self:Close()
    option.Action()
end
function MainMenuController.prototype.Tick(self)
    if self.opened then
        if input.IsKeyDown(KEY_ESCAPE) then
            self:Close()
        else
            local ____opt_16 = self.presentation
            if ____opt_16 ~= nil then
                ____opt_16:Update(self:GetState())
            end
        end
    end
end
local controller = __TS__New(____exports.MainMenuController)
_G.ZPMainMenu = controller
controller:RegisterOption({
    ID = "weapons",
    Label = "zombieplague.mainmenuweapons",
    Description = "zombieplague.mainmenuweaponsdescription",
    Action = function() return ZPWeaponMenu:Open() end
})
hook.Add(
    "Think",
    "ZPMainMenuController",
    function() return controller:Tick() end
)
concommand.Add(
    "zp_menu",
    function() return controller:Toggle() end
)
return ____exports
