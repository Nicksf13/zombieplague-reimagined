-- Generated from src/gamemodes/zombieplague/gamemode/player/client/cl_player.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end

local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ClassExtends(target, base)
    target.____super = base
    local staticMetatable = setmetatable({__index = base}, base)
    setmetatable(target, staticMetatable)
    local baseMetatable = getmetatable(base)
    if baseMetatable then
        if type(baseMetatable.__index) == "function" then
            staticMetatable.__index = baseMetatable.__index
        end
        if type(baseMetatable.__newindex) == "function" then
            staticMetatable.__newindex = baseMetatable.__newindex
        end
    end
    setmetatable(target.prototype, base.prototype)
    if type(base.prototype.__index) == "function" then
        target.prototype.__index = base.prototype.__index
    end
    if type(base.prototype.__newindex) == "function" then
        target.prototype.__newindex = base.prototype.__newindex
    end
    if type(base.prototype.__tostring) == "function" then
        target.prototype.__tostring = base.prototype.__tostring
    end
end

local Error, RangeError, ReferenceError, SyntaxError, TypeError, URIError
do
    local function getErrorStack(self, constructor)
        if debug == nil then
            return nil
        end
        local level = 1
        while true do
            local info = debug.getinfo(level, "f")
            level = level + 1
            if not info then
                level = 1
                break
            elseif info.func == constructor then
                break
            end
        end
        if __TS__StringIncludes(_VERSION, "Lua 5.0") then
            return debug.traceback(("[Level " .. tostring(level)) .. "]")
        elseif _VERSION == "Lua 5.1" then
            return string.sub(
                debug.traceback("", level),
                2
            )
        else
            return debug.traceback(nil, level)
        end
    end
    local function wrapErrorToString(self, getDescription)
        return function(self)
            local description = getDescription(self)
            local caller = debug.getinfo(3, "f")
            local isClassicLua = __TS__StringIncludes(_VERSION, "Lua 5.0")
            if isClassicLua or caller and caller.func ~= error then
                return description
            else
                return (description .. "\n") .. tostring(self.stack)
            end
        end
    end
    local function initErrorClass(self, Type, name)
        Type.name = name
        return setmetatable(
            Type,
            {__call = function(____, _self, message) return __TS__New(Type, message) end}
        )
    end
    local ____initErrorClass_1 = initErrorClass
    local ____class_0 = __TS__Class()
    ____class_0.name = ""
    function ____class_0.prototype.____constructor(self, message)
        if message == nil then
            message = ""
        end
        self.message = message
        self.name = "Error"
        self.stack = getErrorStack(nil, __TS__New)
        local metatable = getmetatable(self)
        if metatable and not metatable.__errorToStringPatched then
            metatable.__errorToStringPatched = true
            metatable.__tostring = wrapErrorToString(nil, metatable.__tostring)
        end
    end
    function ____class_0.prototype.__tostring(self)
        return self.message ~= "" and (self.name .. ": ") .. self.message or self.name
    end
    Error = ____initErrorClass_1(nil, ____class_0, "Error")
    local function createErrorClass(self, name)
        local ____initErrorClass_3 = initErrorClass
        local ____class_2 = __TS__Class()
        ____class_2.name = ____class_2.name
        __TS__ClassExtends(____class_2, Error)
        function ____class_2.prototype.____constructor(self, ...)
            ____class_2.____super.prototype.____constructor(self, ...)
            self.name = name
        end
        return ____initErrorClass_3(nil, ____class_2, name)
    end
    RangeError = createErrorClass(nil, "RangeError")
    ReferenceError = createErrorClass(nil, "ReferenceError")
    SyntaxError = createErrorClass(nil, "SyntaxError")
    TypeError = createErrorClass(nil, "TypeError")
    URIError = createErrorClass(nil, "URIError")
end

local function __TS__ObjectGetOwnPropertyDescriptors(object)
    local metatable = getmetatable(object)
    if not metatable then
        return {}
    end
    return rawget(metatable, "_descriptors") or ({})
end

local function __TS__Delete(target, key)
    local descriptors = __TS__ObjectGetOwnPropertyDescriptors(target)
    local descriptor = descriptors[key]
    if descriptor then
        if not descriptor.configurable then
            error(
                __TS__New(
                    TypeError,
                    ((("Cannot delete property " .. tostring(key)) .. " of ") .. tostring(target)) .. "."
                ),
                0
            )
        end
        descriptors[key] = nil
        return true
    end
    target[key] = nil
    return true
end
-- End of Lua Library inline imports
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.SetAmmoPacks = function(self, value)
    self.AmmoPacks = value
end
PLAYER.GetAmmoPacks = function(self)
    return self.AmmoPacks or 0
end
PLAYER.SetBattery = function(self, value)
    self.Battery = value
end
PLAYER.GetBattery = function(self)
    return self.Battery or self:GetMaxBatteryCharge()
end
PLAYER.SetMaxBatteryCharge = function(self, value)
    self.MaxCharge = value
end
PLAYER.GetMaxBatteryCharge = function(self)
    return self.MaxCharge or 100
end
PLAYER.SetZombieClass = function(self, value)
    self.ZombieClass = value
end
PLAYER.GetZombieClass = function(self)
    return self.ZombieClass or ""
end
PLAYER.SetHumanClass = function(self, value)
    self.HumanClass = value
end
PLAYER.GetHumanClass = function(self)
    return self.HumanClass or ""
end
PLAYER.SetNemesis = function(self, value)
    self.Nemesis = value
end
PLAYER.IsNemesis = function(self)
    return self.Nemesis
end
PLAYER.SetSurvivor = function(self, value)
    self.Survivor = value
end
PLAYER.IsSurvivor = function(self)
    return self.Survivor
end
PLAYER.SetFootstep = function(self, value)
    if value == nil then
        __TS__Delete(self, "Footstep")
    else
        self.Footstep = value
    end
end
PLAYER.GetFootstep = function(self)
    return self.Footstep
end
PLAYER.SetAbilityPower = function(self, value)
    self.AbilityPower = value
end
PLAYER.GetAbilityPower = function(self)
    return self.AbilityPower or -1
end
PLAYER.SetMaxAbilityPower = function(self, value)
    self.MaxAbilityPower = value
end
PLAYER.GetMaxAbilityPower = function(self)
    return self.MaxAbilityPower or -1
end
PLAYER.SetBreath = function(self, value)
    self.Breath = value
end
PLAYER.GetBreath = function(self)
    return self.Breath or 100
end
PLAYER.SetMaxBreath = function(self, value)
    self.MaxBreath = value
end
PLAYER.GetMaxBreath = function(self)
    return self.MaxBreath or 100
end
PLAYER.SetPoints = function(self, value)
    self.Points = value
end
PLAYER.GetPoints = function(self)
    return self.Points or 0
end
PLAYER.SetLight = function(self, value)
    if value == nil then
        __TS__Delete(self, "Light")
    else
        self.Light = value
    end
end
PLAYER.GetLight = function(self)
    return self.Light
end
PLAYER.SetScreenFilter = function(self, value)
    if value == nil then
        __TS__Delete(self, "ScreenFilter")
    else
        self.ScreenFilter = value
    end
end
PLAYER.GetScreenFilter = function(self)
    return self.ScreenFilter
end
PLAYER.GetZPClass = function(self)
    if self:IsNemesis() then
        return language.GetPhrase("zombieplague.nemesis")
    end
    if self:IsSurvivor() then
        return language.GetPhrase("zombieplague.survivor")
    end
    if self:IsZombie() then
        return language.GetPhrase("zombieplague." .. string.lower(self:GetZombieClass()))
    end
    if self:IsHuman() then
        return language.GetPhrase("zombieplague." .. string.lower(self:GetHumanClass()))
    end
    return ""
end
local nightvision = false
_G.SetNightvision = function(value)
    nightvision = value
end
_G.IsNightvisionOn = function() return nightvision end
PLAYER.GetNightvisionColor = function(self)
    return self:IsNemesis() and Color(255, 0, 0) or (self:IsSurvivor() and Color(0, 0, 255) or NIGHTVISION_COLOR)
end
for ____, ____value in ipairs({{"PlayerStartVoice", true}, {"PlayerEndVoice", false}}) do
    local event = ____value[1]
    local talking = ____value[2]
    hook.Add(
        event,
        "ZPStartTalking",
        function(ply)
            if ply == LocalPlayer() then
                net.Start("SendVoice")
                net.WriteBool(talking)
                net.SendToServer()
            end
        end
    )
end
net.Receive(
    "SendNightvision",
    function() return SetNightvision(net.ReadBool()) end
)
net.Receive(
    "SendAmmoPacks",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetAmmoPacks(net.ReadInt(32))
        end
    end
)
net.Receive(
    "SendBatteryCharge",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetBattery(net.ReadFloat())
        end
    end
)
net.Receive(
    "SendMaxBatteryCharge",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetMaxBatteryCharge(net.ReadFloat())
        end
    end
)
net.Receive(
    "SendZombieClass",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetZombieClass(net.ReadString())
        end
    end
)
net.Receive(
    "SendHumanClass",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetHumanClass(net.ReadString())
        end
    end
)
net.Receive(
    "SendNemesis",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetNemesis(net.ReadBool())
        end
    end
)
net.Receive(
    "SendSurvivor",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetSurvivor(net.ReadBool())
        end
    end
)
net.Receive(
    "SendFoostep",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetFootstep(net.ReadBool())
        end
    end
)
net.Receive(
    "SendAbilityPower",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetAbilityPower(net.ReadInt(16))
        end
    end
)
net.Receive(
    "SendMaxAbilityPower",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetMaxAbilityPower(net.ReadInt(16))
        end
    end
)
net.Receive(
    "SendBreath",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetBreath(net.ReadFloat())
        end
    end
)
net.Receive(
    "SendMaxBreath",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetMaxBreath(net.ReadFloat())
        end
    end
)
net.Receive(
    "SendPoints",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetPoints(net.ReadInt(32))
        end
    end
)
net.Receive(
    "SendLight",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetLight(net.ReadBool() and net.ReadColor() or nil)
        end
    end
)
net.Receive(
    "SendScreenFilter",
    function()
        local ply = PlayerManager:DiscoverPlayerByTextID(net.ReadString())
        if ply and IsValid(ply) then
            ply:SetScreenFilter(net.ReadBool() and net.ReadColor() or nil)
        end
    end
)
return ____exports
