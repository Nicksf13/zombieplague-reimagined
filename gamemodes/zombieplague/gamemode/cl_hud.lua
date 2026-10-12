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
_G.HUD_TOP = 1
_G.HUD_CENTER = 2
_G.HUD_BOTTOM = 3
_G.HUD_LEFT = 4
_G.HUD_RIGHT = 5
local function defaults(x, y)
    return {
        Border = Color(0, 0, 0, 144),
        Body = Color(72, 72, 72, 144),
        Text = Color(255, 255, 255),
        Font = "Trebuchet18",
        XPos = x,
        YPos = y
    }
end
local function color(value)
    local entry = ZPClientData.Record(value)
    if not entry or type(entry.r) ~= "number" or type(entry.g) ~= "number" or type(entry.b) ~= "number" or type(entry.a) ~= "number" then
        return
    end
    return Color(entry.r, entry.g, entry.b, entry.a)
end
local function config(value, fallback)
    local entry = ZPClientData.Record(value)
    if not entry then
        return fallback
    end
    return {
        Border = color(entry.Border) or fallback.Border,
        Body = color(entry.Body) or fallback.Body,
        Text = color(entry.Text) or fallback.Text,
        Font = type(entry.Font) == "string" and entry.Font or fallback.Font,
        XPos = type(entry.XPos) == "number" and entry.XPos or fallback.XPos,
        YPos = type(entry.YPos) == "number" and entry.YPos or fallback.YPos
    }
end
____exports.HudManager = __TS__Class()
local HudManager = ____exports.HudManager
HudManager.name = "HudManager"
function HudManager.prototype.____constructor(self)
    self.HUDConfig = {
        Status = defaults(HUD_LEFT, HUD_BOTTOM),
        Timer = defaults(HUD_CENTER, HUD_BOTTOM)
    }
    self.SaveFileName = "zombieplague/hudconfig.json"
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
function HudManager.prototype.CreateTextDisplayBox(self, text, borderSize, radius, border, body, x, y)
    local margin = text.TextMargin or 0
    local width, height = self:CalculateTextSize(text.Text, text.TextFont)
    local posX, posY = self:CalculatePos(
        x,
        y,
        width,
        height,
        20,
        20
    )
    self:CreateBox(
        borderSize,
        radius,
        border,
        body,
        posX,
        posY,
        width + margin * 2,
        height + margin * 2
    )
    draw.DrawText(
        text.Text,
        text.TextFont,
        posX + margin,
        posY + margin,
        text.TextColor,
        TEXT_ALIGN_LEFT
    )
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
function HudManager.prototype.CalculatePos(self, x, y, width, height, borderX, borderY)
    if borderX == nil then
        borderX = 0
    end
    if borderY == nil then
        borderY = 0
    end
    local posX = x == HUD_CENTER and ScrW() / 2 - width / 2 or (x == HUD_RIGHT and ScrW() - width - borderX or borderX)
    local posY = y == HUD_CENTER and ScrH() / 2 - height / 2 or (y == HUD_BOTTOM and ScrH() - height - borderY or borderY)
    return posX, posY
end
function HudManager.prototype.GetConfig(self, id, key)
    return self.HUDConfig[id][key]
end
function HudManager.prototype.GetComponentConfig(self, id)
    return self.HUDConfig[id]
end
function HudManager.prototype.LoadHudInformation(self)
    local saved = file.Read(self.SaveFileName, "DATA")
    if saved ~= nil then
        local data = ZPClientData.Record(util.JSONToTable(saved))
        if data then
            for ____, id in ipairs({"Status", "Timer"}) do
                self.HUDConfig[id] = config(data[id], self.HUDConfig[id])
            end
        end
    else
        self:Save()
    end
end
function HudManager.prototype.Save(self)
    file.Write(
        self.SaveFileName,
        util.TableToJSON(self.HUDConfig, true)
    )
end
function HudManager.prototype.CreateHudComponentInfo(self, x, y)
    return defaults(x, y)
end
local hudManager = __TS__New(____exports.HudManager)
_G.HudManager = hudManager
hudManager:LoadHudInformation()
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
    function(ply) return ply:Armor() > 0 end
)
hudManager:CreateHudInfo(
    "HUDOxygenLevel",
    function() return language.GetPhrase("zombieplague.classoxygenlevel") end,
    function(ply) return string.format(
        "%.2f",
        ply:GetBreath() / ply:GetMaxBreath() * 100
    ) .. "%" end,
    function(ply) return ply:GetBreath() < ply:GetMaxBreath() end
)
hudManager:CreateHudInfo(
    "HUDBattery",
    function() return language.GetPhrase("zombieplague.classbattery") end,
    function(ply) return string.format(
        "%.2f",
        ply:GetBattery() / ply:GetMaxBatteryCharge() * 100
    ) .. "%" end,
    function(ply) return ply:GetBattery() < ply:GetMaxBatteryCharge() end
)
hudManager:CreateHudInfo(
    "HUDAbilityPower",
    function() return language.GetPhrase("zombieplague.classabilitypower") end,
    function(ply) return string.format(
        "%.2f",
        ply:GetAbilityPower() / ply:GetMaxAbilityPower() * 100
    ) .. "%" end,
    function(ply) return ply:GetAbilityPower() < ply:GetMaxAbilityPower() end
)
hudManager:CreateHudInfo(
    "HUDAP",
    function() return language.GetPhrase("zombieplague.ap") end,
    function(ply) return ply:GetAmmoPacks() end,
    function() return true end
)
hook.Add(
    "HUDShouldDraw",
    "HideHUD",
    function(name)
        if name == "CHudHealth" or name == "CHudBattery" then
            return false
        end
    end
)
hook.Add(
    "HUDPaint",
    "HUDZombiePlague",
    function()
        if LocalPlayer():GetObserverMode() ~= OBS_MODE_ROAMING then
            local ply = LocalPlayer():Alive() and LocalPlayer() or LocalPlayer():GetObserverTarget()
            if IsValid(ply) then
                local filter = ply:GetScreenFilter()
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
                local parts = {}
                for ____, info in ipairs(hudManager.HudComponents) do
                    if info:ShouldRenderFunction(ply) then
                        parts[#parts + 1] = (info:TextFunction(ply) .. ": ") .. tostring(info:InfoFunction(ply))
                    end
                end
                local status = hudManager:GetComponentConfig("Status")
                hudManager:CreateTextDisplayBox(
                    {
                        Text = table.concat(parts, " - "),
                        TextFont = status.Font,
                        TextColor = status.Text,
                        TextMargin = 6
                    },
                    1,
                    10,
                    status.Border,
                    status.Body,
                    status.XPos,
                    status.YPos
                )
            end
        end
        local timerConfig = hudManager:GetComponentConfig("Timer")
        hudManager:CreateTextDisplayBox(
            {
                Text = string.FormattedTime(
                    math.ceil(RoundManager:GetTimer()),
                    "%02i:%02i"
                ),
                TextFont = timerConfig.Font,
                TextColor = timerConfig.Text,
                TextMargin = 6
            },
            1,
            10,
            timerConfig.Border,
            timerConfig.Body,
            timerConfig.XPos,
            timerConfig.YPos
        )
    end
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
