import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { integritySetup } from "./helpers/bot-integrity.mjs";
import { boostSetup } from "./helpers/bot-boosts.mjs";

test("fall timing preserves the last actual ground command and departure across action expiry", () => run(integritySetup + `
    trace.Record=function(event) event.Time=now; events[#events+1]=clone(event) end
    local owner=begin()
    now=10.6; learner:Choose(frame(90,"air"),{forward},now); input(now,90,"air")
    now=10.8; learner:Harm(25,"late")
    local departure,fall,finish
    for _,row in ipairs(events) do
        if row.Kind=="departure" then departure=row end
        if row.Kind=="consequence" then fall=row end
        if row.Kind=="finalize" and row.Experience==owner then finish=row end
    end
    assert(departure.Experience==owner and departure.CommandAt==10.2 and departure.DepartureAt==10.4)
    assert(fall.Attributed and fall.Experience==owner and fall.Incident=="late")
    assert(fall.CommandAt==10.2 and fall.DepartureAt==10.4 and fall.Time==10.8)
    assert(finish.Incident==fall.Incident and finish.Time==10.8 and finish.Updated)
    learner:Harm(25,"late")
    local count=0; for _,row in ipairs(events) do if row.Kind=="consequence" then count=count+1 end end
    assert(count==1,"a repeated callback cannot become another detected fall")
`));

test("an unassigned fall retains its incident and limitation without inventing command timing", () => run(integritySetup + `
    now=10; learner:Choose(frame(0,"air"),{forward},now)
    learner:Harm(20,"unknown")
    local fall,limitation
    for _,row in ipairs(events) do
        if row.Kind=="consequence" then fall=row end
        if row.Kind=="unattributed" then limitation=row end
    end
    assert(fall.Incident=="unknown" and not fall.Attributed and fall.Consequence=="fall")
    assert(not fall.CommandAt and not fall.DepartureAt and not limitation.Updated)
    assert(limitation.Incident==fall.Incident and limitation.Reason==fall.Reason)
`));

test("stale departure evidence is described without widening attribution or punishing a later action", () => run(integritySetup + `
    begin(); now=11; learner:Harm(20,"stale")
    local fall
    for _,row in ipairs(events) do if row.Kind=="consequence" then fall=row end end
    assert(not fall.Attributed and fall.Reason=="stale_flight_before_damage")
    assert(fall.CommandAt==10.2 and fall.DepartureAt==10.4 and #updates()==0)
`));

test("superseded movement names its actual controller without changing neutral finalization", () => run(integritySetup + `
    now=10; learner:Choose(frame(0),{forward},now); input(now,0)
    local owner=learner:ExperienceID()
    learner:Cancel("controller_substitution",false,{Controller="traffic",Reason="negotiated_passage",Motion=true,Tactical=true})
    local finish
    for _,row in ipairs(events) do if row.Kind=="finalize" and row.Experience==owner then finish=row end end
    assert(finish.Outcome=="superseded" and finish.Controller=="traffic" and finish.InterventionReason=="negotiated_passage")
    assert(finish.Before==finish.After and not finish.Updated and next(memory.Estimates)==nil)
`));

test("a capture boundary snapshots live pending experiences without finalizing or resetting them", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); newPlayer(TEAM_HUMANS,400,false)
    values.zp_bot_learning_trace=true
    bots:Attach(bot,"aggressive"); now=11; bots:Update(); bots:Command(bot,command())
    consoleCommands.zp_bot_learning_trace_mark(emptyEntity,"",{"1","active_end"})
    assert(bots.Trace:Export())
    local rows=jsonValues[files["zombieplague/bots/diagnostics/learning-trace-v1.json"]].Rows
    local marker=rows[#rows]
    assert(marker.Kind=="marker" and marker.Reason=="active_end" and #marker.Open.Motion==1 and #marker.Open.Tactical==1)
    for _,row in ipairs(rows) do assert(row.Kind~="finalize","marking a boundary cannot change the experiment") end
    local ordinary=newPlayer(TEAM_HUMANS,100,false)
    local count=#logs
    consoleCommands.zp_bot_learning_trace_mark(ordinary,"",{"1","manual_fall"})
    consoleCommands.zp_bot_learning_trace_mark(emptyEntity,"",{"1","unknown_label"})
    assert(#logs==count,"manual annotations require authorization and a valid label")
`));

test("runtime traces distinguish active parameter updates from the same fall with evaluation frozen", () => run(botSetup + `
    local bots=include("sv_bots.lua").bots
    local bot=newPlayer(TEAM_ZOMBIES,0); newPlayer(TEAM_HUMANS,400,false)
    values.zp_bot_learning_trace=true
    bots:Attach(bot,"aggressive"); now=11; bots:Update(); bots:Command(bot,command())
    bot.airborne=true; bot.position=Vector(25,0,-5); now=11.1; bots:Command(bot,command())
    bots:Damage(bot,damage(emptyEntity,20,DMG_FALL),true)
    bot.airborne=false; bot.position=Vector(0,0,0)
    values.zp_bot_evaluation=true; now=12; bots:Update(); bots:Command(bot,command())
    bot.airborne=true; bot.position=Vector(25,0,-5); now=12.1; bots:Command(bot,command())
    bots:Damage(bot,damage(emptyEntity,20,DMG_FALL),true)
    assert(bots.Trace:Export())
    local active,frozen=0,0
    for _,row in ipairs(jsonValues[files["zombieplague/bots/diagnostics/learning-trace-v1.json"]].Rows) do
        if row.Kind=="update" then assert(row.Learning and not row.Evaluation); active=active+1 end
        if row.Kind=="finalize" and row.Learner=="motion" and row.Evaluation and row.Outcome=="failure" then
            assert(not row.Learning and not row.Updated and row.Before==row.After); frozen=frozen+1
        end
    end
    assert(active>=1 and frozen==1)
`));

test("boost diagnostics report the executed pair update and preserve frozen values on the same outcome", () => run(boostSetup + `
    local rows,serial={},0
    local trace={NewID=function() serial=serial+1; return "boost:"..serial end,Record=function(row) rows[#rows+1]=clone(row) end}
    manager=construct(Manager,nil,function() return trace end)
    savePoint(); assert(start()); jumpFromSupport()
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,72); now=now+0.2
    manager:Control(climber,now); manager:Save()
    local active=rows[#rows]; assert(active.Kind=="finalize" and active.Learner=="boost" and active.Updated and active.After>active.Before)
    values.zp_bot_evaluation=true
    manager=construct(Manager,nil,function() return trace end)
    now=now+20; climber.position=Vector(-64,0,0); assert(start()); jumpFromSupport()
    climber.airborne=false; climber.groundEntity=emptyEntity; climber.position=Vector(64,0,72); now=now+0.2
    manager:Control(climber,now)
    local frozen=rows[#rows]; assert(frozen.Outcome=="success" and not frozen.Updated and frozen.After==frozen.Before)
`));
