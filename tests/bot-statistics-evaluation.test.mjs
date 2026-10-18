import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

test("evaluation uses deep frozen copies and never updates tactical, profile, movement, passage or shelter parameters", () => run(botSetup + `
    local Contexts=include("sv_bot_contexts.lua").BotContexts
    local canonical=include("sh_bot_statistics_analysis.lua").canonical
    local ply=newPlayer(TEAM_HUMANS,0); local contexts=construct(Contexts)
    local source=contexts:Get(ply,1,"aggressive")
    local situation={Role="human",Health=1,Distance=400,Allies=0,Enemies=1,HasAlly=false}
    source.Brain:Decide(situation,10); source.Brain:Reward(0.5); source.Brain:Finish()
    source.Places:Reward("shelter",0.5)
    source.Motion:Memory().Passages.edge={Attempts=3,Successes=2,Failures=1,Seconds=3}
    contexts:Save()
    local brainBefore=canonical(source.Brain:GetMemory()); local motionBefore=canonical(source.Motion:Memory())
    values.zp_bot_evaluation=true; contexts:SetEvaluation(true)
    local frozen=contexts:Get(ply,1,"aggressive")
    assert(frozen~=source and frozen.Brain~=source.Brain and frozen.Motion:Memory()~=source.Motion:Memory())
    local policy=frozen.Policy; local frozenBrain=canonical(frozen.Brain:GetMemory())
    local estimates=canonical(frozen.Motion:Memory().Estimates); local passages=canonical(frozen.Motion:Memory().Passages)
    local shelters=canonical(frozen.Motion:Memory().Places)
    math.random=function(low,high) return low end
    for i=1,5 do frozen.Brain:Decide(situation,10+i*3); frozen.Brain:Reward(-1); frozen.Brain:Finish() end
    local function frame(x)
        return {Key="edge",Edge="edge",Mode="ground",From=1,To=2,Position=Vector(x,0,0),Remaining=200-x,RouteRemaining=400-x,
            Speed=200,Breath=100,Drain=false,Dynamic=false,Goal=Vector(400,0,0),Completed=false,Final=false,Path={}}
    end
    local option={Action="forward",Position=Vector(50,0,0),Jump=false,Duck=false,Sprint=false,Preference=0.5,Keys=0}
    frozen.Motion:Choose(frame(0),{option},30); frozen.Motion:Choose(frame(80),{option},30.5)
    local done=frame(180); done.Completed=true; frozen.Motion:Choose(done,{},31)
    frozen.Places:Reward("shelter",-1); frozen.Places:Event("another","Visits")
    assert(canonical(frozen.Brain:GetMemory())==frozenBrain)
    assert(canonical(frozen.Motion:Memory().Estimates)==estimates and canonical(frozen.Motion:Memory().Passages)==passages)
    assert(canonical(frozen.Motion:Memory().Places)==shelters and contexts:Version(frozen)==policy)
    contexts:Save()
    assert(canonical(source.Brain:GetMemory())==brainBefore and canonical(source.Motion:Memory())==motionBefore)
    source.Motion:Memory().Passages.edge.Seconds=999
    assert(frozen.Motion:Memory().Passages.edge.Seconds==3, "nested values must not share references")
    values.zp_bot_evaluation=false; contexts:SetEvaluation(false)
    assert(contexts:Get(ply,1,"aggressive")==source)
`));

test("heldout and retention cohorts force every learning gate off even if training enables learning", () => run(botSetup + `
    local gate=include("sv_bot_learning_gate.lua")
    local Brain=include("sv_bot_brain.lua").BotBrain
    local memory={ID=1,Profile="aggressive",Experience={}}
    local brain=construct(Brain,memory)
    values.zp_bot_learning=true
    for _,cohort in ipairs({"heldout","retention"}) do
        values.zp_bot_stats_cohort=cohort
        assert(gate.evaluationRequested() and not gate.learningAllowed())
        brain:Decide({Role="human",Health=1,Distance=400,Allies=0,Enemies=1,HasAlly=false},now)
        brain:Reward(1); brain:Finish(); assert(brain:Samples()==0)
    end
    values.zp_bot_stats_cohort="trained"; assert(gate.learningAllowed())
`));

test("navigation benchmark works without an active round and rejects opponents and ordinary training", () => run(botSetup + `
    local Controller=include("sv_bot_controller.lua").BotController
    loaded=true; local a=newArea(1,0); local b=newArea(2,200); a.adjacent={b}; b.adjacent={a}
    local bots=construct(Controller); local ply=newPlayer(TEAM_HUMANS,0); bots:Attach(ply)
    local goal=Vector(200,0,0)
    assert(not bots:Benchmark(1,goal))
    values.zp_bot_evaluation=true
    local enemy=newPlayer(TEAM_ZOMBIES,500); assert(not bots:Benchmark(1,goal)); enemy.alive=false
    assert(bots:Benchmark(1,goal))
    RoundManager.state=ROUND_WAITING_PLAYERS; bots:Update()
    local plan=bots:Diagnostics(0,1).Rows[1]
    assert(plan.Goal~="" and plan.Samples==0)
    local input=command(); bots:Command(ply,input); assert(not input.buttons or input.buttons%2==0, "benchmark never fires")
    bots:Reset(ply); assert(not bots:Benchmark(99,goal))
`));

test("boost learning and editing cannot change a frozen evaluation policy", () => run(botSetup + `
    local Store=include("sv_bot_boost_store.lua").BotBoostStore
    local store=construct(Store); local point={ID=1,Base={0,0,0},Approach={20,0,0},Exit={60,0,60}}
    store:Outcome(point,"pair",true); local before=store:Score("pair")
    values.zp_bot_evaluation=true; store:Outcome(point,"pair",false)
    assert(store:Score("pair")==before and not store:Put(point) and not store:Remove(1))
`));
