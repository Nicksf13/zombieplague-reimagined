import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup;

test("comparisons require identical challenges and reward settings; extra ticks do not narrow uncertainty", () => run(setup + `
    local base=successRow(); base.Mode="evaluation"; base.Code="code"; base.Policy="old"; base.Session="one"
    local changed=clone(base); changed.Policy="new"; changed.ID="new"; changed.Session="two"
    local result=analysis.report({base,changed},query,"session",0,100)
    assert(#result.Comparisons==1 and result.Comparisons[1].Result=="inconclusive")
    for _,key in ipairs({"Rewards","Difficulty","Role","Map","Equipment","Settings","Opponents","Navigation","Cohort","Physics"}) do
        local bad=clone(changed); bad[key]="different"
        assert(#analysis.report({base,bad},query,"session",0,100).Comparisons==0,key)
    end
    local bad=clone(changed); bad.Start={1,0,0}; assert(#analysis.report({base,bad},query,"session",0,100).Comparisons==0)
    local many={}; for i=1,100 do many[i]=clone(base); many[i].ID=tostring(i) end
    local summary=analysis.summarize(many,"same-session")
    assert(summary.N==100 and summary.Sessions==1 and summary.Low==0 and summary.High==1)
`));

test("controlled independent sessions can show improvement/regression and flag reward exploitation", () => run(setup + `
    local base=successRow(); base.Mode="evaluation"; base.Code="code"; base.Policy="old"
    local rows={}
    for version=1,2 do for i=1,100 do
        local row=clone(base); row.ID=version..":"..i; row.Session=row.ID; row.Policy=version==1 and "old" or "new"
        if version==1 then row.End="timeout" end
        rows[#rows+1]=row
    end end
    local result=analysis.report(rows,query,"session",0,100)
    -- Old has no successful duration distribution: timing cannot establish overall improvement.
    assert(result.Comparisons[1].Result=="inconclusive")
    for i=1,10 do rows[i].End="success"; rows[i].Seconds=10 end
    result=analysis.report(rows,query,"session",0,100); assert(result.Comparisons[1].Result=="improvement")
    for i=101,200 do rows[i].End="timeout"; rows[i].Reward=10 end
    result=analysis.report(rows,query,"session",0,100)
    assert(result.Comparisons[1].RewardWarning and result.Comparisons[1].Result=="inconclusive")
    for i=1,100 do rows[i].End="success" end
    assert(analysis.report(rows,query,"session",0,100).Comparisons[1].Result=="regression")
`));

test("block size, filters, quantiles and bounded retention/export are explicit", () => run(setup + `
    local base=successRow(); local rows={}
    for i=1,205 do rows[i]=clone(base); rows[i].ID=tostring(i); rows[i].Seconds=i end
    local result=analysis.report(rows,query,"session",0,100); local blocks={}
    for _,group in ipairs(result.Groups) do if group.Block>0 then blocks[#blocks+1]=group.N end end
    assert(#blocks==3 and blocks[1]==100 and blocks[2]==100 and blocks[3]==5)
    local sum=analysis.summarize(rows,"quantiles"); assert(sum.Median==103 and sum.P90==185)
    query.Bot="2"; assert(analysis.report(rows,query,"session",0,100).Total==0); query.Bot=""
    values.zp_bot_stats_retention=100
    for i=1,60 do stats:Finish(1,"interrupted","reset"); observe(0); observe(180) end
    assert(stats:Save()); local stored=jsonValues[files["zombieplague/bots/statistics/history-v1.json"]]
    assert(#stored.Rows==100 and stored.Dropped>0)
    assert(stats:Export(query)); local export=jsonValues[files["zombieplague/bots/statistics/export-v1.json"]]
    assert(export.Version==1 and #export.Rows==100 and export.Report.Dropped>0)
`));
