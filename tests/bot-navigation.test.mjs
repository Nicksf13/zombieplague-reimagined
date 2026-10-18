import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Navigator=include("sv_bot_navigation.lua").BotNavigator
local bot=newPlayer(TEAM_HUMANS,0)
local navigator=construct(Navigator)
`;

test("navigation follows connected areas around corners and excludes blocked or dangerous routes", () => run(setup + `
    loaded=true
    local start,bend,goal=newArea(1,0),newArea(2,0,200),newArea(3,400)
    start.adjacent={bend}; bend.adjacent={goal}
    local steering=navigator:Steer(bot,goal.center,now)
    assert(steering.Position and steering.Position.y>40 and math.abs(steering.Position.x)<1)
    navigator:Reset(); bend.blocked=true
    steering=navigator:Steer(bot,goal.center,now)
    assert(not steering.Position and steering.Unreachable and navigator:Status().Route=="none")
    navigator:Reset(); bend.blocked=false; bend.center.z=200
    steering=navigator:Steer(bot,goal.center,now)
    assert(not steering.Position and steering.Unreachable)
`));

test("local steering avoids cliffs and walls, permits low-obstacle jumps, and detects stalled movement", () => run(setup + `
    ground=false
    assert(not navigator:Steer(bot,Vector(400,0,0),now).Position)
    ground=true; blocked=true
    assert(not navigator:Steer(bot,Vector(400,0,0),now+1).Position)
    blocked=false; obstacle=true
    local jump=navigator:Steer(bot,Vector(400,0,0),now+2)
    assert(jump.Position and jump.Jump)
    obstacle=false
    local stalled=navigator:Steer(bot,Vector(400,0,0),now+3)
    assert(stalled.Stuck)
`));

test("NULL nav areas safely fall back to local steering without calling navigation methods", () => run(setup + `
    loaded=true
    navmesh.GetNearestNavArea=function() return {IsValid=function() return false end} end
    assert(not navigator:Wander(bot))
    local steering=navigator:Steer(bot,Vector(400,0,0),now)
    assert(steering.Position and not steering.Duck)
`));

test("path search has bounded work on cyclic graphs and missing navigation does not fabricate a route", () => run(setup + `
    assert(not navigator:Wander(bot))
    loaded=true
    local start,goal=newArea(1,0),newArea(2,10000)
    local previous=start
    for i=3,300 do
        local area=newArea(i,(i-2)*20,200)
        previous.adjacent={area,start}; previous=area
    end
    local steering=navigator:Steer(bot,goal.center,now)
    assert(steering.Position,"bounded search follows a reachable frontier")
    assert(#navigator.path>0 and navigator:Status().Route=="mesh","partial routes remain inside navigation")
    local wander=navigator:Wander(bot); assert(wander and wander.y==200,"wander uses an adjacent area")
`));
