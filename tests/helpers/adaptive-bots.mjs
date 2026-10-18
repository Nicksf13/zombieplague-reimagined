export const botSetup = `
local now=10
local function construct(class,...)
    local instance=setmetatable({},class.prototype)
    instance:____constructor(...)
    return instance
end
function CurTime() return now end
math.atan2=function(y,x) return math.atan(y,x) end
math.random=function(low,high) return high or low end
ROUND_PLAYING,ROUND_ENDING,HUMANS_WIN,ZOMBIES_WIN,ROUND_DRAW=2,3,2,1,3
ROUND_WAITING_PLAYERS,ROUND_STARTING_NEW_ROUND,ROUND_RESTARTING,ROUND_VOTEMAP,ROUND_CHANGING_MAP=0,1,4,5,6
IN_ATTACK,IN_JUMP,IN_DUCK,IN_SPEED,IN_USE,IN_RELOAD=1,2,4,131072,32,8192
IN_FORWARD,IN_BACK,IN_MOVELEFT,IN_MOVERIGHT=8,16,512,1024
MOVETYPE_LADDER,DMG_FALL,DMG_DROWN,DMG_DROWNRECOVER=9,32,16384,524288
MASK_SHOT,MASK_PLAYERSOLID,NAV_MESH_CROUCH,NAV_MESH_JUMP=1,2,1,2
local vectorMeta={}
function vectorMeta:DistToSqr(other) return (self.x-other.x)^2+(self.y-other.y)^2+(self.z-other.z)^2 end
function Vector(x,y,z) return setmetatable({x=x,y=y,z=z}, {__index=vectorMeta}) end
local angleMeta={}
function angleMeta:Forward()
    local yaw,pitch=math.rad(self.y),math.rad(self.p)
    return Vector(math.cos(yaw)*math.cos(pitch),math.sin(yaw)*math.cos(pitch),-math.sin(pitch))
end
function Angle(p,y,r) return setmetatable({p=p,y=y,r=r}, {__index=angleMeta}) end
engine={TickInterval=function() return 0.05 end}
IsValid=function(value) return type(value)=="table" and not value.invalid end
local emptyEntity={invalid=true,IsValid=function() return false end}
local players,values,messages,consoleCommands,files,jsonValues={},{},{},{},{},{}
local jsonSequence,writes,failWrite=0,0,false
local function clone(value)
    if type(value)~="table" then return value end
    local copy={}; for key,item in pairs(value) do copy[key]=clone(item) end; return copy
end
file.Read=function(path) return files[path] end
local sourceFind=file.Find
file.Find=function(pattern,realm)
    if realm~="DATA" then return sourceFind(pattern,realm) end
    local directory=pattern:match("^(.*)/[^/]*$")
    local result={}
    for path in pairs(files) do
        if path:sub(1,#directory+1)==directory.."/" then
            local name=path:sub(#directory+2)
            if not name:find("/",1,true) and name:sub(-5)==".json" then result[#result+1]=name end
        end
    end
    return result,{}
end
file.CreateDir=function() end
file.Write=function(path,text)
    writes=writes+1
    if failWrite and not path:match("bak.txt$") then files[path]="partial"; return end
    files[path]=text
end
util.JSONToTable=function(text) return clone(jsonValues[text]) end
util.TableToJSON=function(value)
    jsonSequence=jsonSequence+1
    local text="json-"..jsonSequence; jsonValues[text]=clone(value); return text
end
-- Deterministic unique keys stand in for the engine hash; scope contents are asserted separately.
util.SHA256=function(value) return (value:gsub(".",function(char) return string.format("%02x",string.byte(char)) end)) end
local function scopeFile(map,role,class,variant)
    return "zombieplague/bots/scopes/"..util.SHA256(ZPBotMetricsProtocol.Key({Map=map,Role=role,ClassID=class,Variant=variant or "normal"}))..".json"
end
local function metricsFile(map,role,class,variant)
    return (scopeFile(map,role,class,variant):gsub("/scopes/","/metrics/"))
end
local function sharedMemory(id,role,class,variant)
    local saved=jsonValues[files["zombieplague/bots/learning-v3.json"]]
    if not saved then return end
    for _,context in ipairs(saved.Contexts) do
        if context.Scope.Role==role and context.Scope.ClassID==class and context.Scope.Variant==(variant or "normal") then
            for _,bot in ipairs(context.Bots) do if bot.ID==id then return bot end end
        end
    end
end
cvars.Bool=function(key,fallback) if values[key]~=nil then return values[key] end return fallback end
cvars.Number=function(key,fallback) if values[key]~=nil then return values[key] end return fallback end
function GetConVar(name)
    if values[name]==nil then return nil end
    return {GetString=function() return tostring(values[name]) end}
end
local singleplayer,maxplayers=false,16
local mapName="gm_test"
game={SinglePlayer=function() return singleplayer end,MaxPlayers=function() return maxplayers end,GetMap=function() return mapName end}
local humanClass={ID="HumanDefault",Name="HumanDefaultClassName"}
local zombieClass={ID="ZombieDefault",Name="ZombieDefaultClassName"}
ClassManager={GetHumanClasses=function() return {HumanDefault=humanClass} end,GetZombieClasses=function() return {ZombieDefault=zombieClass} end}
RunShouldDrain=function(ply) return ply:IsHuman() and ply.drain~=false end
local loaded,areas=false,{}
navmesh={IsLoaded=function() return loaded end,GetNavArea=function(position,limit)
    local best,height
    for _,area in ipairs(areas) do
        local dz=position.z-area:GetClosestPointOnArea(position).z
        if area:Contains(position) and dz>=0 and dz<=limit and (not height or dz<height) then best,height=area,dz end
    end
    return best
end,GetNearestNavArea=function(position)
    local best,distance
    for _,area in ipairs(areas) do
        local d=position:DistToSqr(area.center)
        if not distance or d<distance then best,distance=area,d end
    end
    return best
end}
local traceCount,blocked,ground,obstacle,wall,blockedTarget=0,false,true,false,false,nil
util.TraceLine=function(options)
    traceCount=traceCount+1
    if options.mask==MASK_PLAYERSOLID then return {Hit=ground,Entity=emptyEntity,HitPos=options.endpos} end
    if wall or options.endpos.x==blockedTarget then return {Hit=true,Entity=emptyEntity,HitPos=options.endpos} end
    return {Hit=false,Entity=emptyEntity,HitPos=options.endpos}
end
util.TraceHull=function(options)
    traceCount=traceCount+1
    return {Hit=blocked or (obstacle and options.start.z<20),Entity=emptyEntity,HitPos=options.endpos}
end
local playerMeta={}
function playerMeta:EntIndex() return self.index end
function playerMeta:SteamID64() return self.bot and "0" or tostring(self.index) end
function playerMeta:IsBot() return self.bot end
function playerMeta:IsSuperAdmin() return self.admin or false end
function playerMeta:IsAdmin() return self.admin or false end
function playerMeta:Name() return self.name or "Bot "..self.index end
function playerMeta:IsPlayer() return true end
function playerMeta:IsValid() return not self.invalid end
function playerMeta:Alive() return self.alive end
function playerMeta:IsFrozen() return self.frozen end
function playerMeta:Team() return self.team end
function playerMeta:IsHuman() return self.team==TEAM_HUMANS end
function playerMeta:IsZombie() return self.team==TEAM_ZOMBIES end
function playerMeta:IsNemesis() return self.nemesis or false end
function playerMeta:IsSurvivor() return self.survivor or false end
function playerMeta:GetHumanClass() return self.humanClass or humanClass end
function playerMeta:GetZombieClass() return self.zombieClass or zombieClass end
function playerMeta:GetBreath() return self.breath or 100 end
function playerMeta:GetMaxBreath() return 100 end
function playerMeta:WaterLevel() return self.water or 0 end
function playerMeta:KeyDown(key) return key==IN_SPEED and self.sprinting==true end
function playerMeta:SetTeam(team) self.team=team end
function playerMeta:GetPos() return self.position end
function playerMeta:EyePos() return Vector(self.position.x,self.position.y,self.position.z+64) end
function playerMeta:WorldSpaceCenter() return Vector(self.position.x,self.position.y,self.position.z+40) end
function playerMeta:GetAimVector() return self.angles:Forward() end
function playerMeta:EyeAngles() return self.angles end
function playerMeta:SetEyeAngles(angles) self.angles=angles end
function playerMeta:Health() return self.health end
function playerMeta:GetMaxHealth() return self.maxHealth end
function playerMeta:Armor() return self.armor or 0 end
function playerMeta:GetAmmoCount() return self.reserveAmmo or 90 end
function playerMeta:GetWalkSpeed() return self.walkSpeed or 200 end
function playerMeta:GetRunSpeed() return self.runSpeed or 300 end
function playerMeta:GetJumpPower() return self.jumpPower or 200 end
function playerMeta:GetAuxGravity() return self.gravity or 1 end
function playerMeta:GetGravity() return self.gravity or 1 end
function playerMeta:GetCrouchedWalkSpeed() return self.crouchSpeed or 0.4 end
function playerMeta:GetHull() return Vector(-16,-16,0),Vector(16,16,self.hullHeight or 68) end
function playerMeta:GetHullDuck() return Vector(-16,-16,0),Vector(16,16,36) end
function playerMeta:GetMoveType() return self.moveType or 2 end
function playerMeta:GetVelocity() return self.velocity or Vector(0,0,0) end
function playerMeta:OnGround() return self.airborne~=true end
function playerMeta:ShouldTakeFallDamage() return self.fallDamage==true end
function playerMeta:GetActiveWeapon() return self.weapon end
function playerMeta:GetWeapons() return self.weapons end
local function newWeapon(maxClip,clip)
    return {clip=clip or maxClip,GetMaxClip1=function() return maxClip end,Clip1=function(self) return self.clip end,GetClass=function() return "test_weapon" end,GetPrimaryAmmoType=function() return 1 end}
end
local function newPlayer(team,x,bot)
    local p=setmetatable({index=#players+1,team=team,position=Vector(x or 0,0,0),alive=true,frozen=false,
        bot=bot~=false,angles=Angle(0,0,0),health=100,maxHealth=100,weapon=newWeapon(30)}, {__index=playerMeta})
    p.weapons={p.weapon}; players[#players+1]=p; return p
end
player={GetAll=function() return players end,GetBots=function()
    local result={}; for _,ply in ipairs(players) do if ply:IsBot() then result[#result+1]=ply end end; return result
end,GetCount=function() return #players end,GetCountConnecting=function() return 0 end,CreateNextBot=function(name)
    local ply=newPlayer(TEAM_HUMANS,0,true); ply.name=name; return ply
end}
RoundManager={state=ROUND_PLAYING,FreezeTimeActive=false,GetRoundState=function(self) return self.state end,
    GetPlayersToPlay=function() return players end,AddPlayerToPlay=function() end}
concommand={Add=function(name,callback) consoleCommands[name]=callback end}
function SendConsoleMessage(_,message) messages[#messages+1]=message end
function SendPopupMessage(_,message) messages[#messages+1]=message end
local logs={}
print=function(text) logs[#logs+1]=text end
local commandMeta={}
function commandMeta:ClearButtons() self.buttons=0 end
function commandMeta:ClearMovement() self.forward,self.side=0,0 end
function commandMeta:SetImpulse(value) self.impulse=value end
function commandMeta:SetForwardMove(value) self.forward=value end
function commandMeta:SetSideMove(value) self.side=value end
function commandMeta:SetViewAngles(value) self.angles=value end
function commandMeta:SetButtons(value) self.buttons=value end
function commandMeta:SelectWeapon(weapon) self.selected=weapon end
local function command() return setmetatable({buttons=99,forward=99,side=99,impulse=99}, {__index=commandMeta}) end
local function damage(attacker,amount,kind,inflictor) return {GetAttacker=function() return attacker end,GetInflictor=function() return inflictor or emptyEntity end,GetDamage=function() return amount end,IsDamageType=function(_,test) return kind==test end} end
local function newArea(id,x,y,z)
    local area={id=id,center=Vector(x,y or 0,z or 0),adjacent={}}
    function area:GetID() return self.id end
    function area:IsValid() return not self.invalid end
    function area:GetCenter() return self.center end
    function area:GetAdjacentAreas() return self.adjacent end
    function area:GetLadders() return self.ladders or {} end
    function area:GetHidingSpots(kind) assert(kind==1); return self.hiding or {} end
    function area:Contains(position) return math.abs(position.x-self.center.x)<=40 and math.abs(position.y-self.center.y)<=40 end
    function area:GetClosestPointOnArea(position) return Vector(math.max(self.center.x-40,math.min(self.center.x+40,position.x)),math.max(self.center.y-40,math.min(self.center.y+40,position.y)),self.center.z) end
    function area:IsBlocked(team) assert(team==-2); return self.blocked or false end
    function area:IsUnderwater() return self.water or false end
    function area:HasAttributes() return false end
    function area:ComputeAdjacentConnectionHeightChange(other) return other.center.z-self.center.z end
    areas[#areas+1]=area; return area
end
include("sh_bot_metrics_protocol.lua")
include("sh_bot_motion_protocol.lua")
include("sh_bot_place_protocol.lua")
include("sh_bot_boost_protocol.lua")
`;
