-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_armor.ts. DO NOT EDIT; run npm run build.
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
        ID = "ZPArmor",
        Name = "ExtraItemArmorName",
        Price = 12,
        OnBuy = function(self, ply)
            ply:SetArmor(ply:Armor() + 100)
        end
    }
)
return ____exports
