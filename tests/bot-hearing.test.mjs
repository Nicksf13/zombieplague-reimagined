import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local Hearing=include("sv_bot_hearing.lua").BotHearing
local hearing=construct(Hearing)
local bot=newPlayer(TEAM_ZOMBIES,0)
local source=newPlayer(TEAM_HUMANS,300,false)
`;

test("heard gunshots expose only a coarse event snapshot with category, expiry and confidence", () => run(setup + `
    local point=Vector(300,10,40)
    hearing:Emit(source,point,"gunshot",now); point.x=900; source.position=Vector(1200,0,0)
    function source:GetPos() error("hearing cannot follow an emitter") end
    local clue=hearing:Listen(bot,now+0.2)
    assert(clue and clue.Position.x==288 and clue.Position.y==0 and clue.Time==10 and clue.Category=="gunshot" and clue.Confidence>0 and clue.Expires==16)
    assert(not clue.Source and not clue.Target and not clue.Team)
    clue.Position.x=999
    assert(hearing:Listen(bot,now+0.3).Position.x==288)
    assert(not hearing:Listen(bot,now+6))
`));

test("walls, event category, range and self sounds limit hearing without granting team identity", () => run(setup + `
    hearing:Emit(source,Vector(800,0,40),"gunshot",now)
    assert(hearing:Listen(bot,now)); wall=true; assert(not hearing:Listen(bot,now))
    hearing:Reset(); hearing:Emit(source,Vector(150,0,40),"footstep",now)
    local clue=hearing:Listen(bot,now); assert(clue and clue.Confidence<0.4)
    assert(not hearing:Listen(bot,now+2))
    hearing:Reset(); hearing:Emit(bot,Vector(0,0,0),"gunshot",now); assert(not hearing:Listen(bot,now))
    source.team=TEAM_ZOMBIES; hearing:Emit(source,Vector(100,0,40),"gunshot",now+0.3)
    assert(hearing:Listen(bot,now+0.3), "an anonymous sound cannot reveal allegiance")
`));

test("sound processing is bounded and hooks respect native silent footsteps", () => run(setup + `
    for i=1,100 do hearing:Emit({index=i},Vector(200,0,40),"gunshot",now) end
    assert(#hearing.events<=16)
    local before=traceCount; hearing:Listen(bot,now); assert(traceCount-before<=2)
    local bots=include("sv_bots.lua").bots
    source.GetFootstep=function() return false end
    hooks.PlayerFootstep.ZPBotHearing(source,Vector(100,0,0),0,"step",1)
    assert(not bots.Hearing:Listen(bot,now))
    source.GetFootstep=function() return true end
    hooks.PlayerFootstep.ZPBotHearing(source,Vector(100,0,0),0,"step",1)
    assert(bots.Hearing:Listen(bot,now).Category=="footstep")
    now=11; source.weapon.GetClass=function() return "weapon_smg1" end
    hooks.PostEntityFireBullets.ZPBotHearing(source)
    assert(bots.Hearing:Listen(bot,now).Category=="gunshot")
    bots.Hearing:Reset(); source.weapon.GetClass=function() return "unknown_silent_swep" end
    now=12; hooks.PostEntityFireBullets.ZPBotHearing(source)
    assert(not bots.Hearing:Listen(bot,now), "unknown bullet events do not establish audible gunfire")
`));

test("a heard region becomes a navigable investigation and never a confirmed firing target", () => run(setup + `
    loaded=true; local a,b=newArea(1,0),newArea(2,300); a.adjacent={b}; b.adjacent={a}
    local bots=include("sv_bots.lua").bots
    bots:Attach(bot,"aggressive"); wall=true
    bots.Hearing:Emit(source,source:WorldSpaceCenter(),"gunshot",now)
    now=11; bots:Update(); local cmd=command(); bots:Command(bot,cmd)
    local plan=bots.bots[1].Plan
    assert(plan.Goal and plan.Goal.x>0 and not plan.Senses.Visible and not plan.Senses.Target)
    assert(cmd.buttons & IN_ATTACK==0)
`));
