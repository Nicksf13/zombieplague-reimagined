import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
OBS_MODE_ROAMING=6
local participants={}
RoundManager.GetPlayersToPlay=function() return participants end
RoundManager.AddPlayerToPlay=function(_,ply) participants[#participants+1]=ply end
RoundManager.RemovePlayerToPlay=function(_,ply)
    ply:SetTeam(TEAM_SPECTATOR)
    for i=#participants,1,-1 do if participants[i]==ply then table.remove(participants,i) end end
end
RoundManager.UnfreezePlayer=function(_,ply) ply.frozen=false end
function playerMeta:KillSilent() self.alive=false end
function playerMeta:Spectate(mode) self.observer=mode end
function playerMeta:SetNemesis(value) self.nemesis=value end
function playerMeta:SetSurvivor(value) self.survivor=value end
function playerMeta:SetNightvision(value) self.nightvision=value end
function playerMeta:SetLight(value) self.light=value end
function playerMeta:Flashlight(value) self.flashlight=value end
function playerMeta:StripWeapons() self.stripped=true end
function GetConVar(name)
    return {GetString=function() return values[name]==false and "0" or "1" end,
        SetString=function(_,value) values[name]=value=="1" end}
end
local kicks=0
function playerMeta:Kick() assert(self:IsBot()); kicks=kicks+1; self.kicked=true end
local runtime=include("sv_bots.lua")
local function tick() timers.ZPBotTraining[2]() end
`;

test("training waits for map and observer, creates exactly two managed bots, and suspends saved filling", () => run(setup + `
    values.zp_bot_training=true; maxplayers=3
    values.zp_bot_ai_enabled=false; values.zp_bot_learning=false
    local host=newPlayer(TEAM_HUMANS,0,false); participants={host}; host.frozen=true
    tick(); assert(#players==1 and host:Alive(), "map initialization must finish first")
    hooks.InitPostEntity.ZPBotTraining(); tick()
    assert(#players==3 and #player.GetBots()==2 and #participants==2)
    assert(host.ZPVoluntarySpectator and host:Team()==TEAM_SPECTATOR and not host:Alive() and not host.frozen)
    assert(host.observer==OBS_MODE_ROAMING and host.stripped and values.zp_bot_ai_enabled and values.zp_bot_learning)
    for _,bot in ipairs(player.GetBots()) do assert(runtime.bots:GetStatus(bot)) end
    assert(runtime.population.Config:Apply(true,0)); local saved=files["zombieplague/bots/population.json"]
    for i=1,20 do timers.ZPBotPopulation[2](); tick() end
    assert(#players==3 and kicks==0 and files["zombieplague/bots/population.json"]==saved)
    values.zp_bot_training=false; tick()
    assert(not values.zp_bot_ai_enabled and not values.zp_bot_learning and #players==3)
`));

test("training does not partially fill insufficient capacity and retries when slots become available", () => run(setup + `
    values.zp_bot_training=true; hooks.InitPostEntity.ZPBotTraining(); tick(); assert(#players==0)
    local host=newPlayer(TEAM_HUMANS,0,false)
    maxplayers=2; tick(); tick()
    assert(#players==1 and #messages==1 and messages[1].Phrase=="zombieplague.botfull")
    maxplayers=3; tick(); assert(#player.GetBots()==2)
    local bot=players[2]; bot.invalid=true; table.remove(players,2); hook.Run("PlayerDisconnected",bot)
    tick(); assert(#player.GetBots()==2 and runtime.bots:GetStatus(players[#players]))
`));

test("training handles delayed removal once and preserves unrelated bots", () => run(setup + `
    local host=newPlayer(TEAM_HUMANS,0,false)
    local foreign=newPlayer(TEAM_HUMANS,0,true)
    for i=1,4 do local bot=newPlayer(TEAM_HUMANS,0,true); runtime.bots:Attach(bot) end
    values.zp_bot_training=true; hooks.InitPostEntity.ZPBotTraining(); tick(); tick()
    assert(kicks==2 and not foreign.kicked and not host.kicked and #players==6)
    for i=#players,1,-1 do if players[i].kicked then
        local bot=players[i]; bot.invalid=true; table.remove(players,i); hook.Run("PlayerDisconnected",bot)
    end end
    tick(); assert(kicks==2 and #players==4)
`));

test("training never creates native bots in singleplayer", () => run(setup + `
    values.zp_bot_training=true; singleplayer=true
    local host=newPlayer(TEAM_HUMANS,0,false)
    hooks.InitPostEntity.ZPBotTraining(); tick(); assert(#players==1 and #player.GetBots()==0)
`));

test("training creates the selected count, grows it, and saves before asynchronous excess removal", () => run(setup + `
    local host=newPlayer(TEAM_HUMANS,0,false)
    values.zp_bot_training=true; values.zp_bot_training_count=4
    hooks.InitPostEntity.ZPBotTraining(); tick(); tick()
    assert(#player.GetBots()==4 and #participants==4 and kicks==0)
    values.zp_bot_training_count=6; tick(); assert(#player.GetBots()==6)
    local saves=0; local save=runtime.bots.Save
    runtime.bots.Save=function(self) saves=saves+1; save(self) end
    local kick=playerMeta.Kick
    playerMeta.Kick=function(self) assert(saves>0,"save learning before removing excess bots"); kick(self) end
    values.zp_bot_training_count=3; tick(); tick()
    assert(kicks==3 and saves==1 and not host.kicked)
    for i=#players,1,-1 do if players[i].kicked then
        local bot=players[i]; bot.invalid=true; table.remove(players,i); hook.Run("PlayerDisconnected",bot)
    end end
    tick(); assert(#player.GetBots()==3 and kicks==3)
`));

test("training caps the selected count to real capacity, reports it once and fills newly freed slots", () => run(setup + `
    local host=newPlayer(TEAM_HUMANS,0,false); local foreign=newPlayer(TEAM_HUMANS,0,true)
    local connecting=1; player.GetCountConnecting=function() return connecting end
    values.zp_bot_training=true; values.zp_bot_training_count=8; maxplayers=6
    hooks.InitPostEntity.ZPBotTraining(); tick(); tick()
    assert(#player.GetBots()==4 and #messages==1 and not foreign.kicked and kicks==0)
    connecting=0; tick(); assert(#player.GetBots()==5 and #messages==1)
    maxplayers=12; tick(); assert(#player.GetBots()==9 and kicks==0, "eight managed bots plus the foreign bot")
`));

test("training validates the count on the server, floors fractions and caps it to the AI limit", () => run(setup + `
    local host=newPlayer(TEAM_HUMANS,0,false)
    values.zp_bot_training=true; hooks.InitPostEntity.ZPBotTraining()
    for _,count in ipairs({-100,0,1,0/0}) do values.zp_bot_training_count=count; tick(); assert(#player.GetBots()==2) end
    values.zp_bot_training_count=5.9; tick(); assert(#player.GetBots()==5)
    maxplayers=70; values.zp_bot_training_count=100000; tick(); tick()
    assert(#player.GetBots()==64 and runtime.bots:Available()==0 and #players==65)
`));
