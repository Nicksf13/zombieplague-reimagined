import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local Contexts=include("sv_bot_contexts.lua").BotContexts
local path="zombieplague/bots/learning-v3.json"
local situation={Role="human",Health=1,Distance=400,Allies=0,Enemies=1,HasAlly=true}
local context=definitions.context(situation)
`;

test("adaptive profile weights persist across maps and restart without changing the assigned profile or resetting estimates", () => run(setup + `
    local contexts=construct(Contexts); local ply=newPlayer(TEAM_HUMANS,0)
    local first=contexts:Get(ply,1,"aggressive")
    math.random=function() return 1 end
    first.Brain:Decide(situation,10); assert(first.Brain:ActiveProfile()=="cooperative")
    first.Brain:Reward(1); first.Brain:Finish(); contexts:Save()
    local saved=sharedMemory(1,"human","HumanDefault")
    assert(saved.Profile=="aggressive" and saved.Behaviors[context].cooperative.Samples==1)
    math.random=function(low,high) return high end
    mapName="zm_other"
    local other=contexts:Get(ply,1,"aggressive")
    assert(other.Brain:Decide(situation,13)=="group" and other.Brain:ActiveProfile()=="cooperative")
    other.Brain:Reward(1); other.Brain:Finish(); contexts:Save()
    assert(first.Brain:BehaviorWeights(situation).cooperative.Samples==2)
    local reloaded=construct(Contexts)
    assert(reloaded:Profile(ply,1)=="aggressive")
    local entry=reloaded:Get(ply,1,"aggressive")
    assert(entry.Brain:Decide(situation,16)=="group" and entry.Brain:ActiveProfile()=="cooperative" and entry.Brain:Samples()==2)
    assert(reloaded:Get(ply,2,"aggressive").Brain:BehaviorWeights(situation).cooperative.Samples==0)
    ply.survivor=true
    assert(reloaded:Get(ply,1,"aggressive").Brain:BehaviorWeights(situation).cooperative.Samples==0)
    local telemetry=jsonValues[files[metricsFile("gm_test","human","HumanDefault")]].Bots[1]
    assert(next(telemetry.Behaviors)==nil, "map telemetry cannot duplicate shared policy memory")
`));

test("version 3 memories without profile weights keep existing action learning and initialize neutral behavior estimates", () => run(setup + `
    local scope={Map="*",Role="human",ClassID="HumanDefault",ClassName="HumanDefaultClassName",Variant="normal"}
    files[path]=util.TableToJSON({Version=3,Contexts={{Scope=scope,Bots={{ID=1,Profile="aggressive",
        Experience={[context..":attack"]={Value=0.5,Samples=7}}}}}}})
    local original=files[path]
    local contexts=construct(Contexts); local ply=newPlayer(TEAM_HUMANS,0)
    local entry=contexts:Get(ply,1,"aggressive")
    assert(entry.Brain:Samples()==7 and entry.Brain:BehaviorWeights(situation).aggressive.Samples==0)
    entry.Brain:Decide(situation,10); entry.Brain:Reward(1); entry.Brain:Finish(); contexts:Save()
    assert(files[path..".bak.txt"]==original and sharedMemory(1,"human","HumanDefault").Behaviors[context].aggressive.Samples==1)
    assert(construct(Contexts):Get(ply,1,"aggressive").Brain:Samples()==8)
`));

test("malformed behavior contexts, profiles and estimates cannot overwrite shared learning files", () => run(setup + `
    local scope={Map="*",Role="human",ClassID="HumanDefault",ClassName="HumanDefaultClassName",Variant="normal"}
    for _,behaviors in ipairs({
        {unknown={aggressive={Value=0,Samples=1}}},
        {[context]={unknown={Value=0,Samples=1}}},
        {[context]={aggressive={Value=2,Samples=1}}},
        {[context]={aggressive={Value=0/0,Samples=1}}},
        {[context]={aggressive={Value=0,Samples=0}}},
        {[context]={aggressive={Value=0,Samples=1.5}}},
        {[context]={aggressive={Value=0,Samples=10001}}}
    }) do
        files[path]=util.TableToJSON({Version=3,Contexts={{Scope=scope,Bots={{ID=1,Profile="aggressive",Experience={},Behaviors=behaviors}}}}})
        local original=files[path]
        local contexts=construct(Contexts); local entry=contexts:Get(newPlayer(TEAM_HUMANS,0),1,"aggressive")
        assert(entry.Brain:BehaviorWeights(situation).aggressive.Samples==0)
        entry.Brain:Decide(situation,10); entry.Brain:Reward(-1); entry.Brain:Finish(); contexts:Save()
        assert(files[path]==original and entry.Brain:IsDirty())
    end
`));

test("controller diagnostics and movement use the learned active profile while attachment retains its initial preference", () => run(setup + `
    local scope={Map="*",Role="human",ClassID="HumanDefault",ClassName="HumanDefaultClassName",Variant="normal"}
    files[path]=util.TableToJSON({Version=3,Contexts={{Scope=scope,Bots={{ID=1,Profile="aggressive",Experience={},
        Behaviors={[context]={cautious={Value=1,Samples=10}}}}}}}})
    local bots=include("sv_bots.lua").bots
    local ply=newPlayer(TEAM_HUMANS,0); newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(ply,"aggressive"); now=11; bots:Update()
    local status=bots:GetStatus(ply); local data=bots:Diagnostics(0,1)
    assert(status.Profile=="cautious" and data.Rows[1].Profile=="cautious" and ZPBotMetricsProtocol.Snapshot(data))
    local cmd=command(); bots:Command(ply,cmd)
    assert(cmd.forward<0, "cautious spacing must move away from an enemy at 400 units")
    bots:Save(); assert(sharedMemory(1,"human","HumanDefault").Profile=="aggressive")
`));
