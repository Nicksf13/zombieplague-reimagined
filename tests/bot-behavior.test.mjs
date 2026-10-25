import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local memory={ID=1,Profile="aggressive",Experience={}}
local brain=construct(definitions.BotBrain,memory)
local situation={Role="human",Health=1,Distance=400,Allies=0,Enemies=1,HasAlly=true}
local context=definitions.context(situation)
local function exploreProfile(low,high) return 1 end
`;

test("profile exploration tries alternatives and credits the profile that actually acted without resetting action experience", () => run(setup + `
    memory.Experience[context..":retreat"]={Value=-0.5,Samples=4}
    math.random=exploreProfile
    assert(brain:Decide(situation,10)=="group" and brain:ActiveProfile()=="cooperative" and brain:Reason()=="explore")
    assert(brain:Decide(situation,10.2)=="group" and brain:ActiveProfile()=="cooperative")
    brain:Reward(-1); brain:Finish()
    assert(memory.Profile=="aggressive" and memory.Experience[context..":retreat"].Samples==4)
    assert(memory.Behaviors[context].cooperative.Samples==1 and memory.Behaviors[context].cooperative.Value<0)
    assert(memory.Behaviors[context].aggressive==nil)
    brain:Decide(situation,13); assert(brain:ActiveProfile()=="defensive", "less-tested profiles get the next experiment")
    brain:Reward(-1); brain:Finish()
    brain:Decide(situation,16); assert(brain:ActiveProfile()=="cautious")
`));

test("successful profiles gain weight while personality is only a prior and each bot retains individual experience", () => run(setup + `
    memory.Behaviors[context]={cautious={Value=0.8,Samples=10}}
    assert(brain:Decide(situation,10)=="defend" and brain:ActiveProfile()=="cautious" and brain:Reason()=="learned")
    local weights=brain:BehaviorWeights(situation)
    assert(weights.cautious.Total>weights.aggressive.Total and weights.aggressive.Prior==0.15)
    weights.cautious.Total=-100
    assert(brain:BehaviorWeights(situation).cautious.Total>0, "weight inspection cannot mutate learned memory")
    brain:Reward(1); brain:Finish()
    assert(memory.Behaviors[context].cautious.Samples==11 and memory.Behaviors[context].cautious.Value>0.8)
    local other=construct(definitions.BotBrain,{ID=2,Profile="aggressive",Experience={}})
    assert(other:Decide(situation,10)=="attack" and other:ActiveProfile()=="aggressive")
    assert(other:BehaviorWeights(situation).cautious.Samples==0)
    situation.Distance=1000
    assert(brain:BehaviorWeights(situation).cautious.Samples==0, "other combat situations have independent weights")
`));

test("a failed initial profile can be replaced through measured outcomes without random exploration", () => run(setup + `
    assert(brain:ActiveProfile()=="aggressive" and brain:Decide(situation,10)=="attack")
    brain:Reward(-1); brain:Finish()
    assert(brain:Decide(situation,13)=="group" and brain:ActiveProfile()=="cooperative")
    assert(brain:BehaviorWeights(situation).aggressive.Total<0)
    brain:Reward(1); brain:Finish()
    assert(brain:Decide(situation,16)=="group" and brain:ActiveProfile()=="cooperative")
    assert(memory.Profile=="aggressive" and brain:Samples()==2)
`));

test("forced random actions train action estimates without falsely scoring the profile's policy", () => run(setup + `
    math.random=function(low,high) if high==100 then return 1 end return high end
    brain:Decide(situation,10)
    assert(brain:ActiveProfile()=="aggressive" and brain:Reason()=="explore")
    brain:Reward(-1); brain:Finish()
    assert(brain:Samples()==1 and memory.Behaviors[context]==nil)
`));

test("held decisions and context changes attribute feedback to the original profile and situation", () => run(setup + `
    local low={Role="human",Health=0.2,Distance=400,Allies=0,Enemies=1,HasAlly=true}
    local lowContext=definitions.context(low)
    memory.Behaviors[lowContext]={cautious={Value=0.8,Samples=10}}
    brain:Decide(situation,10); brain:Reward(-0.5)
    assert(brain:Decide(situation,10.2)=="attack" and memory.Behaviors[context]==nil)
    assert(brain:Decide(low,10.3)=="retreat" and brain:ActiveProfile()=="cautious")
    assert(memory.Behaviors[context].aggressive.Samples==1 and memory.Behaviors[lowContext].cautious.Samples==10)
    brain:Reward(0.5); brain:Finish(); brain:Finish()
    assert(memory.Behaviors[lowContext].cautious.Samples==11 and brain:Samples()==2)
`));

test("neutral episodes and disabled learning do not change weights, while learned profiles still apply", () => run(setup + `
    brain:Decide(situation,10); brain:Finish()
    assert(next(memory.Behaviors)==nil and not brain:IsDirty())
    memory.Behaviors[context]={defensive={Value=0.8,Samples=10}}
    values.zp_bot_learning=false
    math.random=function() error("disabled learning must not explore") end
    brain:Decide(situation,13); assert(brain:ActiveProfile()=="defensive")
    brain:Reward(-1); brain:Finish()
    assert(memory.Behaviors[context].defensive.Value==0.8 and memory.Behaviors[context].defensive.Samples==10)
    assert(not brain:IsDirty() and brain:Samples()==0)
`));

test("profile experiments cannot bypass low-health exploration limits or zombie retreat safety rules", () => run(setup + `
    situation.Role="zombie"; situation.Enemies=1; situation.Health=1; situation.HasAlly=false
    math.random=exploreProfile
    for index=1,4 do
        assert(brain:Decide(situation,index*3)~="retreat")
        brain:Finish()
    end
    situation.Health=0.2; situation.Enemies=3
    math.random=function() error("critical health must not explore profiles or actions") end
    assert(brain:Decide(situation,20)=="retreat")
`));
