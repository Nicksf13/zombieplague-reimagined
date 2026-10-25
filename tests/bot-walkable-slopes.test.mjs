import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local bot=newPlayer(TEAM_ZOMBIES,0)
local actions=include("sv_bot_motion_actions.lua")
local physics=include("sv_bot_motion_physics.lua").physics
local support=include("sv_bot_precision_support.lua")
local slope=0.4
local wall=false
local ceiling=1000
local hole=false
local occupant=false
util.TraceHull=function(options)
    if occupant and options.endpos.x>options.start.x then
        return {Hit=true,Entity=occupant,HitPos=options.endpos}
    end
    local z=slope*options.endpos.x
    local hit=(wall and options.endpos.x>options.start.x) or options.endpos.z+options.maxs.z>ceiling or options.endpos.z<z
    return {Hit=hit,HitWorld=hit,Entity=emptyEntity,
        HitPos=Vector(options.endpos.x,options.endpos.y,hit and z or options.endpos.z),HitNormal=Vector(-slope,0,1)}
end
util.TraceLine=function(options)
    local z=slope*options.start.x
    local hit=not (hole and options.start.x>7 and options.start.x<13) and options.start.z>=z and options.endpos.z<=z
    return {Hit=hit,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,z),HitNormal=Vector(-slope,0,1)}
end
local function surface()
    return actions.options(bot,Vector(100,0,40),physics(bot),false,false,false,false,nil,false,80)
end
`;

test("precision planning permits a supported ramp that intersects a flat hull sweep", () => run(setup + `
    local result=surface()
    assert(#result.Options>0 and not result.Obstacle,"a walkable rise must not be mistaken for an impassable wall")
    assert(not result.Options[1].Jump and not result.Options[1].Sprint)
`));

test("per-command collision safety also permits the same supported walking rise", () => run(setup + `
    local input=support.drive(bot,Vector(100,0,40),100)
    assert(input.x>0 and input.y==0,"the motor must not brake a planner-approved ordinary rise")
`));

test("step validation preserves ceilings, walls, intermediate holes and player collision", () => run(setup + `
    wall=true; assert(#surface().Options==0)
    wall=false; ceiling=50; assert(#surface().Options==0,"raised sweep needs full headroom, including ducking")
    ceiling=1000; hole=true; assert(#surface().Options==0,"step clearance cannot replace continuous floor support")
    hole=false; occupant=newPlayer(TEAM_ZOMBIES,20)
    function occupant:GetClass() return "player" end
    assert(#surface().Options==0,"players cannot be ignored by step validation")
`));

test("walking validation respects the player's own step limit and does not run in the air", () => run(setup + `
    bot.stepSize=2; assert(#surface().Options==0)
    bot.stepSize=6; assert(#surface().Options==0,"the four-unit trace clearance must not increase actual step reach")
    bot.stepSize=18; bot.airborne=true
    local input=support.drive(bot,Vector(100,0,40),100)
    assert(input.x==0,"airborne collision cannot be reinterpreted as a grounded step")
`));
