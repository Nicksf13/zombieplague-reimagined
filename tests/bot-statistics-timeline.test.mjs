import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup;

test("durable hourly/day history survives raw retention and server restarts", () => run(setup + `
    values.zp_bot_stats_retention=100
    for i=1,80 do stats:Finish(1,"interrupted","reset"); observe(0); observe(180) end
    stats:Finish(1,"interrupted","stop"); assert(stats:Save())
    local before=stats:Report(query); assert(before.Dropped>0 and before.Total==100)
    local total=0; for _,group in ipairs(before.Timeline) do if group.Kind=="navigation" and #group.Period>20 then total=total+group.N end end
    assert(total==80, "archive must retain trials pruned from the raw buffer")
    local restored=construct(Statistics); local after=restored:Report(query); local recovered=0
    for _,group in ipairs(after.Timeline) do if group.Kind=="navigation" and #group.Period>20 then
        recovered=recovered+group.N; assert(group.Descriptive and group.Median>=0.5 and group.Median<=0.55)
    end end
    assert(recovered==80 and #after.Timeline>0)
    assert(restored:Export(query)); local exported=jsonValues[files["zombieplague/bots/statistics/export-v1.json"]]
    assert(exported.TimelineQuantileFactor==1.1 and #exported.Timeline>0 and #exported.Rows==100)
`));

test("archived buckets keep hours, days and difficulty apart and obey age retention", () => run(setup + `
    successRow(); stats:Finish(1,"interrupted","reset")
    epoch=epoch+3600; observe(0); observe(180); stats:Finish(1,"interrupted","reset")
    epoch=epoch+86400; values.zp_bot_stats_difficulty="hard"; observe(0); observe(180); stats:Finish(1,"interrupted","stop")
    assert(stats:Save()); local result=stats:Report(query)
    local hours,hard=0,0
    for _,group in ipairs(result.Timeline) do if group.Kind=="navigation" and #group.Period>20 then hours=hours+1; if group.Difficulty=="hard" then hard=hard+1 end end end
    assert(hours==3 and hard==1)
    values.zp_bot_stats_days=1; epoch=epoch+86400; stats:Save(); result=stats:Report(query)
    assert(result.TimelineDropped>0)
    for _,group in ipairs(result.Timeline) do assert(group.Difficulty=="hard") end
`));

test("invalid timeline files remain untouched and failed writes preserve the verified backup", () => run(setup + `
    successRow(); stats:Finish(1,"interrupted","reset"); assert(stats:Save())
    local path="zombieplague/bots/statistics/timeline-v1.json"; local previous=files[path]
    observe(0); observe(180); failWrite=true; assert(not stats:Save())
    assert(files[path..".bak.txt"]==previous)
    failWrite=false; assert(stats:Save())
    files[path]="corrupt"
    local restored=construct(Statistics); assert(not restored:Save() and files[path]=="corrupt")
`));
