import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup;

test("integrity evaluation separates stamina flags and records the rules needed for matching challenges", () => run(setup + `
    local before=successRow(); stats:Finish(1,"interrupted","configuration")
    values.zp_run_should_drain=true; values.zp_realistic_mode=true
    successRow(); local all=navigationRows(); local after=all[#all]
    assert(before.Settings~=after.Settings and analysis.conditions(before)~=analysis.conditions(after))
    assert(before.Rewards:match("^objectives%-v3:") and after.Settings:find("DrainEnabled",1,true) and after.Settings:find("Tick",1,true))
`));

test("navigation success closes once, samples movement and keeps time together with success", () => run(setup + `
    local row=successRow(); observe(180); observe(190)
    assert(#navigationRows()==1 and row.End=="success" and row.Distance==180 and row.Active==1)
    assert(row.Timestamp==epoch and row.EndedAt==epoch and row.UTCOffset==-180)
    assert(row.RecordedAt:match("%d%d:%d%d:%d%d %-03:00$") and row.Hour:match(":00 %-03:00$"))
    assert(row.Session==stats.Session and row.Bot==1 and row.Incarnation==1)
    local summary=analysis.summarize({row},"test")
    assert(summary.N==1 and summary.Success==1 and summary.Median==row.Seconds and summary.Sessions==1)
    assert(summary.Low==0 and summary.High==1, "one session cannot establish improvement")
`));

test("a fall followed by duplicate death callbacks is one navigation failure", () => run(setup + `
    observe(0); stats:Fall(1); stats:Fall(1)
    assert(stats:Death(1,"fall")); assert(not stats:Death(1,"fall"))
    local rows=navigationRows(); assert(#rows==1 and rows[1].End=="fall" and rows[1].Falls==1)
    local history=stats:Report(query).History
    assert(#history==2 and history[2].Kind=="combat" and history[2].Deaths==1)
`));

test("teleports and observation gaps cannot manufacture a successful arrival", () => run(setup + `
    goal=Vector(10000,0,0); observe(0); observe(10000,0.5)
    assert(navigationRows()[1].End=="interrupted" and navigationRows()[1].Detail=="teleport")
    stats:Finish(1,"interrupted","reset"); goal=Vector(200,0,0); observe(0); observe(180,3)
    assert(navigationRows()[2].End=="interrupted" and navigationRows()[2].Detail=="sampling_gap")
`));

test("enemy, environment, unknown, timeout and administrative interruption stay distinct", () => run(setup + `
    observe(0); stats:Death(1,"enemy"); assert(navigationRows()[1].End=="enemy")
    observe(0); stats:Death(1,"environment"); assert(navigationRows()[2].End=="environment")
    observe(0); stats:Death(1,"unknown"); assert(navigationRows()[3].End=="unknown")
    values.zp_bot_stats_timeout=1; observe(0); observe(0,1.1)
    assert(navigationRows()[4].End=="timeout")
    stats:Finish(1,"interrupted","respawn"); observe(0); stats:Finish(1,"interrupted","shutdown")
    local last=navigationRows()[5]; assert(last.End=="interrupted" and last.Detail=="shutdown")
    local sum=analysis.summarize(navigationRows(),"test")
    assert(sum.N==5 and sum.Eligible==4 and sum.Timeouts==1 and sum.Interrupted==1)
`));

test("missing NavMesh and path failure are infrastructure outcomes, including no destination", () => run(setup + `
    navmesh.IsLoaded=function() return false end
    stats:Observe(1,ply,scope,"policy",plan,nil,"empty",route,now)
    stats:Observe(1,ply,scope,"policy",plan,nil,"empty",route,now+1)
    assert(#navigationRows()==1 and navigationRows()[1].End=="missing_nav")
    navmesh.IsLoaded=function() return true end
    plan.Steering.Unreachable=true; observe(0,2)
    assert(navigationRows()[2].End=="path_failure")
    local sum=analysis.summarize(navigationRows(),"test")
    assert(sum.Infrastructure==2 and sum.Eligible==0 and sum.Low==0 and sum.High==1)
`));

test("respawn retains identity, replacement changes incarnation and scope changes interrupt attempts", () => run(setup + `
    observe(0); stats:Finish(1,"interrupted","respawn"); observe(0)
    scope.Role="zombie"; scope.ClassID="ZombieDefault"
    stats:Finish(1,"interrupted","role_change"); observe(0)
    stats:Finish(1,"interrupted","disconnect"); stats:Attach(1); observe(0); stats:Finish(1,"interrupted","stop")
    local rows=navigationRows()
    assert(rows[1].Bot==rows[2].Bot and rows[1].Incarnation==rows[2].Incarnation and rows[2].Life>rows[1].Life)
    assert(rows[2].Role=="human" and rows[3].Role=="zombie")
    assert(rows[4].Incarnation~=rows[3].Incarnation)
`));

test("history persists after restart, recovers pending attempts as interruption and preserves corrupt input", () => run(setup + `
    successRow(); stats:Finish(1,"interrupted","round_end"); observe(0); assert(stats:Save())
    local restored=construct(Statistics)
    local rows=navigationRows(restored); assert(#rows==2 and rows[2].End=="interrupted" and rows[2].Detail=="unclean_restart")
    assert(rows[1].RecordedAt==navigationRows()[1].RecordedAt)
    local path="zombieplague/bots/statistics/history-v1.json"; local previous=files[path]
    stats:Reward(1,"tactical","external",0.1); failWrite=true; assert(not stats:Save()); assert(files[path..".bak.txt"]==previous)
    failWrite=false; assert(stats:Save())
    files[path]="broken"; local broken=construct(Statistics); assert(not broken:Save() and files[path]=="broken")
`));

test("daily/hourly windows survive reload and preserve date and condition boundaries", () => run(setup + `
    local first=successRow(); local second=clone(first); second.ID="second"; second.Policy="changed"; second.Hour=first.Day:sub(1,10).." 16:00 -03:00"
    local third=clone(second); third.ID="third"; third.Day="2026-10-18 -03:00"; third.Hour="2026-10-18 10:00 -03:00"; third.Difficulty="hard"
    local report=analysis.report({first,second,third},query,"session",0,100)
    local day,firstHour,secondHour,hard=0,0,0,0
    for _,group in ipairs(report.Groups) do
        if group.Period==first.Day and group.Difficulty==first.Difficulty then day=group.N; assert(group.Descriptive and group.Policy=="") end
        if group.Period==first.Hour then firstHour=group.N end
        if group.Period==second.Hour then secondHour=group.N end
        if group.Difficulty=="hard" and group.Period==third.Day then hard=group.N end
    end
    assert(day==2 and firstHour==1 and secondHour==1 and hard==1)
    query.Period=third.Day:sub(1,10); assert(analysis.report({first,second,third},query,"session",0,100).Total==1)
    assert(analysis.parseReport(report) and not analysis.parseReport({Version=1}))
`));

test("rewards retain their components; summaries count real combat per active minute and one result per role/round", () => run(setup + `
    observe(0); observe(50); stats:Reward(1,"tactical","damage_dealt",0.5); stats:Reward(1,"tactical","damage_taken",-0.2)
    stats:Event(1,"Dealt",30); stats:Event(1,"Taken",10); stats:Event(1,"Kills",1)
    stats:Finish(1,"interrupted","reset"); observe(50); observe(100); stats:EndRound(HUMANS_WIN)
    local wins=0; local combat={}
    for _,row in ipairs(stats:Report(query).History) do if row.Kind=="combat" then wins=wins+row.Win; combat[#combat+1]=row end end
    assert(wins==1 and #combat==2)
    assert(math.abs(combat[1].Reward-0.3)<0.0001 and combat[1].Components["tactical:damage_taken"]==-0.2)
    local sum=analysis.summarize(combat,"combat"); assert(sum.DealtPerMinute==1800 and sum.TakenPerMinute==600 and sum.Kills==1)
`));
