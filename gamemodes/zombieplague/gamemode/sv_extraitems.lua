-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/sv_extraitems.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local __TS__Symbol, Symbol
do
    local symbolMetatable = {__tostring = function(self)
        return ("Symbol(" .. (self.description or "")) .. ")"
    end}
    function __TS__Symbol(description)
        return setmetatable({description = description}, symbolMetatable)
    end
    Symbol = {
        asyncDispose = __TS__Symbol("Symbol.asyncDispose"),
        dispose = __TS__Symbol("Symbol.dispose"),
        iterator = __TS__Symbol("Symbol.iterator"),
        hasInstance = __TS__Symbol("Symbol.hasInstance"),
        species = __TS__Symbol("Symbol.species"),
        toStringTag = __TS__Symbol("Symbol.toStringTag")
    }
end

local function __TS__InstanceOf(obj, classTbl)
    if type(classTbl) ~= "table" then
        error("Right-hand side of 'instanceof' is not an object", 0)
    end
    if classTbl[Symbol.hasInstance] ~= nil then
        return not not classTbl[Symbol.hasInstance](classTbl, obj)
    end
    if type(obj) == "table" then
        local luaClass = obj.constructor
        while luaClass ~= nil do
            if luaClass == classTbl then
                return true
            end
            luaClass = luaClass.____super
        end
    end
    return false
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
_G.ITEM_HUMAN = 0
_G.ITEM_ZOMBIE = 1
include("sv_extraitem_definition.lua")
local function isRegistered(item)
    return item.ID ~= nil and item.Name ~= nil and item.Price ~= nil and item.OnBuy ~= nil
end
____exports.ExtraItemsManager = __TS__Class()
local ExtraItemsManager = ____exports.ExtraItemsManager
ExtraItemsManager.name = "ExtraItemsManager"
function ExtraItemsManager.prototype.____constructor(self)
    self.ZombiesExtraItems = {}
    self.HumansExtraItems = {}
    self.PostRoundEvents = {}
end
function ExtraItemsManager.prototype.Search(self)
    for ____, path in pairs(Utils:RecursiveFileSearch("zombieplague/gamemode/extraitems", ".lua")) do
        _G.ExtraItem = {
            Order = 100,
            CanBuy = function(self, ply)
                return ply:Alive()
            end,
            ShouldBeEnabled = function(self)
                return true
            end
        }
        local loaded = include(path)
        local ____temp_0
        if type(loaded) == "table" and loaded ~= nil and loaded.default ~= nil then
            ____temp_0 = loaded.default
        else
            ____temp_0 = loaded
        end
        local exported = ____temp_0
        local item = __TS__InstanceOf(exported, ExtraItemDefinition) and exported or ExtraItem
        if item:ShouldBeEnabled() then
            if isRegistered(item) then
                self:AddExtraItem(item, item.Type)
            else
                Utils:Print(WARNING_MESSAGE, ("Invalid Extra Item: '" .. path) .. "'")
            end
        end
    end
end
function ExtraItemsManager.prototype.AddExtraItem(self, item, kind)
    local ____temp_1 = kind == ITEM_ZOMBIE and self.ZombiesExtraItems or self.HumansExtraItems
    ____temp_1[#____temp_1 + 1] = item
    if item.BuySounds then
        for ____, sound in ipairs(item.BuySounds) do
            resource.AddFile("sound/" .. sound)
        end
    end
end
function ExtraItemsManager.prototype.GetZombiesExtraItems(self)
    return self.ZombiesExtraItems
end
function ExtraItemsManager.prototype.GetHumansExtraItems(self)
    return self.HumansExtraItems
end
function ExtraItemsManager.prototype.AddRemoveFunction(self, callback)
    local ____self_PostRoundEvents_2 = self.PostRoundEvents
    ____self_PostRoundEvents_2[#____self_PostRoundEvents_2 + 1] = callback
end
function ExtraItemsManager.prototype.GetItemById(self, team, id)
    local items = team == TEAM_HUMANS and self.HumansExtraItems or self.ZombiesExtraItems
    for ____, item in ipairs(items) do
        if item.ID == id then
            return item
        end
    end
    return nil
end
function ExtraItemsManager.prototype.BuyItem(self, ply, item)
    local phrase
    if not item then
        phrase = "ExtraItemChoose"
    elseif not item:CanBuy(ply) then
        phrase = "ExtraItemCantBuy"
    elseif ply:GetAmmoPacks() < item.Price then
        phrase = "ExtraItemEnought"
    else
        item:OnBuy(ply)
        if item.RemoveFunction then
            local ____self_PostRoundEvents_3 = self.PostRoundEvents
            ____self_PostRoundEvents_3[#____self_PostRoundEvents_3 + 1] = item.RemoveFunction
        end
        if item.BuySounds then
            local sound = SafeTableRandom(item.BuySounds)
            if sound ~= nil then
                SendSound(ply, sound)
            end
        end
        ply:TakeAmmoPacks(item.Price)
        SendPopupMessage(
            ply,
            {
                Phrase = "zombieplague.extraitembought",
                Arguments = {{Phrase = "zombieplague." .. string.lower(item.Name)}}
            }
        )
        return
    end
    SendPopupMessage(
        ply,
        {Phrase = "zombieplague." .. string.lower(phrase)}
    )
end
local extraItemsManager = __TS__New(____exports.ExtraItemsManager)
_G.ExtraItemsManager = extraItemsManager
hook.Add(
    "ZPEndRound",
    "ZPExtraItemsRemove",
    function()
        while #extraItemsManager.PostRoundEvents > 0 do
            local remove = table.remove(extraItemsManager.PostRoundEvents)
            if remove then
                remove()
            end
        end
    end
)
return ____exports
