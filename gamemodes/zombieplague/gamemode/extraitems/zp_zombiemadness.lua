-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_zombiemadness.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPZombieMadness",
        Name = "ExtraItemZombieMadnessName",
        Price = 10,
        Type = ITEM_ZOMBIE,
        OnBuy = function(self, ply)
            ply:ZombieMadness(5)
        end,
        CanBuy = function(self, ply)
            return ply:Alive()
        end
    }
)
return ____exports
