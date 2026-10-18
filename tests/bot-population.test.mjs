import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local connecting,kicks,deferred=0,{},false
player.GetCountConnecting=function() return connecting end
local function disconnect(ply)
    ply.invalid=true
    for i=#players,1,-1 do if players[i]==ply then table.remove(players,i) end end
    hook.Run("PlayerDisconnected",ply)
end
function playerMeta:Kick()
    assert(self:IsBot(), "never kick real players")
    assert(not self.kicked, "never kick a pending bot twice")
    self.kicked=true; kicks[#kicks+1]=self
    if not deferred then disconnect(self) end
end
net.WriteUInt=function(value) sent[#sent+1]=value end
local nativeCreate=player.CreateNextBot
player.CreateNextBot=function(name)
    hook.Run("PlayerConnect",name,"none")
    return nativeCreate(name)
end
local runtime=include("sv_bots.lua")
local bots,population=runtime.bots,runtime.population
local Config=include("sv_bot_population_config.lua").BotPopulationConfig
local path="zombieplague/bots/population.json"
local function tick(times)
    for i=1,times or 1 do now=now+0.25; timers.ZPBotPopulation[2]() end
end
local function fill(target)
    maxplayers=32; assert(population.Config:Apply(true,target or 0)); tick(20)
end
`;

test("automatic filling reserves one slot, replaces bots for connecting humans, and refills departures", () => run(setup + `
    fill(); assert(#players==31 and #player.GetBots()==31 and #kicks==0)
    assert(population:Snapshot().Free==1 and population:Snapshot().Limit==31)
    hook.Run("PlayerConnect","Alice","127.0.0.1:1")
    connecting=1; tick(40)
    assert(#players==30 and #kicks==1 and population:Snapshot().Free==1, "loading client occupies a slot")
    local alice=newPlayer(TEAM_HUMANS,0,false); connecting=0; tick()
    assert(#player.GetBots()==30 and population:Snapshot().Humans==1)
    hook.Run("PlayerConnect","Bob","127.0.0.1:2"); connecting=1
    local bob=newPlayer(TEAM_HUMANS,0,false); connecting=0; tick()
    assert(#player.GetBots()==29 and #players==31 and population:Snapshot().Free==1)
    disconnect(alice); tick(3); assert(#player.GetBots()==29)
    tick(6); assert(#player.GetBots()==30 and #players==31, "refill waits for admission and departure holds")
    disconnect(bob); tick(5); assert(#player.GetBots()==31)
`));

test("simultaneous admissions and asynchronous kicks do not duplicate removal or create bots prematurely", () => run(setup + `
    fill(); deferred=true
    hook.Run("PlayerConnect","Alice","ip1"); connecting=1
    hook.Run("PlayerConnect","Bob","ip2"); connecting=2
    tick(20); assert(#kicks==2 and #players==31)
    disconnect(kicks[1]); tick(); assert(#kicks==2 and #players==30)
    disconnect(kicks[2]); tick(10); assert(#players==29 and #kicks==2)
    connecting=0; tick(); assert(#players==31, "aborted loading is refilled after the hold")
    assert(population:Snapshot().Free==1)
`));

test("population settings survive a new instance, support lower targets and disabling leaves existing bots", () => run(setup + `
    assert(not population.Config.Enabled); tick(20); assert(#players==0)
    fill(30); assert(#players==30 and population:Snapshot().Free==2)
    local saved=construct(Config); assert(saved.Enabled and saved.Target==30)
    local originalSave=bots.Save; local saves=0
    bots.Save=function(self) saves=saves+1; return originalSave(self) end
    local originalKick=playerMeta.Kick
    playerMeta.Kick=function(self) assert(saves>0,"learning flushed before kicking"); return originalKick(self) end
    assert(population.Config:Apply(true,20)); tick(); assert(#players==20 and #kicks==10 and saves==1)
    assert(population.Config:Apply(false,20)); tick(20); assert(#players==20)
    disconnect(players[1]); tick(20); assert(#players==19)
    assert(not construct(Config).Enabled)
`));

test("only managed AI bots are removed; humans and idle or third-party bots still consume capacity", () => run(setup + `
    local human=newPlayer(TEAM_HUMANS,0,false)
    local idle=newPlayer(TEAM_HUMANS,0,true); idle.ZPIdleTestBot=true
    local foreign=newPlayer(TEAM_HUMANS,0,true)
    fill(); assert(#players==31 and #player.GetBots()==30)
    assert(population.Config:Apply(true,1)); tick()
    assert(#players==3 and IsValid(human) and IsValid(idle) and IsValid(foreign))
    assert(not bots:GetStatus(idle) and not bots:GetStatus(foreign))
    tick(20); assert(#players==3, "unmanaged occupants are never kicked to reach the target")
`));

test("startup filling uses persisted settings, honors AI and engine limits, and ignores singleplayer", () => run(botSetup + `
    local path="zombieplague/bots/population.json"
    files[path]="saved-population"; jsonValues[files[path]]={Version=1,Enabled=true,Target=0}
    maxplayers=128
    local runtime=include("sv_bots.lua")
    for i=1,40 do timers.ZPBotPopulation[2]() end
    assert(#players==64 and runtime.bots:Available()==0)
    singleplayer=true; maxplayers=1; timers.ZPBotPopulation[2](); assert(#players==64)
`));

test("manual AI creation respects connecting clients and the reserved slot when automatic filling is enabled", () => run(setup + `
    local host=newPlayer(TEAM_HUMANS,0,false); host.admin=true
    maxplayers=5; connecting=1; assert(population.Config:Apply(true,0))
    consoleCommands.zp_addaibot(host,"zp_addaibot",{"16"})
    assert(#player.GetBots()==2 and #players+connecting==4)
    consoleCommands.zp_addaibot(host,"zp_addaibot",{"1"})
    assert(messages[#messages].Phrase=="zombieplague.botfull")
    assert(population.Config:Apply(false,0))
    consoleCommands.zp_addaibot(host,"zp_addaibot",{"1"}); assert(#player.GetBots()==3)
`));

test("invalid population files are preserved and failed writes never enable automatic filling", () => run(setup + `
    for _,value in ipairs({{Version=2,Enabled=true,Target=0},{Version=1,Enabled="yes",Target=0},{Version=1,Enabled=true,Target=65},{Version=1,Enabled=true,Target=1.5}}) do
        files[path]="bad-file"; jsonValues["bad-file"]=value
        local config=construct(Config); assert(not config.Enabled and not config:Apply(true,10) and files[path]=="bad-file")
    end
    files[path]=nil; failWrite=true
    local config=construct(Config); assert(not config:Apply(true,10) and not config.Enabled and config.Revision==1)
    failWrite=false; files[path]=nil; config=construct(Config)
    assert(config:Apply(true,10)); local previous=files[path]
    failWrite=true; assert(not config:Apply(false,4))
    assert(config.Enabled and config.Target==10 and files[path..".bak.txt"]==previous)
`));

test("population RPC validates permission, exact sizes, revisions, physical capacity and rate limits", () => run(setup + `
    maxplayers=32
    local admin=newPlayer(TEAM_HUMANS,0,false); admin.admin=true
    local uints={}; net.ReadUInt=function() return table.remove(uints,1) end
    local function request(action,target,enabled,revision,ply,length)
        uints={1,action,7,revision or population.Config.Revision,target or 0}; readBool=enabled
        sent={}; receivers.ZPBotPopulationRequest(length or (action==1 and 79 or 40),ply or admin); return sent[4]
    end
    assert(request(0)==0 and sent.recipient==admin and sent[8]==31)
    now=now+0.3; assert(request(1,0,true)==1 and population.Config.Enabled and #players==3)
    assert(request(1,0,false)==2 and population.Config.Enabled,"rate limited")
    now=now+0.3; assert(request(1,0,false,1)==2 and population.Config.Enabled,"stale revision")
    now=now+0.3; assert(request(1,32,true)==2 and population.Config.Target==0,"cannot consume reserved slot")
    now=now+0.3; singleplayer=true; assert(request(1,0,true)==2); singleplayer=false
    now=now+0.3; BOT_MODE=false; assert(request(1,0,true)==2); BOT_MODE=true
    admin.admin=false; assert(not request(1,0,false)); admin.admin=true
    assert(not request(1,0,false,nil,nil,78) and #uints==5,"reject before reading")
    assert(not request(0,0,false,nil,nil,79),"operation and length must agree")
    now=now+0.3; failWrite=true; assert(request(1,20,false)==2 and population.Config.Enabled)
    failWrite=false; now=now+0.3; assert(request(1,20,false)==1 and not population.Config.Enabled)
`));
