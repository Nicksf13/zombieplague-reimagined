-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/sv_extraitem_definition.ts. DO NOT EDIT; run npm run build.
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
-- End of Lua Library inline imports
local ____exports = {}
____exports.ExtraItemDefinition = __TS__Class()
local ExtraItemDefinition = ____exports.ExtraItemDefinition
ExtraItemDefinition.name = "ExtraItemDefinition"
function ExtraItemDefinition.prototype.____constructor(self, options)
    self.Order = 100
    self.ID = options.ID
    self.Name = options.Name
    self.Price = options.Price
    self.OnBuy = options.OnBuy
    __TS__ObjectAssign(self, options)
end
function ExtraItemDefinition.prototype.CanBuy(self, ply)
    return ply:Alive()
end
function ExtraItemDefinition.prototype.ShouldBeEnabled(self)
    return true
end
_G.ExtraItemDefinition = ____exports.ExtraItemDefinition
return ____exports
