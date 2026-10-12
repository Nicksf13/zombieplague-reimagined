-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_tvirus.ts. DO NOT EDIT; run npm run build.
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
        ID = "ZPTVirus",
        Name = "ExtraItemTVirusName",
        Price = 15,
        OnBuy = function(self, ply)
            if RoundManager:GetRoundState() == ROUND_PLAYING then
                InfectionManager:Infect(ply, ply)
            elseif RoundManager:GetRoundState() == ROUND_STARTING_NEW_ROUND then
                local round = RoundManager:GetRounds().SimpleRound
                if round then
                    RoundManager:StartRound(round, ply)
                end
            end
        end,
        CanBuy = function(self, ply)
            return (RoundManager:GetRoundState() == ROUND_PLAYING or RoundManager:GetRoundState() == ROUND_STARTING_NEW_ROUND) and not RoundManager:IsSpecialRound() and not RoundManager:LastHuman() and ply:Alive()
        end
    }
)
return ____exports
