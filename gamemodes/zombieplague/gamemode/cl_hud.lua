-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_hud.ts. DO NOT EDIT; run npm run build.
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
____exports.HudManager = __TS__Class()
local HudManager = ____exports.HudManager
HudManager.name = "HudManager"
function HudManager.prototype.____constructor(self)
    self.HudComponents = {}
end
function HudManager.prototype.CreateHudInfo(self, id, text, info, show)
    local ____self_HudComponents_0 = self.HudComponents
    ____self_HudComponents_0[#____self_HudComponents_0 + 1] = {
        HudComponentID = id,
        TextFunction = function(self, ply)
            return text(ply)
        end,
        InfoFunction = function(self, ply)
            return info(ply)
        end,
        ShouldRenderFunction = function(self, ply)
            return show(ply)
        end
    }
end
function HudManager.prototype.CreateBox(self, borderSize, radius, border, body, x, y, width, height)
    if borderSize > 0 and border and border.a > 0 then
        draw.RoundedBox(
            radius,
            x,
            y,
            width,
            height,
            border
        )
        width = width - borderSize * 2
        height = height - borderSize * 2
        x = x + borderSize
        y = y + borderSize
    end
    if body.a > 0 then
        draw.RoundedBox(
            radius,
            x,
            y,
            width,
            height,
            body
        )
    end
end
function HudManager.prototype.CalculateTextSize(self, text, font)
    surface.SetFont(font)
    return surface.GetTextSize(text)
end
local hudManager = __TS__New(____exports.HudManager)
_G.HudManager = hudManager
local function percent(value, max)
    return string.format(
        "%.0f%%",
        max > 0 and math.max(
            0,
            math.min(100, value / max * 100)
        ) or 0
    )
end
hudManager:CreateHudInfo(
    "HUDZPSpectatingPlayer",
    function() return language.GetPhrase("zombieplague.hudspectatingplayer") end,
    function(ply) return ply:Name() end,
    function() return not LocalPlayer():Alive() end
)
hudManager:CreateHudInfo(
    "HUDZPClass",
    function() return language.GetPhrase("zombieplague.classclass") end,
    function(ply) return ply:GetZPClass() end,
    function() return true end
)
hudManager:CreateHudInfo(
    "HUDHealth",
    function() return language.GetPhrase("zombieplague.classhealth") end,
    function(ply) return ply:Health() end,
    function() return true end
)
hudManager:CreateHudInfo(
    "HUDArmor",
    function() return language.GetPhrase("zombieplague.classarmor") end,
    function(ply) return ply:Armor() end,
    function() return true end
)
hudManager:CreateHudInfo(
    "HUDOxygenLevel",
    function() return language.GetPhrase("zombieplague.classoxygenlevel") end,
    function(ply) return percent(
        ply:GetBreath(),
        ply:GetMaxBreath()
    ) end,
    function(ply) return ply:GetBreath() < ply:GetMaxBreath() end
)
hudManager:CreateHudInfo(
    "HUDBattery",
    function() return language.GetPhrase("zombieplague.classbattery") end,
    function(ply) return percent(
        ply:GetBattery(),
        ply:GetMaxBatteryCharge()
    ) end,
    function(ply) return ply:GetBattery() < ply:GetMaxBatteryCharge() end
)
hudManager:CreateHudInfo(
    "HUDAbilityPower",
    function() return language.GetPhrase("zombieplague.classabilitypower") end,
    function(ply) return percent(
        ply:GetAbilityPower(),
        ply:GetMaxAbilityPower()
    ) end,
    function(ply) return ply:GetAbilityPower() < ply:GetMaxAbilityPower() end
)
hudManager:CreateHudInfo(
    "HUDAP",
    function() return language.GetPhrase("zombieplague.ap") end,
    function(ply) return ply:GetAmmoPacks() end,
    function() return true end
)
local function light(ply, tint, size, duration, shoot)
    local effect = DynamicLight(ply:EntIndex())
    if not effect then
        return
    end
    effect.pos = shoot and ply:GetShootPos() or ply:GetPos()
    effect.r = tint.r
    effect.g = tint.g
    effect.b = tint.b
    effect.brightness = 2
    effect.Decay = 1000
    effect.Size = size
    effect.DieTime = CurTime() + duration
end
hook.Add(
    "Think",
    "ZPSpecialLights",
    function()
        if not IsValid(LocalPlayer()) then
            return
        end
        if IsNightvisionOn() then
            light(
                LocalPlayer(),
                LocalPlayer():GetNightvisionColor(),
                750,
                1,
                true
            )
        end
        for ____, entry in ipairs(player.GetAll()) do
            local ply = entry
            local tint = ply:GetLight()
            if tint then
                light(
                    ply,
                    tint,
                    250,
                    0.5,
                    false
                )
            end
        end
    end
)
return ____exports
