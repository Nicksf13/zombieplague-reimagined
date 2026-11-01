import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local situation={Role="zombie",Variant="nemesis",Health=1,Distance=400,Allies=0,Enemies=4,HasAlly=true,RecentDamage=true}
values.zp_bot_learning=false
`;

test("a healthy Nemesis presses a visible target across personalities despite damage and numerical disadvantage", () => run(setup + `
    for _,profile in ipairs(definitions.profiles) do
        local memory={ID=1,Profile=profile,Experience={}}
        local key=definitions.context(situation)
        memory.Experience[key..":retreat"]={Value=1,Samples=100}
        memory.Experience[key..":group"]={Value=1,Samples=100}
        local brain=construct(definitions.BotBrain,memory)
        assert(not brain:Evaluate(situation,"retreat").Eligible,profile)
        assert(not brain:Evaluate(situation,"group").Eligible,profile)
        assert(brain:Decide(situation,now)=="attack",profile)
        assert(memory.Experience[key..":retreat"].Samples==100,"old learning is preserved")
    end
`));

test("a critically injured Nemesis can reposition and cancels the withdrawal after recovering", () => run(setup + `
    local brain=construct(definitions.BotBrain,{ID=1,Profile="cautious",Experience={}})
    situation.Health=0.2
    assert(brain:Decide(situation,now)=="retreat")
    situation.Health=0.35
    assert(brain:Decide(situation,now+0.2)=="attack")
    situation.Variant="normal"; brain:Reset()
    assert(brain:Evaluate(situation,"retreat").Eligible,"ordinary zombies retain contextual repositioning")
`));

test("the controller supplies the Nemesis variant and issues pursuit under fire", () => run(botSetup + `
    values.zp_bot_learning=false
    local bots=include("sv_bots.lua").bots
    local nemesis=newPlayer(TEAM_ZOMBIES,0); nemesis.nemesis=true; nemesis.maxHealth=20000; nemesis.health=20000
    local attacker=newPlayer(TEAM_HUMANS,400,false)
    newPlayer(TEAM_HUMANS,450,false); newPlayer(TEAM_HUMANS,500,false)
    bots:Attach(nemesis,"cautious"); bots:Update(); bots:Command(nemesis,command())
    now=10.25; bots:Damage(nemesis,damage(attacker,20),true); bots:Update()
    local status=bots:GetStatus(nemesis); local cmd=command(); bots:Command(nemesis,cmd)
    assert(status.Action=="attack" and cmd.forward>0 and cmd.buttons & IN_SPEED~=0)
`));
