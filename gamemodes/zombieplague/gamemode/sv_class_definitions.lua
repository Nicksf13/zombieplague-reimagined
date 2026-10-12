-- Generated from src/gamemodes/zombieplague/gamemode/classes/server/sv_class_definitions.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
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
-- End of Lua Library inline imports
local ____exports = {}
local PlayerClassDefinition = __TS__Class()
PlayerClassDefinition.name = "PlayerClassDefinition"
function PlayerClassDefinition.prototype.____constructor(self, id)
    self.MaxHealth = 100
    self.PModel = "models/player/gasmask.mdl"
    self.RunSpeed = 230
    self.Speed = 100
    self.CrouchSpeed = 0.4
    self.Gravity = 1
    self.Breath = 100
    self.JumpPower = 200
    self.Footstep = true
    self.DamageAmplifier = 1
    self.Order = 100
    self.ID = id
end
function PlayerClassDefinition.prototype.FallFunction(self)
    return true
end
function PlayerClassDefinition.prototype.ShouldBeEnabled(self)
    return true
end
____exports.HumanClassDefinition = __TS__Class()
local HumanClassDefinition = ____exports.HumanClassDefinition
HumanClassDefinition.name = "HumanClassDefinition"
__TS__ClassExtends(HumanClassDefinition, PlayerClassDefinition)
function HumanClassDefinition.prototype.____constructor(self, options)
    PlayerClassDefinition.prototype.____constructor(self, options.ID)
    self.Team = TEAM_HUMANS
    self.Name = "HumanDefaultClassName"
    self.Description = "HumanDefaultClassDescription"
    self.Armor = 25
    self.Battery = 100
    __TS__ObjectAssign(self, options)
end
____exports.ZombieClassDefinition = __TS__Class()
local ZombieClassDefinition = ____exports.ZombieClassDefinition
ZombieClassDefinition.name = "ZombieClassDefinition"
__TS__ClassExtends(ZombieClassDefinition, PlayerClassDefinition)
function ZombieClassDefinition.prototype.____constructor(self, options)
    PlayerClassDefinition.prototype.____constructor(self, options.ID)
    self.Team = TEAM_ZOMBIES
    self.Name = "ZombieDefaultClassName"
    self.Description = "ZombieDefaultClassDescription"
    self.MaxHealth = 2000
    self.PModel = "models/player/zombie_classic.mdl"
    self.RunSpeed = 290
    self.Gravity = 0.8
    self.Footstep = false
    self.WeaponGive = function(self, ply)
        ply:Give(ZOMBIE_KNIFE)
    end
    __TS__ObjectAssign(self, options)
end
function ZombieClassDefinition.prototype.FallFunction(self)
    return false
end
_G.HumanClassDefinition = ____exports.HumanClassDefinition
_G.ZombieClassDefinition = ____exports.ZombieClassDefinition
return ____exports
