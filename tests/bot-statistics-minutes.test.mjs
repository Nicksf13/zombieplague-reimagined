import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup;
test("minute snapshots update active trials without counting polls as new samples and retain distinct minute deltas", () => run(setup + `
    observe(0); observe(0); stats:Event(1,"Dealt",10)
    local function combat(report) local result={} for _,row in ipairs(report.Minutes) do if row.Kind=="combat" then result[#result+1]=row end end return result end
    local first=combat(stats:Report(query)); assert(#first==1 and first[1].N==1)
    for i=1,20 do assert(combat(stats:Report(query))[1].N==1) end
    epoch=epoch+60; now=now+0.5; stats:Event(1,"Dealt",20); observe(0)
    local rows=combat(stats:Report(query)); assert(#rows==2 and rows[1].Period~=rows[2].Period and rows[1].N==1 and rows[2].N==1)
    local dealt=0; for _,row in ipairs(rows) do dealt=dealt+row.DealtPerMinute*row.Active/60 end
    assert(math.abs(dealt-30)<0.000001,"new minutes receive deltas rather than cumulative damage")
    stats:Finish(1,"enemy","test"); assert(stats:Save())
    local restored=construct(Statistics); assert(#combat(restored:Report(query))==2)
    assert(analysis.parseReport(restored:Report(query)))
`));

test("round wins belong to one final minute segment and corrupt minute files remain intact", () => run(setup + `
    observe(0); epoch=epoch+60; observe(0); stats:EndRound(HUMANS_WIN)
    local wins=0; for _,row in ipairs(stats:Report(query).Minutes) do if row.Kind=="combat" then wins=wins+row.Wins end end
    assert(wins==1)
    local path="zombieplague/bots/statistics/minutes-v1.json"; files[path]="corrupt"
    local restored=construct(Statistics); restored:Attach(1)
    restored:Observe(1,ply,scope,"policy",plan,goal,"test",route,now)
    assert(not restored:Save() and files[path]=="corrupt")
`));
test("minute collection does not write per sample and navigation success is counted only once on completion", () => run(setup + `
    local before=writes; observe(0)
    for i=1,10 do observe(0); stats:Report(query) end
    assert(writes==before)
    observe(180); local completed=0
    for _,row in ipairs(stats:Report(query).Minutes) do if row.Kind=="navigation" then completed=completed+row.Success end end
    assert(completed==1)
    for i=1,10 do stats:Report(query) end
    completed=0; for _,row in ipairs(stats:Report(query).Minutes) do if row.Kind=="navigation" then completed=completed+row.Success end end
    assert(completed==1)
`));
