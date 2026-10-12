-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_antidote.ts. DO NOT EDIT; run npm run build.
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
        ID = "ZPAntidote",
        Name = "ExtraItemAntidoteName",
        Price = 20,
        Type = ITEM_ZOMBIE,
        OnBuy = function(self, ply)
            InfectionManager:Cure(ply, ply)
        end,
        CanBuy = function(self, ply)
            return RoundManager:IsPlayingRound() and not RoundManager:IsSpecialRound() and not RoundManager:LastZombie() and ply:Alive()
        end
    }
)
return ____exports
