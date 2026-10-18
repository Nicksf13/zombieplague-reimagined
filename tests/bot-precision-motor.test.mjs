import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { precisionSetup } from "./helpers/bot-precision.mjs";

test("precision inputs counter lateral drift and brake excess forward velocity through ordinary movement", () => run(precisionSetup + `
    local control=steer(); bot.velocity=Vector(0,20,0)
    local move,cmd=input(control)
    assert(move.x>0 and move.y<0 and cmd.buttons & IN_SPEED==0 and cmd.buttons & IN_JUMP==0)
    bot.velocity=Vector(220,0,0); move=input(control); assert(move.x<0,"brake overspeed before it reaches the corner")
    bot.position=Vector(230,0,0); bot.velocity=Vector(60,0,0)
    control.Position=Vector(232,0,0); move=input(control); assert(move.x<0,"recompute stopping input on every tick")
`));

test("per-command safety cancels a stale plan when the floor or player occupancy changes", () => run(precisionSetup + `
    local control=steer()
    floorOverride=function(p) return p.x<84 and floor(p) end
    local move=input(control); assert(move.x==0 and move.y==0)
    floorOverride=nil
    local blocker=newPlayer(TEAM_ZOMBIES,90)
    hullOverride=function(options) return {Hit=options.endpos.x>options.start.x,Entity=blocker,HitPos=options.endpos} end
    move=input(control); assert(move.x==0 and move.y==0)
    hullOverride=nil; move=input(control); assert(move.x>0)
`));

test("waiting in precision mode brakes without moving targets and never steers a stale plan in the air", () => run(precisionSetup + `
    bot.velocity=Vector(50,0,0)
    local move=input({Precision=true,Jump=false,Duck=false,Use=false,Stuck=true})
    assert(move.x<0 and move.y==0)
    local control=steer(); bot.airborne=true
    move=input(control); assert(move.x==0 and move.y==0)
`));

test("a simulated inertial player completes both directions of the two narrow right-angle turns", () => run(precisionSetup + `
    for _,reverse in ipairs({false,true}) do
        navigator:Reset(); learner:Cancel()
        goal=reverse and Vector(40,0,0) or Vector(440,192,0)
        bot.position=reverse and Vector(440,192,0) or Vector(40,0,0); bot.velocity=Vector(0,0,0)
        local control
        for tick=1,2000 do
            now=now+0.05
            if tick%4==1 then control=steer() end
            local move=input(control)
            -- A bounded acceleration approximation exercises command/plan timing, not Source physics.
            bot.velocity=Vector(bot.velocity.x+(move.x-bot.velocity.x)*0.5,bot.velocity.y+(move.y-bot.velocity.y)*0.5,0)
            bot.position=Vector(bot.position.x+bot.velocity.x*0.05,bot.position.y+bot.velocity.y*0.05,0)
            assert(floor(bot.position),"the simulated player left the supported course")
            if bot.position:DistToSqr(goal)<1600 then break end
        end
        assert(bot.position:DistToSqr(goal)<1600,"the route must complete instead of stopping indefinitely")
    end
`));
