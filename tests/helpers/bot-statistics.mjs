export const statisticsSetup = `
local epoch=1792263600
util.SHA256=function(value)
    local hash=7.0; for i=1,#value do hash=(hash*131+value:byte(i))%2147483647 end
    return string.rep(string.format("%08x",math.floor(hash)),8)
end
navmesh.IsLoaded=function() return true end
os.time=function() return epoch end
local nativeDate=os.date
-- Fengari treats the Lua UTC prefix as a literal; the engine supports it.
os.date=function(format,stamp) return nativeDate(format:gsub("^!",""),stamp) end
local Statistics=include("sv_bot_statistics.lua").BotStatistics
local analysis=include("sh_bot_statistics_analysis.lua")
local query={Bot="",Version="",Scenario="",Difficulty="",Role="",Period=""}
local stats=construct(Statistics)
local ply=newPlayer(TEAM_HUMANS,0)
local scope=include("sv_bot_contexts.lua").scopeFor(ply)
local goal=Vector(200,0,0)
local plan={Action="group",Senses={Visible=false,Allies=0,Enemies=0},Steering={Position=goal,Stuck=false}}
local route={Remaining=200,Replans=1}
stats:Attach(1)
local function observe(x,dt,intent)
    now=now+(dt or 0.5); ply.position=Vector(x,0,0); route.Remaining=math.abs(200-x)
    stats:Observe(1,ply,scope,"policy",plan,goal,intent or "test",route,now)
end
local function navigationRows(source)
    local rows={}
    for _,row in ipairs((source or stats):Report(query).History) do if row.Kind=="navigation" then rows[#rows+1]=row end end
    return rows
end
local function successRow()
    observe(0); observe(100); observe(180)
    return clone(navigationRows()[1])
end
`;
