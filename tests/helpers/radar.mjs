export const radarServerSetup = `
local now, round=10,2
CurTime=function() return now end
FCVAR_ARCHIVE=128
local values,changes={},{}
ConvarManager.CreateConVar=function(_,name,value) values[name]=value end
cvars.Number=function(name,fallback) local v=values[name]; if v==nil then return fallback end; return tonumber(v) end
cvars.AddChangeCallback=function(name,callback,id) changes[name]=changes[name] or {}; changes[name][id]=callback end
local function set(name,value)
    values["zp_radar_"..name]=value
    for _,callback in pairs(changes["zp_radar_"..name] or {}) do callback() end
end
RoundManager={GetRoundState=function() return round end}
game={GetMap=function() return "gm_construct" end}
local definition={Material="zombieplague/radar/gm_construct.png",X=-1000,Y=1000,Scale=2,Size=1024}
file.Read=function(path,realm) if path=="resource/zombieplague/radar/gm_construct.json" then return "overview" end end
file.Exists=function(path) return path=="materials/"..definition.Material end
util.JSONToTable=function(text) if text=="overview" then return definition end end
local downloaded={}
resource.AddFile=function(path) downloaded[#downloaded+1]=path end
function Vector(x,y,z)
    local point={x=x,y=y,z=z}
    function point:DistToSqr(other) return (self.x-other.x)^2+(self.y-other.y)^2+(self.z-other.z)^2 end
    return point
end
local players,messages,packets={},{},{}
local function newPlayer(id,team,x)
    local p={id=id,team=team,position=Vector(x or 0,0,0),alive=true,balance=100,charges=0}
    function p:EntIndex() return self.id end
    function p:IsPlayer() return true end
    function p:SteamID64() return "765611980000000"..self.id end
    function p:Team() return self.team end
    function p:Alive() return self.alive end
    function p:IsZombie() return self.team==TEAM_ZOMBIES end
    function p:GetPos() return self.position end
    function p:GetAmmoPacks() return self.balance end
    function p:TakeAmmoPacks(price) self.balance=self.balance-price; self.charges=self.charges+1 end
    players[#players+1]=p
    return p
end
player={GetAll=function() return players end}
net.Send=function(ply)
    messages[ply.id]=messages[ply.id] or {}
    messages[ply.id][sent[1]]=sent[2]
    packets[#packets+1]={Player=ply,Name=sent[1]}
end
local function state(ply) return messages[ply.id].ZPRadarState end
local function tick(time) now=time; timers.ZPRadar[2]() end
include("sh_radar_rules.lua"); include("sv_radar.lua")
local human=newPlayer(1,TEAM_HUMANS,0)
local zombie=newPlayer(2,TEAM_ZOMBIES,500)
local friend=newPlayer(3,TEAM_HUMANS,100)
local function ready(ply)
    hook.Run("ZPPlayerEnvironmentReady",ply)
    readBool=true; receivers.ZPRadarReady(1,ply)
end
ready(human); ready(zombie); ready(friend)
local function attack(ply,melee) ZPRadar:Attack(ply,melee); tick(now) end
local function extras()
    Utils={RecursiveFileSearch=function() return {human="extraitems/zp_radar_human.lua",zombie="extraitems/zp_radar_zombie.lua"} end}
    include("sv_extraitems.lua"); ExtraItemsManager:Search()
end
SendPopupMessage=function() end
`;
