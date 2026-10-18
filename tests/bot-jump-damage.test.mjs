import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory)
local function frame(x,mode)
    return {Key="physics:1>2:"..(mode or "ground")..":blocked:normal",Edge="physics:1>2",Mode=mode or "ground",From=1,To=2,
        Position=Vector(x or 0,0,0),Remaining=200-(x or 0),RouteRemaining=500-(x or 0),Speed=200,Breath=100,
        Drain=false,Dynamic=false,Goal=Vector(500,0,0),Completed=false,Final=false,Path={0,0,0,200,0,0,500,0,0},Intent="pursuit:2"}
end
local function jump(action,issued)
    local choice={Action=action or "jump",Position=Vector(48,0,0),Jump=true,Duck=false,Sprint=false,Preference=0.6,Keys=0}
    learner:Choose(frame(),{choice},now)
    if issued~=false then learner:Input(IN_FORWARD+IN_JUMP,0) end
    return choice
end
`;

test("damage to executed jumps and diagonal jumps learns negative takeoff values even after useful progress", () => run(setup + `
    for _,action in ipairs({"jump","jumpleft","jumpright"}) do
        memory=ZPBotMotionProtocol.Empty(); learner=construct(Motion,memory); now=10
        local choice=jump(action)
        now=10.2; choice.Jump=false; learner:Choose(frame(50,"air"),{choice},now)
        learner:ShotWhileJumping(20)
        now=10.4; local landing=frame(140); landing.Completed=true; landing.Final=true
        learner:Choose(landing,{},now)
        local key="physics:1>2:ground:blocked:normal:"..action
        assert(memory.Estimates[key] and math.abs(memory.Estimates[key].Value+0.04)<0.000001)
        assert(not memory.Estimates["physics:1>2:air:blocked:normal:"..action], "takeoff owns the injury")
        assert(memory.Totals.Harm==20 and memory.Totals.Goals==1 and memory.Totals.Failures==0)
        assert(learner:Diagnostic().Reward<0 and ZPBotMotionProtocol.Memory(memory))
    end
`));

test("headshot-sized damage has a greater bounded cost and simultaneous pellets share one jump outcome", () => run(setup + `
    local function result(hits,amount)
        memory=ZPBotMotionProtocol.Empty(); learner=construct(Motion,memory); now=10; jump()
        for i=1,hits do learner:ShotWhileJumping(amount) end
        now=10.2; learner:Cancel()
        assert(memory.Totals.Attempts==1 and memory.Totals.Harm==hits*amount and learner:Diagnostic().Samples==1)
        return memory.Estimates["physics:1>2:ground:blocked:normal:jump"].Value
    end
    assert(math.abs(result(1,40)-result(4,10))<0.000001)
    assert(result(1,100)<result(1,20))
    assert(math.abs(result(1,1000000)+0.2)<0.000001, "learning target remains bounded")
`));

test("knockback and lethal interruption preserve jump injury without crediting forced displacement or failing a passage", () => run(setup + `
    local choice=jump(); now=10.1; learner:ShotWhileJumping(50)
    local forced=frame(180,"air"); forced.Forced=true
    learner:Choose(forced,{choice},now)
    assert(memory.Totals.Attempts==1 and memory.Totals.Progress==0 and memory.Totals.Distance==0)
    assert(memory.Totals.Failures==0 and next(memory.Passages)==nil and learner:Cost("physics:1>2",200,200)==1)
    assert(memory.Estimates["physics:1>2:ground:blocked:normal:jump"].Value<0)
    learner:Cancel(); assert(memory.Totals.Attempts==1, "confirmed injury is committed once")
    memory=ZPBotMotionProtocol.Empty(); learner=construct(Motion,memory); now=20; jump()
    learner:ShotWhileJumping(100); learner:Cancel()
    assert(learner:Diagnostic().Samples==1 and learner:Diagnostic().Reward<0, "death cancellation retains the hit")
`));

test("unexecuted jumps, nonjump maneuvers and cancelled trials cannot acquire jump damage credit", () => run(setup + `
    jump("jump",false); learner:ShotWhileJumping(50); learner:Cancel()
    assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0)
    now=11; jump("forward"); learner:ShotWhileJumping(50); learner:Cancel()
    assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0, "a push without a jump is not exposure from jumping")
    now=12; jump(); learner:Cancel(); learner:ShotWhileJumping(50)
    assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0)
    now=13; jump(); learner:ShotWhileJumping(0); learner:ShotWhileJumping(-1); learner:ShotWhileJumping(0/0); learner:ShotWhileJumping(math.huge)
    learner:Cancel(); assert(memory.Totals.Harm==0 and learner:Diagnostic().Samples==0)
`));

test("learning disabled retains jump harm metrics while safe jumps keep normal positive movement feedback", () => run(setup + `
    values.zp_bot_learning=false; jump(); learner:ShotWhileJumping(20); now=10.2; learner:Cancel()
    assert(memory.Totals.Harm==20 and memory.Totals.Attempts==1 and learner:Diagnostic().Samples==0)
    assert(learner:Diagnostic().Reward<0 and learner:IsDirty())
    memory=ZPBotMotionProtocol.Empty(); learner=construct(Motion,memory); values.zp_bot_learning=true; now=20
    local choice=jump(); now=20.2; choice.Jump=false; learner:Choose(frame(70,"air"),{choice},now)
    now=20.5; local done=frame(190); done.Completed=true; done.Final=true; learner:Choose(done,{},now)
    assert(memory.Estimates["physics:1>2:ground:blocked:normal:jump"].Value>0 and memory.Totals.Harm==0)
`));

test("repeated damaged jumps favor feasible ground movement while required jumps remain available", () => run(setup + `
    for i=1,3 do now=10+i; jump(); learner:ShotWhileJumping(100); now=now+0.2; learner:Cancel() end
    now=14
    local forward={Action="forward",Position=Vector(48,0,0),Jump=false,Duck=false,Sprint=false,Preference=0.4,Keys=0}
    local hop={Action="jump",Position=Vector(48,0,0),Jump=true,Duck=false,Sprint=false,Preference=0.6,Keys=0}
    assert(learner:Choose(frame(),{hop,forward},now).Action=="forward", "unsafe jumping becomes less attractive")
    learner:Cancel(); now=15
    assert(learner:Choose(frame(),{hop},now).Action=="jump", "learning does not ban a required jump")
`));

const runtime = botSetup + `
local bots=include("sv_bots.lua").bots
local zombie=newPlayer(TEAM_ZOMBIES,0); zombie.maxHealth=20000; zombie.health=20000; zombie.nemesis=true
local human=newPlayer(TEAM_HUMANS,400,false)
obstacle=true
bots:Attach(zombie,"aggressive"); now=11; bots:Update()
local cmd=command(); bots:Command(zombie,cmd)
assert(bots:GetStatus(zombie).Action=="attack" and cmd.buttons & IN_JUMP~=0)
zombie.airborne=true
`;

test("actual pursuit inputs link airborne human damage and knockback to Nemesis movement diagnostics and saved scope", () => run(runtime + `
    bots:Damage(zombie,damage(human,40),true)
    zombie.velocity=Vector(1000,0,200); zombie.position=Vector(-150,0,100); now=11.25; bots:Update()
    local packet=bots:Diagnostics(0,1); local row=packet.Rows[1]
    assert(row.Scope.Variant=="nemesis" and row.Motion.Harm==40 and row.Motion.Reward<0 and row.Motion.Samples==1)
    assert(row.Motion.Progress==0 and row.Motion.Failures==0 and ZPBotMetricsProtocol.Snapshot(packet))
    bots:Save()
    local path="zombieplague/bots/movement/"..util.SHA256(ZPBotMetricsProtocol.Key(row.Scope)).."/"..util.SHA256("missing"):sub(1,16).."/1.json"
    local saved=jsonValues[files[path]]
    local found=false
    for key,estimate in pairs(saved.Memory.Estimates) do
        if key:match(":ground:blocked:normal:jump$") and estimate.Value<0 then found=true end
    end
    assert(found and saved.Memory.Totals.Harm==40, "jump exposure persists in the original map/class/variant scope")
    zombie.nemesis=false; bots:Reset(zombie)
    assert(bots:Diagnostics(0,2).Rows[1].Motion.Harm==0)
`));

test("controller excludes grounded, friendly, unapplied, nonhuman and inactive airborne damage", () => run(runtime + `
    local ally=newPlayer(TEAM_ZOMBIES,20,false)
    bots:Damage(zombie,damage(human,20),false)
    bots:Damage(zombie,damage(ally,20),true)
    bots:Damage(zombie,damage(emptyEntity,20),true)
    zombie.airborne=false; bots:Damage(zombie,damage(human,20),true); zombie.airborne=true
    zombie.water=3; bots:Damage(zombie,damage(human,20),true); zombie.water=0
    zombie.moveType=MOVETYPE_LADDER; bots:Damage(zombie,damage(human,20),true); zombie.moveType=2
    zombie.frozen=true; bots:Damage(zombie,damage(human,20),true); zombie.frozen=false
    RoundManager.FreezeTimeActive=true; bots:Damage(zombie,damage(human,20),true); RoundManager.FreezeTimeActive=false
    values.zp_bot_ai_enabled=false; bots:Damage(zombie,damage(human,20),true); values.zp_bot_ai_enabled=true
    RoundManager.state=ROUND_STARTING_NEW_ROUND; bots:Damage(zombie,damage(human,20),true); RoundManager.state=ROUND_PLAYING
    now=12; bots:Damage(zombie,damage(human,20),true)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==0)
    bots:Reset(zombie); assert(bots:Diagnostics(0,2).Rows[1].Motion.Samples==0)
`));

test("lethal human damage is learned before death cleanup and is not counted again by post-damage observation", () => run(runtime + `
    local hit=damage(human,100)
    zombie.alive=false
    hooks.DoPlayerDeath.ZPAdaptiveBots(zombie,human,hit)
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(zombie,hit,true)
    local motion=bots:Diagnostics(0,1).Rows[1].Motion
    assert(motion.Harm==100 and motion.Samples==1 and motion.Reward<0)
`));

test("environmental lethal damage attributed to a human keeps its existing movement penalty without counting the injury twice", () => run(runtime + `
    local hit=damage(human,20,DMG_FALL)
    hooks.DoPlayerDeath.ZPAdaptiveBots(zombie,human,hit)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==20)
`));

test("human jumps and zombie retreats do not inherit pursuit jump damage penalties", () => run(runtime + `
    zombie.airborne=false; zombie.health=4000; bots:Reset(zombie)
    newPlayer(TEAM_HUMANS,450,false); newPlayer(TEAM_HUMANS,500,false)
    now=12; bots:Update(); bots:Command(zombie,cmd)
    assert(bots:GetStatus(zombie).Action=="retreat")
    zombie.airborne=true; bots:Damage(zombie,damage(human,20),true)
    assert(bots:Diagnostics(0,1).Rows[1].Motion.Harm==0)
    zombie.airborne=false; zombie.team=TEAM_HUMANS; human.team=TEAM_ZOMBIES; zombie.health=20000
    now=13; bots:Reset(zombie); bots:Update(); bots:Command(zombie,cmd)
    assert(cmd.buttons & IN_JUMP~=0)
    zombie.airborne=true; bots:Damage(zombie,damage(human,20),true)
    assert(bots:Diagnostics(0,2).Rows[1].Motion.Harm==0)
`));
