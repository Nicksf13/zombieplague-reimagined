import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local Traffic=include("sv_bot_traffic.lua").BotTrafficManager
local traffic=construct(Traffic)
local a,b=newPlayer(TEAM_ZOMBIES,0),newPlayer(TEAM_ZOMBIES,50)
local peers={{Player=a,ID=1,Target=Vector(160,0,0),Busy=false},{Player=b,ID=2,Target=Vector(-100,0,0),Busy=false}}
local function request(ply,blocker) traffic:Request(ply,{Blocker=blocker,Jump=false,Duck=false,Use=false,Stuck=true},peers,now) end
`;

test("head-on allies agree on one passer, yield off the lane and resume after passage", () => run(setup + `
    request(a,b); assert(not traffic:Control(a,now).Position)
    local yielding=traffic:Control(b,now); assert(yielding.Precision and yielding.Position and yielding.Position.y~=0)
    request(b,a); assert(not traffic:Control(a,now).Position,"reciprocal requests cannot swap priority")
    b.position=yielding.Position; assert(not traffic:Control(b,now).Position)
    assert(not traffic:Control(a,now),"the reserved passer resumes only after the lane is clear")
    a.position=Vector(110,0,0); assert(not traffic:Control(a,now) and not traffic:Control(b,now))
`));

test("a yielder backs into a supported bay instead of stepping off a narrow beam", () => run(setup + `
    util.TraceLine=function(options)
        local p=options.start; local floor=math.abs(p.y)<=8 or (p.x>=106 and p.x<=220 and math.abs(p.y)<=100)
        return {Hit=floor,Entity=emptyEntity,HitPos=Vector(p.x,p.y,floor and 0 or options.endpos.z)}
    end
    request(a,b); local move=traffic:Control(b,now)
    assert(move and move.Position and move.Position.y==0 and move.Position.x>=114)
    b.position=move.Position; move=traffic:Control(b,now)
    assert(move.Position and move.Position.y~=0)
    util.TraceLine=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
    assert(not traffic:Control(b,now).Position,"a new hole invalidates a reserved yield path")
`));

test("no safe bay, enemies, human players, busy bots and following traffic do not start a yield", () => run(setup + `
    util.TraceLine=function(options) return {Hit=math.abs(options.start.y)<=8,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,0)} end
    request(a,b); assert(not traffic:Control(a,now) and not traffic:Control(b,now))
    util.TraceLine=function(options) return {Hit=true,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,0)} end
    now=12; b.team=TEAM_HUMANS; request(a,b); assert(not traffic:Control(b,now))
    b.team=TEAM_ZOMBIES; peers[2].Busy=true; request(a,b); assert(not traffic:Control(b,now))
    peers[2].Busy=false; peers[2].Target=Vector(160,0,0); request(a,b); assert(not traffic:Control(b,now))
    peers[2]=nil; now=14; request(a,b); assert(not traffic:Control(b,now))
`));

test("three bots cannot form reciprocal leases and death, role changes and timeout release reservations", () => run(setup + `
    local c=newPlayer(TEAM_ZOMBIES,-50); peers[3]={Player=c,ID=3,Target=Vector(160,0,0),Busy=false}
    request(a,b); request(c,a); assert(not traffic:Control(c,now))
    b.alive=false; assert(not traffic:Control(a,now)); b.alive=true
    now=12; request(a,b); b.team=TEAM_HUMANS; assert(not traffic:Control(a,now)); b.team=TEAM_ZOMBIES
    now=14; request(a,b); now=27; assert(not traffic:Control(b,now))
`));

test("a stalled parking reservation releases both bots and cannot immediately be reacquired", () => run(setup + `
    request(a,b)
    local initial=traffic:Diagnostic(a,now)
    assert(initial and initial.Passer==a:EntIndex() and initial.Yielder==b:EntIndex() and #initial.Parking==3 and not initial.Ready)
    assert(traffic:Control(a,now) and traffic:Control(b,now).Position)
    local pending=traffic:Diagnostic(b,now+2)
    assert(pending.Seconds==2 and pending.Idle==2,"observing a lease must not renew its progress timer")
    now=13.1
    assert(not traffic:Control(a,now) and not traffic:Control(b,now),"three seconds without progress release the pair")
    assert(not traffic:Diagnostic(a,now) and not traffic:Diagnostic(b,now))
    request(a,b); request(b,a)
    assert(not traffic:Control(a,now) and not traffic:Control(b,now),"both bots receive a retry delay")
    now=15.2; request(a,b)
    assert(traffic:Control(a,now) and traffic:Control(b,now).Position)
`));

test("a shared final goal does not turn opposing local alignment waypoints into following traffic", () => run(setup + `
    local finalGoal=Vector(200,0,0)
    peers[1].Target=finalGoal; peers[2].Target=finalGoal
    request(a,b); assert(not traffic:Control(a,now),"actual following traffic waits for its leader")
    peers[2].Target=Vector(-20,0,0); now=12
    request(a,b)
    assert(traffic:Control(a,now) and traffic:Control(b,now).Position,
        "alignment toward the requester needs a passing reservation even when both pursue the same human")
`));

test("the bot controller negotiates opposing local routes despite a shared human destination", () => run(botSetup + `
    loaded=true
    local start,other,goal=newArea(1,0),newArea(2,80),newArea(3,400)
    start.adjacent={goal}; other.adjacent={start}
    local a,b=newPlayer(TEAM_ZOMBIES,0),newPlayer(TEAM_ZOMBIES,80)
    local human=newPlayer(TEAM_HUMANS,400,false)
    local bots=include("sv_bots.lua").bots
    bots:Attach(a,"aggressive"); bots:Attach(b,"aggressive")
    now=11; bots:Update()
    local snapshots=bots:Snapshot()
    assert(snapshots[1].Goal[1]==400 and snapshots[2].Goal[1]==400)
    assert(snapshots[1].Steering[1]>0 and snapshots[2].Steering[1]<80,"the nav graph requires opposing local approaches")
    util.TraceHull=function(options)
        local blocker=options.filter==a and b or a
        local toward=(options.endpos.x-options.start.x)*(blocker.position.x-options.filter.position.x)>0
        return {Hit=toward,Entity=toward and blocker or emptyEntity,HitPos=options.endpos}
    end
    function a:GetClass() return "player" end
    function b:GetClass() return "player" end
    now=11.3; bots:Update()
    bots:Command(a,command()); bots:Command(b,command())
    local reserved=false
    for _,snapshot in ipairs(bots:Snapshot()) do
        for _,intervention in ipairs(snapshot.Input.Controllers) do
            if intervention=="traffic:negotiated_passage" then reserved=true end
        end
    end
    assert(reserved,"traffic must compare immediate navigation direction instead of the shared human position")
`));
