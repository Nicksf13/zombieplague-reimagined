import { botSetup } from "./adaptive-bots.mjs";
export const precisionSetup = botSetup + `
loaded=true
local function rectangle(id,x1,x2,y1,y2)
    local area=newArea(id,(x1+x2)/2,(y1+y2)/2)
    function area:Contains(p) return p.x>=x1 and p.x<=x2 and p.y>=y1 and p.y<=y2 end
    function area:GetClosestPointOnArea(p) return Vector(math.max(x1,math.min(x2,p.x)),math.max(y1,math.min(y2,p.y)),0) end
    return area
end
local a=rectangle(1,0,240,-8,8)
local b=rectangle(2,224,240,8,200)
local c=rectangle(3,240,480,184,200)
a.adjacent={b}; b.adjacent={a,c}; c.adjacent={b}
local function floor(p) return a:Contains(p) or b:Contains(p) or c:Contains(p) end
local floorOverride
util.TraceLine=function(options)
    local hit=(floorOverride or floor)(options.start) and options.start.z>=0 and options.endpos.z<=0
    return {Hit=hit,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,hit and 0 or options.endpos.z),HitNormal=Vector(0,0,1)}
end
local hullOverride
util.TraceHull=function(options)
    if hullOverride then return hullOverride(options) end
    return {Hit=false,Entity=emptyEntity,HitPos=options.endpos}
end
local bot=newPlayer(TEAM_ZOMBIES,80)
local navigator=construct(include("sv_bot_navigation.lua").BotNavigator)
local learner=construct(include("sv_bot_motion.lua").BotMotionLearner,ZPBotMotionProtocol.Empty())
local precision=construct(include("sv_bot_precision.lua").BotPrecisionTraversal)
local physics=include("sv_bot_motion_physics.lua").physics
local motor=include("sv_bot_motor.lua")
local support=include("sv_bot_precision_support.lua")
local goal=Vector(440,192,0)
local step={From=1,To=2,Source=a,Area=b,Position=b.center}
local function steer() return navigator:Steer(bot,goal,now,learner,true,"zigzag") end
local function input(control)
    local cmd=command(); cmd:ClearButtons(); cmd:ClearMovement()
    motor.apply(bot,cmd,{Senses={Visible=false,Allies=0,Enemies=0},Steering=control,Action="attack",Updated=now,ReadyAt=now},1,false)
    local yaw=math.rad(bot.angles.y)
    return Vector(cmd.forward*math.cos(yaw)+cmd.side*math.sin(yaw),cmd.forward*math.sin(yaw)-cmd.side*math.cos(yaw),0),cmd
end
`;
