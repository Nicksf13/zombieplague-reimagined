import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

test("short-reach melee keeps approaching a human outside actual fist contact", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua")
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1); bot.weapon.HitDistance=40
    local position=Vector(55,0,0)
    local request=motor.request(bot,{Visible=true,EnemyPosition=position},"attack","aggressive")
    assert(request.Move=="approach", "a forty-unit fist must not stop at fifty-five units")
`));

test("a player at the end of a hull sweep still allows the collision-free prefix of ordinary movement", () => run(botSetup + `
    local actions=include("sv_bot_motion_actions.lua")
    local physics=include("sv_bot_motion_physics.lua").physics
    local bot=newPlayer(TEAM_ZOMBIES,0); local human=newPlayer(TEAM_HUMANS,55,false)
    util.TraceHull=function(options)
        local crossing=options.endpos.x>23
        return {Hit=crossing,Entity=crossing and human or emptyEntity,Fraction=crossing and 23/options.endpos.x or 1,HitPos=Vector(23,0,4)}
    end
    local surface=actions.options(bot,human:GetPos(),physics(bot),false,false,false,false)
    local forward
    for _,option in ipairs(surface.Options) do if option.Action=="forward" then forward=option end end
    assert(forward and forward.Position.x>4 and forward.Position.x<23, "a future collision must not prevent all approach input")
    assert(surface.Dynamic and surface.Blocker==human)
`));

test("search crosses small nav areas instead of repeatedly choosing already-arrived neighbors", () => run(botSetup + `
    loaded=true
    local a,b,c,d=newArea(1,0),newArea(2,20),newArea(3,40),newArea(4,180)
    a.adjacent={b}; b.adjacent={a,c}; c.adjacent={b,d}; d.adjacent={c}
    local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
    local bot=newPlayer(TEAM_ZOMBIES,0)
    local goal=navigator:Wander(bot)
    assert(goal and bot:GetPos():DistToSqr(goal)>80*80, "search must choose a destination outside arrival tolerance")
`));

test("minor distance changes between two visible humans do not continually restart target reaction", () => run(botSetup + `
    local perception=construct(include("sv_bot_perception.lua").BotPerception)
    local bot=newPlayer(TEAM_ZOMBIES,0)
    local first,second=newPlayer(TEAM_HUMANS,300,false),newPlayer(TEAM_HUMANS,310,false)
    assert(perception:Observe(bot,players,now).Target==first)
    first.position=Vector(316,0,0)
    assert(perception:Observe(bot,players,now+0.2).Target==first, "a six-unit distance reversal should not cancel reaction")
    second.position=Vector(60,0,0)
    assert(perception:Observe(bot,players,now+0.4).Target==second, "a materially closer threat still takes priority")
`));

test("an actual close-contact plan uses a smaller arrival tolerance and closes the fist distance before holding", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1); bot.weapon.HitDistance=40; bot.weapons={bot.weapon}
    local human=newPlayer(TEAM_HUMANS,55,false)
    util.TraceHull=function(options)
        local dx=options.endpos.x-options.start.x
        local free=human.position.x-options.start.x-32
        local fraction=dx>0 and math.max(0,math.min(1,free/dx)) or 1
        return {Hit=fraction<1,Entity=fraction<1 and human or emptyEntity,Fraction=fraction,StartSolid=free<0,HitPos=options.endpos}
    end
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.forward>0, "the arrival radius must not suppress the remaining melee approach")
    for i=1,2 do
        bot.position=Vector(math.min(human.position.x-32,bot.position.x+math.max(0,cmd.forward)*engine.TickInterval()),0,0)
        now=11+i*0.25; bots:Update(); bots:Command(bot,cmd)
    end
    assert(human.position.x-bot.position.x<=34)
    assert(cmd.buttons & IN_ATTACK~=0, "a grounded contact must be allowed to attack without navigation movement")
    local direction=bot:GetAimVector(); local endX=bot:EyePos().x+direction.x*40
    assert(endX>=human.position.x-16, "the native fist trace can actually reach the target hull")
`));

test("a nearby visible human is not forgotten just because a navmesh connection is missing", () => run(botSetup + `
    loaded=true; local a,b=newArea(1,0),newArea(2,60); a.adjacent={}; b.adjacent={}
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1)
    newPlayer(TEAM_HUMANS,60,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    assert(bots.bots[1].Plan.Senses.Visible and bots.bots[1].Plan.Senses.Target, "navigation failure cannot erase a visible contact")
`));

test("search visit memory avoids immediately bouncing to the area it just left", () => run(botSetup + `
    loaded=true; math.random=function(low,high) return low end
    local a,b,c=newArea(1,0),newArea(2,180),newArea(3,380)
    a.adjacent={b}; b.adjacent={a,c}; c.adjacent={b}
    local search=construct(include("sv_bot_search.lua").BotSearch)
    local bot=newPlayer(TEAM_ZOMBIES,0)
    search:Choose(bot,now); bot.position=Vector(180,0,0)
    local goal=search:Choose(bot,now+1)
    assert(goal and goal.x>180, "an unvisited continuation outranks the recently visited source")
`));

test("search excludes blocked areas, impossible climbs and unsafe drops while remaining bounded", () => run(botSetup + `
    loaded=true; local start,high,blockedArea,dry=newArea(1,0),newArea(2,200,0,300),newArea(3,-200),newArea(4,0,200)
    start.adjacent={high,blockedArea,dry}; blockedArea.blocked=true
    local search=construct(include("sv_bot_search.lua").BotSearch)
    local bot=newPlayer(TEAM_ZOMBIES,0)
    local goal=search:Choose(bot,now); assert(goal and goal.y==200 and goal.z==0)
    search:Failed(goal,now); assert(not search:Choose(bot,now+1))
    assert(search:Choose(bot,now+21))
`));

test("brief same-target occlusion preserves reaction but a sustained loss of contact requires reacting again", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); local human=newPlayer(TEAM_HUMANS,300,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local ready=bots.bots[1].Plan.ReadyAt
    wall=true; now=11.2; bots:Update(); assert(not bots.bots[1].Plan.Senses.Visible)
    wall=false; now=11.4; bots:Update(); assert(bots.bots[1].Plan.ReadyAt==ready)
    wall=true
    for i=1,4 do now=11.4+i*0.25; bots:Update() end
    wall=false; now=12.65; bots:Update()
    assert(bots.bots[1].Plan.ReadyAt>now, "reacquisition after a real gap retains normal reaction delay")
`));

test("longer authored melee reach does not stop outside a fixed unrelated firing cutoff", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua")
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1); bot.weapon.HitDistance=180
    local human=newPlayer(TEAM_HUMANS,110,false)
    local plan={Senses={Visible=true,Target=human,EnemyPosition=human:GetPos(),AimPosition=human:WorldSpaceCenter()},
        Steering={Jump=false,Duck=false},Action="attack",Updated=now,ReadyAt=0}
    local cmd=command(); motor.apply(bot,cmd,plan,1,true)
    assert(cmd.buttons & IN_ATTACK~=0)
`));
