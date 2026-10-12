-- Generated from src/gamemodes/zombieplague/gamemode/interface/client/cl_keymanager.ts. DO NOT EDIT; run npm run build.
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

local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
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
____exports.KeyManager = __TS__Class()
local KeyManager = ____exports.KeyManager
KeyManager.name = "KeyManager"
function KeyManager.prototype.____constructor(self)
    self.Keys = {}
    self.EventGroups = {}
    self.TemporaryKeys = {}
    self.SaveFileName = "zombieplague/keybinding.json"
    self.LastPress = 0
    self.PressingKeyList = {}
end
function KeyManager.prototype.SetKeyGroup(self, id, group)
    self.Keys[id] = group
end
function KeyManager.prototype.GetEvent(self, id)
    for ____, group in pairs(self.EventGroups) do
        if group[id] then
            return group[id]
        end
    end
    return nil
end
function KeyManager.prototype.AddEvent(self, group, id, name, action, key)
    if self:GetEvent(id) then
        print(("Could not add event: '" .. id) .. "', duplicated ID!")
        return
    end
    local events = self.EventGroups[group] or ({})
    self.EventGroups[group] = events
    events[id] = {
        Name = name,
        Action = function(self)
            action()
        end,
        DefaultKey = key
    }
end
function KeyManager.prototype.GetEventGroup(self, id)
    return self.EventGroups[id] or ({})
end
function KeyManager.prototype.GetEventGroups(self)
    return self.EventGroups
end
function KeyManager.prototype.GetKeys(self)
    return self.Keys
end
function KeyManager.prototype.GetKeysByGroupID(self, id)
    return self.Keys[id] or ({})
end
function KeyManager.prototype.Save(self)
    if not file.Exists("zombieplague", "DATA") then
        file.CreateDir("zombieplague")
    end
    file.Write(
        self.SaveFileName,
        util.TableToJSON(self.Keys, true)
    )
end
function KeyManager.prototype.LoadDefault(self)
    local keys = {}
    for groupID, group in pairs(self.EventGroups) do
        local bindings = {}
        keys[groupID] = bindings
        for id, event in pairs(group) do
            bindings[id] = event.DefaultKey
        end
    end
    return keys
end
function KeyManager.prototype.Load(self)
    self.Keys = self:LoadDefault()
    local text = file.Read(self.SaveFileName, "DATA")
    local ____text_0
    if text then
        ____text_0 = ZPClientData.Record(util.JSONToTable(text))
    else
        ____text_0 = nil
    end
    local stored = ____text_0
    if stored then
        for groupID, events in pairs(self.EventGroups) do
            do
                local __continue21
                repeat
                    local saved = ZPClientData.Record(stored[groupID])
                    local group = self.Keys[groupID]
                    if not saved or not group then
                        __continue21 = true
                        break
                    end
                    for id in pairs(events) do
                        local key = saved[id]
                        if type(key) == "number" and key >= KEY_NONE and key == math.floor(key) then
                            group[id] = key
                        end
                    end
                    __continue21 = true
                until true
                if not __continue21 then
                    break
                end
            end
        end
    end
    self:Save()
end
function KeyManager.prototype.ResetGroup(self, id)
    self.Keys[id] = self:LoadDefault()[id] or ({})
    self:Save()
end
local keyManager = __TS__New(____exports.KeyManager)
_G.KeyManager = keyManager
hook.Add(
    "Think",
    "KeyManagerHook",
    function()
        if LocalPlayer():IsTyping() or CurTime() < keyManager.LastPress then
            return
        end
        for ____, group in pairs(keyManager.Keys) do
            for id, key in pairs(group) do
                if key ~= KEY_NONE and input.IsKeyDown(key) then
                    if not keyManager.PressingKeyList[key] then
                        keyManager.LastPress = CurTime() + 0.2
                        keyManager.PressingKeyList[key] = true
                        local ____opt_1 = keyManager:GetEvent(id)
                        if ____opt_1 ~= nil then
                            ____opt_1:Action()
                        end
                    end
                else
                    __TS__Delete(keyManager.PressingKeyList, key)
                end
            end
        end
    end
)
local function request(name)
    return function()
        net.Start(name)
        net.SendToServer()
    end
end
keyManager:AddEvent(
    "ZombiePlagueActions",
    "NightVisionToggle",
    "KeyBindingNightVisionToggle",
    request("RequestNightvision"),
    KEY_F3
)
keyManager:AddEvent(
    "ZombiePlagueActions",
    "RequestAbility",
    "KeyBindingRequestAbility",
    request("RequestAbility"),
    KEY_T
)
keyManager:Load()
return ____exports
