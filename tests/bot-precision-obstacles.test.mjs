import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local bot=newPlayer(TEAM_ZOMBIES,1101.828125)
bot.position=Vector(1101.828125,-551.141357,128.03125)
local precision=construct(include("sv_bot_precision.lua").BotPrecisionTraversal)
local physical=include("sv_bot_motion_physics.lua")
local function rectangle(id,x1,x2,y1,y2,z)
    local area=newArea(id,(x1+x2)/2,(y1+y2)/2,z)
    function area:Contains(p) return p.x>=x1 and p.x<=x2 and p.y>=y1 and p.y<=y2 end
    function area:GetClosestPointOnArea(p) return Vector(math.max(x1,math.min(x2,p.x)),math.max(y1,math.min(y2,p.y)),z) end
    return area
end
local source=rectangle(16,1100,1325,-750,-325,128.03125)
local target=rectangle(695,1100,1325,-775,-750,128.03125)
local step={From=16,To=695,Source=source,Area=target,Position=target.center}
-- Bounds of the world railing brush 106 in the local zm_canals BSP.
local low,high=Vector(1088,-768,128),Vector(1092,-576,160)
local missing=false
local blocker
util.TraceHull=function(options)
    if blocker then return {Hit=true,Entity=blocker,HitPos=options.endpos} end
    local enter,leave,normal,inside=0,1,Vector(0,0,1),true
    for _,axis in ipairs({"x","y","z"}) do
        local a=low[axis]-options.maxs[axis]; local b=high[axis]-options.mins[axis]
        local start=options.start[axis]; local delta=options.endpos[axis]-start
        if start<a or start>b then inside=false end
        if math.abs(delta)<0.000001 then
            if start<a or start>b then return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
        else
            local first,last=(a-start)/delta,(b-start)/delta
            local sign=-1
            if first>last then first,last=last,first; sign=1 end
            if first>enter then enter=first; normal=Vector(0,0,0); normal[axis]=sign end
            leave=math.min(leave,last)
            if enter>leave then return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
        end
    end
    local hit=enter<=leave and leave>=0 and enter<=1
    local fraction=inside and 0 or enter
    return {Hit=hit,HitWorld=hit,StartSolid=inside,Entity=emptyEntity,HitNormal=normal,Fraction=fraction,
        HitPos=Vector(options.start.x+(options.endpos.x-options.start.x)*fraction,
            options.start.y+(options.endpos.y-options.start.y)*fraction,options.start.z+(options.endpos.z-options.start.z)*fraction)}
end
util.TraceLine=function(options)
    local z=bot.position.z
    return {Hit=not missing and options.start.z>=z and options.endpos.z<=z,Entity=emptyEntity,
        HitPos=Vector(options.start.x,options.start.y,z),HitNormal=Vector(0,0,1)}
end
local function control() return precision:Control(bot,step,physical.physics(bot),false,now,true) end
`;

test("the canals railing corner is cleared sideways before advancing through the doorway", () => run(setup + `
    local result=control()
    assert(result.Surface.Options[1] and result.Target.x==1124 and result.Target.y==bot.position.y,
        "align the whole hull with the clear passage before advancing past the railing")
    bot.position=Vector(1110,-551.141357,128.03125); now=10.2
    result=control(); assert(result.Target.y==bot.position.y,"retain the chosen corner while approaching it")
    bot.position=Vector(1124,-551.141357,128.03125); now=10.4
    result=control(); assert(result.Surface.Options[1] and result.Target.y<bot.position.y)
`));

test("navigation can select a local corner approach while the narrow destination is still far away", () => run(setup + `
    loaded=true; source.adjacent={target}
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    local result=navigator:Steer(bot,target.center,now)
    assert(result.Precision and result.Pick and result.Position.x==1124 and result.Position.y==bot.position.y)
`));

test("the canals building corner is cleared in the other axis before entering the shared span", () => run(setup + `
    low=Vector(768,-320,0); high=Vector(1632,0,128)
    source=rectangle(665,750,800,-350,-325,0)
    target=rectangle(806,800,825,-375,-325,0)
    step={From=665,To=806,Source=source,Area=target,Position=target.center}
    bot.position=Vector(750.38739,-332.4068,0)
    local result=control()
    assert(result.Surface.Options[1] and result.Target.x==bot.position.x and result.Target.y==-337.5)
    bot.position=Vector(750.38739,-337.5,0); now=10.2
    result=control(); assert(result.Target.x>bot.position.x and result.Surface.Options[1])
`));

test("precision corner alignment never bypasses a player or missing floor", () => run(setup + `
    missing=true; assert(#control().Surface.Options==0)
    missing=false; blocker=newPlayer(TEAM_ZOMBIES,1120)
    function blocker:GetClass() return "player" end
    local result=control(); assert(result.Surface.Dynamic and #result.Surface.Options==0)
`));

test("jump decisions use the local sloped entry height when its center is lower", () => run(botSetup + `
    loaded=true
    local source,rail=newArea(19,1212.5,-900,213),newArea(864,1090,-896,224)
    function source:Contains(p) return p.x>=1100 and p.x<=1325 and p.y>=-1025 and p.y<=-775 end
    function source:GetClosestPointOnArea(p) return Vector(math.max(1100,math.min(1325,p.x)),math.max(-1025,math.min(-775,p.y)),213) end
    function rail:Contains(p) return p.x>=1088 and p.x<=1092 and p.y>=-1024 and p.y<=-768 end
    function rail:GetClosestPointOnArea(p)
        local y=math.max(-1024,math.min(-768,p.y))
        return Vector(math.max(1088,math.min(1092,p.x)),y,288-(y+1024)*0.5)
    end
    source.adjacent={rail}
    local bot=newPlayer(TEAM_ZOMBIES,1115); bot.position=Vector(1115,-922,213)
    util.TraceHull=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    util.TraceLine=function(options)
        return {Hit=true,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,224),HitNormal=Vector(0,0,1)}
    end
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    local result=navigator:Steer(bot,rail.center,now)
    assert(result.Pick and result.Jump and not result.Precision,
        "a center only eleven units above cannot hide the twenty-four-unit local entry")
`));
