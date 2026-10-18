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
