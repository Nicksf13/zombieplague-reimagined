import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Objectives=include("sv_bot_objectives.lua").BotObjectives
local motor=include("sv_bot_motor.lua")
local goals=construct(Objectives)
local bot=newPlayer(TEAM_HUMANS,0)
local hidden={Visible=false,EnemyPosition=Vector(400,0,0),Enemies=0,Allies=0}
`;

test("a human never pursues the remembered attacker, even when the previous combat action was attack", () => run(setup + `
    for _,action in ipairs({"attack","defend","retreat","group"}) do
        local request=motor.request(bot,hidden,action,"aggressive")
        assert(request.Goal.x<0 and request.Move~="remembered_pursuit")
    end
    local request=motor.request(bot,hidden,"retreat","cautious")
    local first=goals:Resolve(bot,hidden,"retreat",request,now)
    bot.position=Vector(-40,0,0)
    local next=goals:Resolve(bot,hidden,"retreat",motor.request(bot,hidden,"retreat","cautious"),now+0.2)
    assert(first.Goal==next.Goal and first.Key==next.Key, "plan renewal retains the destination")
    now=now+3
    assert(goals:Resolve(bot,hidden,"retreat",request,now).Key~=first.Key, "unproductive goals have a bounded lifetime")
`));

test("zombie repositioning has a lateral approach while ordinary pursuit and grouping retain their meanings", () => run(setup + `
    bot.team=TEAM_ZOMBIES
    local request=motor.request(bot,hidden,"retreat","cautious")
    local goal=goals:Resolve(bot,hidden,"retreat",request,now)
    assert(goal.Mode=="reposition" and math.abs(goal.Goal.y)==240 and goal.Goal.x==-100)
    hidden.Visible=true; hidden.Enemies=3; hidden.AllyPosition=Vector(-250,0,0)
    assert(motor.destination(bot,hidden,"group","cooperative")==hidden.AllyPosition)
    hidden.Enemies=1
    assert(motor.destination(bot,hidden,"attack","aggressive")==hidden.EnemyPosition)
`));

test("investigations use static visual snapshots, expire, and revisit empty regions only after a cooldown", () => run(setup + `
    bot.team=TEAM_ZOMBIES; loaded=true
    local start,target=newArea(1,0),newArea(2,400); start.adjacent={target}; target.adjacent={start}
    local request=motor.request(bot,hidden,"group","aggressive")
    local first=goals:Resolve(bot,hidden,"group",request,now)
    assert(first.Mode=="investigate" and first.Goal.x==400)
    hidden.EnemyPosition=Vector(600,0,0)
    assert(goals:Resolve(bot,hidden,"group",request,now+0.2).Goal.x==400)
    hidden.EnemyPosition=Vector(400,0,0); bot.position=Vector(400,0,0)
    assert(goals:Resolve(bot,hidden,"group",request,now+0.4).Mode=="search_places")
    assert(goals:Inspected(hidden,now+0.5))
    bot.position=Vector(0,0,0)
    assert(goals:Resolve(bot,hidden,"group",request,now+1).Mode=="search_places")
    assert(goals:Resolve(bot,hidden,"group",request,now+27).Mode=="investigate")
`));

test("safety requires remembered geometry, distance and absence of recent damage", () => run(setup + `
    assert(not goals:Safe(bot,hidden,now)); wall=true
    assert(goals:Safe(bot,hidden,now))
    goals:Damage(now); assert(not goals:Safe(bot,hidden,now+1))
    assert(goals:Safe(bot,hidden,now+3))
    hidden.EnemyPosition=Vector(100,0,0); assert(not goals:Safe(bot,hidden,now+3))
    hidden.EnemyPosition=nil; assert(not goals:Safe(bot,hidden,now+3))
`));

test("a controller keeps a human fleeing after visual contact is lost without awarding an immediate escape", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local human=newPlayer(TEAM_HUMANS,0); newPlayer(TEAM_ZOMBIES,400,false); newPlayer(TEAM_ZOMBIES,450,false)
    bots:Attach(human,"cautious"); now=11; bots:Update(); bots:Command(human,command())
    assert(bots:GetStatus(human).Action=="retreat")
    wall=true; now=11.25; bots:Update(); local cmd=command(); bots:Command(human,cmd)
    assert(cmd.forward<0 and bots:GetStatus(human).Action=="retreat" and bots:GetStatus(human).Samples==0)
    for i=2,14 do now=11+i*0.25; bots:Update(); bots:Command(human,cmd) end
    assert(bots:GetStatus(human).Samples==1, "three continuously observed seconds of protection confirm escape")
`));
