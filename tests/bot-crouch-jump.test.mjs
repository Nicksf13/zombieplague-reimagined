import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local movement=include("sv_bot_motion_actions.lua")
local physical=include("sv_bot_motion_physics.lua")
local bot=newPlayer(TEAM_ZOMBIES,0)
local height=55
local ceiling=1000
local missing=false
util.TraceHull=function(options)
    local hit=(options.endpos.x>20 and options.start.z<height) or options.endpos.z+options.maxs.z>ceiling
    return {Hit=hit,HitWorld=hit,Entity=emptyEntity,HitPos=options.endpos}
end
util.TraceLine=function(options)
    local z=options.start.x>20 and height or 0
    return {Hit=not missing and options.start.z>=z and options.endpos.z<=z,Entity=emptyEntity,
        HitPos=Vector(options.start.x,options.start.y,z),HitNormal=Vector(0,0,1)}
end
local function choices(jump,precision)
    return movement.options(bot,Vector(80,0,height),physical.physics(bot),false,jump,false,false,nil,false,precision).Options
end
local function crouch(options)
    for _,pick in ipairs(options) do if pick.Action=="jumpduck" then return pick end end
end
`;

test("a ledge above the ordinary jump can offer a crouch jump with standing takeoff", () => run(setup + `
    local options=choices(true)
    local pick=crouch(options)
    assert(pick and pick.Jump and not pick.Duck and not pick.Sprint)
    for _,other in ipairs(options) do assert(not other.Jump or other.Action=="jumpduck") end
    assert(physical.jumpReach(physical.physics(bot))>55)
    bot.hullHeight=36
    assert(not crouch(choices(true)),"identical standing and duck hulls provide no extra tuck reach")
`));

test("crouch jump validation rejects blocked headroom, unreachable landings and missing support", () => run(setup + `
    ceiling=90; assert(not crouch(choices(true)),"standing launch must fit below the ceiling")
    ceiling=1000; height=100; assert(not crouch(choices(true)),"crouching cannot invent extra jump power")
    height=55; missing=true; assert(not crouch(choices(true)),"no blind launch over missing support")
`));

test("clear ground, precision walking, controlled drops, water and ladders retain their movement rules", () => run(setup + `
    height=0
    assert(not crouch(choices(false)),"clear ground must not trigger random crouch jumps")
    assert(not crouch(choices(true,40)),"precision walking does not try jumps on a narrow beam")
    assert(not crouch(movement.options(bot,Vector(80,0,0),physical.physics(bot),false,true,false,false,nil,true).Options))
    bot.water=2; assert(not crouch(choices(true)))
    bot.water=0; bot.moveType=MOVETYPE_LADDER; assert(not crouch(choices(true)))
`));

test("crouch flight follows issued input, survives plan renewal and ends at landing or cancellation", () => run(setup + `
    local control=construct(include("sv_bot_jump_control.lua").BotJumpControl)
    local steering={Jump=true,Pick=crouch(choices(true))}
    control:Issued(steering,IN_FORWARD,now)
    bot.airborne=true; assert(not control:Crouch(bot,now+0.03),"an unissued proposal cannot start the sequence")
    bot.airborne=false
    assert(control:Allow(bot,steering,now))
    control:Issued(steering,IN_FORWARD+IN_JUMP,now)
    assert(not control:Crouch(bot,now+0.01),"launch before pressing crouch")
    bot.airborne=true; assert(control:Crouch(bot,now+0.03))
    assert(control:Crouch(bot,now+0.6),"renewing a plan cannot release the airborne tuck")
    bot.airborne=false; assert(not control:Crouch(bot,now+0.7))
    assert(not control:Allow(bot,steering,now+0.7),"the sequence retains the existing launch cooldown")
    control:Issued(steering,IN_JUMP,now+1); control:CancelFlight()
    bot.airborne=true; assert(not control:Crouch(bot,now+1.03))
`));

test("the controller issues jump, airborne duck without an air jump, then releases duck on landing", () => run(setup + `
    local bots=include("sv_bots.lua").bots
    local human=newPlayer(TEAM_HUMANS,80,false); human.position.z=55
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_JUMP~=0 and cmd.buttons & IN_DUCK==0,"standing launch")
    bot.airborne=true; bot.position=Vector(15,0,10); now=11.03
    bots:Command(bot,cmd)
    assert(cmd.buttons & IN_DUCK~=0 and cmd.buttons & IN_JUMP==0,"airborne tuck without another jump")
    now=11.22; bots:Update(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_DUCK~=0,"retain tuck even if the renewed plan has no movement choice")
    bot.airborne=false; bot.position=Vector(65,0,55); now=11.24
    bots:Command(bot,cmd)
    assert(cmd.buttons & IN_DUCK==0,"release the tuck once grounded")
`));

test("navmesh routing considers live crouch reach and still rejects a higher disconnected-height link", () => run(setup + `
    loaded=true
    local a,b=newArea(1,0),newArea(2,80,0,55); a.adjacent={b}
    local routing=include("sv_bot_pathfinding.lua")
    local route=routing.findPath(bot,b.center,physical.physics(bot),function() return 1 end)
    assert(route.Kind=="complete")
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    assert(navigator:Steer(bot,b.center,now).Pick.Action=="jumpduck")
    b.center.z=90
    assert(routing.findPath(bot,b.center,physical.physics(bot),function() return 1 end).Kind=="unreachable")
`));

test("crouch jump estimates require an observed crossing and preserve previous stored actions", () => run(setup + `
    local memory=ZPBotMotionProtocol.Empty()
    memory.Estimates["old:jump"]={Value=0.2,Samples=3}
    local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,memory)
    local pick=crouch(choices(true))
    local function frame(x,mode)
        return {Key="ledge",Edge="1>2",Mode=mode or "ground",From=1,To=2,Position=Vector(x,0,x>=70 and 55 or mode=="air" and 25 or 0),
            Remaining=80-x,RouteRemaining=80-x,Speed=200,Breath=100,Drain=false,Dynamic=false,
            Goal=Vector(80,0,55),Completed=false,Final=false,Path={0,0,0,80,0,55},Intent="ledge"}
    end
    learner:Choose(frame(0),{pick},now); learner:Input(IN_FORWARD+IN_JUMP,0)
    now=10.2; pick.Jump=false; pick.Duck=true; learner:Choose(frame(30,"air"),{pick},now)
    assert(not memory.Estimates["ledge:jumpduck"],"flight progress alone is not a confirmed successful landing")
    now=10.5; local done=frame(70); done.Completed=true; done.Final=true
    learner:Choose(done,{},now)
    assert(memory.Estimates["ledge:jumpduck"].Value>0 and memory.Totals.Goals==1)
    local restored=ZPBotMotionProtocol.Memory(memory)
    assert(restored and restored.Estimates["old:jump"].Samples==3 and restored.Estimates["ledge:jumpduck"].Value>0)
    local diagnostic=learner:Diagnostic(); diagnostic.Action="jumpduck"
    assert(ZPBotMotionProtocol.Diagnostic(diagnostic))
    diagnostic.Values[#diagnostic.Values]=nil; diagnostic.Action="jump"
    local legacy=ZPBotMotionProtocol.Diagnostic(diagnostic)
    assert(legacy and #legacy.Values==#ZPBotMotionProtocol.Actions and legacy.Values[#legacy.Values]==0)
`));

test("unsuccessful crouch jumps cannot collect positive estimates from repeated proposals", () => run(setup + `
    local memory=ZPBotMotionProtocol.Empty()
    local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,memory)
    local pick=crouch(choices(true))
    local frame={Key="ledge",Edge="1>2",Mode="ground",From=1,To=2,Position=Vector(0,0,0),
        Remaining=80,RouteRemaining=80,Speed=200,Breath=100,Drain=false,Dynamic=false,
        Goal=Vector(80,0,55),Completed=false,Final=false,Path={0,0,0,80,0,55},Intent="ledge"}
    for i=1,4 do
        learner:Choose(frame,{pick},now); learner:Input(IN_FORWARD+IN_JUMP,0)
        now=now+0.6; learner:Choose(frame,{pick},now)
    end
    assert(memory.Totals.Successes==0 and memory.Totals.Goals==0)
    assert(memory.Estimates["ledge:jumpduck"] and memory.Estimates["ledge:jumpduck"].Value<0)
`));
