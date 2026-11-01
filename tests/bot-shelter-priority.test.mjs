import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Catalog=include("sv_bot_place_catalog.lua").BotPlaceCatalog
local Learning=include("sv_bot_place_learning.lua").BotPlaceLearning
local Places=include("sv_bot_places.lua").BotPlaces
local state=ZPBotPlaceProtocol.Empty(); local learning=construct(Learning,state); local catalog=construct(Catalog)
local bot=newPlayer(TEAM_HUMANS,0); local goals=construct(Places,catalog,learning,1,"aggressive")
local none={Visible=false,Enemies=0,Allies=0}
loaded=true
local start,cover=newArea(1,0),newArea(2,240); start.adjacent={cover}; cover.adjacent={start}
local points={{ID=1,Role="human",Position={240,0,0}}}
ZPBotSafePoints={Points=function() return points end}
math.random=function(low,high) return high==100 and 100 or low end
`;

test("authored human shelters bypass the quiet personality lottery and continue during visible combat", () => run(setup + `
    local intent=goals:Update(bot,none,"group",now)
    assert(intent and intent.Goal.x==240,"an aggressive bot should use a valid authored suggestion")
    local threat={Visible=true,EnemyPosition=Vector(-600,0,0),Enemies=1,Allies=0}
    wall=true; now=10.2
    intent=goals:Update(bot,threat,"attack",now)
    assert(intent and intent.Goal.x==240 and not intent.Holding,"visible combat must not cancel travel into viable marked cover")
    assert(state.Totals.Escapes==0,"choosing cover does not prove escape")
`));

test("visible attackers allow selection of marked cover without exposing it to known danger", () => run(setup + `
    local threat={Visible=true,EnemyPosition=Vector(-600,0,0),Enemies=1,Allies=0}
    assert(not goals:Update(bot,threat,"attack",now),"an exposed marker is not safe")
    wall=true; now=30
    assert(goals:Update(bot,threat,"attack",now),"attack can coexist with travel to protected marked cover")
    now=30.2; wall=false; threat.EnemyPosition=Vector(240,0,0)
    assert(not goals:Update(bot,threat,"attack",now),"a compromised destination still interrupts the visit")
    for _,entry in pairs(state.Records) do assert(entry.Samples==0 and entry.Value==0) end
`));

test("marked cover takes priority over learned automatic hiding spots without clearing their estimates", () => run(setup + `
    local automatic=newArea(3,160); start.adjacent={cover,automatic}; automatic.adjacent={start}
    automatic.hiding={Vector(160,0,0)}
    local function record(value)
        local entry=clone(ZPBotPlaceProtocol.Empty().Totals); entry.Value=value; entry.Samples=100; return entry
    end
    state.Records["v2:3:10.0.0"]=record(1)
    state.Records["safe:1:240.0.0"]=record(-1)
    local intent=goals:Update(bot,none,"group",now)
    assert(intent and intent.Key:sub(1,5)=="safe:")
    assert(state.Records["v2:3:10.0.0"].Value==1 and state.Records["safe:1:240.0.0"].Value==-1)
`));

test("unmarked and wrong-role shelters retain the ordinary personality lottery", () => run(setup + `
    cover.hiding={Vector(240,0,0)}
    points[1].Role="zombie"
    assert(not goals:Update(bot,none,"group",now))
    points={}; now=30
    assert(not goals:Update(bot,none,"group",now))
    assert(state.Totals.Visits==0)
`));

test("dense automatic hiding spots cannot fill the catalog before it reaches a connected marked point", () => run(setup + `
    areas={}; local chain={}
    for i=1,24 do
        local x=(i-1)*60
        chain[i]=newArea(i,x); chain[i].hiding={Vector(x,0,0),Vector(x,16,0)}
        if i>1 then chain[i-1].adjacent={chain[i]}; chain[i].adjacent={chain[i-1]} end
    end
    points[1].Position={1380,0,0}
    local candidates=catalog:Points(bot,include("sv_bot_motion_physics.lua").physics(bot),now)
    local found=false
    for _,point in ipairs(candidates) do if point.SafeID==1 then found=true end end
    assert(found and #candidates<=32,"keep the output bounded while making room for authored candidates")
`));

test("the controller requests sprint on a short human shelter route with stamina enabled", () => run(setup + `
    values.zp_run_should_drain=true; values.zp_run_drain=1
    RunShouldDrain=function() return true end
    function start:Contains(position) return position.x>=-200 and position.x<=400 and math.abs(position.y)<=200 end
    function start:GetClosestPointOnArea(position)
        return Vector(math.max(-200,math.min(400,position.x)),math.max(-200,math.min(200,position.y)),0)
    end
    local bots=include("sv_bots.lua").bots
    ZPBotSafePoints={Points=function() return points end}
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local snapshot=bots:Snapshot()[1]
    local diagnostic=bots:Diagnostics(0,1).Rows[1]
    assert(diagnostic.Place.State=="shelter" and snapshot.Goal[1]==240 and snapshot.Move=="sprint","open shelter travel should run")
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_SPEED~=0 and cmd.forward==bot:GetRunSpeed())
    bot.breath=5; now=11.25; bots:Update(); cmd=command(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_SPEED==0,"shelter urgency still respects exhaustion")
`));

test("marked upper-floor shelters remain discoverable beyond the automatic area's search budget", () => run(setup + `
    areas={}; local chain={}
    for i=1,65 do
        chain[i]=newArea(i,(i-1)*24,0,math.max(0,i-45)*8)
        if i>1 then chain[i-1].adjacent={chain[i]}; chain[i].adjacent={chain[i-1]} end
    end
    points[1].Position={1536,0,160}
    local state=include("sv_bot_motion_physics.lua").physics(bot)
    local candidates=catalog:Points(bot,state,now)
    local marked
    for _,point in ipairs(candidates) do if point.SafeID==1 then marked=point end end
    assert(marked and marked.Area:GetID()==65 and marked.Position.z==160)
    assert(catalog:Validate(bot,marked),"the normal pathfinder still validates the longer ascent")
    assert(goals:Update(bot,none,"group",now),"local automatic search must not hide authored goals")
`));

test("marked shelters cannot bypass disconnected routes or select the wrong overlapping floor", () => run(setup + `
    local upper=newArea(3,240,0,256); upper.adjacent={cover}
    points[1].Position={240,0,256}
    local state=include("sv_bot_motion_physics.lua").physics(bot)
    local candidates=catalog:Points(bot,state,now)
    local marked
    for _,point in ipairs(candidates) do if point.SafeID==1 then marked=point end end
    assert(marked and marked.Area==upper)
    assert(not catalog:Validate(bot,marked),"a good endpoint is not proof of a reachable ascent")
    assert(not goals:Update(bot,none,"group",now))
    upper.blocked=true
    for _,point in ipairs(catalog:Points(bot,state,now)) do assert(point.SafeID~=1) end
`));
