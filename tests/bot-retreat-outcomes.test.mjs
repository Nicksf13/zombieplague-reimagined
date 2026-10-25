import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local situation={Role="zombie",Health=0.5,Distance=400,Allies=0,Enemies=3,HasAlly=false}
local memory={ID=1,Profile="cautious",Experience={}}
local brain=construct(definitions.BotBrain,memory)
local key=definitions.context(situation)..":retreat"
assert(brain:Decide(situation,now)=="retreat")
local function step(visible,elapsed) now=10+elapsed; return brain:ContinueRetreat(visible,now) end
`;

test("out-of-sight zombie repositioning ends after observed disengagement without rewarding idle safety", () => run(setup + `
    for i=1,14 do assert(step(false,i*0.2)) end
    assert(not step(false,3) and brain:Samples()==0)
    assert(not brain:Evaluate(situation,"retreat").Eligible, "disengagement must resume pressure before another reposition")
    now=17.1; assert(brain:Decide(situation,now)=="retreat")
`));

test("an observation gap cannot establish either retreat success or an invented failure", () => run(setup + `
    now=14; assert(not brain:ContinueRetreat(false,now))
    assert(brain:Samples()==0 and not brain:IsDirty())
`));

test("sustained fire ends an unproductive reposition with a bounded retry cooldown", () => run(setup + `
    brain:DamageTaken(1,20000,true,now)
    for i=1,7 do now=10+i*0.25; brain:DamageTaken(1,20000,true,now); assert(brain:Decide(situation,now)=="retreat") end
    now=12; brain:DamageTaken(1,20000,true,now)
    assert(brain:Decide(situation,now)~="retreat")
    assert(memory.Experience[key].Samples==1 and memory.Experience[key].Value<0)
    assert(not brain:Decision().Scores.retreat.Eligible)
    brain:Finish(); now=15.1; brain:Decide(situation,now); assert(brain:Decision().Scores.retreat.Eligible)
`));

test("a single shot restarts disengagement timing but does not invent jump or retreat failure", () => run(setup + `
    for i=1,10 do assert(step(false,i*0.2)) end
    brain:DamageTaken(5,1000,true,now)
    for i=11,24 do assert(step(false,i*0.2)) end
    assert(not step(false,5))
    assert(memory.Experience[key].Samples==1 and memory.Experience[key].Value<0)
`));

test("retreat deadlines prevent indefinite avoidance and frozen evaluation retains parameter values", () => run(setup + `
    values.zp_bot_evaluation=true
    for i=1,31 do now=10+i*0.25; assert(brain:Decide(situation,now)=="retreat") end
    now=18; assert(brain:Decide(situation,now)~="retreat")
    assert(brain:Samples()==0 and not brain:IsDirty() and not brain:Decision().Scores.retreat.Eligible)
`));

test("freeze and AI shutdown cannot credit an unresolved zombie reposition", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local zombie=newPlayer(TEAM_ZOMBIES,0); zombie.health=20
    newPlayer(TEAM_HUMANS,400,false); newPlayer(TEAM_HUMANS,450,false)
    bots:Attach(zombie,"cautious"); now=11; bots:Update(); bots:Command(zombie,command())
    assert(bots:GetStatus(zombie).Action=="retreat")
    wall=true; now=11.25; bots:Update()
    RoundManager.FreezeTimeActive=true; now=13; bots:Update()
    assert(bots:GetStatus(zombie).Samples==0)
    RoundManager.FreezeTimeActive=false; values.zp_bot_ai_enabled=false; now=20; bots:Update()
    assert(bots:GetStatus(zombie).Samples==0)
`));
