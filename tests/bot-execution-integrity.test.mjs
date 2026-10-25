import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Brain=include("sv_bot_brain.lua").BotBrain
local Tracker=include("sv_bot_execution.lua").BotExecutionTracker
local motor=include("sv_bot_motor.lua")
local rows,sequence={},0
local trace={NewID=function(layer) sequence=sequence+1; return layer..":"..sequence end,Record=function(row) rows[#rows+1]=clone(row) end}
local memory={ID=1,Profile="aggressive",Experience={}}
local brain=construct(Brain,memory,nil,nil,trace)
local tracker=construct(Tracker,trace)
local bot=newPlayer(TEAM_HUMANS,0)
local senses={Visible=true,Allies=0,Enemies=1,EnemyPosition=Vector(100,0,0),AimPosition=Vector(100,0,40)}
local situation={Role="human",Health=1,Distance=100,Allies=0,Enemies=1,HasAlly=false}
`;

test("a range intervention preserves the tactical label, records issued movement and withholds tactical/profile credit", () => run(setup + `
    local action=brain:Decide(situation,now); assert(action=="attack")
    local decision=brain:ExperienceID(); local requested=motor.request(bot,senses,action,"aggressive")
    assert(requested.Move=="withdraw" and requested.Goal.x<0)
    local cmd=command()
    motor.apply(bot,cmd,{Action=action,Senses=senses,Steering={Position=requested.Goal,Jump=false,Duck=false},Interventions=requested.Interventions,Updated=now,ReadyAt=now},1,false,function(execution)
        for _,intervention in ipairs(execution.Interventions) do brain:Intervene(intervention,decision) end
        tracker:Command({Decision=decision,Experience="motion:separate",Stage="edge",Action=action,Requested={Goal={requested.Goal.x,0,0},Move=requested.Move}},execution,now)
    end)
    assert(cmd.forward<0)
    brain:DamageTaken(20,100); now=10.6; tracker:Reset(now); brain:Finish()
    assert(next(memory.Experience)==nil and next(memory.Behaviors)==nil)
    local finalized,issued,duration=false,false,false
    for _,row in ipairs(rows) do
        if row.Kind=="execution" then
            assert(row.Action=="attack" and row.Requested.Move=="withdraw" and row.Commanded.WorldX<0 and row.Decision==decision and row.Experience~=decision); issued=true
        elseif row.Kind=="intervention" then assert(row.Controller=="range" and math.abs(row.Duration-0.6)<0.00001); duration=true
        elseif row.Kind=="finalize" then
            assert(row.Experience==decision and row.Outcome=="superseded" and not row.Updated and row.Before==row.After); finalized=true
        end
    end
    assert(finalized and issued and duration)
    situation.Distance=400; now=13; brain:Decide(situation,now); brain:Reward(0.5); brain:Finish()
    assert(memory.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Value>0,"unmodified decisions must still learn")
`));

test("a delayed command from another decision cannot invalidate the current tactical experience", () => run(setup + `
    brain:Decide(situation,now); local old=brain:ExperienceID(); brain:Finish()
    now=13; situation.Distance=400; brain:Decide(situation,now)
    brain:Intervene({Controller="traffic",Reason="old_command",Tactical=true,Motion=true},old)
    brain:Reward(0.5); brain:Finish(); brain:Finish()
    assert(memory.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Samples==1)
`));

test("pending human consequences update the old role once before infection selects zombie knowledge", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local human=newPlayer(TEAM_HUMANS,0); local zombie=newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(human,"aggressive"); now=11; bots:Update(); bots:Command(human,command())
    human.team=TEAM_ZOMBIES; bots:Infection(human,zombie); bots:Save()
    local saved=sharedMemory(1,"human","HumanDefault")
    assert(saved.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Samples==1 and saved.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Value<0)
    assert(bots:GetStatus(human).Role=="zombie" and bots:GetStatus(human).Samples==0)
    bots:Reset(human); bots:Save()
    assert(sharedMemory(1,"human","HumanDefault").Experience["v2:human:healthy:balanced:mid:quiet:attack"].Samples==1)
`));

test("death and post-damage callbacks observe one fall and finalize its old movement experience once", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local zombie=newPlayer(TEAM_ZOMBIES,0); newPlayer(TEAM_HUMANS,400,false)
    bots:Attach(zombie,"aggressive"); now=11; bots:Update(); bots:Command(zombie,command())
    zombie.airborne=true; zombie.position=Vector(25,0,-5); now=11.1; bots:Command(zombie,command())
    local hit=damage(emptyEntity,50,DMG_FALL); zombie.alive=false; zombie.airborne=false
    hooks.DoPlayerDeath.ZPAdaptiveBots(zombie,emptyEntity,hit)
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(zombie,hit,true)
    hooks.DoPlayerDeath.ZPAdaptiveBots(zombie,emptyEntity,hit)
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Motion.Harm==50 and row.Motion.Samples==1 and row.Motion.Reward<0 and row.Motion.Failures==1)
    bots:Reset(zombie); zombie.alive=true
    assert(bots:Diagnostics(0,2).Rows[1].Motion.Samples==1)
`));

test("debug tracing is off by default, bounded when enabled and detaches reward snapshots", () => run(botSetup + `
    local Trace=include("sv_bot_experience_trace.lua").BotExperienceTrace
    local logger=construct(Trace,"session"); local scope={Map="gm_test",Role="human",ClassID="HumanDefault",ClassName="HumanDefault",Variant="normal"}
    local trace=logger:Channel(1,scope)
    local event={Kind="finalize",Learner="motion",Experience="one",Reason="test",Components={progress=0.2},Total=0.2}
    trace.Record(event); assert(#logs==0 and not logger:Export())
    values.zp_bot_learning_trace=true
    trace.Record(event); event.Components.progress=999
    assert(logger:Export()); local saved=jsonValues[files["zombieplague/bots/diagnostics/learning-trace-v1.json"]]
    assert(saved.Rows[1].Components.progress==0.2 and saved.Rows[1].Bot==1 and saved.Rows[1].Role=="human")
    for i=1,600 do trace.Record(event) end
    assert(logger:Export() and #jsonValues[files["zombieplague/bots/diagnostics/learning-trace-v1.json"]].Rows==512)
    local count=#logs; values.zp_bot_learning_trace_bot=2; trace.Record(event); assert(#logs==count)
`));

test("the authored zig-zag fall pit is a fall even when its trigger uses generic damage", () => run(botSetup + `
    loaded=true; local start,goal=newArea(1,0),newArea(2,400); start.adjacent={goal}
    local bots=include("sv_bots.lua").bots
    local zombie=newPlayer(TEAM_ZOMBIES,0); newPlayer(TEAM_HUMANS,400,false)
    bots:Attach(zombie,"aggressive"); now=11; bots:Update(); bots:Command(zombie,command())
    zombie.airborne=true; zombie.position=Vector(25,0,-5); now=11.1; bots:Command(zombie,command())
    local pit={IsPlayer=function() return false end,GetClass=function() return "trigger_hurt" end,GetName=function() return "zp_fall_hurt" end}
    local hit=damage(pit,10000,1,pit); zombie.alive=false
    bots:Death(zombie,pit,hit); bots:Damage(zombie,hit,true)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==10000 and bots:Diagnostics(0,1).Rows[1].Motion.Samples==1)
    local query={Bot="1",Version="",Scenario="",Difficulty="",Role="",Period=""}
    local failures=0
    for _,row in ipairs(bots.Statistics:Report(query).History) do if row.Kind=="navigation" then assert(row.End=="fall" and row.Falls==1); failures=failures+1 end end
    assert(failures==1)
`));

test("a generic hurt volume without the fall marker is not misclassified as a failed crossing", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); newPlayer(TEAM_HUMANS,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update(); bots:Command(bot,command())
    bot.airborne=true; now=11.1; bots:Command(bot,command())
    local acid={IsPlayer=function() return false end,GetClass=function() return "trigger_hurt" end,GetName=function() return "acid" end}
    bots:Damage(bot,damage(acid,20,1,acid),true)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==0 and bots:Diagnostics(0,1).Rows[1].Motion.Samples==0)
`));

test("lethal damage is observed before finalization and repeated hooks cannot duplicate combat updates", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local victim,attacker=newPlayer(TEAM_ZOMBIES,0),newPlayer(TEAM_HUMANS,400)
    bots:Attach(victim,"aggressive"); bots:Attach(attacker,"aggressive"); now=11; bots:Update()
    bots:Command(victim,command()); bots:Command(attacker,command())
    local hit=damage(attacker,100); victim.alive=false
    bots:Death(victim,attacker,hit); bots:Damage(victim,hit,true); bots:Death(victim,attacker,hit)
    local query={Bot="1",Version="",Scenario="",Difficulty="",Role="",Period=""}
    local found=false
    for _,row in ipairs(bots.Statistics:Report(query).History) do if row.Kind=="combat" then assert(row.Deaths==1 and row.Taken==100); found=true end end
    assert(found and bots:GetStatus(victim).Samples==1)
    query.Bot="2"
    for _,row in ipairs(bots.Statistics:Report(query).History) do if row.Kind=="combat" then assert(row.Kills==1 and row.Dealt==100) end end
`));

test("a selected tactical decision cannot receive damage credit before its first issued command", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); local target=newPlayer(TEAM_HUMANS,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    bots:Damage(bot,damage(target,5),true); bots:Reset(bot); bots:Save()
    assert(bots:GetStatus(bot).Samples==0)
    now=12; bots:Update(); bots:Command(bot,command()); bots:Damage(bot,damage(target,5),true); bots:Reset(bot)
    assert(bots:GetStatus(bot).Samples==1,"once input was issued, the same ordinary outcome may train its own decision")
`));

test("an empty motor command cannot train a new tactical intention when physical options are unavailable", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); local target=newPlayer(TEAM_HUMANS,400,false)
    blocked=true
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.forward==0 and cmd.side==0 and cmd.buttons & IN_ATTACK==0)
    bots:Damage(bot,damage(target,5),true); bots:Reset(bot)
    assert(bots:GetStatus(bot).Samples==0, "absence of execution cannot establish a policy outcome")
`));
