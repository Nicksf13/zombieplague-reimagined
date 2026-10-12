-- Generated from src/gamemodes/zombieplague/gamemode/menus/server/sv_weapon_menu.ts. DO NOT EDIT; run npm run build.
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

local function __TS__ArraySort(self, compareFn)
    if compareFn ~= nil then
        table.sort(
            self,
            function(a, b) return compareFn(nil, a, b) < 0 end
        )
    else
        table.sort(self)
    end
    return self
end

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
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
-- End of Lua Library inline imports
local ____exports = {}
local WeaponMenuService = __TS__Class()
WeaponMenuService.name = "WeaponMenuService"
function WeaponMenuService.prototype.____constructor(self)
    self.sessions = {}
end
function WeaponMenuService.prototype.Session(self, ply)
    local id = ply:SteamID64()
    local session = self.sessions[id] or ({NextRequest = 0, Receipts = {}})
    self.sessions[id] = session
    return session
end
function WeaponMenuService.prototype.Disconnect(self, ply)
    __TS__Delete(
        self.sessions,
        ply:SteamID64()
    )
end
function WeaponMenuService.prototype.CanReceive(self, ply, kind)
    local ____temp_1
    if kind == "primary" then
        ____temp_1 = ply:GetPrimaryWeaponGiven()
    else
        local ____temp_0
        if kind == "secondary" then
            ____temp_0 = ply:GetSecondaryWeaponGiven()
        else
            ____temp_0 = ply:GetMeleeWeaponGiven()
        end
        ____temp_1 = ____temp_0
    end
    local given = ____temp_1
    return ply:Alive() and ply:IsHuman() and not given
end
function WeaponMenuService.prototype.Snapshot(self, ply)
    local entries = {}
    local budget = 0
    local truncated = false
    for ____, ____value in ipairs({{"primary", WEAPON_PRIMARY}, {"secondary", WEAPON_SECONDARY}, {"melee", WEAPON_MELEE}}) do
        local kind = ____value[1]
        local weaponType = ____value[2]
        for ____, weapon in pairs(WeaponManager:GetWeaponsTableByWeaponType(weaponType)) do
            do
                local __continue8
                repeat
                    if not weapon:ShouldBeEnabled() then
                        __continue8 = true
                        break
                    end
                    local cost = #weapon.WeaponID + #weapon.PrettyName + 256
                    if #entries >= 256 or budget + cost > 48000 or #weapon.WeaponID > 128 or #weapon.PrettyName > 128 then
                        truncated = true
                        __continue8 = true
                        break
                    end
                    budget = budget + cost
                    entries[#entries + 1] = {ID = weapon.WeaponID, Name = weapon.PrettyName, Kind = kind, Order = weapon.Order}
                    __continue8 = true
                until true
                if not __continue8 then
                    break
                end
            end
        end
    end
    __TS__ArraySort(
        entries,
        function(____, a, b) return a.Order ~= b.Order and a.Order - b.Order or (a.ID < b.ID and -1 or (a.ID == b.ID and 0 or 1)) end
    )
    local ____opt_2 = ply:GetPrimaryWeapon()
    local ____temp_8 = ____opt_2 and ____opt_2.WeaponID or ""
    local ____opt_4 = ply:GetSecondaryWeapon()
    local ____temp_9 = ____opt_4 and ____opt_4.WeaponID or ""
    local ____opt_6 = ply.MeleeWeapon
    return {
        Entries = entries,
        Selected = {primary = ____temp_8, secondary = ____temp_9, melee = ____opt_6 and ____opt_6.WeaponID or ""},
        CanReceive = {
            primary = self:CanReceive(ply, "primary"),
            secondary = self:CanReceive(ply, "secondary"),
            melee = self:CanReceive(ply, "melee")
        },
        Truncated = truncated
    }
end
function WeaponMenuService.prototype.OpenMissing(self, ply)
    if not IsValid(ply) or ply:IsBot() or not ply:Alive() or not ply:IsHuman() or ply:IsSurvivor() then
        return
    end
    local snapshot = self:Snapshot(ply)
    local missing = __TS__ArrayFind(
        {"primary", "secondary", "melee"},
        function(____, kind) return snapshot.Selected[kind] == "" and __TS__ArraySome(
            snapshot.Entries,
            function(____, entry) return entry.Kind == kind end
        ) end
    )
    if missing then
        net.Start("ZPWeaponMenuMissing")
        net.WriteString(missing)
        net.Send(ply)
    end
end
function WeaponMenuService.prototype.Reply(self, ply, id, code)
    local reply = (code == "invalid_weapon" or code == "rate_limited") and ({Version = 1, RequestID = id, Code = code}) or ({
        Version = 1,
        RequestID = id,
        Code = code,
        Snapshot = self:Snapshot(ply)
    })
    net.Start("ZPWeaponMenuReply")
    net.WriteTable(reply)
    net.Send(ply)
end
function WeaponMenuService.prototype.Allow(self, session)
    if CurTime() < session.NextRequest then
        return false
    end
    session.NextRequest = CurTime() + 0.2
    return true
end
function WeaponMenuService.prototype.Catalog(self, ply, id)
    if not self:Allow(self:Session(ply)) then
        self:Reply(ply, id, "rate_limited")
        return
    end
    self:Reply(ply, id, "catalog")
end
function WeaponMenuService.prototype.Select(self, ply, request)
    local session = self:Session(ply)
    if not self:Allow(session) then
        self:Reply(ply, request.RequestID, "rate_limited")
        return
    end
    local previous = __TS__ArrayFind(
        session.Receipts,
        function(____, receipt) return receipt.Request.RequestID == request.RequestID end
    )
    if previous then
        local matches = previous.Request.Kind == request.Kind and previous.Request.ID == request.ID
        self:Reply(ply, request.RequestID, matches and previous.Code or "invalid_weapon")
        return
    end
    local weaponType = request.Kind == "primary" and WEAPON_PRIMARY or (request.Kind == "secondary" and WEAPON_SECONDARY or WEAPON_MELEE)
    local weapon = WeaponManager:FindWeaponByWeaponId(request.ID, weaponType)
    local code = "invalid_weapon"
    if weapon and weapon:ShouldBeEnabled() then
        local canReceive = self:CanReceive(ply, request.Kind)
        if request.Kind == "primary" then
            ply:SetPrimaryWeapon(weapon)
        elseif request.Kind == "secondary" then
            ply:SetSecondaryWeapon(weapon)
        else
            ply:SetMeleeWeapon(weapon)
        end
        code = canReceive and IsValid(ply:GetWeapon(weapon.WeaponID)) and "issued" or "saved"
    end
    local ____session_Receipts_10 = session.Receipts
    ____session_Receipts_10[#____session_Receipts_10 + 1] = {Request = request, Code = code}
    if #session.Receipts > 16 then
        table.remove(session.Receipts, 1)
    end
    self:Reply(ply, request.RequestID, code)
end
local service = __TS__New(WeaponMenuService)
for ____, name in ipairs({
    "ZPWeaponMenuCatalog",
    "ZPWeaponMenuSelect",
    "ZPWeaponMenuReply",
    "ZPWeaponMenuOpen",
    "ZPWeaponMenuMissing"
}) do
    util.AddNetworkString(name)
end
net.Receive(
    "ZPWeaponMenuCatalog",
    function(length, ply)
        if not IsValid(ply) or length > 128 then
            return
        end
        local version = net.ReadUInt(8)
        local id = net.ReadUInt(31)
        if version == 1 and ZPWeaponMenuProtocol.RequestID(id) then
            service:Catalog(ply, id)
        end
    end
)
net.Receive(
    "ZPWeaponMenuSelect",
    function(length, ply)
        if not IsValid(ply) or length > 4096 then
            return
        end
        local request = ZPWeaponMenuProtocol.Selection(net.ReadTable())
        if request then
            service:Select(ply, request)
        end
    end
)
hook.Add(
    "PlayerDisconnected",
    "ZPWeaponMenuCleanup",
    function(ply) return service:Disconnect(ply) end
)
hook.Add(
    "PlayerSpawn",
    "ZPWeaponMenuMissingChoices",
    function(ply)
        timer.Simple(
            0,
            function() return service:OpenMissing(ply) end
        )
    end
)
Commands:AddCommand(
    "weapons",
    "Open the weapon selection HUD.",
    function(ply)
        net.Start("ZPWeaponMenuOpen")
        net.Send(ply)
    end
)
return ____exports
