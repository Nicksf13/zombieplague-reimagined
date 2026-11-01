import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local module=include("sv_bot_breakables.lua")
local breaker=construct(module.BotBreaker)
local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1); bot.weapon.HitDistance=40; bot.weapons={bot.weapon}
local barrier={health=100,class="func_breakable",damageMode=2,x=32}
function barrier:EntIndex() return 99 end
function barrier:GetClass() return self.class end
function barrier:IsPlayer() return false end
function barrier:Health() return self.health end
function barrier:GetInternalVariable(name) return name=="m_takedamage" and self.damageMode or self.material end
function barrier:NearestPoint(eye) return Vector(self.x,eye.y,eye.z) end
function barrier:Remove() error("the bot must not remove the barrier") end
function barrier:TakeDamageInfo() error("the bot must use ordinary weapon input") end
local line=util.TraceLine
util.TraceLine=function(options)
    if options.mask==MASK_SHOT and not barrier.invalid then return {Hit=true,Entity=barrier,HitPos=Vector(barrier.x,0,64)} end
    return line(options)
end
local senses={Visible=false,Allies=0,Enemies=0}
local steering={Obstruction=barrier,Jump=false,Duck=false,Use=false,Stuck=true}
local motor=include("sv_bot_motor.lua")
local function plan(intent)
    return {Senses=senses,Steering=intent.Steering,Breakable={Entity=intent.Entity,Aim=intent.Aim},
        Updated=now,ReadyAt=0,Action="group",Interventions={{Controller="breakable",Reason="clear_route_obstruction",Motion=true,Tactical=true}}}
end
`;

test("a local destructible obstruction receives ordinary melee attacks and stops after removal", () => run(setup + `
    local intent=breaker:Resolve(bot,steering,senses,now); assert(intent and not intent.Steering.Position)
    local cmd=command(); motor.apply(bot,cmd,plan(intent),1,true)
    assert(cmd.buttons & IN_ATTACK~=0 and barrier.health==100,"only the game weapon may deal damage")
    barrier.invalid=true; now=now+0.2
    cmd=command(); motor.apply(bot,cmd,plan(intent),1,true)
    assert(cmd.buttons & IN_ATTACK==0)
    assert(not breaker:Resolve(bot,steering,senses,now))
`));

test("melee approaches only within its real reach while humans retain normal firearm and reload gates", () => run(setup + `
    barrier.x=60
    local intent=breaker:Resolve(bot,steering,senses,now)
    assert(intent and intent.Steering.Position and intent.Steering.Position.x<=24 and intent.Steering.Precision)
    local cmd=command(); motor.apply(bot,cmd,plan(intent),1,true)
    assert(cmd.buttons & IN_ATTACK==0,"forty-unit fists cannot hit a wall sixty units away")
    bot.team=TEAM_HUMANS; bot.weapon=newWeapon(30); bot.weapons={bot.weapon}
    intent=breaker:Resolve(bot,steering,senses,now)
    assert(intent and not intent.Steering.Position)
    cmd=command(); motor.apply(bot,cmd,plan(intent),1,true); assert(cmd.buttons & IN_ATTACK~=0)
    bot.weapon.clip=0; cmd=command(); motor.apply(bot,cmd,plan(intent),1,true)
    assert(cmd.buttons & IN_ATTACK==0 and cmd.buttons & IN_RELOAD~=0)
`));

test("world brushes, players, doors, indestructible props and trigger-only barriers are never attacked", () => run(setup + `
    for _,class in ipairs({"worldspawn","player","prop_door_rotating","func_door","func_wall","unknown_custom_entity"}) do
        barrier.class=class; assert(not breaker:Resolve(bot,steering,senses,now),class)
    end
    barrier.class="func_breakable"; barrier.damageMode=0
    assert(not breaker:Resolve(bot,steering,senses,now))
    barrier.damageMode=2; barrier.material=7
    assert(not breaker:Resolve(bot,steering,senses,now))
    barrier.material=1; barrier.health=0
    assert(not breaker:Resolve(bot,steering,senses,now))
    barrier.health=100; barrier.x=150
    assert(not breaker:Resolve(bot,steering,senses,now),"remote breakables are not navigation obstructions")
`));

test("a new friendly obstruction, reaction delay, aim alignment and inactive combat suppress barrier attacks", () => run(setup + `
    local intent=breaker:Resolve(bot,steering,senses,now)
    local p=plan(intent); p.ReadyAt=now+1
    local cmd=command(); motor.apply(bot,cmd,p,1,true); assert(cmd.buttons & IN_ATTACK==0)
    p.ReadyAt=0; bot.angles=Angle(0,180,0)
    cmd=command(); motor.apply(bot,cmd,p,1,true); assert(cmd.buttons & IN_ATTACK==0)
    bot.angles=Angle(0,0,0)
    cmd=command(); motor.apply(bot,cmd,p,1,false); assert(cmd.buttons & IN_ATTACK==0)
    local ally=newPlayer(TEAM_ZOMBIES,16)
    util.TraceLine=function(options) return {Hit=true,Entity=ally,HitPos=Vector(16,0,64)} end
    cmd=command(); motor.apply(bot,cmd,p,1,true); assert(cmd.buttons & IN_ATTACK==0)
    assert(not breaker:Resolve(bot,steering,senses,now))
`));

test("unchanged health times out with a retry fence while actual damage permits bounded progress", () => run(setup + `
    assert(breaker:Resolve(bot,steering,senses,now))
    for i=1,3 do now=10+i; assert(breaker:Resolve(bot,steering,senses,now)) end
    now=14; assert(not breaker:Resolve(bot,steering,senses,now))
    now=20; assert(not breaker:Resolve(bot,steering,senses,now))
    now=35; assert(breaker:Resolve(bot,steering,senses,now))
    for i=1,8 do now=35+i; barrier.health=barrier.health-1; assert(breaker:Resolve(bot,steering,senses,now)) end
    breaker:Reset(); assert(breaker:Resolve(bot,steering,senses,now))
    senses.Visible=true; assert(not breaker:Resolve(bot,steering,senses,now))
    senses.Visible=false; senses.RecentDamage=true; assert(not breaker:Resolve(bot,steering,senses,now))
`));

test("the controller discovers a blocking breakable, keeps its destination and resumes movement after destruction", () => run(setup + `
    loaded=true
    local area=newArea(1,0)
    function area:Contains(p) return math.abs(p.x)<=400 and math.abs(p.y)<=200 end
    function area:GetClosestPointOnArea(p) return Vector(math.max(-400,math.min(400,p.x)),math.max(-200,math.min(200,p.y)),0) end
    local hull=util.TraceHull
    util.TraceHull=function(options)
        if not barrier.invalid and options.endpos.x>barrier.x-16 then
            return {Hit=true,Entity=barrier,HitPos=Vector(barrier.x-16,0,0),Fraction=0.3}
        end
        return hull(options)
    end
    local bots=include("sv_bots.lua").bots
    bots:Attach(bot,"aggressive"); bots.bots[1].Wander=Vector(240,0,0)
    now=11; bots:Update()
    local p=bots.bots[1].Plan
    assert(p.Breakable and p.Breakable.Entity==barrier and p.Goal.x==240)
    now=11.5; bots:Update(); local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_ATTACK~=0 and not bots.bots[1].Plan.Senses.Target)
    assert(bots.bots[1].Brain:Samples()==0,"clearing geometry is not a combat victory")
    barrier.invalid=true; now=11.75; bots:Update(); cmd=command(); bots:Command(bot,cmd)
    assert(not bots.bots[1].Plan.Breakable and cmd.forward>0)
`));

test("clearing a blocker pauses a marked shelter visit without discarding it or granting a reward", () => run(setup + `
    local bots=include("sv_bots.lua").bots
    bots:Attach(bot,"aggressive")
    local managed=bots.bots[1]
    local interruptions=0
    managed.Places.Intervene=function() interruptions=interruptions+1 end
    local intent=breaker:Resolve(bot,steering,senses,now)
    managed.Plan=plan(intent); managed.Plan.Goal=Vector(240,0,0); managed.Plan.DecisionID=""
    managed.Plan.MotionID=""; managed.Plan.StageID=""
    bots:Command(bot,command())
    assert(interruptions==0,"breaking implements the existing destination instead of ending the visit")
    assert(managed.Brain:Samples()==0)
`));
