-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/sv_classmanager.ts. DO NOT EDIT; run npm run build.
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
include("sv_class_definitions.lua")
____exports.ClassManager = __TS__Class()
local ClassManager = ____exports.ClassManager
ClassManager.name = "ClassManager"
function ClassManager.prototype.____constructor(self)
    self.ZombieClasses = {}
    self.HumanClasses = {}
end
function ClassManager.prototype.SearchClasses(self)
    for ____, ____value in ipairs({{"zombies", false}, {"humans", true}}) do
        local folder = ____value[1]
        local human = ____value[2]
        for ____, path in pairs(Utils:RecursiveFileSearch("zombieplague/gamemode/classes/" .. folder, ".lua")) do
            _G.ZPClass = human and self:NewHumanClass() or self:NewZombieClass()
            local loaded = include(path)
            local ____temp_0
            if type(loaded) == "table" and loaded ~= nil and loaded.default ~= nil then
                ____temp_0 = loaded.default
            else
                ____temp_0 = loaded
            end
            local exported = ____temp_0
            if (__TS__InstanceOf(exported, HumanClassDefinition) or __TS__InstanceOf(exported, ZombieClassDefinition)) and exported:ShouldBeEnabled() then
                self:AddZPClass(exported.ID, exported, exported.Team)
            end
        end
    end
end
function ClassManager.prototype.GetZombieClasses(self)
    return self.ZombieClasses
end
function ClassManager.prototype.GetHumanClasses(self)
    return self.HumanClasses
end
function ClassManager.prototype.CreateClassAbility(self, drain, activate, reset, delay)
    local ability
    ability = {
        DrainOnActivation = drain,
        Drain = 60,
        MaxAbilityPower = 60,
        UseAction = function(self, ply)
            activate(ply)
            if reset then
                ply:SetAbilityTimer(
                    "ZPClassAbility",
                    delay or ability.Drain - 10,
                    function() return reset(ply) end
                )
            end
        end,
        CanUseAbility = function(self)
            return true
        end
    }
    return ability
end
function ClassManager.prototype.AddZPClass(self, id, definition, teamID)
    if teamID == TEAM_HUMANS or teamID == TEAM_ZOMBIES then
        local registry = teamID == TEAM_HUMANS and self.HumanClasses or self.ZombieClasses
        registry[id] = definition
        resource.AddFile(definition.PModel)
    else
        Utils:Print(WARNING_MESSAGE, "Invalid ZP class: " .. id)
    end
end
function ClassManager.prototype.GetZPClass(self, id, teamID)
    local registry = teamID == TEAM_HUMANS and self.HumanClasses or self.ZombieClasses
    return registry[id] or SafeTableRandom(registry)
end
function ClassManager.prototype.GetHumanClass(self, id)
    return self:GetZPClass(id, TEAM_HUMANS)
end
function ClassManager.prototype.GetZombieClass(self, id)
    return self:GetZPClass(id, TEAM_ZOMBIES)
end
function ClassManager.prototype.SetZPClass(self, ply, id, teamID)
    local definition = self:GetZPClass(id, teamID)
    if not definition then
        return
    end
    if teamID == TEAM_HUMANS then
        ply:SetHumanClass(definition)
    else
        ply:SetZombieClass(definition)
    end
end
function ClassManager.prototype.NewHumanClass(self)
    return {
        Name = "HumanDefaultClassName",
        Description = "HumanDefaultClassDescription",
        MaxHealth = 100,
        Armor = 25,
        PModel = "models/player/gasmask.mdl",
        Speed = 230,
        RunSpeed = 100,
        CrouchSpeed = 0.4,
        Gravity = 1,
        Battery = 100,
        Breath = 100,
        JumpPower = 200,
        Footstep = true,
        DamageAmplifier = 1,
        Order = 100,
        FallFunction = function(self)
            return true
        end,
        ShouldBeEnabled = function(self)
            return true
        end
    }
end
function ClassManager.prototype.NewZombieClass(self)
    return {
        Name = "ZombieDefaultClassName",
        Description = "ZombieDefaultClassDescription",
        MaxHealth = 2000,
        PModel = "models/player/zombie_classic.mdl",
        Speed = 290,
        RunSpeed = 100,
        CrouchSpeed = 0.4,
        Gravity = 0.8,
        Breath = 100,
        JumpPower = 200,
        Footstep = false,
        DamageAmplifier = 1,
        Order = 100,
        FallFunction = function(self)
            return false
        end,
        ShouldBeEnabled = function(self)
            return true
        end,
        WeaponGive = function(self, ply)
            ply:Give(ZOMBIE_KNIFE)
        end
    }
end
local classManager = __TS__New(____exports.ClassManager)
_G.ClassManager = classManager
net.Receive(
    "RequestAbility",
    function(_length, ply)
        local phrase
        if not ply:Alive() or ply:Team() == TEAM_SPECTATOR then
            phrase = "NoticeIsNotAlive"
        else
            local ability = ply:GetZPClass().Ability
            if not ability then
                phrase = "NoticeNoAbility"
            elseif ply:IsNemesis() or ply:IsSurvivor() then
                phrase = "NoticeSpecialClassNotAllowed"
            elseif not ability:CanUseAbility() then
                phrase = "NoticeNotAllowed"
            elseif ply:GetAbilityPower() < ability.Drain then
                phrase = "NoticeNotEnoughAbilityPower"
            else
                if ability.DrainOnActivation then
                    ply:DrainAbilityPower(ability.Drain)
                end
                ability:UseAction(ply)
            end
        end
        if phrase then
            SendPopupMessage(
                ply,
                {Phrase = "zombieplague." .. string.lower(phrase)}
            )
        end
    end
)
util.AddNetworkString("RequestAbility")
return ____exports
