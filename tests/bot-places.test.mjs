import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Catalog=include("sv_bot_place_catalog.lua").BotPlaceCatalog
local Learning=include("sv_bot_place_learning.lua").BotPlaceLearning
local Places=include("sv_bot_places.lua").BotPlaces
local state=ZPBotPlaceProtocol.Empty(); local learning=construct(Learning,state); local catalog=construct(Catalog)
local bot=newPlayer(TEAM_HUMANS,0); local goals=construct(Places,catalog,learning,1,"cautious")
local none={Visible=false,Enemies=0,Allies=0}
loaded=true
local start,cover=newArea(1,0),newArea(2,240); start.adjacent={cover}; cover.adjacent={start}; cover.hiding={Vector(240,0,0)}
math.random=function(low,high) return low end
`;

test("authored safe points respect role, connected nav floors, geometry and leases", () => run(setup + `
    local points={{ID=1,Role="human",Position={240,0,0}},{ID=2,Role="zombie",Position={240,20,0}},
        {ID=3,Role="both",Position={900,0,0}},{ID=4,Role="both",Position={240,0,100}}}
    ZPBotSafePoints={Points=function() return points end}
    newArea(3,900)
    local function authored(ply)
        local result={}; for _,point in ipairs(catalog:Points(ply,include("sv_bot_motion_physics.lua").physics(ply),now)) do
            if point.SafeID then result[#result+1]=point end
        end; return result
    end
    local human=authored(bot); assert(#human==1 and human[1].SafeID==1)
    local nearby=0
    for _,point in ipairs(catalog:Points(bot,include("sv_bot_motion_physics.lua").physics(bot),now)) do
        if point.Position:DistToSqr(Vector(240,0,0))<32*32 then nearby=nearby+1 end
    end
    assert(nearby==1, "a native hiding spot must not bypass the marked point's reservation")
    assert(catalog:Validate(bot,human[1]), "an authored point can qualify without native hiding flags or two walls")
    catalog:Reserve(human[1],"human",1,now)
    assert(not catalog:Available(human[1],"human",2,now))
    blocked=true; assert(not catalog:Validate(bot,human[1])); blocked=false
    bot.team=TEAM_ZOMBIES; local zombie=authored(bot); assert(#zombie==1 and zombie[1].SafeID==2)
    cover.blocked=true; assert(#authored(bot)==0)
`));

test("authored shelter suggestions yield to known danger and deletion ends visits neutrally", () => run(setup + `
    cover.hiding={}
    local points={{ID=9,Role="both",Position={240,0,0}}}
    ZPBotSafePoints={Points=function() return points end}
    assert(not goals:Update(bot,{Visible=true,EnemyPosition=Vector(600,0,0),Enemies=1,Allies=0},"retreat",now),
        "a marked point exposed to a known enemy is unsafe")
    now=12; wall=true
    local intent=goals:Update(bot,{Visible=false,EnemyPosition=Vector(600,0,0),Enemies=0,Allies=0},"retreat",now)
    assert(intent and intent.Key:sub(1,5)=="safe:")
    points={}; now=12.2
    assert(not goals:Update(bot,none,"group",now))
    assert(goals:Diagnostic(now).State=="patrol")
    for _,entry in pairs(state.Records) do assert(entry.Samples==0 and entry.Value==0) end
`));

test("place diagnostic lifecycles expose active and frozen outcomes without changing their learning contract", () => run(setup + `
    local rows,serial={},0
    local trace={NewID=function() serial=serial+1; return "place:"..serial end,Record=function(row) rows[#rows+1]=clone(row) end}
    goals=construct(Places,catalog,learning,1,"cautious",trace)
    assert(goals:Update(bot,none,"group",now)); goals:Damage(20,100); goals:Failed()
    local active=rows[#rows]
    assert(active.Kind=="finalize" and active.Learner=="place" and active.Updated and active.After<active.Before)
    values.zp_bot_evaluation=true; now=80
    goals=construct(Places,catalog,learning,1,"cautious",trace)
    assert(goals:Update(bot,none,"group",now)); goals:Damage(20,100); goals:Failed()
    local frozen=rows[#rows]
    assert(frozen.Outcome=="failure" and not frozen.Updated and frozen.Before==frozen.After)
`));

test("foreign movement ends an unresolved place visit without training a fake timeout or death", () => run(setup + `
    assert(goals:Update(bot,none,"group",now))
    goals:Intervene(); now=40; goals:Death(); goals:Finish()
    for _,entry in pairs(state.Records) do assert(entry.Value==0 and entry.Samples==0) end
    assert(state.Totals.Deaths==0 and goals:Diagnostic(now).State=="patrol")
`));

test("humans visit cover, look toward its entrance and leave after a bounded stay without idle rewards", () => run(setup + `
    local intent=goals:Update(bot,none,"group",now)
    assert(intent and intent.Goal.x==240 and goals:Diagnostic(now).State=="shelter")
    bot.position=Vector(240,0,0); now=11; intent=goals:Update(bot,none,"group",now)
    assert(intent.Holding and intent.Look.x==0 and intent.Look.z==bot:EyePos().z and goals:Diagnostic(now).State=="guard")
    for i=1,29 do now=11+i*0.2; goals:Update(bot,none,"group",now) end
    now=17; assert(not goals:Update(bot,none,"group",now))
    assert(goals:Diagnostic(now).State=="patrol" and state.Totals.Visits==1 and state.Totals.Seconds>5)
    for _,entry in pairs(state.Records) do assert(entry.Value==0 and entry.Samples==0, "quiet camping cannot earn reinforcement") end
    bot.position=Vector(0,0,0); now=20; assert(not goals:Update(bot,none,"group",now), "recent places have a cooldown")
`));

test("damage makes a human abandon its shelter and observed protection is rewarded only once", () => run(setup + `
    wall=true
    local threat={Visible=true,EnemyPosition=Vector(1000,0,0),Enemies=1,Allies=0}
    assert(goals:Update(bot,threat,"defend",now))
    bot.position=Vector(240,0,0); now=11
    local hidden={Visible=false,EnemyPosition=Vector(1000,0,0),Enemies=0,Allies=0}
    goals:Update(bot,hidden,"group",now); now=11.2; goals:Update(bot,hidden,"group",now)
    assert(state.Totals.Escapes==0, "loss of sight alone is not an escape")
    for i=2,21 do now=11+i*0.2; goals:Update(bot,hidden,"group",now) end
    assert(state.Totals.Escapes==1)
    goals:Damage(20,100); now=15.4; assert(not goals:Update(bot,hidden,"defend",now))
    assert(state.Totals.Damage==20)
    for _,entry in pairs(state.Records) do assert(entry.Samples==1 and entry.Value>0 and entry.Value<0.12) end
    bot.position=Vector(0,0,0); now=80; assert(goals:Update(bot,none,"group",now))
    goals:Damage(50,100); now=80.2; goals:Update(bot,none,"group",now)
    for _,entry in pairs(state.Records) do assert(entry.Samples==2 and entry.Value<0) end
`));

test("zombies inspect remembered hiding places, learn actual finds and move on after empty checks", () => run(setup + `
    bot.team=TEAM_ZOMBIES
    local seen={Visible=true,EnemyPosition=Vector(240,0,0),Enemies=1,Allies=0}
    assert(not goals:Update(bot,seen,"attack",now), "combat takes priority over investigating")
    now=11; assert(goals:Update(bot,none,"group",now)); assert(goals:Diagnostic(now).Reason=="clue")
    bot.position=Vector(240,0,0); now=11.4; goals:Update(bot,none,"group",now)
    assert(goals:Diagnostic(now).State=="inspect")
    now=11.6; assert(not goals:Update(bot,seen,"attack",now))
    assert(state.Totals.Finds==1); for _,entry in pairs(state.Records) do assert(entry.Value>0) end
    bot.position=Vector(0,0,0); now=80; assert(goals:Update(bot,none,"group",now))
    bot.position=Vector(240,0,0); now=81; goals:Update(bot,none,"group",now)
    now=82; goals:Update(bot,none,"group",now)
    now=83; assert(not goals:Update(bot,none,"group",now)); assert(state.Totals.Empty==1)
    assert(goals:Diagnostic(now).State=="patrol")
`));

test("place queries ignore hidden player bodies and only reserve destinations among the same role", () => run(setup + `
    local human=newPlayer(TEAM_HUMANS,240,false)
    function human:GetPos() error("hidden player coordinates must not be queried") end
    local original=util.TraceHull
    util.TraceHull=function(options)
        assert(type(options.filter)=="table" and options.filter[2]==human, "geometry queries ignore every player's body")
        return original(options)
    end
    assert(goals:Update(bot,none,"group",now))
    local other=construct(Places,catalog,construct(Learning,ZPBotPlaceProtocol.Empty()),2,"cautious")
    assert(not other:Update(bot,none,"group",now), "allied bots should spread out")
    bot.team=TEAM_ZOMBIES
    local hunter=construct(Places,catalog,construct(Learning,ZPBotPlaceProtocol.Empty()),3,"aggressive")
    assert(hunter:Update(bot,none,"group",now), "zombies cannot infer a human reservation")
`));

test("hiding candidates respect class traversal, blocked areas, ground and actual duck hulls", () => run(setup + `
    local physics=include("sv_bot_motion_physics.lua").physics
    cover.center.z=200; cover.hiding={Vector(240,0,200)}
    assert(#catalog:Points(bot,physics(bot),now)==0)
    cover.center.z=0; cover.hiding={Vector(240,0,0)}
    cover.blocked=true; assert(#catalog:Points(bot,physics(bot),now)==0); cover.blocked=false
    ground=false; assert(not goals:Update(bot,none,"group",now)); ground=true
    now=30; util.TraceHull=function(options) return {Hit=options.maxs.z>40,Entity=emptyEntity,HitPos=options.endpos} end
    local intent=goals:Update(bot,none,"group",now); assert(intent and intent.Duck)
`));

test("personalities, probability and cooldowns keep shelter selection optional and interrupts remain neutral", () => run(setup + `
    math.random=function(low,high) return high==100 and 50 or low end
    local aggressive=construct(Places,catalog,construct(Learning,ZPBotPlaceProtocol.Empty()),2,"aggressive")
    assert(not aggressive:Update(bot,none,"group",now))
    assert(goals:Update(bot,none,"group",now), "cautious bots use cover more often")
    goals:Reset(); assert(goals:Diagnostic(now).State=="patrol")
    for _,entry in pairs(state.Records) do assert(entry.Samples==0) end
    now=80; assert(goals:Update(bot,none,"group",now)); goals:Death()
    assert(state.Totals.Deaths==1); for _,entry in pairs(state.Records) do assert(entry.Value<0) end
`));

test("place memory shares validated movement persistence and stays separated by class, map, role and nav revision", () => run(setup + `
    local Contexts=include("sv_bot_contexts.lua").BotContexts
    local contexts=construct(Contexts); local entry=contexts:Get(bot,1,"cautious")
    entry.Places:Event("2:15.0.0","Visits"); entry.Places:Reward("2:15.0.0",0.8); contexts:Save()
    local restored=construct(Contexts):Get(bot,1,"cautious"); assert(restored.Places:Value("2:15.0.0")>0 and restored.Places:Totals().Visits==1)
    assert(contexts:Get(bot,1,"aggressive").Places:Totals().Visits==1, "personality does not erase place knowledge")
    bot.humanClass={ID="Scout",Name="HumanDefaultClassName"}; assert(contexts:Get(bot,1,"cautious").Places:Totals().Visits==0)
    bot.humanClass=nil; bot.team=TEAM_ZOMBIES; assert(contexts:Get(bot,1,"cautious").Places:Totals().Visits==0)
    bot.team=TEAM_HUMANS; mapName="other"; assert(contexts:Get(bot,1,"cautious").Places:Totals().Visits==0)
    mapName="gm_test"; files["maps/gm_test.nav"]="new revision"; assert(construct(Contexts):Get(bot,1,"cautious").Places:Totals().Visits==0)
    values.zp_bot_learning=false; local value=learning:Value("2:15.0.0"); learning:Reward("2:15.0.0",1); assert(learning:Value("2:15.0.0")==value)
    learning:Event("2:15.0.0","Visits"); assert(learning:Totals().Visits==1)
    local bad=ZPBotPlaceProtocol.Empty(); bad.Records.bad={}; assert(not ZPBotPlaceProtocol.Memory(bad))
    local move=ZPBotMotionProtocol.Empty(); move.Places=bad; assert(not ZPBotMotionProtocol.Memory(move))
    bad=ZPBotPlaceProtocol.Empty(); bad.Records[1]={Visits=0,Finds=0,Escapes=0,Deaths=0,Empty=0,Damage=0,Seconds=0,Value=0,Samples=0}
    assert(not ZPBotPlaceProtocol.Memory(bad), "malformed numeric record keys are rejected without crashing")
`));

test("place scans stay bounded, reject traps without a class-usable exit and cancel teleports neutrally", () => run(setup + `
    local physics=include("sv_bot_motion_physics.lua").physics
    local calls=0
    local previous=cover
    for i=3,300 do
        local area=newArea(i,i*100,0,0)
        function area:GetHidingSpots() calls=calls+1; return {} end
        previous.adjacent={start,area}; previous=area
    end
    local points=catalog:Points(bot,physics(bot),now)
    assert(#points<=32 and calls<=48 and catalog.cache.size<=48)
    cover.adjacent={newArea(400,240,0,300)}
    assert(not goals:Update(bot,none,"group",now), "a trap with no usable exit is rejected")
    cover.adjacent={start}; now=30; assert(goals:Update(bot,none,"group",now))
    bot.position=Vector(3000,0,0); now=30.2; assert(not goals:Update(bot,none,"group",now))
    for _,entry in pairs(state.Records) do assert(entry.Samples==0) end
`));

test("controller holds a crouched shelter, reports real idle input, and clears the visit on freeze", () => run(botSetup + `
    loaded=true
    local start,cover=newArea(1,0),newArea(2,240); start.adjacent={cover}; cover.adjacent={start}; cover.hiding={cover.center}
    util.TraceHull=function(options) return {Hit=options.maxs.z>40,Entity=emptyEntity,HitPos=options.endpos} end
    local bots=include("sv_bots.lua").bots; local bot=newPlayer(TEAM_HUMANS,0)
    math.random=function(low,high) return low end
    bots:Attach(bot,"cautious"); now=11; bots:Update()
    assert(bots:Diagnostics(0,1).Rows[1].Place.State=="shelter")
    bot.position=Vector(240,0,0); now=11.4; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    local row=bots:Diagnostics(0,2).Rows[1]
    assert(row.Place.State=="guard" and not row.Blocked and cmd.buttons & IN_DUCK~=0 and cmd.forward==0)
    assert(row.Motion.Keys==cmd.buttons)
    bot.frozen=true; bots:Command(bot,cmd); assert(cmd.buttons==0 and bots:Diagnostics(0,4).Rows[1].Motion.Keys==0)
    bot.frozen=false
    RoundManager.FreezeTimeActive=true; bots:Update(); row=bots:Diagnostics(0,3).Rows[1]
    assert(row.Place.State=="patrol" and #row.Place.Point==0 and row.Motion.Keys==0)
`));

test("round completion retains earned place outcomes while ending a quiet visit grants no reward", () => run(setup + `
    wall=true
    local threat={Visible=true,EnemyPosition=Vector(1000,0,0),Enemies=1,Allies=0}
    assert(goals:Update(bot,threat,"defend",now))
    bot.position=Vector(240,0,0); now=11
    goals:Update(bot,{Visible=false,EnemyPosition=Vector(1000,0,0)},"group",now)
    for i=1,21 do now=11+i*0.2; goals:Update(bot,{Visible=false,EnemyPosition=Vector(1000,0,0)},"group",now) end
    assert(state.Totals.Escapes==1); goals:Finish(); goals:Reset()
    for _,entry in pairs(state.Records) do assert(entry.Samples==1 and entry.Value>0) end
    bot.position=Vector(0,0,0); now=80; goals:Update(bot,none,"group",now); goals:Finish()
    for _,entry in pairs(state.Records) do assert(entry.Samples==1, "ending a quiet visit never creates survival samples") end
`));

test("urgent human shelter and zombie cover do not depend on personality chance or a quiet choice interval", () => run(setup + `
    goals=construct(Places,catalog,learning,1,"aggressive")
    math.random=function(low,high) return high end
    assert(not goals:Update(bot,none,"group",now))
    wall=true
    local threat={Visible=true,EnemyPosition=Vector(1000,0,0),Enemies=3,Allies=0,RecentDamage=true}
    now=10.2; assert(goals:Update(bot,threat,"retreat",now), "urgent retreat bypasses the quiet lottery")
    goals:Reset(); bot.team=TEAM_ZOMBIES; goals=construct(Places,catalog,learning,1,"aggressive")
    now=11; assert(goals:Update(bot,threat,"retreat",now), "zombies can use the same validated cover system")
`));

test("runtime place ownership rejects unissued damage and retains known damage through a later intervention", () => run(setup + `
    goals=construct(Places,catalog,learning,1,"cautious",nil,nil,true)
    local visit=goals:Update(bot,none,"group",now); assert(visit)
    goals:Damage(20,100); assert(state.Totals.Damage==0)
    goals:Executed(visit.Goal); goals:Damage(20,100)
    goals:Intervene({Controller="traffic",Reason="wait",Tactical=true,Motion=true})
    assert(state.Totals.Damage==20)
    for _,entry in pairs(state.Records) do assert(entry.Samples==1 and entry.Value<0) end
`));
