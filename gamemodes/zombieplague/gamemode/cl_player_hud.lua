-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_player_hud.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ObjectAssign(target, ...)
    local sources = {...}
    for i = 1, #sources do
        local source = sources[i]
        if type(source) == "table" then
            for key in pairs(source) do
                target[key] = source[key]
            end
        end
    end
    return target
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.PlayerHUDController = __TS__Class()
local PlayerHUDController = ____exports.PlayerHUDController
PlayerHUDController.name = "PlayerHUDController"
function PlayerHUDController.prototype.____constructor(self)
end
function PlayerHUDController.prototype.Subject(self)
    local viewer = LocalPlayer()
    if not IsValid(viewer) or viewer:GetObserverMode() == OBS_MODE_ROAMING then
        return
    end
    local subject = viewer:Alive() and viewer or viewer:GetObserverTarget()
    if IsValid(subject) and subject:IsPlayer() then
        return subject
    end
end
function PlayerHUDController.prototype.Ammo(self, subject)
    local weapon = subject:GetActiveWeapon()
    if not IsValid(weapon) then
        return
    end
    local primary = weapon:GetPrimaryAmmoType()
    local secondary = weapon:GetSecondaryAmmoType()
    if primary < 0 and secondary < 0 then
        return
    end
    local ammo = {}
    if primary >= 0 then
        ammo.Primary = {
            Clip = weapon:Clip1(),
            Reserve = subject:GetAmmoCount(primary)
        }
    end
    if secondary >= 0 then
        ammo.Secondary = {
            Clip = weapon:Clip2(),
            Reserve = subject:GetAmmoCount(secondary)
        }
    end
    return ammo
end
function PlayerHUDController.prototype.GetState(self)
    local subject = self:Subject()
    local entries = {}
    if subject then
        for ____, info in ipairs(HudManager.HudComponents) do
            if info:ShouldRenderFunction(subject) then
                entries[#entries + 1] = {
                    ID = info.HudComponentID,
                    Label = info:TextFunction(subject),
                    Value = info:InfoFunction(subject)
                }
            end
        end
    end
    local state = {
        Width = ScrW(),
        Height = ScrH(),
        Timer = string.FormattedTime(
            math.max(
                0,
                math.ceil(RoundManager:GetTimer())
            ),
            "%02i:%02i"
        ),
        Spectating = IsValid(LocalPlayer()) and not LocalPlayer():Alive(),
        Entries = entries
    }
    local ____temp_0
    if subject and subject == LocalPlayer() and subject:Alive() then
        ____temp_0 = self:Ammo(subject)
    else
        ____temp_0 = nil
    end
    local ammo = ____temp_0
    return ammo and __TS__ObjectAssign({}, state, {Ammo = ammo}) or state
end
function PlayerHUDController.prototype.Paint(self)
    local subject = self:Subject()
    local filter = subject and subject:GetScreenFilter()
    if filter then
        draw.RoundedBox(
            0,
            0,
            0,
            ScrW(),
            ScrH(),
            filter
        )
    end
    local theme = ZPThemes:GetTheme()
    if theme then
        theme.PaintPlayerHUD(
            self:GetState(),
            theme.Palette
        )
    end
end
function PlayerHUDController.prototype.ShouldHide(self, name)
    if not ZPThemes:GetTheme() then
        return
    end
    if name == "CHudHealth" or name == "CHudBattery" then
        return false
    end
    local subject = self:Subject()
    if (name == "CHudAmmo" or name == "CHudSecondaryAmmo") and subject and subject == LocalPlayer() and subject:Alive() and self:Ammo(subject) then
        return false
    end
end
local hud = __TS__New(____exports.PlayerHUDController)
_G.ZPPlayerHUD = hud
hook.Add(
    "HUDShouldDraw",
    "HideHUD",
    function(name) return hud:ShouldHide(name) end
)
hook.Add(
    "HUDPaint",
    "HUDZombiePlague",
    function() return hud:Paint() end
)
return ____exports
