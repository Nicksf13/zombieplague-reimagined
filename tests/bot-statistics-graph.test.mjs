import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup + `
local graph=include("cl_bot_statistics_graph.lua")
local base=analysis.summarize({successRow()},"scope")
base.Period="2026-10-17 10:00 -03:00"; base.Role="human"
`;

test("graph uses hourly archives once, sorts chronologically and keeps roles and conditions separate", () => run(setup + `
    local early=clone(base); early.Period="2026-10-17 09:00 -03:00"
    local daily=clone(base); daily.Period="2026-10-17 -03:00"
    local session=clone(base); session.Period=""
    local zombie=clone(base); zombie.Role="zombie"; zombie.Key="zombie"
    local other=clone(base); other.Key="other-class"; other.ClassID="other"
    local rows=graph.series({base,daily,session,zombie,early,other},"success","human")
    assert(#rows==2 and #rows[1].Points==2 and #rows[2].Points==1)
    assert(rows[1].Points[1].Period==early.Period and rows[1].Points[2].Hour-rows[1].Points[1].Hour==1)
    assert(rows[1].Points[1].Value==100)
    assert(#graph.series({base,zombie},"success","zombie")==1)
`));

test("graph orders archived time zones and calendar transitions using actual hours", () => run(setup + `
    local next=clone(base); base.Period="2026-10-31 23:00 -03:00"; next.Period="2026-11-01 01:00 -02:00"
    local rows=graph.series({next,base},"success","human")
    assert(#rows[1].Points==2 and rows[1].Points[2].Hour-rows[1].Points[1].Hour==1)
    base.Period="2024-02-29 23:00 +00:00"; next.Period="2024-03-01 00:00 +00:00"
    rows=graph.series({next,base},"success","human"); assert(rows[1].Points[2].Hour-rows[1].Points[1].Hour==1)
    for _,invalid in ipairs({"bad","2026-02-30 09:00 -03:00","2026-10-17 99:00 -03:00","2026-10-17 10:01 -03:00","2026-10-17 10:00 +99:00"}) do
        base.Period=invalid; assert(#graph.series({base},"success","human")==0)
    end
`));

test("metrics respect event kind and undefined denominators instead of drawing false zeroes", () => run(setup + `
    base.N=4; base.Eligible=4; base.Success=1; base.Median=3; base.P90=5; base.Active=40; base.Stuck=10
    assert(graph.value(base,"success")==25 and graph.value(base,"stuck")==25)
    assert(graph.value(base,"median")==3 and graph.value(base,"p90")==5)
    assert(graph.value(base,"kills")==nil)
    base.Success=0; assert(graph.value(base,"median")==nil and graph.value(base,"p90")==nil)
    assert(graph.value(base,"success")==0)
    base.Eligible=0; assert(graph.value(base,"success")==nil)
    base.Active=0; assert(graph.value(base,"stuck")==nil)
    base.Kind="combat"; base.Kills=3; base.Deaths=2; base.Wins=2; base.Losses=2; base.Reward=12
    base.DealtPerMinute=120; base.TakenPerMinute=60
    assert(graph.value(base,"success")==nil and graph.value(base,"kills")==3 and graph.value(base,"deaths")==2)
    assert(graph.value(base,"wins")==50 and graph.value(base,"reward")==3)
    assert(graph.value(base,"dealt")==nil and graph.value(base,"taken")==nil)
    base.Active=10; assert(graph.value(base,"dealt")==120 and graph.value(base,"taken")==60)
    base.Wins=0; base.Losses=0; assert(graph.value(base,"wins")==nil)
`));

test("minute series accept nonzero minutes and retain chronological intervals without treating hourly data as minute samples", () => run(setup + `
    local next=clone(base); base.Period="2026-10-17 10:14 -03:00"; next.Period="2026-10-17 10:15 -03:00"
    local rows=graph.series({next,base},"success","human",true)
    assert(#rows==1 and #rows[1].Points==2)
    assert(math.abs(rows[1].Points[2].Hour-rows[1].Points[1].Hour-1/60)<0.00001)
    assert(#graph.series({base,next},"success","human")==0)
`));
