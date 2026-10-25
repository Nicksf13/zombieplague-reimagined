import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { precisionSetup } from "./helpers/bot-precision.mjs";

test("alignment accepts a small nav-floor height offset without waiting below the player's feet", () => run(precisionSetup + `
    bot.position=Vector(232,0,8)
    local control=steer()
    assert(control.Pick and control.Position.y>8 and navigator:Diagnostic().Phase=="cross",
        "horizontal alignment must advance when the nav surface is slightly below the physical floor")
`));

test("alignment still rejects an overlapping point on a different floor", () => run(precisionSetup + `
    local ground=construct(include("sv_bot_ground.lua").BotGroundTraversal)
    bot.position=Vector(232,0,64)
    local control=ground:Control(bot,step,32,100,true,4)
    assert(control and control.Phase=="align")
`));

test("an obstructed precision plan exposes the rejected hull segment for incident recordings", () => run(precisionSetup + `
    hullOverride=function(options) return {Hit=true,HitWorld=true,StartSolid=false,Entity=emptyEntity,HitPos=options.endpos} end
    local control=steer()
    assert(not control.Pick and control.Probe and control.Probe.World and control.Probe.Class=="worldspawn")
    assert(control.Probe.Start[1]==bot.position.x and control.Probe.End[1]>bot.position.x)
    assert(control.Waypoint and control.Waypoint.x==232 and control.Waypoint.y==0,
        "traffic still needs the local alignment waypoint when collision prevents a movement choice")
`));

test("crossing a narrow source edge does not recenter backwards before reaching the next area", () => run(precisionSetup + `
    bot.position=Vector(232,0,0); steer()
    bot.position=Vector(232,6,0); now=10.2
    local control=steer()
    assert(control.Pick and control.Position.y>8 and navigator:Diagnostic().Phase=="cross")
`));

test("retargeting through the same passage retains crossing instead of returning to alignment", () => run(precisionSetup + `
    bot.position=Vector(232,0,0)
    local first=steer(); assert(first.Position.y>8 and navigator:Diagnostic().Phase=="cross")
    bot.position=Vector(232,6,0); now=10.2
    goal=Vector(300,192,0)
    local next=steer()
    assert(next.Pick and next.Position.y>8, "a moving destination must not send the bot backwards to the old alignment point")
    assert(navigator:Diagnostic().Phase=="cross")
`));

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
    assert(control.SupportProbe and control.SupportProbe.Reason=="missing" and control.SupportProbe.Sample[1]>87)
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

test("a distant narrow target does not slow a wide supported approach before the braking zone", () => run(precisionSetup + `
    local wide=rectangle(4,600,900,-100,100)
    local seam=rectangle(5,900,1100,-125,-100)
    local step={From=4,To=5,Source=wide,Area=seam,Position=seam.center}
    floorOverride=function() return true end
    bot.position=Vector(700,0,0)
    assert(not precision:Control(bot,step,physics(bot),false,now),"keep ordinary speed while the narrow transition is far away")
    bot.position=Vector(880,-80,0); now=10.2
    local control=precision:Control(bot,step,physics(bot),false,now)
    assert(control and control.SpeedLimit<=80,"still brake when entering the narrow transition's approach")
`));

test("a grounded hull overlapping a beam can recenter even when its origin is outside the nav area", () => run(precisionSetup + `
    bot.position=Vector(80,20,0)
    local contactEnabled=true
    hullOverride=function(options)
        if options.maxs.z==0 then
            local contact=contactEnabled and options.start.y+options.mins.y<=8 and options.start.y+options.maxs.y>=-8
            return {Hit=contact,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,0),HitNormal=Vector(0,0,1)}
        end
        return {Hit=false,Entity=emptyEntity,HitPos=options.endpos}
    end
    local control=steer()
    assert(control.Pick and control.Pick.EdgeRecovery and control.Position.x==80 and control.Position.y==0)
    local move=input(control)
    assert(move.y<0 and math.abs(move.x)<0.001,"per-command safety must allow the same short inward correction")
    contactEnabled=false
    assert(not steer().Pick,"native grounded state alone cannot replace actual footprint contact")
    contactEnabled=true
    floorOverride=function() return false end
    assert(not steer().Pick,"a missing destination floor must still reject recovery")
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
