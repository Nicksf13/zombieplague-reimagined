import { botSetup } from "./adaptive-bots.mjs";

export const integritySetup = botSetup + `
local Motion=include("sv_bot_motion.lua").BotMotionLearner
local events,serial={},0
local trace={NewID=function(layer) serial=serial+1; return layer..":"..serial end,
    Record=function(event) events[#events+1]=clone(event) end}
local memory=ZPBotMotionProtocol.Empty(); local learner=construct(Motion,memory,nil,trace)
local function frame(x,mode,edge)
    edge=edge or "physics:1>2"
    return {Key=edge..":"..(mode or "ground"),Edge=edge,Mode=mode or "ground",From=1,To=2,Position=Vector(x,0,0),
        Remaining=200-x,RouteRemaining=500-x,Speed=200,Run=300,Breath=100,Drain=false,Dynamic=false,
        Goal=Vector(500,0,0),Intent="crossing",Completed=false,Final=false,Path={}}
end
local forward={Action="forward",Position=Vector(48,0,0),Jump=false,Duck=false,Sprint=false,Preference=0.4,Keys=0}
local function input(time,x,mode)
    now=time
    learner:Input(IN_FORWARD,0,{Mode=mode or "ground",Position=Vector(x,0,0),Velocity=Vector(100,0,mode=="air" and -100 or 0),Run=300,Controlled=true,Moving=true})
end
local function begin()
    now=10; learner:Choose(frame(0),{forward},now); input(now,0)
    local owner=learner:ExperienceID()
    now=10.2; learner:Choose(frame(40),{forward},now); input(now,40)
    now=10.4; learner:Choose(frame(70,"air"),{forward},now); input(now,70,"air")
    return owner
end
local function updates(id)
    local result={}
    for _,event in ipairs(events) do if event.Kind=="update" and event.Learner=="motion" and (not id or event.Experience==id) then result[#result+1]=event end end
    return result
end
`;
