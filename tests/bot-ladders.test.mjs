import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local control=include("sv_bot_ladder.lua")
local motion=include("sv_bot_motion_actions.lua")
local physics=include("sv_bot_motion_physics.lua").physics
local motor=include("sv_bot_motor.lua")
local bot=newPlayer(TEAM_HUMANS,0)
local bottom,top=newArea(1,0),newArea(2,80,0,220)
local null={IsValid=function() return false end}
local normal=Vector(-1,0,0)
local ladder={IsValid=function() return true end,GetID=function() return 1 end,GetNormal=function() return normal end,
    GetBottom=function() return Vector(0,0,0) end,GetTop=function() return Vector(0,0,320) end,
    GetBottomArea=function() return bottom end,GetTopForwardArea=function() return top end,
    GetTopBehindArea=function() return null end,GetTopLeftArea=function() return null end,GetTopRightArea=function() return null end}
bottom.ladders={ladder}; top.ladders={ladder}
local up={Position=top.center,Area=top,From=1,To=2,Ladder=ladder}
local down={Position=bottom.center,Area=bottom,From=2,To=1,Ladder=ladder}
local function apply(pick)
    local cmd=command()
    motor.apply(bot,cmd,{Steering={Position=pick.Position,Pick=pick,Jump=false,Duck=pick.Duck,Use=false,Stuck=false},
        Senses={Visible=false,Allies=0,Enemies=0},Action="group",Updated=now,ReadyAt=now},1,false)
    return cmd
end
`;

test("descending approaches the source floor edge even when the ladder endpoint extends above the landing", () => run(setup + `
    bot.position=Vector(100,0,220)
    local approach=control.steer(bot,down,32)
    assert(approach.Target.x==40 and approach.Target.z==220 and not approach.Aim)
    bot.position=Vector(60,0,220)
    local attach=control.steer(bot,down,32)
    assert(attach.Aim and attach.Aim.z<bot:EyePos().z)
`));

test("attached climbing faces the ladder normal in either orientation and waits for turn alignment", () => run(setup + `
    normal=Vector(1,0,0); bot.moveType=MOVETYPE_LADDER; bot.airborne=true; bot.position=Vector(0,0,100)
    local steering=control.steer(bot,up,32); assert(steering.Aim.x<0)
    local surface=motion.options(bot,steering.Target,physics(bot),false,false,false,false,steering.Aim)
    local pick=surface.Options[1]; assert(pick and pick.Action=="climb" and not pick.Sprint)
    local cmd=apply(pick); assert(cmd.forward==0 and cmd.side==0, "turn before moving on the ladder")
    for i=1,20 do cmd=apply(pick) end
    assert(cmd.forward>0 and cmd.side==0 and cmd.buttons & IN_FORWARD~=0 and cmd.buttons & IN_SPEED==0)
`));

test("ladder exit uses the destination floor height and permits crouching through a low landing", () => run(setup + `
    bot.moveType=MOVETYPE_LADDER; bot.airborne=true; bot.position=Vector(0,0,210)
    local exit=control.steer(bot,up,32)
    assert(exit.Target.z==220 and exit.Aim.z==284, "exit toward the real floor rather than waiting for endpoint height 320")
    local surface=motion.options(bot,exit.Target,physics(bot),false,false,true,false,exit.Aim)
    local pick=surface.Options[1]; assert(pick and pick.Action=="climb" and pick.Duck)
    local cmd=apply(pick); assert(cmd.buttons & IN_DUCK~=0)
    local prop={IsPlayer=function() return false end,GetClass=function() return "prop_physics" end,EntIndex=function() return 99 end}
    util.TraceHull=function(options) return {Hit=true,Entity=prop,HitPos=options.endpos} end
    surface=motion.options(bot,exit.Target,physics(bot),false,false,true,false,exit.Aim)
    assert(surface.Dynamic and #surface.Options==0, "temporary props still block ladder commands")
`));
