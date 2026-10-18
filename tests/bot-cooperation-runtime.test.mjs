import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

test("controller negotiates a blocking ally and applies yielding inputs without teaching a failed retreat", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local a,b=newPlayer(TEAM_ZOMBIES,0),newPlayer(TEAM_ZOMBIES,50)
    function playerMeta:GetClass() return "player" end
    newPlayer(TEAM_HUMANS,250,false)
    util.TraceHull=function(options)
        if options.filter==a and options.endpos.x>options.start.x then return {Hit=true,Entity=b,HitPos=options.endpos} end
        return {Hit=false,Entity=emptyEntity,HitPos=options.endpos}
    end
    bots:Attach(a,"aggressive"); bots:Attach(b,"aggressive"); now=11; bots:Update()
    local first,second=command(),command(); bots:Command(a,first); bots:Command(b,second)
    assert(first.forward==0 and first.side==0)
    assert(math.abs(second.side)>0,"the blocking managed ally actually receives a yield movement")
    assert(bots:Diagnostics(0,1).Rows[2].Totals.Actions.retreat.Negative==0)
    bots:Remove(a); assert(not bots.traffic:Control(b,now))
`));

test("only applied hostile ranged damage activates defensive facing in the controller", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local zombie=newPlayer(TEAM_ZOMBIES,0); zombie.maxHealth=1000; zombie.health=1000
    local enemy=newPlayer(TEAM_HUMANS,300,false); local ally=newPlayer(TEAM_ZOMBIES,-300,false)
    bots:Attach(zombie,"aggressive"); now=11; bots:Update()
    local guard=bots.bots[1].Guard
    bots:Damage(zombie,damage(enemy,100),false); assert(not guard:Look(zombie,now))
    bots:Damage(zombie,damage(ally,100),true); assert(not guard:Look(zombie,now))
    enemy.weapon=newWeapon(-1); bots:Damage(zombie,damage(enemy,100),true); assert(not guard:Look(zombie,now))
    enemy.weapon=newWeapon(30); bots:Damage(zombie,damage(enemy,100),true); assert(guard:Look(zombie,now))
    local cmd=command(); bots:Command(zombie,cmd); assert(cmd.buttons & IN_ATTACK==0 and zombie.angles.y<0)
    bots:Reset(zombie); assert(not guard:Look(zombie,now))
`));
