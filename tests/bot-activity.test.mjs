import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local Activity=include("sv_bot_activity.lua").BotActivity
local activity=construct(Activity,"session","code")
local bot=newPlayer(TEAM_ZOMBIES,0)
local scope={Map="gm_test",Role="zombie",ClassID="ZombieDefault",ClassName="ZombieDefault",Variant="normal"}
local plan={Senses={Visible=false},Action="attack",Steering={Position=Vector(200,0,0),Jump=false}}
local issued={Commanded={Forward=200,Side=0,WorldX=200,WorldY=0,Keys=IN_FORWARD,Yaw=0},Interventions={}}
local function counters()
    assert(activity:Export())
    return jsonValues[files["zombieplague/bots/diagnostics/activity-v1.json"]].Rows[1].Counters
end
`;

test("under-fire telemetry separates blocked movement, valid waiting, missing input and foreign control", () => run(setup + `
    activity:Observe(1,scope,bot,plan,issued,true,now)
    now=10.2; activity:Observe(1,scope,bot,plan,issued,true,now)
    local row=counters(); assert(row["UnderFire:command_without_progress:seconds"]>0)
    plan.Wait=true; now=10.4; activity:Observe(1,scope,bot,plan,issued,true,now)
    now=10.6; activity:Observe(1,scope,bot,plan,issued,true,now)
    plan.Wait=false; issued.Commanded.Forward=0
    now=10.8; activity:Observe(1,scope,bot,plan,issued,true,now)
    now=11; activity:Observe(1,scope,bot,plan,issued,true,now)
    issued.Interventions={{Controller="traffic",Reason="wait",Tactical=true,Motion=true}}
    now=11.2; activity:Observe(1,scope,bot,plan,issued,true,now)
    now=11.4; activity:Observe(1,scope,bot,plan,issued,true,now)
    row=counters()
    assert(row["UnderFire:intentional_wait:seconds"]>0 and row["UnderFire:no_command:seconds"]>0)
    assert(row["UnderFire:override:traffic:seconds"]>0 and row["Override:traffic:starts"]==1)
    assert(row.NoVisualContactSeconds>0)
`));

test("jump telemetry distinguishes issued input, observed landing and damage-ambiguous displacement", () => run(setup + `
    plan.Steering.Pick={JumpReason="obstacle"}; issued.Commanded.Keys=IN_FORWARD+IN_JUMP
    activity:Observe(1,scope,bot,plan,issued,false,now)
    bot.airborne=true; bot.position=Vector(30,0,30); issued.Commanded.Keys=IN_FORWARD
    now=10.2; activity:Observe(1,scope,bot,plan,issued,false,now)
    bot.airborne=false; bot.position=Vector(80,0,0)
    now=10.6; activity:Observe(1,scope,bot,plan,issued,false,now)
    local row=counters(); assert(row["Jump:obstacle:issued"]==1 and row["Jump:obstacle:landed_with_progress"]==1)
    issued.Commanded.Keys=IN_FORWARD+IN_JUMP; now=11; activity:Observe(1,scope,bot,plan,issued,false,now)
    bot.airborne=true; now=11.2; activity:Observe(1,scope,bot,plan,issued,true,now)
    bot.airborne=false; issued.Commanded.Keys=IN_FORWARD; now=11.6; activity:Observe(1,scope,bot,plan,issued,true,now)
    assert(counters()["Jump:obstacle:external_or_damage_uncertain"]==1)
`));

test("activity exports remain available with learning frozen and separate scopes and unobserved gaps", () => run(setup + `
    values.zp_bot_evaluation=true
    activity:Observe(1,scope,bot,plan,issued,false,now)
    now=20; activity:Observe(1,scope,bot,plan,issued,false,now)
    assert(counters().UnobservedSeconds==10 and not counters().SurvivalSeconds)
    activity:Reset(1); scope.Role="human"; scope.ClassID="HumanDefault"
    activity:Observe(1,scope,bot,plan,issued,false,now)
    activity:Event(1,"Infections")
    assert(activity:Export())
    local data=jsonValues[files["zombieplague/bots/diagnostics/activity-v1.json"]]
    assert(data.Version==1 and data.Code=="code" and #data.Rows==2 and data.Rows[1].Evaluation)
    assert(not data.Rows[1].Counters.Infections and data.Rows[2].Counters.Infections==1)
`));

test("activity export is restricted to the server console or superadmin", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local user=newPlayer(TEAM_HUMANS,0,false)
    consoleCommands.zp_bot_activity_export(user)
    assert(not files["zombieplague/bots/diagnostics/activity-v1.json"])
    user.admin=true; consoleCommands.zp_bot_activity_export(user)
    assert(files["zombieplague/bots/diagnostics/activity-v1.json"])
`));

test("attack opportunity timing requires an eligible issued attack instead of proximity alone", () => run(setup + `
    plan.Senses.Visible=true; plan.Senses.EnemyPosition=Vector(55,0,0)
    activity:Observe(1,scope,bot,plan,issued,false,now)
    assert(not counters().AttackRangeReached, "proximity is not proof that the weapon can attack")
    now=10.4; issued.Commanded.Keys=IN_ATTACK
    activity:Observe(1,scope,bot,plan,issued,false,now)
    assert(counters().AttackRangeReached==1 and math.abs(counters().AttackRangeSeconds-0.4)<0.00001)
`));
