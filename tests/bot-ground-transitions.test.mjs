import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local bot=newPlayer(TEAM_ZOMBIES,250)
local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
local memory=ZPBotMotionProtocol.Empty()
local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,memory)
loaded=true
local bridge,platform=newArea(840,200),newArea(773,500,120)
bridge.adjacent={platform}
function bridge:Contains(point) return point.x>=0 and point.x<=400 and math.abs(point.y)<=8 end
function bridge:GetClosestPointOnArea(point) return Vector(math.max(0,math.min(400,point.x)),math.max(-8,math.min(8,point.y)),0) end
function platform:Contains(point) return point.x>=400 and point.x<=600 and point.y>=0 and point.y<=240 end
function platform:GetClosestPointOnArea(point) return Vector(math.max(400,math.min(600,point.x)),math.max(0,math.min(240,point.y)),0) end
local original=util.TraceLine
util.TraceLine=function(options)
    if options.mask~=MASK_PLAYERSOLID then return original(options) end
    local supported=bridge:Contains(options.start) or platform:Contains(options.start)
    return {Hit=supported and options.start.z>=0 and options.endpos.z<=0,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,0)}
end
local function steer() return navigator:Steer(bot,platform.center,now,learner,false,"pursuit:773") end
`;

test("a narrow bridge approaches its shared exit before entering an offset connected area", () => run(setup + `
    local control=steer()
    assert(control.Pick and control.Position.x>bot.position.x and bridge:Contains(control.Position),
        "a connected path must not stop because aiming at the next center leaves the bridge")
    assert(navigator:Diagnostic().From==840 and navigator:Diagnostic().To==773)
    assert(navigator:Diagnostic().Phase=="align")
    assert(not control.Jump and not control.Pick.Sprint)
    bot.position=Vector(330,2,0); now=10.4; control=steer()
    assert(control.Pick and bridge:Contains(control.Position), "alignment remains on the source beam")
    bot.position=Vector(376,4,0); now=10.8; control=steer()
    assert(control.Pick and platform:Contains(control.Position), "cross through the shared span instead of the far center")
    assert(navigator:Diagnostic().Phase=="cross")
    bot.position=Vector(408,4,0); now=11.2; control=steer()
    assert(navigator.path[1].From==773 and memory.Totals.Successes==1 and memory.Totals.Goals==0)
    assert(#bridge.adjacent==1, "steering does not modify the navmesh")
`));

test("shared exit alignment works in every cardinal direction", () => run(setup + `
    local bridgeContains,bridgeClosest=bridge.Contains,bridge.GetClosestPointOnArea
    local platformContains,platformClosest=platform.Contains,platform.GetClosestPointOnArea
    local function rotated(point,angle) return Vector(point.x*math.cos(angle)-point.y*math.sin(angle),point.x*math.sin(angle)+point.y*math.cos(angle),point.z) end
    for _,angle in ipairs({math.pi/2,math.pi,math.pi*1.5}) do
        bridge.center=rotated(Vector(200,0,0),angle); platform.center=rotated(Vector(500,120,0),angle)
        function bridge:Contains(point) return bridgeContains(self,rotated(point,-angle)) end
        function bridge:GetClosestPointOnArea(point) return rotated(bridgeClosest(self,rotated(point,-angle)),angle) end
        function platform:Contains(point) return platformContains(self,rotated(point,-angle)) end
        function platform:GetClosestPointOnArea(point) return rotated(platformClosest(self,rotated(point,-angle)),angle) end
        bot.position=rotated(Vector(250,0,0),angle); navigator:Reset(); learner:Cancel(); now=now+1
        local control=steer()
        assert(control.Pick and bridge:Contains(control.Position), "each shared cardinal side can retain floor support")
        assert(navigator:Diagnostic().Phase=="align")
    end
`));

test("ground checkpoint input slows near the corner and does not jump or sprint past it", () => run(setup + `
    local control=steer()
    bot.position=Vector(360,4,0); now=10.4; control=steer()
    assert(control.Pick.SpeedLimit<bot:GetWalkSpeed() and not control.Jump and not control.Pick.Sprint)
    local motor=include("sv_bot_motor.lua"); local cmd=command()
    motor.apply(bot,cmd,{Senses={Visible=false,Allies=0,Enemies=0},Steering=control,Action="attack",Updated=now,ReadyAt=now},1,false)
    assert(cmd.forward>0 and cmd.forward<=64.01 and cmd.buttons & IN_SPEED==0 and cmd.buttons & IN_JUMP==0)
`));

test("a graph connection without local floor support reports the rejection and never authorizes blind movement", () => run(setup + `
    util.TraceLine=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    local control=steer()
    assert(not control.Pick and not control.Position)
    local detail=navigator:Diagnostic()
    assert(detail.Reason=="ground" and detail.From==840 and detail.To==773)
    assert(ZPBotMotionProtocol.Navigation(detail))
    assert(memory.Totals.Successes==0 and memory.Totals.Goals==0)
`));

test("movement diagnostics distinguish occupied passages from static obstacles and clear when movement resumes", () => run(setup + `
    local blocker=newPlayer(TEAM_ZOMBIES,280)
    function blocker:GetClass() return "player" end
    util.TraceHull=function(options) return {Hit=true,Entity=blocker,HitPos=options.endpos} end
    assert(not steer().Pick and navigator:Diagnostic().Reason=="occupied")
    assert(ZPBotMotionProtocol.Navigation(navigator:Diagnostic()))
    now=10.2
    util.TraceHull=function(options) return {Hit=true,Entity=emptyEntity,HitPos=options.endpos} end
    assert(not steer().Pick and navigator:Diagnostic().Reason=="obstacle")
    now=10.4
    util.TraceHull=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    assert(steer().Pick and navigator:Diagnostic().Reason=="ready")
`));

test("ready route diagnostics follow the active connection's actual height instead of a default zero", () => run(botSetup + `
    loaded=true
    local start,upper,goal=newArea(840,0),newArea(773,200,0,18),newArea(774,400,0,36)
    start.adjacent={upper}; upper.adjacent={goal}
    local bot=newPlayer(TEAM_ZOMBIES,0)
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    assert(navigator:Steer(bot,goal.center,now).Pick)
    local detail=navigator:Diagnostic(); assert(detail.From==840 and detail.To==773 and detail.Height==18)
    bot.position=upper.center; now=10.4
    assert(navigator:Steer(bot,goal.center,now).Pick)
    detail=navigator:Diagnostic(); assert(detail.From==773 and detail.To==774 and detail.Height==18)
`));
