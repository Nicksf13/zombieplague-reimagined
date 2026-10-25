import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory)
local function frame(x,mode)
    return {Key="physics:1>2:"..(mode or "ground")..":blocked:normal",Edge="physics:1>2",Mode=mode or "ground",From=1,To=2,
        Position=Vector(x or 0,0,0),Remaining=200-(x or 0),RouteRemaining=500-(x or 0),Speed=200,Breath=100,
        Drain=false,Dynamic=false,Goal=Vector(500,0,0),Completed=false,Final=false,Path={0,0,0,200,0,0,500,0,0},Intent="pursuit:2"}
end
local choice={Action="jump",Position=Vector(48,0,0),Jump=true,JumpReason="traversal",Duck=false,Sprint=false,Preference=0.6,Keys=0}
local key="physics:1>2:ground:blocked:normal:jump"
local function launch() learner:Choose(frame(),{choice},now); learner:Input(IN_FORWARD+IN_JUMP,0) end
`;

test("a useful grounded crossing retains its observed success when shots coincide with the jump", () => run(setup + `
    launch(); now=10.2; choice.Jump=false; learner:Choose(frame(50,"air"),{choice},now)
    learner:ShotWhileJumping(20)
    now=10.5; local landed=frame(190); landed.Completed=true; landed.Final=true; learner:Choose(landed,{},now)
    assert(memory.Estimates[key] and memory.Estimates[key].Value>0)
    assert(memory.Totals.Harm==20 and memory.Totals.Goals==1 and memory.Totals.Failures==0)
`));

test("shots alone do not fabricate a failed jump when knockback or death interrupts the crossing", () => run(setup + `
    launch(); learner:ShotWhileJumping(50)
    now=10.1; local forced=frame(180,"air"); forced.Forced=true; learner:Choose(forced,{choice},now)
    assert(memory.Totals.Harm==50 and memory.Totals.Progress==0 and memory.Totals.Failures==0)
    assert(not memory.Estimates[key], "external displacement has no known crossing result")
    learner:Cancel(); assert(not memory.Estimates[key])
`));

test("unissued jumps and a push without jumping cannot acquire jump-exposure evidence", () => run(setup + `
    learner:Choose(frame(),{choice},now); learner:ShotWhileJumping(50); learner:Cancel()
    assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0)
    now=11; choice.Action="forward"; launch(); learner:ShotWhileJumping(50); learner:Cancel()
    assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0)
`));

test("repeated jumps without crossing progress receive no positive reinforcement", () => run(setup + `
    for i=1,4 do
        now=10+i; launch(); now=now+0.6; learner:Choose(frame(),{choice},now); learner:Cancel()
    end
    assert(not memory.Estimates[key] or memory.Estimates[key].Value<=0)
    assert(memory.Totals.Goals==0 and memory.Totals.Successes==0)
`));

test("jump launch control survives renewed plans but permits progress, retries, swimming and cooperative input", () => run(botSetup + `
    local control=construct(include("sv_bot_jump_control.lua").BotJumpControl)
    local bot=newPlayer(TEAM_ZOMBIES,0); local steering={Jump=true}
    assert(control:Allow(bot,steering,now))
    assert(not control:Allow(bot,{Jump=true},now+0.2))
    assert(control:Allow(bot,{Jump=true},now+0.9))
    assert(not control:Allow(bot,{Jump=true},now+1.8))
    assert(not control:Allow(bot,{Jump=true},now+2.8))
    bot.position=Vector(100,0,0); assert(control:Allow(bot,{Jump=true},now+3))
    bot.water=2; assert(control:Allow(bot,{Jump=true},now+3.1))
    control:Reset(); bot.water=0; assert(control:Allow(bot,{Jump=true},now+3.2))
`));

test("recovery on clear ground cannot invent jump candidates while real obstacles and nav jumps remain available", () => run(botSetup + `
    local actions=include("sv_bot_motion_actions.lua")
    local physics=include("sv_bot_motion_physics.lua").physics
    local bot=newPlayer(TEAM_ZOMBIES,0)
    local surface=actions.options(bot,Vector(200,0,0),physics(bot),true,false,false,false)
    for _,pick in ipairs(surface.Options) do assert(not pick.Jump) end
    obstacle=true
    surface=actions.options(bot,Vector(200,0,0),physics(bot),true,false,false,false)
    local jump=false; for _,pick in ipairs(surface.Options) do if pick.Jump then jump=true; assert(pick.JumpReason=="obstacle") end end
    assert(jump)
    obstacle=false
    surface=actions.options(bot,Vector(200,0,48),physics(bot),false,true,false,false)
    jump=false; for _,pick in ipairs(surface.Options) do if pick.Jump then jump=true; assert(pick.JumpReason=="traversal") end end
    assert(jump)
`));

test("a motor plan emits only one grounded launch across consecutive commands", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua"); local bot=newPlayer(TEAM_ZOMBIES,0)
    local plan={Senses={Visible=false},Steering={Position=Vector(100,0,0),Jump=true,Duck=false},Action="attack",Updated=now,ReadyAt=0}
    local cmd=command(); motor.apply(bot,cmd,plan,1,false); assert(cmd.buttons & IN_JUMP~=0)
    now=10.05; motor.apply(bot,cmd,plan,1,false); assert(cmd.buttons & IN_JUMP==0)
`));

test("lethal duplicate hooks keep jump exposure descriptive and attribute combat to the executed zombie scope once", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local zombie=newPlayer(TEAM_ZOMBIES,0); local human=newPlayer(TEAM_HUMANS,400,false)
    zombie.nemesis=true; zombie.maxHealth=20000; zombie.health=20000
    obstacle=true; bots:Attach(zombie,"aggressive"); now=11; bots:Update()
    local cmd=command(); bots:Command(zombie,cmd); assert(cmd.buttons & IN_JUMP~=0)
    zombie.airborne=true; zombie.alive=false
    local hit=damage(human,100)
    bots:Death(zombie,human,hit); bots:Damage(zombie,hit,true); bots:Death(zombie,human,hit)
    local row=bots:Diagnostics(0,1).Rows[1]
    assert(row.Scope.Role=="zombie" and row.Scope.Variant=="nemesis" and row.Motion.Harm==100)
    assert(row.Motion.Failures==0 and row.Motion.Samples==0)
    assert(row.Totals.DamageTaken==100 and row.Totals.Deaths==1 and row.Samples==1)
`));
