import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local definitions=include("sv_bot_brain.lua")
local function brain(profile,role,health)
    local situation={Role=role,Health=health,Distance=400,Allies=0,Enemies=3,HasAlly=false}
    local memory={ID=1,Profile=profile,Experience={}}
    return construct(definitions.BotBrain,memory),situation,memory
end
`;

test("healthy outnumbered zombies advance despite old retreat preferences, without erasing experience", () => run(setup + `
    values.zp_bot_learning=false
    for _,profile in ipairs(definitions.profiles) do
        for _,id in ipairs({1,5,19,64}) do
            for _,health in ipairs({0.65,1}) do
                for _,distance in ipairs({100,400,1000}) do
                    local bot,situation,memory=brain(profile,"zombie",health); memory.ID=id; situation.Distance=distance
                    local key=definitions.context(situation)
                    memory.Experience[key..":attack"]={Value=-1,Samples=100}
                    memory.Experience[key..":retreat"]={Value=1,Samples=100}
                    assert(bot:Score(situation,"attack")>bot:Score(situation,"retreat"), profile.." still prefers retreat")
                    assert(bot:Decide(situation,now)~="retreat")
                    local report=bot:Decision()
                    assert(report and not report.Scores.retreat.Eligible and report.Scores.retreat.Threat==-100 and report.Scores.attack.Health>0)
                    assert(memory.Experience[key..":retreat"].Value==1 and bot:Samples()==200 and not bot:IsDirty())
                end
            end
        end
    end
`));

test("critical zombies can retreat, humans retain their choices, and healing interrupts a held retreat", () => run(setup + `
    for _,profile in ipairs(definitions.profiles) do
        local bot,situation=brain(profile,"zombie",0.2)
        assert(bot:Decide(situation,now)=="retreat", profile.." must retain low-health survival")
    end
    local human,situation=brain("cautious","human",1)
    assert(human:Decide(situation,now)=="retreat")
    local zombie,situation=brain("cautious","zombie",0.5)
    assert(zombie:Decide(situation,now)=="retreat")
    situation.Health=0.65
    assert(zombie:Decide(situation,now+0.1)~="retreat" and not zombie:Decision().Held)
`));

test("exploration no longer randomly retreats at high zombie health but still explores other behaviors", () => run(setup + `
    math.random=function(low,high) if high==100 then return 1 end return high end
    local zombie,situation=brain("cautious","zombie",1)
    assert(zombie:Decide(situation,now)=="defend" and zombie:Reason()=="explore")
    local injured,situation=brain("cautious","zombie",0.5)
    assert(injured:Decide(situation,now)=="retreat")
    local human,situation=brain("cautious","human",1)
    assert(human:Decide(situation,now)=="retreat")
`));

test("failed zombie retreats get stronger damage feedback, including high-HP classes, with bounded pellet-independent rewards", () => run(setup + `
    local function result(role,health,maxHealth,hits,amount)
        local bot,situation,memory=brain("cautious",role,health)
        local action=bot:Decide(situation,now)
        for i=1,hits do bot:DamageTaken(amount,maxHealth) end
        bot:Finish()
        return memory.Experience[definitions.context(situation)..":"..action].Value
    end
    local normal=result("zombie",0.5,100,1,10)
    local human=result("human",0.5,100,1,10)
    assert(math.abs(normal-human*2)<0.000001)
    local nemesis=result("zombie",0.5,20000,1,100)
    local pellets=result("zombie",0.5,20000,10,10)
    assert(math.abs(nemesis+0.04)<0.000001 and math.abs(nemesis-pellets)<0.000001)
    assert(math.abs(result("zombie",1,20000,1,100)+0.001)<0.000001, "attacking keeps its original damage penalty")
    assert(math.abs(result("zombie",0.5,20000,4,1000000)+0.2)<0.000001, "learned targets remain bounded")
`));

test("losing sight alone rewards humans but cannot establish a successful zombie escape", () => run(setup + `
    for _,case in ipairs({{"human",1,true},{"zombie",0.2,false},{"zombie",0.5,false}}) do
        local bot,situation,memory=brain("cautious",case[1],case[2])
        assert(bot:Decide(situation,now)=="retreat")
        bot:Escaped(); bot:Finish()
        local estimate=memory.Experience[definitions.context(situation)..":retreat"]
        if case[3] then assert(math.abs(estimate.Value-0.03)<0.000001) else assert(not estimate and bot:Samples()==0) end
    end
`));

test("Nemesis damage and failed escape update retreat learning and diagnostics in its own scope", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.nemesis=true; bot.maxHealth=20000; bot.health=10000
    local attacker=newPlayer(TEAM_HUMANS,400,false)
    newPlayer(TEAM_HUMANS,450,false); newPlayer(TEAM_HUMANS,500,false)
    bots:Attach(bot,"cautious"); now=11; bots:Update()
    assert(bots:GetStatus(bot).Action=="retreat")
    bots:Command(bot,command())
    bots:Damage(bot,damage(attacker,100),false)
    assert(bots:Diagnostics(0,1).Rows[1].Totals.DamageTaken==0)
    bots:Damage(bot,damage(attacker,100),true)
    wall=true; now=11.3; bots:Update()
    assert(bots:GetStatus(bot).Action=="retreat" and bots:GetStatus(bot).Samples==0, "hidden does not mean safe yet")
    bots:Reset(bot)
    local data=bots:Diagnostics(0,2); local row=data.Rows[1]
    assert(ZPBotMetricsProtocol.Snapshot(data) and row.Scope.Variant=="nemesis")
    assert(row.Totals.DamageTaken==100 and row.Totals.Actions.retreat.Negative==1 and row.Samples==1)
    assert(math.abs(row.LastReward+0.2)<0.000001, "escaping at medium health cannot cancel retreat damage")
    bots:Save()
    local saved=sharedMemory(1,"zombie","ZombieDefault","nemesis")
    assert(math.abs(saved.Experience["zombie:healthy:outnumbered:mid:retreat"].Value+0.04)<0.000001)
    bot.nemesis=false; bot.team=TEAM_HUMANS; bots:Reset(bot)
    assert(bots:GetStatus(bot).Samples==0 and bots:Diagnostics(0,3).Rows[1].Totals.DamageTaken==0)
`));

test("unsuccessful noncritical retreats on death receive a severe bounded penalty in their original context", () => run(setup + `
    local medium,situation,memory=brain("cautious","zombie",0.5)
    local key=definitions.context(situation)..":retreat"
    assert(medium:Decide(situation,now)=="retreat"); situation.Health=0.1
    medium:Death(); assert(math.abs(memory.Experience[key].Value+0.6)<0.000001)
    medium:Death(); assert(memory.Experience[key].Samples==1)
    local critical,low,lowMemory=brain("cautious","zombie",0.2)
    assert(critical:Decide(low,now)=="retreat"); critical:Death()
    assert(math.abs(lowMemory.Experience[definitions.context(low)..":retreat"].Value+0.2)<0.000001)
`));

test("healthy zombies cannot use grouping to follow an ally away from a visible human", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua"); local zombie=newPlayer(TEAM_ZOMBIES,0)
    local enemy=Vector(400,0,0)
    local senses={Visible=true,EnemyPosition=enemy,AllyPosition=Vector(-300,0,0),Allies=1,Enemies=1}
    assert(motor.destination(zombie,senses,"group","cooperative")==enemy)
    senses.AllyPosition=Vector(250,0,0)
    assert(motor.destination(zombie,senses,"group","cooperative")==senses.AllyPosition)
    zombie.health=20; senses.AllyPosition=Vector(-300,0,0)
    assert(motor.destination(zombie,senses,"group","cooperative")==senses.AllyPosition)
`));
