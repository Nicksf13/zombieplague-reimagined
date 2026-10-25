import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local situation={Role="zombie",Health=1,Distance=400,Allies=0,Enemies=3,HasAlly=false,RecentDamage=true}
local memory={ID=1,Profile="cautious",Experience={}}
local brain=construct(definitions.BotBrain,memory)
`;

test("healthy zombies can learn contextual repositioning under fire in every profile", () => run(setup + `
    values.zp_bot_learning=false
    for _,profile in ipairs(definitions.profiles) do
        memory={ID=1,Profile=profile,Experience={}}
        brain=construct(definitions.BotBrain,memory)
        assert(brain:Evaluate(situation,"retreat").Eligible)
        assert(brain:Decide(situation,now)=="retreat",profile)
        assert(brain:Decision().Scores.retreat.Threat>0)
        assert(not brain:IsDirty())
    end
`));

test("ordinary healthy pursuit and melee contact do not turn into perpetual retreat", () => run(setup + `
    situation.Enemies=1; situation.RecentDamage=false
    assert(brain:Decide(situation,now)=="attack")
    assert(not brain:Decision().Scores.retreat.Eligible)
    situation.Enemies=3; situation.RecentDamage=true; situation.Distance=60
    brain:Reset(); assert(brain:Decide(situation,now)=="attack")
    situation.Health=0.2; brain:Reset(); assert(brain:Decide(situation,now)=="retreat")
`));

test("healing alone does not cancel a viable reposition, while a resolved disadvantage does", () => run(setup + `
    situation.Health=0.5; assert(brain:Decide(situation,now)=="retreat")
    situation.Health=1
    assert(brain:Decide(situation,now+0.2)=="retreat" and brain:Decision().Held)
    situation.Enemies=1; situation.RecentDamage=false
    assert(brain:Decide(situation,now+0.4)~="retreat")
`));

test("versioned tactical contexts preserve old estimates and separate recent pressure", () => run(setup + `
    local legacy="zombie:healthy:outnumbered:mid:retreat"
    memory.Experience[legacy]={Value=1,Samples=20}
    brain:Decide(situation,now); brain:Reward(-0.5); brain:Finish()
    local key=definitions.context(situation)..":retreat"
    assert(key~=legacy and memory.Experience[legacy].Value==1 and memory.Experience[legacy].Samples==20)
    assert(memory.Experience[key].Samples==1 and memory.Experience[key].Value<0)
    situation.RecentDamage=false; assert(definitions.context(situation)..":retreat"~=key)
    local parsed=include("sv_bot_storage.lua").parseBotMemories({brain:GetMemory()},definitions.isProfile)
    assert(parsed and parsed[1].Experience[legacy].Samples==20 and parsed[1].Experience[key].Samples==1)
`));

test("humans need explicit observed safety and zombies never earn safety-only rewards", () => run(setup + `
    for _,role in ipairs({"human","zombie"}) do
        situation.Role=role; memory={ID=1,Profile="cautious",Experience={}}; brain=construct(definitions.BotBrain,memory)
        assert(brain:Decide(situation,now)=="retreat")
        brain:Escaped(); brain:Finish(); assert(brain:Samples()==0)
        brain:Decide(situation,now+1); brain:Escaped(true); brain:Finish()
        assert(brain:Samples()==(role=="human" and 1 or 0))
    end
`));

test("ranged damage is attributed to the original executed role and pellets do not manufacture multiple samples", () => run(setup + `
    brain:Decide(situation,now)
    for i=1,10 do brain:DamageTaken(10,20000,true,now) end
    brain:Finish(); brain:Finish()
    local key=definitions.context(situation)..":retreat"
    assert(memory.Experience[key].Samples==1 and memory.Experience[key].Value<0)
    assert(not memory.Experience["v2:human:healthy:outnumbered:mid:pressured:retreat"])
`));

test("an outnumbered zombie can group away from pressure while balanced grouping still advances", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua"); local zombie=newPlayer(TEAM_ZOMBIES,0)
    local senses={Visible=true,EnemyPosition=Vector(400,0,0),AllyPosition=Vector(-300,0,0),Allies=1,Enemies=3}
    assert(motor.destination(zombie,senses,"group","cooperative")==senses.AllyPosition)
    senses.Enemies=1
    assert(motor.destination(zombie,senses,"group","cooperative")==senses.EnemyPosition)
    senses.RecentDamage=true
    assert(motor.destination(zombie,senses,"group","cooperative")==senses.AllyPosition)
`));
