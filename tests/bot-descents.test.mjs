import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local routing=include("sv_bot_pathfinding.lua")
local physics=include("sv_bot_motion_physics.lua").physics
local fallRisk=include("sv_bot_traversal.lua").fallRisk
local bot=newPlayer(TEAM_ZOMBIES,0); bot.position=Vector(0,0,200)
local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,memory)
loaded=true
local bridge,platform=newArea(1,0,0,200),newArea(2,120,0,0); bridge.adjacent={platform}
local support,solid,slope=true,false,1
local originalLine=util.TraceLine
util.TraceLine=function(options)
    if options.mask~=MASK_PLAYERSOLID then return originalLine(options) end
    for _,area in ipairs(areas) do
        if support and area:Contains(options.start) and options.start.z>=area.center.z and options.endpos.z<=area.center.z then
            return {Hit=true,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,area.center.z),HitNormal=Vector(0,0,slope)}
        end
    end
    return {Hit=false,Entity=emptyEntity,HitPos=options.endpos}
end
util.TraceHull=function(options) return {Hit=solid,Entity=emptyEntity,HitPos=options.endpos} end
local function steer() return navigator:Steer(bot,platform.center,now,learner,false,"pursuit:2") end
`;

test("connected drops over 100 units follow alignment, edge crossing and landing without blind cliff movement", () => run(setup + `
    bot.fallDamage=true
    local route=routing.findPath(bot,platform.center,physics(bot),function() return 1 end)
    assert(route.Kind=="complete" and route.Steps[1].From==1 and route.Steps[1].To==2)
    local control=steer(); local detail=navigator:Diagnostic()
    assert(control.Position and control.Position.x==16 and detail.Phase=="align" and detail.Height==-200 and detail.Damage==0)
    assert(control.Pick.SpeedLimit<bot:GetWalkSpeed(), "alignment slows before the short edge checkpoint")
    assert(not control.Jump and not control.Unreachable and memory.Totals.Successes==0)
    bot.position=Vector(16,0,200); now=10.2; control=steer(); detail=navigator:Diagnostic()
    assert(detail.Phase=="cross" and control.Position.x>40 and not control.Jump, "a validated drop may step beyond immediate ground")
    assert(control.Pick.SpeedLimit<bot:GetWalkSpeed(), "departure speed is matched to the landing distance")
    assert(learner:Diagnostic().Progress>=0, "a farther departure waypoint cannot manufacture backtracking")
    bot.airborne=true; bot.position=Vector(80,0,100); bot.velocity=Vector(60,0,-350); now=10.4; control=steer()
    assert(navigator:Diagnostic().Phase=="land" and control.Position and not control.Jump and memory.Totals.Successes==0)
    bot.airborne=false; bot.position=Vector(104,0,0); bot.velocity=Vector(0,0,0); now=10.6; steer()
    assert(memory.Totals.Goals==1 and memory.Passages[physics(bot).Key..":1>2"].Successes==1)
    assert(memory.Totals.Failures==0 and memory.Totals.Progress>0)
    assert(navigator:Diagnostic().Phase=="route", "completed landings do not leave a stale airborne phase")
`));

test("a new goal beyond the same descent retains crossing and its original failure deadline", () => run(setup + `
    local farther=newArea(3,400,0,0); platform.adjacent={farther}
    steer(); bot.position=Vector(16,0,200); now=10.2; steer()
    assert(navigator:Diagnostic().Phase=="cross")
    bot.position=Vector(40,0,200); now=10.4
    navigator:Steer(bot,farther.center,now,learner,false,"pursuit:2")
    assert(navigator:Diagnostic().Phase=="cross", "retargeting must not send a committed descent back to alignment")
    now=26
    navigator:Steer(bot,platform.center,now,learner,false,"pursuit:2")
    assert(navigator:Diagnostic().Reason=="stalled", "moving goals cannot indefinitely renew a stalled descent")
`));

test("descent risk follows live class immunity, gravity and remaining health, with bounded nonlethal damage", () => run(setup + `
    bot.fallDamage=true
    local state=physics(bot)
    assert(fallRisk(bot,200,state).Allowed)
    assert(not fallRisk(bot,500,state).Allowed and fallRisk(bot,500,state).Damage>0)
    bot.fallDamage=false; assert(fallRisk(bot,500,state).Allowed)
    assert(not fallRisk(bot,769,state).Allowed, "immunity does not allow unbounded drops")
    bot.fallDamage=true; bot.gravity=0.3; assert(fallRisk(bot,500,physics(bot)).Allowed)
    bot.gravity=1; bot.maxHealth=20000; bot.health=20000; assert(fallRisk(bot,500,physics(bot)).Allowed)
    bot.health=10; assert(not fallRisk(bot,500,physics(bot)).Allowed)
    bridge.center.z=500; bot.position=Vector(0,0,500)
    local route=routing.findPath(bot,platform.center,physics(bot),function() return 1 end)
    assert(route.Kind=="unreachable" and route.Detail.Reason=="fall" and route.Detail.From==1 and route.Detail.To==2)
`));

test("connections remain directed and unreachable route diagnostics distinguish coverage, height and obstacles", () => run(setup + `
    bridge.adjacent={}; platform.adjacent={bridge}
    local route=routing.findPath(bot,platform.center,physics(bot),function() return 1 end)
    assert(route.Kind=="unreachable" and route.Detail.Reason=="connection")
    bridge.adjacent={platform}; platform.blocked=true
    assert(routing.findPath(bot,platform.center,physics(bot),function() return 1 end).Detail.Reason=="obstacle")
    platform.blocked=false; platform.center.z=400
    assert(routing.findPath(bot,platform.center,physics(bot),function() return 1 end).Detail.Reason=="height")
    loaded=false; assert(routing.findPath(bot,platform.center,physics(bot),function() return 1 end).Detail.Reason=="missing")
`));

test("missing floor, steep support and blocked standing hulls reject a connected descent before stepping off", () => run(setup + `
    for _,kind in ipairs({"landing","slope","obstacle"}) do
        navigator:Reset(); learner:Cancel(); support=kind~="landing"; slope=kind=="slope" and 0.2 or 1; solid=kind=="obstacle"
        local control=steer()
        assert(not control.Position and navigator:Diagnostic().Reason==(kind=="obstacle" and "obstacle" or "landing"))
        now=now+0.2; control=steer(); assert(control.Unreachable and not control.Position)
        assert(memory.Totals.Attempts==0 and memory.Totals.Successes==0 and memory.Totals.Goals==0)
    end
`));

test("a rejected descent can replan through an existing alternative connection without inventing navmesh links", () => run(setup + `
    local bend=newArea(3,-120,0,200); bridge.adjacent={platform,bend}; bend.adjacent={platform}
    local original=util.TraceHull
    util.TraceHull=function(options)
        return {Hit=options.start.x>0 and options.endpos.x>0,Entity=emptyEntity,HitPos=options.endpos}
    end
    local control=steer(); assert(not control.Position and not control.Unreachable)
    now=10.2; control=steer()
    assert(control.Position and control.Position.x<0 and navigator.path[1].To==3)
    assert(#bridge.adjacent==2 and #bend.adjacent==1 and memory.Totals.Failures==0)
`));

test("overlapping floors find a valid exit direction instead of aiming straight down through the source floor", () => run(setup + `
    platform.center.x=0
    function platform:Contains(point) return math.abs(point.x)<=200 and math.abs(point.y)<=200 end
    function platform:GetClosestPointOnArea(point) return Vector(math.max(-200,math.min(200,point.x)),math.max(-200,math.min(200,point.y)),0) end
    local control=steer(); assert(control.Position and navigator:Diagnostic().Phase=="align")
    local path=navigator:Diagnostic().Path
    assert(path[7]>40 and path[10]>40 and path[12]==0, "exit and landing remain outside the bridge edge")
`));

test("long narrow bridges use the nearest departure edge instead of projecting toward a distant corner", () => run(setup + `
    function bridge:Contains(point) return math.abs(point.x)<=400 and math.abs(point.y)<=16 end
    function bridge:GetClosestPointOnArea(point) return Vector(math.max(-400,math.min(400,point.x)),math.max(-16,math.min(16,point.y)),200) end
    platform.center=Vector(40,120,0)
    local control=steer(); local path=navigator:Diagnostic().Path
    assert(control.Position and path[4]==40 and path[5]==-8 and path[7]==40 and path[8]>16)
`));

test("crouch-marked source and destination areas retain a forward crouch action through a validated descent", () => run(setup + `
    local motor=include("sv_bot_motor.lua")
    for _,marked in ipairs({bridge,platform}) do
        navigator:Reset(); learner:Cancel(); bot.position=Vector(0,0,200); bot.airborne=false
        function bridge:HasAttributes(attribute) return self==marked and attribute==NAV_MESH_CROUCH end
        function platform:HasAttributes(attribute) return self==marked and attribute==NAV_MESH_CROUCH end
        local control=steer()
        assert(control.Pick and control.Duck and not control.Jump, "alignment respects the required crouch")
        bot.position=Vector(16,0,200); now=now+0.2; control=steer()
        assert(navigator:Diagnostic().Phase=="cross")
        assert(control.Pick and control.Pick.Action=="duck" and control.Position.x>16,
            "crouching must not eliminate every action at the departure edge")
        assert(control.Duck and not control.Jump and not control.Pick.Sprint)
        local cmd=command()
        motor.apply(bot,cmd,{Senses={Visible=false,Allies=0,Enemies=0},Steering=control,Action="attack",Updated=now,ReadyAt=now},1,false)
        assert(cmd.buttons & IN_DUCK~=0 and cmd.forward>0 and cmd.buttons & IN_JUMP==0 and cmd.buttons & IN_SPEED==0)
        now=now+0.2
    end
`));

test("health loss before departure cancels an unsafe drop, while landing on the wrong floor is not completion", () => run(setup + `
    bridge.center.z=500; bot.position=Vector(0,0,500); bot.fallDamage=true; bot.maxHealth=20000; bot.health=20000
    assert(steer().Position)
    bot.health=10; now=10.2; assert(not steer().Position and navigator:Diagnostic().Reason=="fall")
    assert(memory.Totals.Goals==0)
    navigator:Reset(); learner:Cancel(); bot.fallDamage=false; bot.health=100; now=11
    steer(); bot.airborne=true; bot.position=Vector(80,0,100); now=11.2; steer()
    bot.airborne=false; now=11.4
    assert(not steer().Position and navigator:Diagnostic().Reason=="landing" and memory.Totals.Goals==0)
`));

test("navigation diagnostic transport validates reasons and detaches waypoint arrays", () => run(setup + `
    steer(); local detail=navigator:Diagnostic(); assert(ZPBotMotionProtocol.Navigation(detail))
    local first=detail.Path[1]; detail.Path[1]=999; assert(navigator:Diagnostic().Path[1]==first)
    detail=navigator:Diagnostic(); detail.Reason="unknown"; assert(not ZPBotMotionProtocol.Navigation(detail))
    detail=navigator:Diagnostic(); detail.Path[1]=0/0; assert(not ZPBotMotionProtocol.Navigation(detail))
    detail=navigator:Diagnostic(); detail.Damage=-1; assert(not ZPBotMotionProtocol.Navigation(detail))
    detail=navigator:Diagnostic(); detail.Path[13]=0; assert(not ZPBotMotionProtocol.Navigation(detail))
`));

test("controller exposes descent waypoints and credits landing before melee pursuit changes into dodging", () => run(setup + `
    local bots=include("sv_bots.lua").bots
    local human=newPlayer(TEAM_HUMANS,120,false); bots:Attach(bot,"aggressive")
    now=11; bots:Update(); local cmd=command(); bots:Command(bot,cmd)
    local packet=bots:Diagnostics(0,1); local motion=packet.Rows[1].Motion
    assert(motion.Navigation.Phase=="align" and motion.Navigation.From==1 and motion.Navigation.To==2)
    assert(cmd.forward>0 and cmd.forward<bot:GetWalkSpeed() and cmd.buttons & IN_SPEED==0)
    assert(#motion.Navigation.Path==12 and #motion.Path==0 and ZPBotMetricsProtocol.Snapshot(packet))
    bot.position=Vector(16,0,200); now=11.2; bots:Update(); bots:Command(bot,cmd)
    assert(cmd.forward>0 and cmd.buttons & IN_JUMP==0)
    bot.airborne=true; bot.position=Vector(80,0,100); bot.velocity=Vector(60,0,-350); now=11.4; bots:Update()
    assert(bots:Diagnostics(0,2).Rows[1].Motion.Navigation.Phase=="land")
    bot.airborne=false; bot.position=Vector(104,0,0); bot.velocity=Vector(0,0,0); now=11.6; bots:Update(); bots:Save()
    assert(bots:Diagnostics(0,3).Rows[1].Motion.Goals==0, "landing settlement retains its causal owner")
    now=11.85; bots:Update(); bots:Save()
    assert(bots:Diagnostics(0,4).Rows[1].Motion.Goals==1)
    local saved
    for path,text in pairs(files) do if path:find("/movement/",1,true) and path:match("/1.json$") then saved=jsonValues[text] end end
    assert(saved and saved.Memory.Passages[physics(bot).Key..":1>2"].Successes==1)
`));
