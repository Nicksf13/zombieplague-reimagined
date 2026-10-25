import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Navigator=include("sv_bot_navigation.lua").BotNavigator
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local motor=include("sv_bot_motor.lua")
local bot=newPlayer(TEAM_ZOMBIES,0)
local navigator=construct(Navigator)
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory)
local function stairs()
    loaded=true
    local start,upper=newArea(1,0),newArea(8,0,0,200)
    local previous=start
    for i=2,7 do
        local step=newArea(i,-160,0,(i-2)*40)
        previous.adjacent={step}; previous=step
    end
    previous.adjacent={upper}; return start,upper
end
`;

test("melee pursuit includes vertical reach instead of dodging underneath an elevated human", () => run(setup + `
    local target=Vector(0,0,200)
    for _,action in ipairs({"attack","defend","group"}) do
        local goal=motor.destination(bot,{EnemyPosition=target,Visible=true,Allies=0,Enemies=1},action,"aggressive")
        assert(goal==target, action.." must keep the human's real elevation")
    end
    local nearby=Vector(40,0,0)
    assert(motor.destination(bot,{EnemyPosition=nearby,Visible=true},"attack","aggressive")==nearby)
    local retreat=motor.destination(bot,{EnemyPosition=Vector(20,0,200),Visible=true},"retreat","aggressive")
    assert(retreat.x<0 and retreat.z==0, "intentional retreat remains local")
`));

test("stairs can initially lead away from a human overhead and still earn checkpoint progress", () => run(setup + `
    local start,upper=stairs()
    local steering=navigator:Steer(bot,upper.center,now,learner,false,"pursuit:1")
    assert(steering.Position and steering.Position.x<0 and navigator:Status().Route=="mesh")
    assert(navigator.path[1].To==2 and navigator.path[#navigator.path].To==upper.id)
    bot.position=Vector(-80,0,0); now=10.6
    navigator:Steer(bot,upper.center,now,learner,false,"pursuit:1")
    assert(bot.position:DistToSqr(upper.center)>40000, "the detour increases direct target distance")
    assert(memory.Totals.Progress>0 and learner:Integrity().Pending>0 and memory.Totals.Goals==0)
    bot.position=Vector(-130,0,0); now=10.8
    navigator:Steer(bot,upper.center,now,learner,false,"pursuit:1")
    assert(learner:Diagnostic().Reward>0,"the reached stair checkpoint confirms the useful detour")
`));

test("endpoint selection prefers the containing floor over a closer area on the wrong floor", () => run(setup + `
    local start,upper=stairs()
    navmesh.GetNearestNavArea=function() return start end
    navigator:Steer(bot,upper.center,now,learner)
    assert(navigator.path[1].To==2 and navigator.path[#navigator.path].To==8)
    navigator:Reset(); areas={start}
    local steering=navigator:Steer(bot,Vector(0,0,200),now,learner)
    assert(not steering.Position and steering.Unreachable, "missing upper-floor coverage cannot reuse the ground floor")
`));

test("unreachable floors stop blind direct movement and retries are throttled", () => run(setup + `
    loaded=true; newArea(1,0); local upper=newArea(2,0,0,200)
    local steering=navigator:Steer(bot,upper.center,now,learner)
    assert(steering.Unreachable and not steering.Position and navigator:Status().Route=="none")
    for i=1,10 do navigator:Steer(bot,upper.center,now+i*0.2,learner) end
    assert(navigator:Status().Replans==1 and learner:Diagnostic().Samples==0)
    navigator:Steer(bot,upper.center,now+5,learner); assert(navigator:Status().Replans==2)
    navigator:Reset(); loaded=false
    assert(navigator:Steer(bot,Vector(0,0,200),now,learner).Unreachable)
`));

test("reachable approaches are followed once without claiming the unreachable goal was reached", () => run(setup + `
    loaded=true
    local start,approach,goal=newArea(1,0),newArea(2,200),newArea(3,400,0,180)
    start.adjacent={approach}
    local steering=navigator:Steer(bot,goal.center,now,learner)
    assert(steering.Position and #navigator.path==1 and navigator.routeKind=="approach")
    bot.position=Vector(100,0,0); now=10.4; navigator:Steer(bot,goal.center,now,learner)
    bot.position=Vector(200,0,0); now=10.8; steering=navigator:Steer(bot,goal.center,now,learner)
    assert(steering.Unreachable and not steering.Position and memory.Totals.Goals==0 and memory.Totals.Successes==1)
`));

test("route memory preserves only the last observed position during a stair detour and still expires", () => run(setup + `
    local start,upper=stairs()
    local Perception=include("sv_bot_perception.lua").BotPerception
    local perception=construct(Perception); local human=newPlayer(TEAM_HUMANS,0,false); human.position=upper.center
    assert(perception:Observe(bot,players,now).Visible)
    navigator:Steer(bot,upper.center,now,learner)
    wall=true; human.position=Vector(500,0,200)
    local senses=perception:Observe(bot,players,now+5,navigator:IsFollowing())
    assert(not senses.Visible and senses.EnemyPosition.x==0 and senses.EnemyPosition.z==200)
    senses.AllyPosition=Vector(1000,0,0)
    assert(motor.destination(bot,senses,"group","aggressive")==senses.AllyPosition)
    assert(not perception:Observe(bot,players,now+21,true).Target)
`));

test("a small vertical floor change invalidates the previous route immediately", () => run(setup + `
    loaded=true
    local start,lower,upper=newArea(1,0),newArea(2,200),newArea(3,200,0,40)
    start.adjacent={lower}; lower.adjacent={upper}
    navigator:Steer(bot,lower.center,now,learner)
    assert(navigator.path[#navigator.path].To==2)
    navigator:Steer(bot,upper.center,now+0.2,learner)
    assert(navigator.path[#navigator.path].To==3 and navigator:Status().Replans==2)
`));

test("visible unreachable humans are temporarily ignored so bots can select a reachable target", () => run(botSetup + `
    loaded=true
    local start,roof,groundTarget=newArea(1,0),newArea(2,0,0,200),newArea(3,600)
    start.adjacent={groundTarget}
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); local high=newPlayer(TEAM_HUMANS,0,false); high.position=roof.center
    local low=newPlayer(TEAM_HUMANS,600,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Route=="none" and not row.Decision)
    now=11.2; bots:Update(); row=bots:Diagnostics(0,2).Rows[1]
    assert(row.Route=="mesh" and row.Goal:find("600",1,true), row.Goal)
    local cmd=command(); bots:Command(bot,cmd); assert(cmd.forward>0)
`));

test("three stalled plans yield a temporary failure instead of following the same blocked route forever", () => run(setup + `
    local start,upper=stairs(); navigator:Steer(bot,upper.center,now,learner)
    for i=1,3 do
        learner.Replan=true; now=now+0.2
        local steering=navigator:Steer(bot,upper.center,now,learner)
        if i<3 then assert(steering.Position) else assert(steering.Unreachable and not steering.Position) end
    end
`));
