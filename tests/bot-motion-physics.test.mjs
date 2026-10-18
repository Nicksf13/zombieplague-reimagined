import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Navigator=include("sv_bot_navigation.lua").BotNavigator
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local physics=include("sv_bot_motion_physics.lua").physics
local motor=include("sv_bot_motor.lua")
local bot=newPlayer(TEAM_HUMANS,0)
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory); local navigator=construct(Navigator)
local function apply(steering)
    local cmd=command()
    motor.apply(bot,cmd,{Senses={Visible=false,Allies=0,Enemies=0},Steering=steering,Action="group",Updated=now,ReadyAt=now},1,false)
    return cmd
end
`;

test("active jump power and gravity change reachable navmesh transitions and movement contexts", () => run(setup + `
    loaded=true
    local start,upper=newArea(1,0),newArea(2,300,0,130); start.adjacent={upper}
    navigator:Steer(bot,upper.center,now,learner); assert(#navigator.path==0)
    local original=physics(bot).Key
    bot.jumpPower=500; bot.gravity=0.7
    now=now+0.2; local steering=navigator:Steer(bot,upper.center,now,learner)
    assert(#navigator.path>0 and steering.Jump and physics(bot).Key~=original)
    assert(learner:Diagnostic().Samples==0, "temporary physics changes cancel the previous attempt neutrally")
    local cmd=apply(steering); assert(cmd.buttons & IN_JUMP~=0)
    bot.runSpeed=500; assert(physics(bot).Key~=original)
`));

test("low ceilings select the player's actual duck hull and sprint respects real breath drain", () => run(setup + `
    util.TraceHull=function(options) return {Hit=options.maxs.z>40,Entity=emptyEntity,HitPos=options.endpos} end
    local steering=navigator:Steer(bot,Vector(400,0,0),now,learner)
    assert(steering.Duck and apply(steering).buttons & IN_DUCK~=0)
    util.TraceHull=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    navigator:Reset(); learner:Cancel(); bot.breath=5
    now=now+0.2; steering=navigator:Steer(bot,Vector(400,0,0),now,learner,true)
    assert(steering.Pick and not steering.Pick.Sprint)
    assert(apply(steering).buttons & IN_SPEED==0)
    navigator:Reset(); learner:Cancel(); bot.breath=100
    now=now+0.2; steering=navigator:Steer(bot,Vector(400,0,0),now,learner,true)
    local cmd=apply(steering)
    assert(cmd.buttons & IN_SPEED~=0 and cmd.buttons & IN_FORWARD~=0, "normal breath manager observes directional input")
    assert(learner:Diagnostic().Keys==cmd.buttons)
`));

test("water recovery seeks dry navigation and rewards a real exit without requiring ground ahead underwater", () => run(setup + `
    loaded=true; ground=false
    local water,shore=newArea(1,0),newArea(2,400); water.water=true; water.adjacent={shore}
    bot.water=3
    local steering=navigator:Steer(bot,Vector(1000,0,0),now,learner)
    assert(steering.Pick and steering.Pick.Action=="swim" and steering.Pick.Aim.z>bot:EyePos().z)
    local cmd=apply(steering); assert(cmd.buttons & IN_JUMP~=0)
    bot.position=Vector(200,0,0); now=10.4; navigator:Steer(bot,Vector(1000,0,0),now,learner)
    assert(memory.Totals.WaterEscapes==0)
    bot.position=Vector(360,0,0); bot.water=0; ground=true; now=10.8
    navigator:Steer(bot,Vector(1000,0,0),now,learner)
    assert(memory.Totals.WaterEscapes==1 and memory.Totals.Goals==0)
    local rewarded=false
    for key,entry in pairs(memory.Estimates) do if key:match(":swim$") and entry.Value>0 then rewarded=true end end
    assert(rewarded, "exit success trains the swimming action")
`));

test("water without navmesh still offers ascent when the bot has nobody to pursue", () => run(setup + `
    bot.water=3; loaded=false; ground=false
    local goal=navigator:Wander(bot)
    assert(goal and goal.z>bot.position.z)
    local steering=navigator:Steer(bot,goal,now,learner)
    assert(steering.Pick and steering.Pick.Action=="swim" and apply(steering).buttons & IN_JUMP~=0)
`));

test("jump trials continue through flight and credit landing progress without issuing air jumps", () => run(setup + `
    bot.jumpPower=500
    local steering=navigator:Steer(bot,Vector(200,0,50),now,learner)
    assert(steering.Pick.Action=="jump")
    bot.airborne=true; bot.position=Vector(30,0,25); now=10.2
    steering=navigator:Steer(bot,Vector(200,0,50),now,learner)
    assert(steering.Pick.Action=="jump" and not steering.Jump)
    bot.position=Vector(100,0,60); now=10.6
    steering=navigator:Steer(bot,Vector(200,0,50),now,learner)
    assert(steering.Pick.Action=="jump" and learner:Diagnostic().Samples==0)
    bot.airborne=false; bot.position=Vector(190,0,50); now=11
    navigator:Steer(bot,Vector(200,0,50),now,learner)
    local learned=false
    for key,entry in pairs(memory.Estimates) do if key:match(":jump$") and entry.Value>0 then learned=true end end
    assert(learned and memory.Totals.Goals==1)
`));

test("ladder links produce upward view and ordinary movement, then reward actual top-area entry", () => run(setup + `
    loaded=true
    local bottom,top=newArea(1,0),newArea(2,80,0,220)
    local null={IsValid=function() return false end}
    local ladder={IsValid=function() return true end,GetID=function() return 1 end,GetNormal=function() return Vector(-1,0,0) end,
        GetBottom=function() return Vector(0,0,0) end,GetTop=function() return Vector(0,0,220) end,
        GetBottomArea=function() return bottom end,GetTopForwardArea=function() return top end,
        GetTopBehindArea=function() return null end,GetTopLeftArea=function() return null end,GetTopRightArea=function() return null end}
    bottom.ladders={ladder}; top.ladders={ladder}
    local steering=navigator:Steer(bot,top.center,now,learner)
    assert(steering.Pick.Action=="climb" and steering.Pick.Aim.z>bot:EyePos().z, "initial ladder aim")
    assert(apply(steering).forward>0, "initial ladder input")
    bot.moveType=MOVETYPE_LADDER; bot.airborne=true; blocked=true
    bot.position=Vector(0,0,80); now=10.4
    steering=navigator:Steer(bot,top.center,now,learner)
    assert(steering.Pick and steering.Pick.Action=="climb", "ladder attachment is not rejected as a wall")
    bot.position=Vector(0,0,220); now=10.8; navigator:Steer(bot,top.center,now,learner)
    bot.position=Vector(75,0,220); bot.moveType=2; bot.airborne=false; blocked=false; now=11.2
    navigator:Steer(bot,top.center,now,learner)
    assert(memory.Totals.Ladders==1 and memory.Totals.Goals==1, "ladder arrivals "..memory.Totals.Ladders.." / goals "..memory.Totals.Goals)
    navigator:Reset(); learner:Cancel(); bot.position=Vector(100,0,220); now=11.6
    steering=navigator:Steer(bot,bottom.center,now,learner)
    assert(steering.Position and not steering.Pick.Aim, "approach the ladder's front before trying to descend")
    bot.position=Vector(60,0,220); now=12; steering=navigator:Steer(bot,bottom.center,now,learner)
    assert(steering.Pick and steering.Pick.Aim.z<bot:EyePos().z, "descending uses the correct view direction")
`));

test("learned passage failures make pathfinding choose an alternative route for the same physics", () => run(setup + `
    loaded=true
    local start,bad,good,goal=newArea(1,0),newArea(2,200),newArea(3,0,250),newArea(4,400)
    start.adjacent={bad,good}; bad.adjacent={goal}; good.adjacent={goal}
    local initial=navigator:Steer(bot,goal.center,now,learner); assert(initial.Position.x>40)
    navigator:Reset(); learner:Cancel()
    memory.Passages[physics(bot).Key..":1>2"]={Attempts=10,Successes=0,Failures=10,Seconds=30}
    now=now+0.2; local alternative=navigator:Steer(bot,goal.center,now,learner)
    assert(alternative.Position.y>40 and math.abs(alternative.Position.x)<1)
`));

test("combat shots do not punish locomotion, while actual fall damage does, and freezing cancels pending movement", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    bots:Damage(bot,damage(target,20),true)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==0)
    bots:Damage(bot,damage(emptyEntity,20,DMG_FALL),false)
    assert(bots:Diagnostics(0,2).Rows[1].Motion.Harm==0)
    bots:Command(bot,command())
    bot.airborne=true; bot.position=Vector(20,0,-4); now=11.1; bots:Command(bot,command())
    bots:Damage(bot,damage(emptyEntity,20,DMG_FALL),true)
    assert(bots:Diagnostics(0,3).Rows[1].Motion.Harm==20 and bots:Diagnostics(0,3).Rows[1].Motion.Reward<0)
    now=11.2; bots:Update(); RoundManager.FreezeTimeActive=true; bots:Update()
    local row=bots:Diagnostics(0,4).Rows[1]
    assert(not row.Active and row.Motion.Keys==0 and #row.Motion.Path==0)
`));
