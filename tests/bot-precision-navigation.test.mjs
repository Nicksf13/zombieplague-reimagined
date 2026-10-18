import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { precisionSetup } from "./helpers/bot-precision.mjs";

test("precision starts before a straight movement becomes unsafe and aligns with the center of a narrow corner", () => run(precisionSetup + `
    local control=steer()
    assert(control.Precision and control.Pick and control.Pick.Precision)
    assert(control.Position.x==232 and control.Position.y==0 and navigator:Diagnostic().Phase=="align")
    assert(control.Pick.SpeedLimit<=80 and not control.Pick.Sprint and not control.Pick.Jump)
    bot.position=Vector(224,0,0); now=10.2; control=steer()
    assert(control.Position.y==0 and control.Pick.SpeedLimit<=32,"brake before changing direction")
    bot.position=Vector(231,0,0); now=10.4; control=steer()
    assert(control.Position.x==232 and control.Position.y>8 and navigator:Diagnostic().Phase=="cross")
    bot.position=Vector(232,12,0); now=10.6; control=steer()
    assert(control.Position.x==232 and control.Position.y==192,"follow the next beam instead of cutting the second corner")
`));

test("a bot near the lateral edge recenters before advancing and can recover inward", () => run(precisionSetup + `
    bot.position=Vector(80,7,0)
    local control=steer(); assert(control.Pick and control.Position.x==80 and control.Position.y==0)
    local move=input(control); assert(move.y<0 and math.abs(move.x)<0.001)
    bot.position=Vector(80,3,0); now=10.2; control=steer()
    assert(control.Pick and control.Position.x==232 and control.Position.y==0)
`));

test("precision floor samples reject intermediate holes and a lower floor even when the endpoint is supported", () => run(precisionSetup + `
    floorOverride=function(p) return floor(p) and not (p.x>87 and p.x<93) end
    assert(not support.supported(bot,Vector(80,0,0),Vector(104,0,0)))
    local control=steer(); assert(control.Precision and not control.Pick and navigator:Diagnostic().Reason=="ground")
    util.TraceLine=function(options) return {Hit=true,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,-64)} end
    assert(not steer().Pick)
`));

test("a persistent static obstruction permits only a short previously validated retreat", () => run(precisionSetup + `
    precision:Control(bot,step,physics(bot),false,now)
    bot.position=Vector(96,0,0); now=10.2; precision:Control(bot,step,physics(bot),false,now)
    hullOverride=function(options) return {Hit=options.endpos.x>options.start.x,Entity=emptyEntity,HitPos=options.endpos} end
    now=11.6
    local control=precision:Control(bot,step,physics(bot),false,now)
    assert(control.Surface.Options[1] and control.Surface.Options[1].Action=="back")
    assert(control.Target.x==80 and not control.Surface.Options[1].Jump and not control.Surface.Options[1].Sprint)
    floorOverride=function(p) return floor(p) and p.x>=92 end
    now=11.8; control=precision:Control(bot,step,physics(bot),false,now)
    assert(#control.Surface.Options==0,"a once-safe retreat must be checked again")
`));

test("temporary player occupancy waits and cannot cause exploratory escape or permanent passage failures", () => run(precisionSetup + `
    local blocker=newPlayer(TEAM_ZOMBIES,100)
    function blocker:GetClass() return "player" end
    hullOverride=function(options) return {Hit=true,Entity=blocker,HitPos=options.endpos} end
    for i=1,60 do now=10+i*0.2; local control=steer(); assert(control.Precision and not control.Pick) end
    assert(not learner.Replan and learner:Diagnostic().Failures==0)
    hullOverride=nil; now=23; assert(steer().Pick)
`));

test("wide supported areas, jumps, ladders and airborne motion retain their existing traversal", () => run(precisionSetup + `
    local wide=rectangle(4,600,900,-100,100); bot.position=Vector(700,0,0)
    floorOverride=function() return true end
    assert(not precision:Control(bot,{From=4,To=4,Area=wide,Position=Vector(800,0,0)},physics(bot),false,now))
    bot.position=Vector(80,0,0); bot.airborne=true
    assert(not precision:Control(bot,step,physics(bot),false,now)); bot.airborne=false
    function b:HasAttributes(flag) return flag==NAV_MESH_JUMP end
    assert(not precision:Control(bot,step,physics(bot),false,now))
    function b:HasAttributes() return false end
    step.Ladder={}; assert(not precision:Control(bot,step,physics(bot),false,now))
`));

test("physical floor probes anticipate narrowing even when the nav area itself is wide", () => run(precisionSetup + `
    local wide=rectangle(4,600,900,-100,100); bot.position=Vector(700,0,0)
    floorOverride=function(p) return p.x<716 or math.abs(p.y)<=8 end
    local control=precision:Control(bot,{From=4,To=4,Area=wide,Position=Vector(800,0,0)},physics(bot),false,now)
    assert(control and control.Surface.Options[1] and control.Surface.Options[1].Precision)
    assert(control.SpeedLimit<=80,"slow before the footprint reaches the narrow section")
`));

test("precision keeps validated crouching through low headroom, including the per-command hull check", () => run(precisionSetup + `
    function b:HasAttributes(flag) return flag==NAV_MESH_CROUCH end
    hullOverride=function(options) return {Hit=options.maxs.z>36,Entity=emptyEntity,HitPos=options.endpos} end
    local control=steer()
    assert(control.Pick and control.Duck and control.Pick.Precision and not control.Pick.Jump)
    local move,cmd=input(control)
    assert(move.x>0 and cmd.buttons & IN_DUCK~=0 and cmd.buttons & IN_SPEED==0)
`));
