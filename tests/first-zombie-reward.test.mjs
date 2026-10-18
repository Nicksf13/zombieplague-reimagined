import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
GM = {}; GAMEMODE = GM
local players, values, globals = {}, {}, {}
ConvarManager.CreateConVar=function(self,name,value) values[name]=value end
cvars.Number=function(name,fallback) if values[name]~=nil then return values[name] end return fallback end
SetGlobalBool=function(name,value) globals[name]=value end
GetGlobalBool=function(name,fallback) if globals[name]~=nil then return globals[name] end return fallback end
SetGlobalInt,GetGlobalInt=SetGlobalBool,GetGlobalBool
team={GetPlayers=function(id)
    local result={}; for _,ply in ipairs(players) do if ply:Team()==id then result[#result+1]=ply end end
    return result
end}
player={GetAll=function() return players end}
hook.Call=function(name,gm,...) for _,action in pairs(hooks[name] or {}) do action(...) end end
function SendPopupMessage() end
function SendNotifyMessage() end
table.RemoveByValue=function(list,value)
    for i=#list,1,-1 do if list[i]==value then table.remove(list,i) end end
end
function addPlayer(id,teamID,alive)
    local ply={id=id,team=teamID or TEAM_HUMANS,alive=alive~=false,hp=100,maxHP=100}
    function ply:Team() return self.team end
    function ply:Alive() return self.alive end
    function ply:Health() return self.hp end
    function ply:SetHealth(value) self.hp=value end
    function ply:SteamID64() return self.id end
    function ply:Name() return self.id end
    function ply:Infect() self.team=TEAM_ZOMBIES; self.hp=2000; self.maxHP=2000 end
    function ply:MakeNemesis() self:Infect() end
    function ply:MakeSurvivor() end
    players[#players+1]=ply
    return ply
end
include("sh_roundmanager.lua"); include("sv_roundmanager.lua"); include("sv_eventmanager.lua")
RoundManager:AddDefaultRounds()
local first=addPlayer("first")
local a,b,c=addPlayer("a"),addPlayer("b"),addPlayer("c")
addPlayer("dead",TEAM_HUMANS,false); addPlayer("spectator",TEAM_SPECTATOR)
RoundManager.PlayersToPlay={first,a,b,c}
`;

test("normal round rewards its random first zombie after infection with the registered defaults", () => run(setup + `
    assert(values.zp_first_zombie_reward_mode==1 and values.zp_first_zombie_reward_health==250)
    local firstEvents,lastEvents=0,0
    hook.Add("ZPFirstZombieEvent","observe",function(ply)
        assert(ply==first and ply:Team()==TEAM_ZOMBIES and ply.maxHP==2000, "Expected the first participant after infection")
        firstEvents=firstEvents+1
    end)
    hook.Add("ZPLastZombieEvent","observe",function() lastEvents=lastEvents+1 end)
    RoundManager.Rounds.SimpleRound.StartFunction()
    assert(first:Health()==2750 and first.maxHP==2000, "Expected 2750 current HP and the unchanged class maximum")
    assert(a:Health()==100 and b:Health()==100 and c:Health()==100)
    assert(firstEvents==1 and lastEvents==0, "Expected only one first zombie event")
    a:Infect() -- Later infections do not grant another first reward.
    assert(a:Health()==2000 and first:Health()==2750 and firstEvents==1)
`));

for (const [mode, bonus] of [[0, 0], [1, 999], [2, 333], [3, 0]]) {
    test(`first zombie mode ${mode} uses its own configured reward for an explicit selection`, () => run(setup + `
        values.zp_first_zombie_reward_mode=${mode}; values.zp_first_zombie_reward_health=333
        values.zp_last_zombie_reward_mode=0; values.zp_last_zombie_reward_health=9999
        RoundManager.Rounds.SimpleRound.StartFunction(b)
        assert(b:Health()==2000+${bonus} and b.maxHP==2000)
        assert(first:Health()==100)
    `));
}

test("zero first reward leaves class health unchanged", () => run(setup + `
    values.zp_first_zombie_reward_health=0
    RoundManager.Rounds.SimpleRound.StartFunction(first)
    assert(first:Health()==2000)
`));

for (const round of ["MultiInfectionRound", "NemesisRound", "SurvivalRound", "SwarmRound", "PlagueRound"]) {
    test(`${round} does not fire the first zombie reward`, () => run(setup + `
        hook.Add("ZPFirstZombieEvent","unexpected",function() error("Unexpected first zombie reward") end)
        RoundManager.Rounds.${round}.StartFunction()
        for _,ply in ipairs(players) do
            if ply:Team()==TEAM_ZOMBIES then assert(ply:Health()==2000) end
        end
    `));
}

test("an empty normal round does not fire the first zombie reward", () => run(setup + `
    RoundManager.PlayersToPlay={}
    hook.Add("ZPFirstZombieEvent","unexpected",function() error("Unexpected first zombie reward") end)
    RoundManager.Rounds.SimpleRound.StartFunction()
    assert(first:Health()==100)
`));

test("a later last zombie reward remains independent and keeps its existing modes", () => run(setup + `
    values.zp_first_zombie_reward_mode=2; values.zp_first_zombie_reward_health=500
    RoundManager.Rounds.SimpleRound.StartFunction(first)
    assert(first:Health()==2500)
    values.zp_first_zombie_reward_mode=0
    values.zp_last_zombie_reward_mode=1; values.zp_last_zombie_reward_health=100
    hook.Call("ZPLastZombieEvent"); assert(first:Health()==2800)
    values.zp_last_zombie_reward_mode=2
    hook.Call("ZPLastZombieEvent"); assert(first:Health()==2900)
    values.zp_last_zombie_reward_mode=0
    hook.Call("ZPLastZombieEvent"); assert(first:Health()==2900)
`));
