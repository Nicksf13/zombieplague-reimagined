import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { boostSetup } from "./helpers/bot-boosts.mjs";

test("cooperative boosts require observed support contact, a real launch and grounded destination arrival", () => run(boostSetup + `
    savePoint(); assert(start()); assert(manager:Sessions()[1].Phase=="assemble")
    jumpFromSupport(); assert(manager.Store:Results()[1].Successes==0)
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,72); now=now+0.2
    assert(not manager:Control(climber,now) and #manager:Sessions()==0)
    assert(manager.Store:Results()[1].Successes==1 and manager.Store:Results()[1].Failures==0)
    manager:Save(); local reloaded=construct(Manager)
    assert(reloaded.Store:Results()[1].Successes==1 and #reloaded.Store:Points()==1)
`));

test("wrong-floor landings fail and cooldowns prevent immediate repeated boosts", () => run(boostSetup + `
    savePoint(); assert(start()); jumpFromSupport()
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,0); now=now+0.6
    assert(not manager:Control(climber,now) and manager.Store:Results()[1].Failures==1)
    assert(not start())
`));

test("freeze, infection, class/physics changes and disconnect cancel pending boosts neutrally", () => run(boostSetup + `
    savePoint()
    for _,kind in ipairs({"freeze","team","physics","cancel"}) do
        now=now+3; support.ducking=false; climber.position=Vector(-64,0,0); climber.team=TEAM_ZOMBIES; climber.jumpPower=200
        RoundManager.FreezeTimeActive=false; assert(start())
        if kind=="freeze" then RoundManager.FreezeTimeActive=true
        elseif kind=="team" then climber.team=TEAM_HUMANS
        elseif kind=="physics" then climber.jumpPower=400
        else manager:Cancel(climber) end
        assert(not manager:Control(climber,now) and #manager:Sessions()==0)
        assert(manager.Store:Results()[1].Successes==0 and manager.Store:Results()[1].Failures==0)
    end
`));

test("cooperative pairing excludes enemies, impossible class jumps, duplicate participants and missing support", () => run(boostSetup + `
    savePoint(); support.team=TEAM_HUMANS; assert(not start())
    now=now+3; support.team=TEAM_ZOMBIES; climber.jumpPower=50; assert(not start())
    now=now+3; climber.jumpPower=200; assert(start())
    assert(not manager:Start(support,Vector(64,0,72),{support,climber},now,point.ID))
    manager:Cancel(climber); now=now+3
    assert(not manager:Start(climber,Vector(64,0,72),{climber},now,point.ID))
`));

test("boost storage preserves malformed files and verified backups, and failed saves keep the live graph", () => run(boostSetup + `
    savePoint(); local path
    for name in pairs(files) do if name:find("/boosts/",1,true) then path=name end end
    local previous=files[path]; assert(manager.Store:Remove(point.ID)); assert(files[path..".bak.txt"]==previous)
    files[path]="broken"; local broken=construct(Manager)
    assert(not broken.Store:Put(point) and files[path]=="broken")
    files[path]=previous; local valid=construct(Manager); failWrite=true
    assert(not valid.Store:Remove(point.ID) and #valid.Store:Points()==1)
`));

test("automatic boosts join two separately reachable navmesh regions without editing native connections", () => run(boostSetup + `
    savePoint(); assert(#source.adjacent==0)
    assert(manager:Start(climber,Vector(64,0,72),{support,climber},now))
    assert(#source.adjacent==0 and #upper.adjacent==0)
`));

test("controller executes ordinary crouch and jump inputs and immediately suppresses a cancelled partner plan", () => run(boostSetup + `
    savePoint(); local bots=include("sv_bots.lua").bots
    bots:Attach(support,"cooperative"); bots:Attach(climber,"aggressive")
    assert(bots.Boosts:Start(climber,Vector(64,0,72),bots:ManagedPlayers(),now,point.ID))
    now=10.1; bots:Update(); local cmd=command(); bots:Command(support,cmd)
    assert(cmd.buttons & IN_DUCK~=0 and cmd.forward==0 and cmd.side==0, "support stays crouched on its actual position")
    support.ducking=true; now=10.4; bots:Update(); bots:Command(climber,cmd)
    assert(cmd.buttons & IN_JUMP~=0 and cmd.buttons & IN_SPEED==0 and cmd.forward>0)
    bots.Boosts:Cancel(support); bots:Command(climber,cmd)
    assert(cmd.buttons==0 and cmd.forward==0 and cmd.side==0, "a partner cannot execute a stale coordinated jump")
`));

test("boost outcomes stay separated by class pair, physics and map while learning-disabled trials retain counters", () => run(boostSetup + `
    savePoint(); assert(start()); jumpFromSupport()
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,72); now=now+0.2; manager:Control(climber,now)
    now=now+6; climber.position=Vector(-64,0,0); climber.zombieClass={ID="Heavy",Name="HeavyZombieClassName"}; climber.jumpPower=220
    values.zp_bot_learning=false; assert(start()); jumpFromSupport()
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,0); now=now+0.6; manager:Control(climber,now); manager:Save()
    local records
    for path,text in pairs(files) do if path:find("/boosts/",1,true) and path:match(".json$") then records=jsonValues[text].Records end end
    assert(#records==2 and records[1].Key~=records[2].Key)
    assert(records[1].Value>0 and records[2].Value==0 and records[2].Failures==1)
    mapName="gm_another"; local other=construct(Manager); assert(#other.Store:Points()==0)
`));

test("boost jump probes allow the predicted airborne crouch without bypassing a real overhead obstruction", () => run(boostSetup + `
    local actions=include("sv_bot_boost_actions.lua")
    climber.position=Vector(0,0,36)
    util.TraceHull=function(options) return {Hit=options.endpos.z<74,Entity=emptyEntity,HitPos=options.endpos} end
    local steering=actions.move(climber,support,Vector(64,0,72),true,false)
    assert(steering.Jump and steering.Pick and not steering.Duck, "takeoff leaves room for the subsequent airborne crouch")
    util.TraceHull=function(options) return {Hit=true,Entity=emptyEntity,HitPos=options.endpos} end
    assert(not actions.move(climber,support,Vector(64,0,72),true,false).Position)
`));

test("boost assembly closes the ordinary navigator's 40-unit arrival tolerance using precise grounded movement", () => run(boostSetup + `
    savePoint(); support.position=Vector(30,0,0); climber.position=Vector(-30,0,0); assert(start())
    local supportControl=manager:Control(support,now)
    assert(supportControl.Steering and supportControl.Steering.Position.x<30 and supportControl.Steering.Duck)
    local climberControl=manager:Control(climber,now)
    assert(climberControl.Steering and climberControl.Steering.Position.x < -30 and not climberControl.Steering.Jump)
    util.TraceLine=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    assert(not manager:Control(climber,now).Steering.Position, "precision approach cannot bypass a missing floor")
`));
