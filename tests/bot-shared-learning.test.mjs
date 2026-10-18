import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Contexts=include("sv_bot_contexts.lua").BotContexts
local path="zombieplague/bots/learning-v3.json"
local key="human:healthy:balanced:mid:attack"
local situation={Role="human",Health=1,Distance=400,Allies=0,Enemies=0,HasAlly=false}
local function train(entry,reward)
    entry.Brain:Decide(situation,now)
    entry.Brain:Reward(reward); entry.Brain:Finish(); now=now+3
end
local function seed(map,role,class,bots)
    local scope={Map=map,Role=role,ClassID=class,ClassName=class.."ClassName",Variant="normal"}
    for _,bot in ipairs(bots) do bot.Metrics=bot.Metrics or ZPBotMetricsProtocol.Empty() end
    local name=scopeFile(map,role,class)
    files[name]=util.TableToJSON({Version=2,Scope=scope,Bots=bots})
    return name,files[name]
end
local function memory(id,profile,value,count)
    return {ID=id,Profile=profile,Experience={[key]={Value=value,Samples=count}}}
end
`;

test("tactical experience changes decisions on another map and survives saving back to the original map", () => run(setup + `
    local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
    local first=contexts:Get(bot,1,"aggressive"); train(first,-1)
    first.Metrics:Event("DamageDealt",25)
    mapName="zm_other"
    local second=contexts:Get(bot,1,"aggressive")
    assert(second.Brain:Samples()==1 and second.Brain:Evaluate(situation,"attack").Learned<0, "second map uses learned attack penalty")
    assert(second.Metrics:Totals().DamageDealt==0 and second.Scope.Map=="zm_other")
    train(second,-1); assert(first.Brain:Samples()==2, "active map entries share estimates without sharing episodes")
    contexts:Save(); local before=writes; contexts:Save(); assert(writes==before)
    local saved=sharedMemory(1,"human","HumanDefault")
    local count=0; for _,estimate in pairs(saved.Experience) do count=count+estimate.Samples end
    assert(count==2 and saved.Metrics==nil, "shared disk record contains both outcomes without telemetry")
    mapName="a_third_map"
    local reloaded=construct(Contexts)
    assert(reloaded:Profile(bot,1)=="aggressive")
    local entry=reloaded:Get(bot,1,"aggressive")
    assert(entry.Brain:Samples()==2 and entry.Brain:Evaluate(situation,"attack").Learned<0, "reloaded third map uses both outcomes")
    assert(entry.Metrics:Totals().DamageDealt==0 and entry.Motion:Diagnostic().Samples==0)
    assert(reloaded:Get(bot,2,"aggressive").Brain:Samples()==0)
    bot.humanClass={ID="OtherHuman",Name="HumanDefaultClassName"}
    assert(reloaded:Get(bot,1,"aggressive").Brain:Samples()==0)
    bot.humanClass=nil; bot.survivor=true
    assert(reloaded:Get(bot,1,"aggressive").Brain:Samples()==0)
    bot.survivor=false; bot.team=TEAM_ZOMBIES
    assert(reloaded:Get(bot,1,"aggressive").Brain:Samples()==0)
`));

test("legacy maps merge once using sample weights while originals and map metrics are preserved", () => run(setup + `
    local first=memory(1,"aggressive",0.5,2); first.Metrics=ZPBotMetricsProtocol.Empty(); first.Metrics.DamageDealt=50
    local a,rawA=seed("gm_test","human","HumanDefault",{first,memory(2,"cautious",1,3)})
    local b,rawB=seed("zm_other","human","HumanDefault",{memory(1,"aggressive",-0.5,6)})
    local bot=newPlayer(TEAM_HUMANS,0); local contexts=construct(Contexts)
    local entry=contexts:Get(bot,1,"aggressive")
    assert(entry.Brain:Samples()==8 and math.abs(entry.Brain:GetMemory().Experience[key].Value+0.25)<0.000001)
    assert(entry.Metrics:Totals().DamageDealt==50 and contexts:Profile(bot,2)=="cautious")
    contexts:Save()
    assert(files[a]==rawA and files[b]==rawB, "migration and new saves must never rewrite legacy learning")
    assert(sharedMemory(2,"human","HumanDefault").Profile=="cautious", "inactive identity slots are imported too")
    entry.Metrics:Event("DamageDealt",5); contexts:Save()
    assert(files[a]==rawA and files[b]==rawB)
    local telemetry
    for _,bot in ipairs(jsonValues[files[metricsFile("gm_test","human","HumanDefault")]].Bots) do
        assert(next(bot.Experience)==nil, "telemetry must not copy inactive identities' legacy estimates")
        if bot.ID==1 then telemetry=bot end
    end
    assert(telemetry.Metrics.DamageDealt==55 and next(telemetry.Experience)==nil)
    local reload=construct(Contexts):Get(bot,1,"aggressive")
    assert(reload.Brain:Samples()==8 and reload.Metrics:Totals().DamageDealt==55, "restarts must not import old samples twice")
`));

test("migration merges all maps of each profile before choosing a conflicting identity's most experienced profile", () => run(setup + `
    seed("map_a","human","HumanDefault",{memory(1,"aggressive",1,10000),memory(2,"aggressive",0.5,10)})
    seed("map_b","human","HumanDefault",{memory(1,"aggressive",-1,10000),memory(2,"cautious",0.5,15)})
    seed("map_c","human","HumanDefault",{memory(2,"aggressive",0.5,10)})
    local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
    local entry=contexts:Get(bot,1,"aggressive")
    assert(entry.Brain:Samples()==10000 and entry.Brain:GetMemory().Experience[key].Value==0)
    assert(contexts:Profile(bot,2)=="aggressive")
    contexts:Save(); assert(sharedMemory(2,"human","HumanDefault").Experience[key].Samples==20)
`));

test("legacy import skips malformed or mismatched scopes without modifying their files", () => run(setup + `
    local a,rawA=seed("good","human","HumanDefault",{memory(1,"aggressive",0.5,3)})
    local b=seed("bad","human","HumanDefault",{memory(2,"aggressive",0.5,3)})
    jsonValues[files[b]].Bots[1].Experience[key].Samples=-1
    local c=seed("mismatch","human","HumanDefault",{memory(3,"aggressive",0.5,3)})
    jsonValues[files[c]].Scope.Map="wrong_map"
    files["zombieplague/bots/scopes/broken.json"]="broken"
    local rawB,rawC=files[b],files[c]
    local bot=newPlayer(TEAM_HUMANS,0); local contexts=construct(Contexts)
    assert(contexts:Get(bot,1,"aggressive").Brain:Samples()==3)
    assert(contexts:Profile(bot,2)==nil and contexts:Profile(bot,3)==nil)
    contexts:Save()
    assert(files[a]==rawA and files[b]==rawB and files[c]==rawC and files["zombieplague/bots/scopes/broken.json"]=="broken")
`));

test("shared-file corruption freezes disk writes without importing old data again or stopping map metrics", () => run(setup + `
    local legacy,old=seed("gm_test","human","HumanDefault",{memory(1,"aggressive",1,50)})
    local scope={Map="*",Role="human",ClassID="HumanDefault",ClassName="HumanDefaultClassName",Variant="normal"}
    local valid={Scope=scope,Bots={memory(1,"aggressive",0.5,1)}}
    local wrong=clone(valid); wrong.Scope.Map="gm_test"
    local badSample=clone(valid); badSample.Bots[1].Experience[key].Samples=10001
    for _,invalid in ipairs({{Version=2,Contexts={valid}}, {Version=3,Contexts={wrong}},
        {Version=3,Contexts={valid,valid}}, {Version=3,Contexts={badSample}}}) do
        files[path]="invalid"; jsonValues.invalid=invalid
        local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
        local entry=contexts:Get(bot,1,"aggressive")
        assert(entry.Brain:Samples()==0, "corruption must not silently replay legacy experience")
        train(entry,-1); entry.Metrics:Event("Deaths",1); contexts:Save()
        assert(files[path]=="invalid" and files[legacy]==old and entry.Brain:IsDirty())
        assert(not entry.Metrics:IsDirty(), "map telemetry has an independent writable file")
    end
`));

test("failed shared saves retain dirty experience and verified backups until a successful retry", () => run(setup + `
    local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
    local entry=contexts:Get(bot,1,"aggressive"); train(entry,-1); contexts:Save()
    local first=files[path]
    train(entry,-1); failWrite=true; contexts:Save()
    assert(entry.Brain:IsDirty() and files[path..".bak.txt"]==first)
    contexts:Save(); assert(entry.Brain:IsDirty() and files[path..".bak.txt"]==first)
    failWrite=false; contexts:Save()
    assert(not entry.Brain:IsDirty() and files[path..".bak.txt"]==first)
    assert(construct(Contexts):Get(bot,1,"aggressive").Brain:Samples()==2)
    local before=writes; contexts:Save(); assert(writes==before)
`));

test("profile changes reset shared tactics across maps and stale map entries cannot restore a discarded profile", () => run(setup + `
    local contexts=construct(Contexts); local bot=newPlayer(TEAM_HUMANS,0)
    local old=contexts:Get(bot,1,"aggressive"); train(old,-1)
    mapName="zm_other"
    local fresh=contexts:Get(bot,1,"cautious")
    assert(fresh.Brain:Samples()==0)
    train(old,-1); contexts:Save()
    assert(sharedMemory(1,"human","HumanDefault").Profile=="cautious")
    mapName="gm_test"
    assert(contexts:Get(bot,1,"cautious").Brain:Samples()==0)
    assert(contexts:Get(bot,1,"aggressive").Brain:Samples()==0)
`));
