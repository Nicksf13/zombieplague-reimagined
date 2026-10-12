-- Generated from src/gamemodes/zombieplague/gamemode/bank/server/sv_bank.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
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

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
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
____exports.AmmoPackBank = __TS__Class()
local AmmoPackBank = ____exports.AmmoPackBank
AmmoPackBank.name = "AmmoPackBank"
function AmmoPackBank.prototype.____constructor(self, storage)
    self.BankStorageType = "text"
    self.AmmoPacksStorage = {}
    self.Time = 5
    self.ShouldSaveAmmoPacks = true
    self.Save = function()
        local storage = self.BankStorageSource
        if not storage then
            return
        end
        for id, amount in pairs(self.AmmoPacksStorage) do
            local success, ____error = pcall(storage.Save, id, amount)
            if success then
                __TS__Delete(self.AmmoPacksStorage, id)
            elseif ____error ~= nil then
                print("Error on ammo pack saving:")
                print(____error)
            end
        end
    end
    if storage then
        self.BankStorageSource = storage
    end
end
function AmmoPackBank.prototype.SetPlayerAmmoPacks(self, ply, amount)
    self.AmmoPacksStorage[ply:SteamID64()] = amount
end
function AmmoPackBank.prototype.GiveTakeAmmoPacks(self, requester, target, give, amount)
    if not requester:IsSuperAdmin() then
        SendPopupMessage(requester, {Phrase = "zombieplague.commandnotaccess"})
    elseif not target then
        SendPopupMessage(requester, {Phrase = "zombieplague.ammopackgiveplynotfound"})
    elseif amount == nil or amount <= 0 then
        SendPopupMessage(requester, {Phrase = "zombieplague.ammopackgiveinvalidamount"})
    else
        if give then
            target:GiveAmmoPacks(amount)
        else
            target:TakeAmmoPacks(amount)
        end
        local phrase = give and "AmmoPackGiveName" or "AmmoPackTakeName"
        SendPopupMessage(
            target,
            {
                Phrase = "zombieplague." .. string.lower(phrase),
                Arguments = {
                    requester:Name(),
                    amount
                }
            }
        )
    end
end
local bank = __TS__New(____exports.AmmoPackBank)
_G.Bank = bank
if bank.ShouldSaveAmmoPacks then
    include(("zombieplague/gamemode/bankstorage/" .. bank.BankStorageType) .. ".lua")
    local storage = bank.BankStorageSource
    if not storage then
        error("Bank backend did not register BankStorageSource", 0)
    end
    storage:Init()
    hook.Add(
        "PlayerAuthed",
        "ZPBankWithdraw",
        function(ply)
            ply:SetAmmoPacks(
                storage:GetPlayerAmmopacks(ply),
                true
            )
        end
    )
    hook.Add("ShutDown", "ZPBankDepositAll", bank.Save)
    timer.Create("ZPBankSaver", bank.Time, 0, bank.Save)
end
return ____exports
