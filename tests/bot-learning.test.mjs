import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const brainSetup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local Brain=definitions.BotBrain
local function brain(profile,id) return construct(Brain,{ID=id or 1,Profile=profile,Experience={}}) end
local situation={Role="human",Health=1,Distance=350,Allies=0,Enemies=1,HasAlly=true}
`;

test("personalities have different priorities and handle both roles without grouping alone", () => run(brainSetup + `
    assert(brain("aggressive"):Decide(situation,now)=="attack")
    assert(brain("cooperative"):Decide(situation,now)=="group")
    assert(brain("defensive"):Decide(situation,now)=="defend")
    situation.Health=0.2; situation.Enemies=3
    assert(brain("cautious"):Decide(situation,now)=="retreat")
    situation.Role="zombie"; situation.Health=1; situation.Enemies=1; situation.HasAlly=false
    for _,profile in ipairs(definitions.profiles) do assert(brain(profile):Decide(situation,now)=="attack") end
`));

test("combat failures change later choices while learning remains individual and context-specific", () => run(brainSetup + `
    local bot,untouched=brain("aggressive"),brain("aggressive",2)
    local action=bot:Decide(situation,now); assert(action=="attack")
    bot:Reward(-1); bot:Finish()
    assert(bot:Samples()==1 and bot:IsDirty() and untouched:Samples()==0)
    assert(bot:Decide(situation,now+3)~="attack")
    bot:Finish()
    situation.Role="zombie"
    assert(bot:Decide(situation,now+6)=="attack")
    bot:Finish(); situation.Role="human"; situation.Distance=1000
    assert(bot:Decide(situation,now+9)=="attack")
`));

test("decisions hold briefly, low health interrupts, and no outcome or disabled learning creates no samples", () => run(brainSetup + `
    local bot=brain("aggressive")
    assert(bot:Decide(situation,now)==bot:Decide(situation,now+0.1))
    assert(bot:Samples()==0); bot:Finish(); assert(bot:Samples()==0)
    bot:Decide(situation,now+3); bot:Reward(-1)
    situation.Health=0.1; situation.Enemies=4
    assert(bot:Decide(situation,now+3.1)=="retreat" and bot:Samples()==1)
    local disabled=brain("defensive")
    values.zp_bot_learning=false
    disabled:Decide(situation,now); disabled:Reward(-1); disabled:Finish()
    assert(disabled:Samples()==0 and not disabled:IsDirty())
`));

test("decision inspection exposes actual score contributions, grouping eligibility and held decisions without learning", () => run(brainSetup + `
    local bot=brain("aggressive")
    bot:Decide(situation,now)
    local report=bot:Decision()
    assert(report and not report.Held and report.Health==1 and report.Distance==350)
    assert(math.abs(report.Scores.attack.Profile-0.73)<0.000001 and report.Scores.attack.Learned==0)
    assert(report.Scores.attack.Total==bot:Score(situation,"attack"))
    for action,score in pairs(report.Scores) do
        assert(math.abs(score.Total-score.Profile-score.Health-score.Threat-score.Distance-score.Cohesion-score.Learned)<0.000001)
    end
    report.Scores.attack.Profile=999; assert(bot:Decision().Scores.attack.Profile<1)
    bot:Decide(situation,now+0.2); assert(bot:Decision().Held and bot:Decision().Age>0)
    assert(bot:Samples()==0 and not bot:IsDirty(), "diagnostics do not train the bot")
    bot:Reward(-1); bot:Finish(); assert(not bot:Decision())
    bot:Decide(situation,now+3)
    assert(bot:Decision().Scores.attack.Learned<0 and bot:Decision().Scores.attack.Samples==1)
    bot:Finish(); situation.HasAlly=false; bot:Decide(situation,now+6)
    assert(not bot:Decision().Scores.group.Eligible and bot:Decision().Scores.group.Total==-100)
`));

test("learning storage validates contexts and preserves corrupt files without overwriting", () => run(brainSetup + `
    local Store=include("sv_bot_storage.lua").BotLearningStore
    local path="zombieplague/bots/learning-v1.json"
    for _,invalid in ipairs({{Version=2,Bots={}}, {Version=1,Bots={{ID=1,Profile="wrong",Experience={}}}},
        {Version=1,Bots={{ID=1,Profile="aggressive",Experience={unknown={Value=0,Samples=1}}}}},
        {Version=1,Bots={{ID=1,Profile="aggressive",Experience={["human:low:balanced:mid:attack"]={Value=0/0,Samples=1}}}}}}) do
        files[path]="invalid"; jsonValues.invalid=invalid
        local store=construct(Store,definitions.isProfile)
        assert(#store:Load()==0 and not store:Save({}))
        assert(files[path]=="invalid")
    end
    files[path]=string.rep("a",524289)
    local store=construct(Store,definitions.isProfile); assert(#store:Load()==0 and not store:Save({}))
`));

test("learning survives reload and failed writes retry without replacing the last good backup", () => run(brainSetup + `
    local Store=include("sv_bot_storage.lua").BotLearningStore
    local path,bot="zombieplague/bots/learning-v1.json",brain("aggressive")
    bot:Decide(situation,now); bot:Reward(-1); bot:Finish()
    local store=construct(Store,definitions.isProfile); assert(#store:Load()==0)
    assert(store:Save({bot:GetMemory()})); local first=files[path]
    local again=construct(Store,definitions.isProfile); local loaded=again:Load()
    assert(#loaded==1 and loaded[1].Experience["human:healthy:balanced:mid:attack"].Samples==1)
    failWrite=true
    assert(not again:Save(loaded) and files[path..".bak.txt"]==first)
    assert(not again:Save(loaded) and files[path..".bak.txt"]==first)
    failWrite=false; assert(again:Save(loaded))
    assert(files[path..".bak.txt"]==first and files[path]~="partial")
`));
