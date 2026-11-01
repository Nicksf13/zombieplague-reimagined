import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local contacts=construct(include("sv_bot_contacts.lua").BotContacts)
local reporter=newPlayer(TEAM_ZOMBIES,0)
local receiver=newPlayer(TEAM_ZOMBIES,200)
local target=newPlayer(TEAM_HUMANS,600,false)
local senses={Visible=true,Target=target,EnemyPosition=Vector(600,0,0),Enemies=1,Allies=0}
`;

test("allied contact reports preserve detached visual snapshots without exposing hidden motion", () => run(setup + `
    contacts:Report(reporter,senses,now)
    assert(not contacts:Listen(target,players,now),"reports never cross roles")
    senses.EnemyPosition.x=999; target.position.x=1200
    function target:GetPos() error("a received contact cannot read the hidden target's position") end
    function target:WorldSpaceCenter() error("a received contact cannot read the hidden target's aim") end
    local clue=contacts:Listen(receiver,players,now+0.2)
    assert(clue and clue.Position.x==600 and clue.Reporter==reporter:EntIndex() and clue.Expires==16)
    assert(not clue.Target and not clue.AimPosition and not clue.Visible)
    clue.Position.x=-1
    assert(contacts:Listen(receiver,players,now+1).Position.x==600)
    assert(not contacts:Listen(reporter,players,now),"a bot cannot listen to its own report")
    assert(not contacts:Listen(receiver,players,now+6),"contact age is bounded")
`));

test("contact range is live, bounded and disabled by zero, including existing reports", () => run(setup + `
    values.zp_bot_contact_radius=100; contacts:Report(reporter,senses,now)
    assert(not contacts:Listen(receiver,players,now))
    values.zp_bot_contact_radius=200; assert(contacts:Listen(receiver,players,now))
    values.zp_bot_contact_radius=0; assert(not contacts:Listen(receiver,players,now))
    values.zp_bot_contact_radius=900; assert(not contacts:Listen(receiver,players,now),"disabling discards buffered reports")
    contacts:Report(reporter,senses,now+1); receiver.position.x=901
    assert(not contacts:Listen(receiver,players,now+1))
    values.zp_bot_contact_radius=1200; assert(contacts:Listen(receiver,players,now+1))
    values.zp_bot_contact_radius=1e9; receiver.position.x=32769
    assert(not contacts:Listen(receiver,players,now+1))
    values.zp_bot_contact_radius=0/0; receiver.position.x=900
    assert(contacts:Listen(receiver,players,now+1),"invalid console values fall back to the default")
`));

test("only firsthand sightings refresh reports and no relay extends their radius or lifetime", () => run(setup + `
    receiver.position.x=800
    local distant=newPlayer(TEAM_ZOMBIES,1500)
    contacts:Report(reporter,senses,now)
    local clue=contacts:Listen(receiver,players,now+1); assert(clue)
    contacts:Report(receiver,{Visible=false,Contact=clue,EnemyPosition=clue.Position,Enemies=0,Allies=0},now+1)
    assert(not contacts:Listen(distant,players,now+1))
    contacts:Report(reporter,{Visible=false,Target=target,EnemyPosition=Vector(1200,0,0)},now+5)
    assert(not contacts:Listen(receiver,players,now+6))
    now=17; senses.EnemyPosition=Vector(1000,0,0); contacts:Report(reporter,senses,now)
    assert(contacts:Listen(receiver,players,now).Position.x==1000)
    local id=contacts:Listen(receiver,players,now).ID
    contacts:Report(reporter,senses,now+0.2)
    assert(contacts:Listen(receiver,players,now+0.2).ID==id,"broadcast refreshes are rate limited")
`));

test("death, infection, missing participants and lifecycle resets invalidate contacts", () => run(setup + `
    local function report() contacts:Report(reporter,senses,now) end
    report(); target.alive=false; assert(not contacts:Listen(receiver,players,now)); target.alive=true
    report(); reporter.team=TEAM_HUMANS; assert(not contacts:Listen(receiver,players,now)); reporter.team=TEAM_ZOMBIES
    report(); target.team=TEAM_ZOMBIES; assert(not contacts:Listen(receiver,players,now)); target.team=TEAM_HUMANS
    report(); assert(not contacts:Listen(receiver,{receiver,target},now))
    report(); contacts:Remove(target); assert(not contacts:Listen(receiver,players,now))
    report(); contacts:Remove(reporter); assert(not contacts:Listen(receiver,players,now))
    report(); contacts:Reset(); assert(not contacts:Listen(receiver,players,now))
`));

const controllerSetup = botSetup + `
loaded=true
local a,b,c=newArea(1,0),newArea(2,200),newArea(3,600)
a.adjacent={b}; b.adjacent={a,c}; c.adjacent={b}
local bots=include("sv_bots.lua").bots
local reporter=newPlayer(TEAM_ZOMBIES,0)
local receiver=newPlayer(TEAM_ZOMBIES,200)
local target=newPlayer(TEAM_HUMANS,600,false)
local trace=util.TraceLine
util.TraceLine=function(options)
    if options.mask==MASK_SHOT and options.filter==receiver then return {Hit=true,Entity=emptyEntity,HitPos=options.endpos} end
    return trace(options)
end
bots:Attach(reporter,"aggressive"); bots:Attach(receiver,"cooperative")
now=11; bots:Update()
`;

test("a zombie without line of sight runs to an ally's contact and still needs its own sight and reaction to attack", () => run(controllerSetup + `
    local plan=bots.bots[2].Plan
    assert(plan.Senses.Contact and plan.Senses.Contact.Position.x==600)
    assert(not plan.Senses.Visible and not plan.Senses.Target and not plan.Senses.EnemyPosition)
    assert(plan.Goal.x==600 and plan.Steering.Pick.Sprint,"shared sightings should override grouping and quiet wandering")
    local cmd=command(); bots:Command(receiver,cmd)
    assert(cmd.forward>0 and cmd.buttons & IN_SPEED~=0 and cmd.buttons & IN_ATTACK==0)
    local snapshot=bots:Snapshot()[2]; assert(snapshot.Contact.Reporter==reporter:EntIndex())
    assert(bots.bots[2].Brain:Samples()==0,"receiving information does not fabricate a combat outcome")
    receiver.position=Vector(600,0,0); target.position=Vector(630,0,0)
    util.TraceLine=trace; now=11.25; bots:Update(); cmd=command(); bots:Command(receiver,cmd)
    assert(bots.bots[2].Plan.Senses.Visible and bots.bots[2].Plan.ReadyAt>now)
    assert(cmd.buttons & IN_ATTACK==0,"new firsthand acquisition retains reaction delay")
`));

test("shared searches update on new distant sightings, expire, and stop revisiting an empty inspected region", () => run(controllerSetup + `
    local bot=bots.bots[2]
    local objectives=bot.Objectives
    local contact=bot.Plan.Senses.Contact
    local senses={Visible=false,Enemies=0,Allies=0,Contact=contact}
    local request={Move="none",Interventions={}}
    receiver.position=Vector(600,0,0)
    assert(objectives:Resolve(receiver,senses,"group",request,now+0.2).Mode=="search_places")
    receiver.position=Vector(200,0,0)
    assert(objectives:Resolve(receiver,senses,"group",request,now+0.4).Mode=="search_places")
    local next=newArea(4,1000); c.adjacent={b,next}; next.adjacent={c}
    senses.Contact={ID=99,Reporter=reporter:EntIndex(),Position=Vector(1000,0,0),Time=now+1,Expires=now+7}
    local intent=objectives:Resolve(receiver,senses,"group",request,now+1)
    assert(intent.Mode=="investigate" and intent.Goal.x==1000)
    assert(objectives:Resolve(receiver,senses,"group",request,now+7).Mode=="search_places")
    bots:EndRound(HUMANS_WIN)
    assert(not bots.contacts:Listen(receiver,players,now+1))
`));

test("humans use allied reports to avoid danger without treating them as firsthand sightings", () => run(setup + `
    reporter.team=TEAM_HUMANS; receiver.team=TEAM_HUMANS; target.team=TEAM_ZOMBIES
    contacts:Report(reporter,senses,now)
    local clue=contacts:Listen(receiver,players,now)
    local observations={Visible=false,Enemies=0,Allies=0,Contact=clue}
    local request=include("sv_bot_motor.lua").request(receiver,observations,"group","cautious")
    assert(request.Goal.x<receiver.position.x and not observations.EnemyPosition)
`));
