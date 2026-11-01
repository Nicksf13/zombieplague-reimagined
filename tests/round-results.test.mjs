import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { adminRoundsSetup } from "./helpers/admin-rounds.mjs";

const setup = adminRoundsSetup + `
local mode={StartFunction=function() end,MinPlayers=2,Chance=1,Order=1}
local function totals(humans,zombies,draws)
    assert(GetGlobalInt("ZPHumanRoundWins",-1)==humans)
    assert(GetGlobalInt("ZPZombieRoundWins",-1)==zombies)
    assert(GetGlobalInt("ZPRoundDraws",-1)==draws)
end
`;

test("round results count each completed round once, independently of player statistics", () => run(setup + `
    local bool=cvars.Bool
    cvars.Bool=function(name,fallback) if name=="zp_statistics_enabled" then return false end return bool(name,fallback) end
    totals(0,0,0)
    RoundManager:EndRound(HUMANS_WIN); totals(0,0,0)
    for index,reason in ipairs({HUMANS_WIN,ZOMBIES_WIN,ROUND_DRAW,HUMANS_WIN}) do
        RoundManager:StartRound(mode)
        RoundManager:EndRound(reason)
        RoundManager:EndRound(reason)
        RoundManager:CheckRoundEnd()
        if index==1 then totals(1,0,0) elseif index==2 then totals(1,1,0)
        elseif index==3 then totals(1,1,1) else totals(2,1,1) end
    end
`));

test("round timeouts and special modes contribute team results", () => run(setup + `
    transform(1,c.id)
    RoundManager:EndRound(ZOMBIES_WIN); totals(0,1,0)
    RoundManager:SetRoundState(ROUND_RESTARTING)
    transform(2,a.id)
    RoundManager:EndRound(HUMANS_WIN); totals(1,1,0)
    RoundManager:StartRound(mode)
    timers.ZombiePlagueTimer[2]()
    totals(1,1,1)
`));

test("manual restarts, preparation and waiting cancel unfinished results without erasing totals", () => run(setup + `
    RoundManager:StartRound(mode); RoundManager:EndRound(HUMANS_WIN)
    for _,cancel in ipairs({"RestartRound","Prepare","WaitPlayers"}) do
        RoundManager:StartRound(mode)
        RoundManager[cancel](RoundManager)
        RoundManager:EndRound(ROUND_DRAW)
        totals(1,0,0)
    end
    RoundManager:StartRound(mode); RoundManager:EndRound(ZOMBIES_WIN); totals(1,1,0)
    RoundManager:AddExtraRounds(5); game.CleanUpMap(); totals(1,1,0)
`));

test("final round counts before the map vote, prolongation preserves totals and a new map clears them", () => run(setup + `
    local votes=0
    ZPVoteMap={StartVotemap=function() votes=votes+1; totals(1,0,0) end}
    RoundManager:SetRound(9)
    RoundManager:StartRound(mode); RoundManager:EndRound(HUMANS_WIN)
    assert(votes==1)
    RoundManager:AddExtraRounds(5); totals(1,0,0)
    RoundManager:StartRound(mode); RoundManager:EndRound(ZOMBIES_WIN); totals(1,1,0)
    include("sv_round_results.lua"); totals(0,0,0)
`));
