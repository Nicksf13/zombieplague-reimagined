import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
import { statisticsSetup } from "./helpers/bot-statistics.mjs";
const setup = botSetup + statisticsSetup;

test("statistics requests authenticate before reading, rate limit senders and reply privately", () => run(setup + `
    successRow()
    local Service=include("sv_bot_statistics_service.lua").BotStatisticsService
    local service=construct(Service,{Statistics=stats})
    local sender=newPlayer(TEAM_HUMANS,0,false); local reads=0; local uints={1,7}
    net.ReadUInt=function() reads=reads+1; return table.remove(uints,1) end
    net.ReadBool=function() reads=reads+1; return false end
    net.ReadString=function() reads=reads+1; return util.TableToJSON(query) end
    net.WriteUInt=function(value) sent[#sent+1]=value end
    service:Receive(500,sender); assert(reads==0)
    sender.admin=true; service:Receive(9000,sender); assert(reads==0)
    service:Receive(500,sender); assert(reads==4 and sent[1]=="ZPBotStatisticsReply" and sent.recipient==sender and sent[2]==7)
    local report=jsonValues[sent[4]]; assert(analysis.parseReport(report) and report.Total==1)
    service:Receive(500,sender); assert(reads==4)
    now=now+1.1; uints={9,8}; service:Receive(500,sender); assert(sent[2]==7,"bad versions cannot replace the reply")
`));

test("export and benchmark commands require the correct administrative permission and bounded arguments", () => run(setup + `
    local Service=include("sv_bot_statistics_service.lua").BotStatisticsService
    local calls=0; local service=construct(Service,{Statistics=stats,Benchmark=function(_,id,goal) calls=calls+1; assert(id==1 and goal.x==10) end})
    service:Register(); local sender=newPlayer(TEAM_HUMANS,0,false)
    consoleCommands.zp_bot_benchmark(sender,"",{"1","10","20","30"}); assert(calls==0)
    sender.admin=true
    consoleCommands.zp_bot_benchmark(sender,"",{"1","10","20","30"}); assert(calls==1)
    consoleCommands.zp_bot_benchmark(sender,"",{"1","100000000","20","30"}); assert(calls==1)
    consoleCommands.zp_bot_benchmark(sender,"",{"1","bad","20","30"}); assert(calls==1)
    local before=writes; sender.admin=false; consoleCommands.zp_bot_stats_export(sender,"",{}); assert(writes==before)
    sender.admin=true; consoleCommands.zp_bot_stats_export(sender,"",{}); assert(files["zombieplague/bots/statistics/export-v1.json"])
`));

test("collection performs no file or network writes per sample", () => run(setup + `
    local before=writes; local network=sent[1]
    for i=1,40 do observe(0) end
    assert(writes==before and sent[1]==network)
    assert(stats:Save() and writes>before)
    before=writes; assert(stats:Save() and writes==before)
`));

test("bot choices include archived identities after restart and are not narrowed by a team or bot filter", () => run(setup + `
    local row=successRow(); stats:Finish(1,"interrupted","stop"); assert(stats:Save())
    local Timeline=include("sv_bot_statistics_timeline.lua").BotStatisticsTimeline
    local timeline=construct(Timeline); row.Bot=2; timeline:Add(row); assert(timeline:Save())
    local restored=construct(Statistics)
    query.Bot="1"; query.Role="human"
    local report=restored:Report(query)
    assert(#report.Bots==2 and report.Bots[1]==1 and report.Bots[2]==2)
    assert(analysis.parseReport(report))
    for _,invalid in ipairs({{1,1},{0},{65},{1.5},{"1"}}) do
        report.Bots=invalid; assert(not analysis.parseReport(report))
    end
`));
