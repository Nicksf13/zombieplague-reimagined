import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory)
local function frame(x,remaining)
    return {Key="physics:1>2:ground:clear:normal",Edge="physics:1>2",Mode="ground",From=1,To=2,Position=Vector(x,0,0),
        Remaining=remaining,RouteRemaining=remaining+300,Speed=200,Breath=100,Drain=false,Dynamic=false,
        Goal=Vector(1000,0,0),Completed=false,Final=false,Path={x,0,0,200,0,0,1000,0,0}}
end
local function option(action,preference)
    return {Action=action,Position=Vector(48,0,0),Jump=false,Duck=false,Sprint=false,Preference=preference or 0,Keys=0}
end
local forward=option("forward",0.4)
`;

test("locomotion learns successful alternatives after repeated failed actions", () => run(setup + `
    learner:Choose(frame(0,200),{forward},10)
    for i=1,12 do learner:Choose(frame(0,200),{forward},10+i*0.5) end
    assert(memory.Estimates["physics:1>2:ground:clear:normal:forward"].Value<0)
    local alternative=option("diagonalleft",0.05)
    local selected=learner:Choose(frame(0,200),{forward,alternative},16.5)
    assert(selected.Action=="diagonalleft", "selected "..selected.Action.." with forward value "..memory.Estimates["physics:1>2:ground:clear:normal:forward"].Value)
    learner:Choose(frame(50,150),{forward,alternative},16.7)
    learner:Choose(frame(100,100),{forward,alternative},17)
    local completed=frame(180,20); completed.Completed=true
    learner:Choose(completed,{},17.2)
    assert(memory.Estimates["physics:1>2:ground:clear:normal:diagonalleft"].Value>0, "alternative learned value")
    assert(learner:Diagnostic().Samples>0 and learner:Diagnostic().Reward>0, "last outcome")
`));

test("backtracking and replans cannot repeatedly farm the same progress or completion", () => run(setup + `
    learner:Choose(frame(0,200),{forward},10)
    learner:Choose(frame(50,150),{forward},10.2)
    learner:Choose(frame(0,200),{forward},10.4)
    learner:Choose(frame(50,150),{forward},10.6)
    assert(memory.Totals.Progress==50)
    local changed=frame(50,150); changed.RouteRemaining=1
    learner:Choose(changed,{forward},10.8); assert(memory.Totals.Progress==50)
    local done=frame(180,20); done.Completed=true
    learner:Choose(done,{},11); learner:Choose(done,{},11.2)
    assert(memory.Totals.Successes==1 and memory.Passages["physics:1>2"].Successes==1)
    done.Final=true; learner:Choose(done,{},11.4); learner:Choose(done,{},11.6)
    assert(memory.Totals.Goals==1)
`));

test("teleports, long inactive gaps and explicit cancellation do not generate false rewards", () => run(setup + `
    learner:Choose(frame(0,200),{forward},10)
    local done=frame(10000,0); done.Completed=true; done.Final=true
    learner:Choose(done,{},10.2)
    assert(memory.Totals.Distance==0 and memory.Totals.Goals==0 and next(memory.Estimates)==nil)
    learner:Cancel(); learner:Choose(frame(0,200),{forward},20)
    learner:Choose(frame(100,100),{forward},25)
    assert(memory.Totals.Distance==0 and next(memory.Estimates)==nil)
    learner:Cancel(); assert(learner:Diagnostic().Keys==0 and #learner:Diagnostic().Path==0)
`));

test("moving targets preserve attempts but target motion and external pushes cannot supply progress", () => run(setup + `
    local first=frame(0,200); first.Intent="attack:10"; first.Stage=Vector(200,0,0)
    learner:Choose(first,{forward},10)
    local second=frame(0,100); second.Intent=first.Intent; second.Goal=Vector(1200,0,0); second.Stage=Vector(100,0,0)
    learner:Choose(second,{forward},10.2)
    assert(memory.Totals.Progress==0, "target movement alone is not useful movement")
    local third=frame(50,100); third.Intent=first.Intent; third.Goal=Vector(1300,0,0); third.Stage=Vector(150,0,0)
    learner:Choose(third,{forward},10.6)
    assert(memory.Totals.Progress==50 and learner:Integrity().Pending>0, "observed pursuit progress awaits a completed crossing")
    local completed=frame(140,10); completed.Intent=first.Intent; completed.Stage=Vector(150,0,0); completed.Completed=true
    learner:Choose(completed,{},10.8)
    assert(learner:Diagnostic().Samples>0,"completed pursuit checkpoints release their learning outcomes")
    local fourth=frame(100,50); fourth.Intent=first.Intent; fourth.Forced=true
    local before=memory.Totals.Progress
    learner:Choose(fourth,{forward},11); assert(memory.Totals.Progress==before)
`));

test("slow controlled movement accepts observed vertical falling speed but still cancels teleport-sized deltas", () => run(setup + `
    local first=frame(0,200); first.Speed=40; first.Gravity=600; first.Velocity=Vector(0,0,0); first.Position=Vector(0,0,200)
    learner:Choose(first,{forward},10)
    local falling=frame(10,80); falling.Speed=40; falling.Mode="air"; falling.Gravity=600; falling.Velocity=Vector(40,0,-500); falling.Position=Vector(10,0,80)
    learner:Choose(falling,{forward},10.2)
    assert(memory.Totals.Distance>100 and memory.Totals.Progress>0, "valid falling motion is not a teleport because approach speed was low")
    memory=ZPBotMotionProtocol.Empty(); learner=construct(Motion,memory)
    first.Position=Vector(0,0,0); first.Mode="air"; learner:Choose(first,{forward},20)
    falling.Position=Vector(0,0,10000); falling.Velocity=Vector(0,0,-20000)
    learner:Choose(falling,{forward},20.2)
    assert(memory.Totals.Distance==0 and learner:Diagnostic().Samples==0, "even extreme vertical velocity cannot manufacture a teleport reward")
`));

test("temporary blockers do not penalize map passages and disabled training retains metrics only", () => run(setup + `
    for i=0,20 do local observation=frame(0,200); observation.Dynamic=true; learner:Choose(observation,{forward},10+i*0.5) end
    assert(memory.Totals.Failures>0 and next(memory.Passages)==nil)
    assert(learner:Cost("physics:1>2",200,200)==1)
    learner:Cancel(); values.zp_bot_learning=false; local count=learner:Diagnostic().Samples
    learner:Choose(frame(0,200),{forward},30)
    learner:Choose(frame(60,140),{forward},30.5)
    assert(learner:Diagnostic().Samples==count and memory.Totals.Progress>=60)
`));

test("learned passage cost favors reliable routes after repeated traversal failures", () => run(setup + `
    memory.Passages["physics:1>2"]={Attempts=10,Successes=1,Failures=9,Seconds=30}
    memory.Passages["physics:1>3"]={Attempts=10,Successes=10,Failures=0,Seconds=10}
    assert(learner:Cost("physics:1>2",200,200)>learner:Cost("physics:1>3",200,200))
    assert(learner:Cost("another-physics:1>2",200,200)==1)
`));

test("actual navmesh checkpoints reward entry at the correct height and goal completion once", () => run(botSetup + `
    loaded=true
    local start,bend,goal=newArea(1,0),newArea(2,200),newArea(3,400)
    start.adjacent={bend}; bend.adjacent={goal}
    local memory=ZPBotMotionProtocol.Empty()
    local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,memory)
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    local bot=newPlayer(TEAM_HUMANS,0)
    navigator:Steer(bot,goal.center,10,learner)
    bot.position=Vector(100,0,0); navigator:Steer(bot,goal.center,10.4,learner)
    bot.position=Vector(180,0,150); navigator:Steer(bot,goal.center,10.6,learner)
    assert(memory.Totals.Successes==0, "the area underneath another floor is not reached")
    bot.position=Vector(180,0,0); navigator:Steer(bot,goal.center,10.8,learner)
    assert(memory.Totals.Successes==1)
    bot.position=Vector(280,0,0); navigator:Steer(bot,goal.center,11.2,learner)
    bot.position=Vector(370,0,0); navigator:Steer(bot,goal.center,11.6,learner)
    assert(memory.Totals.Goals==1 and memory.Totals.Successes>=2)
    assert(ZPBotMotionProtocol.Diagnostic(learner:Diagnostic()))
`));

test("movement memories persist independently per map, role, class, identity and navigation revision", () => run(botSetup + `
    local Contexts=include("sv_bot_contexts.lua").BotContexts
    local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
    local entry=contexts:Get(bot,1,"aggressive")
    entry.Motion:Choose({Key="p:1>2:ground",Edge="p:1>2",Mode="ground",From=1,To=2,Position=Vector(0,0,0),Remaining=200,RouteRemaining=200,
        Speed=200,Breath=100,Drain=false,Dynamic=false,Goal=Vector(200,0,0),Completed=false,Final=false,Path={0,0,0,200,0,0}},
        {{Action="forward",Position=Vector(48,0,0),Jump=false,Duck=false,Sprint=false,Preference=0.4,Keys=0}},10)
    now=10
    entry.Motion:Input(IN_FORWARD,0,{Mode="ground",Position=Vector(0,0,0),Velocity=Vector(100,0,0),Run=300,Controlled=true,Moving=true})
    now=10.1
    entry.Motion:Observe({Mode="air",Position=Vector(10,0,0),Velocity=Vector(100,0,-100),Run=300,Controlled=true,Moving=true})
    entry.Motion:Harm(10,"observed-fall"); contexts:Save()
    local filesBefore=writes
    contexts:Save(); assert(writes==filesBefore)
    local reloaded=construct(Contexts):Get(bot,1,"aggressive")
    assert(reloaded.Motion:Diagnostic().Samples==1 and reloaded.Motion:Diagnostic().Harm==10)
    assert(reloaded.Brain:Samples()==0, "movement rewards cannot train combat decisions")
    bot.humanClass={ID="FastHuman",Name="HumanDefaultClassName"}
    assert(contexts:Get(bot,1,"aggressive").Motion:Diagnostic().Samples==0)
    bot.humanClass=nil; bot.team=TEAM_ZOMBIES; assert(contexts:Get(bot,1,"aggressive").Motion:Diagnostic().Samples==0)
    bot.team=TEAM_HUMANS; mapName="another_map"; assert(contexts:Get(bot,1,"aggressive").Motion:Diagnostic().Samples==0)
    mapName="gm_test"; assert(contexts:Get(bot,2,"aggressive").Motion:Diagnostic().Samples==0)
    files["maps/gm_test.nav"]="regenerated geometry"
    assert(construct(Contexts):Get(bot,1,"aggressive").Motion:Diagnostic().Samples==0)
    assert(entry.Motion:Diagnostic().Samples==1)
`));

test("movement storage rejects malformed data without overwriting it, and retries verified backups", () => run(botSetup + `
    local scope={Map="gm_test",Role="human",ClassID="HumanDefault",ClassName="HumanDefaultClassName",Variant="normal"}
    local Store=include("sv_bot_motion_storage.lua").BotMotionStore
    local store=construct(Store,scope,1); local memory=store:Load()
    local path="zombieplague/bots/movement/"..util.SHA256(ZPBotMetricsProtocol.Key(scope)).."/unknown/1.json"
    assert(store:Save(memory)); local first=files[path]
    memory.Totals.Attempts=1; failWrite=true
    assert(not store:Save(memory) and files[path..".bak.txt"]==first)
    failWrite=false; assert(store:Save(memory))
    assert(construct(Store,scope,1):Load().Totals.Attempts==1)
    files[path]="broken"
    local broken=construct(Store,scope,1)
    assert(broken:Load().Totals.Attempts==0 and not broken:Save(memory) and files[path]=="broken")
    local invalid=ZPBotMotionProtocol.Empty(); invalid.Estimates.bad={Value=2,Samples=1}
    assert(not ZPBotMotionProtocol.Memory(invalid))
`));
