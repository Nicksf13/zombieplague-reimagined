import { botSetup } from "./adaptive-bots.mjs";
export const boostSetup = botSetup + `
util.SHA256=function(text)
    local result=7
    for i=1,#text do result=(result*31+string.byte(text,i))%2147483647 end
    return string.format("%08x",result)
end
function playerMeta:Ducking() return self.ducking==true end
function playerMeta:GetGroundEntity() return self.groundEntity or emptyEntity end
function playerMeta:GetEyeTrace() return self.eyeTrace end
loaded=true
local source,upper=newArea(1,0),newArea(2,64,0,72)
function source:Contains(point) return math.abs(point.x)<=300 and math.abs(point.y)<=300 end
function source:GetClosestPointOnArea(point) return Vector(math.max(-300,math.min(300,point.x)),math.max(-300,math.min(300,point.y)),0) end
local originalLine=util.TraceLine
util.TraceLine=function(options)
    if options.mask~=MASK_PLAYERSOLID then return originalLine(options) end
    for _,area in ipairs({upper,source}) do
        if area:Contains(options.start) and options.start.z>=area.center.z and options.endpos.z<=area.center.z then
            return {Hit=true,HitPos=Vector(options.start.x,options.start.y,area.center.z),HitNormal=Vector(0,0,1),Entity=emptyEntity}
        end
    end
    return {Hit=false,HitPos=options.endpos,Entity=emptyEntity}
end
local support,climber=newPlayer(TEAM_ZOMBIES,0),newPlayer(TEAM_ZOMBIES,-64)
local Manager=include("sv_bot_boost.lua").BotBoostManager
local manager=construct(Manager)
local point={ID=0,Base={0,0,0},Approach={-64,0,0},Exit={64,0,72}}
local function savePoint() assert(manager.Store:Put(point)); point=manager.Store:Points()[1] end
local function start() return manager:Start(climber,Vector(64,0,72),{support,climber},now,point.ID) end
local function jumpFromSupport()
    support.ducking=true; manager:Control(support,now)
    local control=manager:Control(climber,now); assert(control.Steering.Jump)
    manager:Input(climber,IN_JUMP); climber.airborne=true; now=now+0.2; manager:Control(climber,now)
    climber.airborne=false; climber.groundEntity=support; climber.position=Vector(0,0,36); now=now+0.2; manager:Control(climber,now)
    assert(manager:Sessions()[1].Phase=="jump")
    now=now+0.6; control=manager:Control(climber,now); assert(control.Steering.Jump); manager:Input(climber,IN_JUMP)
    climber.airborne=true; climber.position=Vector(32,0,64); now=now+0.2; manager:Control(climber,now)
    assert(manager:Sessions()[1].Phase=="land")
end
`;
