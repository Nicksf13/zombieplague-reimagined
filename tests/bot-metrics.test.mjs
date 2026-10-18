import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

test("movement metrics measure signed route progress, real breath use, water exits and recovery", () => run(botSetup + `
    local Metrics=include("sv_bot_metrics.lua").BotMetrics
    local metrics=construct(Metrics,ZPBotMetricsProtocol.Empty())
    local ply=newPlayer(TEAM_HUMANS,0)
    local goal=Vector(500,0,0)
    local plan={Action="attack",Steering={Position=goal,Stuck=false}}
    local route={Remaining=500,Replans=1}
    metrics:Observe(ply,plan,goal,route,10)
    ply.position=Vector(20,0,0); ply.breath=97; ply.water=2; ply.sprinting=true; route.Remaining=480
    metrics:Observe(ply,plan,goal,route,10.2)
    local data=metrics:Totals()
    assert(math.abs(data.ActiveSeconds-0.2)<0.001 and data.Distance==20 and data.Progress==20)
    assert(data.BreathSpent==3 and math.abs(data.SprintSeconds-0.2)<0.001 and math.abs(data.WaterSeconds-0.2)<0.001)
    ply.position=Vector(0,0,0); ply.breath=100; ply.water=0; ply.sprinting=false; route.Remaining=500
    plan.Action="defend"; metrics:Observe(ply,plan,goal,route,10.4)
    data=metrics:Totals()
    assert(data.Distance==40 and data.Progress==0 and data.WaterEscapes==1 and data.BreathSpent==3)
    assert(math.abs(data.Actions.attack.Seconds-0.4)<0.001 and data.Actions.defend.Seconds==0)
    metrics:Observe(ply,plan,goal,route,10.6)
    assert(metrics.Blocked and math.abs(metrics:Totals().StuckSeconds-0.2)<0.001)
    ply.position=Vector(100,0,0); route.Remaining=400
    metrics:Observe(ply,plan,goal,route,10.8)
    assert(not metrics.Blocked and metrics:Totals().Recoveries==1)
    data=metrics:Totals(); data.Actions.attack.Seconds=999
    assert(metrics:Totals().Actions.attack.Seconds<1, "diagnostics must not expose mutable memory")
    local before=metrics:Totals()
    metrics:Reset(); ply.position=Vector(9000,0,0); route.Replans=1
    metrics:Observe(ply,plan,goal,route,20)
    assert(metrics:Totals().Distance==before.Distance and metrics:Totals().ActiveSeconds==before.ActiveSeconds)
`));

test("teleports, inactive gaps and path replans do not manufacture progress or arrivals", () => run(botSetup + `
    local Metrics=include("sv_bot_metrics.lua").BotMetrics
    local metrics=construct(Metrics,ZPBotMetricsProtocol.Empty())
    local ply=newPlayer(TEAM_HUMANS,0); local goal=Vector(1000,0,0)
    local plan={Action="group",Steering={Position=goal,Stuck=false}}
    local route={Remaining=1000,Replans=1}
    metrics:Observe(ply,plan,goal,route,10)
    ply.position=Vector(990,0,0); route.Remaining=10
    metrics:Observe(ply,plan,goal,route,10.2)
    assert(metrics:Totals().Progress==0 and metrics:Totals().Distance==0 and metrics:Totals().Arrivals==0)
    ply.position=Vector(995,0,0); route.Remaining=500; route.Replans=2
    metrics:Observe(ply,plan,goal,route,10.4)
    assert(metrics:Totals().Progress==0 and metrics:Totals().Replans==2)
    route.Remaining=5
    metrics:Observe(ply,plan,goal,route,15)
    assert(metrics:Totals().Progress==0 and metrics:Totals().Arrivals==0)
`));

test("learning transfers across maps while metrics, roles, stable class IDs and variants stay separate", () => run(botSetup + `
    local Contexts=include("sv_bot_contexts.lua").BotContexts
    local contexts=construct(Contexts); local ply=newPlayer(TEAM_HUMANS,0)
    local first=contexts:Get(ply,1,"aggressive")
    first.Brain:Decide({Role="human",Health=1,Distance=400,Allies=0,Enemies=0,HasAlly=false},10)
    first.Brain:Reward(0.8); first.Brain:Finish(); first.Metrics:Event("DamageDealt",80)
    assert(first.Brain:Samples()==1 and first.Metrics:Totals().Actions.attack.Positive==1)
    ply.humanClass={ID="HumanFast",Name=humanClass.Name}
    local fast=contexts:Get(ply,1,"aggressive")
    assert(fast.Brain:Samples()==0 and fast.Metrics:Totals().DamageDealt==0)
    ply.humanClass=nil; ply.survivor=true
    assert(contexts:Get(ply,1,"aggressive").Brain:Samples()==0)
    ply.survivor=false; ply.team=TEAM_ZOMBIES
    assert(contexts:Get(ply,1,"aggressive").Brain:Samples()==0)
    ply.nemesis=true; assert(contexts:Get(ply,1,"aggressive").Scope.Variant=="nemesis")
    ply.team=TEAM_HUMANS; ply.nemesis=false; mapName="zm_other"
    local other=contexts:Get(ply,1,"aggressive")
    assert(other.Brain:Samples()==1 and other.Metrics:Totals().DamageDealt==0 and other.Scope.Map=="zm_other")
    mapName="gm_test"; assert(contexts:Get(ply,1,"aggressive")==first)
    contexts:Save(); assert(not first.Metrics:IsDirty())
    local reloaded=construct(Contexts):Get(ply,1,"aggressive")
    assert(reloaded.Brain:Samples()==1 and reloaded.Metrics:Totals().DamageDealt==80)
    assert(reloaded.Metrics:Totals().Actions.attack.Positive==1)
    local renamed=humanClass.Name; humanClass.Name="renamed"
    local renamedEntry=construct(Contexts):Get(ply,1,"aggressive")
    assert(renamedEntry.Brain:Samples()==1, "display names must not invalidate stable IDs")
    humanClass.Name=renamed; humanClass.ID=nil
    assert(include("sv_bot_contexts.lua").scopeFor(ply).ClassID=="HumanDefault", "legacy registry IDs remain stable")
`));

test("legacy learning is preserved, scoped corruption cannot overwrite files, and writes retain verified backups", () => run(botSetup + `
    local Brain=include("sv_bot_brain.lua")
    local Store=include("sv_bot_storage.lua").BotLearningStore
    local old=util.TableToJSON({Version=1,Bots={{ID=1,Profile="cautious",Experience={}}}})
    files["zombieplague/bots/learning-v1.json"]=old
    local Contexts=include("sv_bot_contexts.lua").BotContexts
    local ply=newPlayer(TEAM_HUMANS,0); local contexts=construct(Contexts)
    assert(contexts:Profile(ply,1)=="cautious")
    local entry=contexts:Get(ply,1,"cautious"); entry.Metrics:Event("Deaths",1); contexts:Save()
    local path=metricsFile("gm_test","human","HumanDefault"); local first=files[path]
    assert(files["zombieplague/bots/learning-v1.json"]==old)
    entry.Metrics:Event("Deaths",1); failWrite=true; contexts:Save()
    assert(entry.Metrics:IsDirty() and files[path..".bak.txt"]==first)
    failWrite=false; contexts:Save()
    assert(not entry.Metrics:IsDirty() and jsonValues[files[path]].Bots[1].Metrics.Deaths==2)
    local malformed=jsonValues[files[path]]; malformed.Scope.Map="another_map"; files[path]=util.TableToJSON(malformed)
    local corrupt=files[path]; local store=construct(Store,Brain.isProfile,entry.Scope,true)
    assert(#store:Load()==0 and not store:Save({}) and files[path]==corrupt)
`));

test("controller records combat with learning disabled, separates infection and cure, and pauses observation", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local human,zombie=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400)
    values.zp_bot_learning=false
    bots:Attach(human,"aggressive"); bots:Attach(zombie,"aggressive"); now=11; bots:Update()
    bots:Command(human,command()); bots:Command(zombie,command())
    bots:Damage(zombie,damage(human,20),true); bots:Damage(human,damage(zombie,10),false)
    bots:Reset(human)
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Totals.DamageDealt==20 and row.Totals.DamageTaken==0 and row.Samples==0)
    assert(row.Totals.Actions.attack.Positive==1, "observed outcomes remain visible when training is frozen")
    human.team=TEAM_ZOMBIES; bots:Infection(human,zombie)
    row=bots:Diagnostics(0,2).Rows[1]
    assert(row.Scope.Role=="zombie" and row.Totals.DamageDealt==0)
    assert(bots:Diagnostics(0,2).Rows[2].Totals.Infections==1)
    human.team=TEAM_HUMANS; bots:Reset(human)
    row=bots:Diagnostics(0,3).Rows[1]; assert(row.Scope.Role=="human" and row.Totals.DamageDealt==20)
    now=12; bots:Update(); now=12.2; bots:Update()
    local active=bots:Diagnostics(0,4).Rows[1].Totals.ActiveSeconds
    RoundManager.state=ROUND_ENDING; now=20; bots:Update()
    row=bots:Diagnostics(0,5).Rows[1]
    assert(not row.Active and row.Totals.ActiveSeconds==active)
    RoundManager.state=ROUND_PLAYING; now=21; bots:Update()
    assert(bots:Diagnostics(0,6).Rows[1].Totals.ActiveSeconds==active)
`));

test("admin metrics requests authenticate before reading, enforce rate limits and return bounded private pages", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local host=newPlayer(TEAM_HUMANS,0,false)
    for i=1,20 do bots:Attach(newPlayer(TEAM_HUMANS,0),"aggressive") end
    local input,reads={1,123,0},0
    net.ReadUInt=function() reads=reads+1; return table.remove(input,1) end
    receivers.ZPBotMetricsRequest(41,host); assert(reads==0 and #sent==0)
    host.admin=true; receivers.ZPBotMetricsRequest(40,host); assert(reads==0)
    receivers.ZPBotMetricsRequest(41,host)
    assert(reads==3 and sent[1]=="ZPBotMetricsReply" and sent.recipient==host)
    local data=sent[2]; assert(data.RequestID==123 and data.Total==20 and #data.Rows==16)
    assert(ZPBotMetricsProtocol.Snapshot(data), "server pages satisfy the same contract as client replies")
    receivers.ZPBotMetricsRequest(41,host); assert(reads==3)
    now=now+1; input={2,124,1}; receivers.ZPBotMetricsRequest(41,host); assert(reads==6 and sent[2]==data)
    now=now+1; input={1,125,1}; receivers.ZPBotMetricsRequest(41,host)
    assert(#sent[2].Rows==4 and sent[2].Rows[1].ID==17 and ZPBotMetricsProtocol.Snapshot(sent[2]))
    hooks.PlayerDisconnected.ZPBotMetrics(host)
    input={1,126,3}; receivers.ZPBotMetricsRequest(41,host)
    assert(#sent[2].Rows==0 and ZPBotMetricsProtocol.Snapshot(sent[2]))
`));

test("metrics protocol rejects malformed scopes, totals, duplicate identities and oversized pages", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots; bots:Attach(newPlayer(TEAM_HUMANS,0),"aggressive")
    local data=bots:Diagnostics(0,1); assert(ZPBotMetricsProtocol.Snapshot(data))
    data.Rows[1].Totals.Progress=-10; assert(ZPBotMetricsProtocol.Snapshot(data))
    data.Rows[1].Totals.WaterSeconds=-1; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,1); data.Rows[1].Scope.Role="spectator"; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,1); data.Rows[2]=data.Rows[1]; data.Total=2; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,1); data.Rows[1].Totals.Actions.attack.Positive=1; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,1); data.Rows[1].LastReward=0/0; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,1); for i=2,17 do data.Rows[i]=clone(data.Rows[1]); data.Rows[i].ID=i end
    data.Total=17; assert(not ZPBotMetricsProtocol.Snapshot(data))
`));

test("live decision diagnostics survive transport while malformed contributions are rejected", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local human,zombie=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400)
    bots:Attach(human,"aggressive"); now=11; bots:Update()
    local data=bots:Diagnostics(0,1); assert(data.Rows[1].Decision and ZPBotMetricsProtocol.Snapshot(data))
    local report=data.Rows[1].Decision
    report.Scores.attack.Total=99; assert(not ZPBotMetricsProtocol.Snapshot(data))
    data=bots:Diagnostics(0,2); data.Rows[1].Decision.Scores.group.Eligible=true
    assert(not ZPBotMetricsProtocol.Snapshot(data), "grouping without an ally is ineligible")
    data=bots:Diagnostics(0,3); data.Rows[1].Decision.Scores.attack.Learned=0/0
    assert(not ZPBotMetricsProtocol.Snapshot(data))
    wall=true; now=12; bots:Update(); data=bots:Diagnostics(0,4)
    assert(not data.Rows[1].Decision and ZPBotMetricsProtocol.Snapshot(data), "no active decision when searching")
`));

test("a full visual diagnostics page stays below the net message and client packet limits", () => run(botSetup + `
    -- Primitive sizes follow Facepunch's net.WriteType / net.WriteTable implementation:
    -- https://github.com/Facepunch/garrysmod/blob/master/garrysmod/lua/includes/extensions/net.lua
    local function bits(value)
        if type(value)=="number" then return 72 end
        if type(value)=="boolean" then return 9 end
        if type(value)=="string" then return 8+(#value+1)*8 end
        local count=16 -- table type and terminating nil type
        for key,item in pairs(value) do count=count+bits(key)+bits(item) end
        return count
    end
    mapName=string.rep("m",128); humanClass.ID=string.rep("i",128); humanClass.Name=string.rep("c",128)
    local bots=include("sv_bots.lua").bots
    for i=1,16 do local ply=newPlayer(TEAM_HUMANS,0); ply.name=string.rep("b",128); bots:Attach(ply,"aggressive") end
    newPlayer(TEAM_ZOMBIES,400,false); now=11
    for i=1,8 do bots:Update() end
    local data=bots:Diagnostics(0,2147483647)
    for _,row in ipairs(data.Rows) do
        assert(row.Decision and row.Motion); row.Goal=string.rep("g",96)
        row.Motion.Path={0,0,0,100,0,0,200,0,0,300,0,0,400,0,0}
        row.Motion.Passage={1000,900,30}
        row.Motion.Navigation={Reason="connection",Phase="cross",From=1000,To=1001,Height=-768,Damage=100,Path={1e7,-1e7,1e7,1e7,-1e7,1e7,1e7,-1e7,1e7,1e7,-1e7,1e7}}
        row.Motion.Path={}
        row.Place.Point={1e7,-1e7,1e7}; row.Place.State="inspect"; row.Place.Reason="learned"; row.Place.Hold=60
    end
    assert(ZPBotMetricsProtocol.Snapshot(data))
    local size=bits(data)-8
    assert(size<500000, "worst-length page is too large: "..size.." bits")
    for _,row in ipairs(data.Rows) do row.Motion.Navigation.Path={}; row.Motion.Path={0,0,0,100,0,0,200,0,0,300,0,0,400,0,0} end
    assert(ZPBotMetricsProtocol.Snapshot(data) and bits(data)-8<500000, "ordinary route paths also fit with navigation reasons")
`));
