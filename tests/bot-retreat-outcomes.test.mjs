import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local situation={Role="zombie",Health=0.5,Distance=400,Allies=0,Enemies=3,HasAlly=false}
local memory={ID=1,Profile="cautious",Experience={}}
local outcomes={}
local brain=construct(definitions.BotBrain,memory,function(action,reward) outcomes[#outcomes+1]={Action=action,Reward=reward} end)
local key=definitions.context(situation)..":retreat"
local function step(visible,elapsed) now=10+elapsed; return brain:ContinueRetreat(visible,now) end
assert(brain:Decide(situation,now)=="retreat")
`;

test("zombies earn escape credit only after three observed seconds out of sight and without human damage", () => run(setup + `
    brain:Escaped(); assert(brain:Samples()==0)
    for i=1,14 do assert(step(false,i*0.2)) end
    assert(brain:Samples()==0 and #outcomes==0, "visibility loss is not instant credit")
    assert(not step(false,3))
    assert(brain:Samples()==1 and #outcomes==1 and outcomes[1].Action=="retreat")
    assert(math.abs(memory.Experience[key].Value-0.03)<0.000001)
    for i=16,20 do assert(not step(false,i*0.2)) end
    assert(brain:Samples()==1, "the same escape cannot be credited twice")
`));

test("human damage from a hidden shooter restarts the safety interval, environmental damage does not", () => run(setup + `
    for i=1,10 do assert(step(false,i*0.2)) end
    brain:DamageTaken(5,1000,true,now)
    for i=11,24 do assert(step(false,i*0.2)) end
    brain:DamageTaken(1,1000,false,now)
    assert(not step(false,5))
    assert(#outcomes==1 and math.abs(outcomes[1].Reward-0.138)<0.000001)
    assert(outcomes[1].Action=="retreat" and brain:Samples()==1)
`));

test("reacquiring a visible enemy restarts confirmation and does not reward an unobserved pause", () => run(setup + `
    for i=1,10 do assert(step(false,i*0.2)) end
    assert(step(true,2.2))
    for i=12,25 do assert(step(false,i*0.2)) end
    assert(not step(false,5.2) and brain:Samples()==1)
    brain:Reset(); now=20; assert(brain:Decide(situation,now)=="retreat")
    now=24; assert(not brain:ContinueRetreat(false,now))
    assert(brain:Samples()==1 and #outcomes==1, "server stalls do not establish safety")
`));

test("sustained human fire interrupts retreat, attributes failure to the original context and excludes exploration", () => run(setup + `
    memory.Experience[key]={Value=1,Samples=50}
    brain:DamageTaken(1,20000,true,now)
    situation.Health=0.2
    for i=1,10 do
        now=10+i*0.25
        brain:DamageTaken(1,20000,true,now)
        local action=brain:Decide(situation,now)
        if i<8 then assert(action=="retreat") else assert(action~="retreat") end
    end
    assert(memory.Experience[key].Samples==51 and memory.Experience[key].Value<1)
    assert(not memory.Experience[definitions.context(situation)..":retreat"], "original attempt owns feedback")
    assert(#outcomes==1 and outcomes[1].Reward < -0.35)
    assert(not brain:Decision().Scores.retreat.Eligible)
    brain:Finish(); situation.Health=0.5
    math.random=function(low,high) if high==100 then return 1 end return high end
    now=13; assert(brain:Decide(situation,now)~="retreat" and brain:Reason()=="explore")
    brain:Finish(); now=24.1
    brain:Decide(situation,now); assert(brain:Decision().Scores.retreat.Eligible, "cooldown expires")
`));

test("a single shot or simultaneous pellets cannot interrupt an otherwise safe retreat", () => run(setup + `
    for i=1,20 do brain:DamageTaken(1,20000,true,now) end
    for i=1,14 do assert(step(false,i*0.2)) end
    assert(not step(false,3) and #outcomes==1)
    assert(math.abs(outcomes[1].Reward-0.11)<0.000001)
    now=13.1; assert(brain:Decide(situation,now)=="retreat" and brain:Decision().Scores.retreat.Eligible)
`));

test("a short burst that stops before two seconds can still result in a safe escape", () => run(setup + `
    brain:DamageTaken(1,20000,true,now)
    for i=1,5 do assert(step(false,i*0.2)) end
    brain:DamageTaken(1,20000,true,now)
    for i=6,19 do assert(step(false,i*0.2)) end
    assert(not step(false,4) and #outcomes==1 and outcomes[1].Reward>0)
    assert(math.abs(outcomes[1].Reward-0.146)<0.000001)
`));

test("retreats still exposed after eight seconds fail, with metrics and cooldown even when learning is disabled", () => run(setup + `
    values.zp_bot_learning=false
    for i=1,31 do
        now=10+i*0.25
        assert(brain:Decide(situation,now)=="retreat")
    end
    now=18; assert(brain:Decide(situation,now)~="retreat")
    assert(#outcomes==1 and math.abs(outcomes[1].Reward+1.3)<0.000001 and brain:Samples()==0 and not brain:IsDirty())
    assert(not brain:Decision().Scores.retreat.Eligible)
    brain:Reset(); now=18.1
    assert(brain:Decide(situation,now)=="retreat", "new life or scope clears temporary cooldowns")
`));

const runtime = botSetup + `
local bots=include("sv_bots.lua").bots
local zombie=newPlayer(TEAM_ZOMBIES,0); zombie.maxHealth=20000; zombie.health=10000; zombie.nemesis=true
local human=newPlayer(TEAM_HUMANS,400,false)
newPlayer(TEAM_HUMANS,450,false); newPlayer(TEAM_HUMANS,500,false)
bots:Attach(zombie,"cautious"); now=11; bots:Update()
assert(bots:GetStatus(zombie).Action=="retreat")
bots:Command(zombie,command())
`;

test("controller keeps retreating during confirmation and accounts for actual hidden human damage", () => run(runtime + `
    wall=true; now=11.25; bots:Update()
    local cmd=command(); bots:Command(zombie,cmd)
    assert(bots:GetStatus(zombie).Action=="retreat" and cmd.forward<0, "withdraw instead of pursuing remembered enemy")
    for i=2,9 do now=11+i*0.25; bots:Update() end
    bots:Damage(zombie,damage(human,10),true)
    for i=10,20 do now=11+i*0.25; bots:Update() end
    assert(bots:GetStatus(zombie).Samples==0)
    now=16.25; bots:Update()
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Scope.Variant=="nemesis" and row.Totals.DamageTaken==10 and row.Samples==1)
    assert(row.Totals.Actions.retreat.Positive==1 and math.abs(row.LastReward-0.13)<0.000001)
    bots:Save()
    local saved=sharedMemory(1,"zombie","ZombieDefault","nemesis")
    assert(math.abs(saved.Experience["zombie:healthy:outnumbered:mid:retreat"].Value-0.026)<0.000001)
`));

test("controller ignores unapplied and friendly hits, then reconsiders continuous enemy fire before the two-second hold can repeat", () => run(runtime + `
    local ally=newPlayer(TEAM_ZOMBIES,20,false)
    for i=1,10 do
        now=11+i*0.25
        bots:Damage(zombie,damage(human,10),false)
        bots:Damage(zombie,damage(ally,10),true)
        bots:Update()
        assert(bots:GetStatus(zombie).Action=="retreat")
    end
    for i=11,19 do
        now=11+i*0.25
        bots:Damage(zombie,damage(human,10),true); bots:Update()
    end
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Action~="retreat" and row.Decision and not row.Decision.Scores.retreat.Eligible)
    local packet=bots:Diagnostics(0,2)
    assert(ZPBotMetricsProtocol.Snapshot(packet), "cooldown remains visible through the validated admin protocol")
    packet.Rows[1].Decision.Scores.retreat.Eligible=true
    assert(not ZPBotMetricsProtocol.Snapshot(packet), "a cooldown penalty cannot masquerade as an ordinary score")
    packet=bots:Diagnostics(0,3); packet.Rows[1].Decision.Scores.attack.Eligible=false
    assert(not ZPBotMetricsProtocol.Snapshot(packet), "unavailable retreat does not loosen other action contracts")
    assert(row.Totals.Actions.retreat.Negative==1 and math.abs(row.LastReward+1.48)<0.000001)
`));

test("freeze and AI shutdown cannot turn a pending zombie escape into positive feedback", () => run(runtime + `
    wall=true; now=11.25; bots:Update()
    RoundManager.FreezeTimeActive=true; now=13; bots:Update()
    RoundManager.FreezeTimeActive=false; now=20; bots:Update()
    assert(bots:GetStatus(zombie).Samples==0)
    wall=false; now=20.25; bots:Update()
    assert(bots:GetStatus(zombie).Action=="retreat")
    wall=true; now=20.5; bots:Update()
    values.zp_bot_ai_enabled=false; now=24; bots:Update()
    values.zp_bot_ai_enabled=true; now=30; bots:Update()
    assert(bots:GetStatus(zombie).Samples==0)
`));

test("healing a hidden zombie past the advance threshold cancels confirmation without rewarding it", () => run(runtime + `
    wall=true; now=11.25; bots:Update()
    zombie.health=13000; now=11.5; bots:Update()
    assert(bots:GetStatus(zombie).Action~="retreat" and bots:GetStatus(zombie).Samples==0)
`));
