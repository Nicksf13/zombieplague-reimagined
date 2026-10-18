import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Navigator=include("sv_bot_navigation.lua").BotNavigator
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local physics=include("sv_bot_motion_physics.lua").physics
local actions=include("sv_bot_motion_actions.lua")
local motor=include("sv_bot_motor.lua")
RunShouldDrain=function(ply)
    return ply:GetWalkSpeed()~=ply:GetRunSpeed() and
        (cvars.Bool("zp_run_should_drain",false) or cvars.Bool("zp_realistic_mode",false))
end
local bot=newPlayer(TEAM_HUMANS,0)
local function surface(distance,recovery,jump,duck,drop,precision)
    return actions.options(bot,Vector(distance,0,0),physics(bot),recovery or false,jump or false,duck or false,false,nil,drop or false,precision)
end
local function preference(surface,action)
    for _,option in ipairs(surface.Options) do if option.Action==action then return option.Preference end end
end
local function steer()
    local navigator=construct(Navigator)
    local steering=navigator:Steer(bot,Vector(200,0,0),now)
    local cmd=command()
    motor.apply(bot,cmd,{Senses={Visible=false,Allies=0,Enemies=0},Steering=steering,Action="group",Updated=now,ReadyAt=now},1,false)
    return steering,cmd
end
`;

test("humans and zombies favor actual class sprint speed on ordinary free-stamina travel", () => run(setup + `
    for _,team in ipairs({TEAM_HUMANS,TEAM_ZOMBIES}) do
        bot.team=team; bot.breath=5; bot.runSpeed=420
        local steering,cmd=steer()
        assert(steering.Pick and steering.Pick.Sprint,"ordinary grouping should run without an explicit combat sprint request")
        assert(cmd.buttons & IN_SPEED~=0 and cmd.forward==420,"use the class run speed and normal sprint input")
    end
`));

test("either stamina mode preserves normal priorities even for zombies or zero drain rate", () => run(setup + `
    for _,team in ipairs({TEAM_HUMANS,TEAM_ZOMBIES}) do
        bot.team=team
        for _,flags in ipairs({{true,false},{false,true},{true,true}}) do
            values.zp_run_should_drain=flags[1]; values.zp_realistic_mode=flags[2]
            values.zp_run_drain=0
            local surface=surface(200)
            assert(preference(surface,"sprint")<preference(surface,"forward"),"either mode must disable the new sprint preference")
            local steering,cmd=steer()
            assert(not steering.Pick.Sprint and cmd.buttons & IN_SPEED==0)
        end
    end
    values.zp_run_drain=1; bot.team=TEAM_HUMANS; bot.breath=5
    assert(preference(surface(200),"sprint")==nil,"active stamina rules still reject exhausted sprint")
`));

test("free sprint does not override short adjustments, recovery, jumps, precision or class restrictions", () => run(setup + `
    for _,surface in ipairs({surface(64),surface(200,true),surface(200,false,true)}) do
        assert(preference(surface,"sprint")<preference(surface,"forward"))
    end
    assert(preference(surface(200,false,false,true),"sprint")==nil)
    assert(preference(surface(200,false,false,false,true),"sprint")==nil)
    assert(preference(surface(200,false,false,false,false,60),"sprint")==nil)
    bot.water=3; assert(preference(surface(200),"sprint")==nil); bot.water=0
    bot.moveType=MOVETYPE_LADDER; assert(preference(surface(200),"sprint")==nil); bot.moveType=2
    bot.airborne=true
    assert(preference(surface(200),"sprint")<preference(surface(200),"forward")); bot.airborne=false
    obstacle=true
    local obstructed=surface(200)
    assert(obstructed.Obstacle and preference(obstructed,"sprint")==nil)
    obstacle=false; bot.runSpeed=bot:GetWalkSpeed()
    local steering,cmd=steer()
    assert(not steering.Pick.Sprint and cmd.buttons & IN_SPEED==0,"classes unable to run faster retain walking")
`));

test("existing bounded walking estimates cannot keep eligible free running slow", () => run(setup + `
    local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory)
    local frame={Key="old",Edge="edge",Mode="ground",From=1,To=2,Position=bot:GetPos(),
        Remaining=200,RouteRemaining=200,Speed=200,Breath=100,Drain=false,Dynamic=false,
        Goal=Vector(200,0,0),Completed=false,Final=false,Path={0,0,0,200,0,0}}
    memory.Estimates["old:forward"]={Value=1,Samples=100}
    memory.Estimates["old:sprint"]={Value=-1,Samples=100}
    local selected=learner:Choose(frame,surface(200).Options,now)
    assert(selected.Sprint,"free sprint should beat old walking bias without clearing learned data")
    assert(memory.Estimates["old:forward"].Samples==100 and memory.Estimates["old:sprint"].Samples==100)
`));
