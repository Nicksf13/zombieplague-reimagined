export const statisticsSetup = `
local now=10
function CurTime() return now end
GM={}; GAMEMODE=GM
FCVAR_ARCHIVE=128
HUMANS_WIN,ZOMBIES_WIN,ROUND_DRAW=1,2,0
local enabled,training=true,false
util.SHA256=function(value)
    local hash=7.0; for i=1,#value do hash=(hash*131+value:byte(i))%2147483647 end
    return string.rep(string.format("%08x",math.floor(hash)),8)
end
local globals={}
function SetGlobalBool(name,value) globals[name]=value end
function GetGlobalBool(name,fallback) if globals[name]==nil then return fallback end; return globals[name] end
cvars.Bool=function(name,default)
    if name=="zp_statistics_enabled" then return enabled end
    if name=="zp_bot_training" then return training end
    return default
end
local callbacks={}
cvars.AddChangeCallback=function(name,callback) callbacks[name]=callback end
local currentMap="zm_test"
game={GetMap=function() return currentMap end}
local participants={}
local state=ROUND_PLAYING
RoundManager={GetPlayersToPlay=function() return participants end,GetRoundState=function() return state end}
local function clone(value)
    if type(value)~="table" then return value end
    local copy={}; for key,item in pairs(value) do copy[key]=clone(item) end; return copy
end
local files,jsonValues,writes={},{},0
local failWrites=false
file.Find=function(pattern)
    local found={}
    for path in pairs(files) do local name=path:match("^zombieplague/statistics/v1/([^/]+%.json)$"); if name then found[#found+1]=name end end
    return found,{}
end
file.Read=function(path) return files[path] end
file.Write=function(path,value) writes=writes+1; if not failWrites then files[path]=value end end
file.CreateDir=function() end
util.TableToJSON=function(value)
    local key="json:"..tostring(#jsonValues+1); jsonValues[#jsonValues+1]=value; jsonValues[key]=clone(value); return key
end
util.JSONToTable=function(key) return clone(jsonValues[key]) end
local function construct(class,...)
    local instance=setmetatable({},class.prototype); instance:____constructor(...); return instance
end
local meta={}
local function vector(x,y,z)
    local value={x=x or 0,y=y or 0,z=z or 0}
    function value:DistToSqr(other) return (self.x-other.x)^2+(self.y-other.y)^2+(self.z-other.z)^2 end
    return value
end
local function newPlayer(id,team)
    local ply=setmetatable({id=id,team=team or TEAM_HUMANS,alive=true,health=100,armor=0,position=vector(),velocity=vector(),frags=0,deaths=0}, {__index=meta})
    participants[#participants+1]=ply; return ply
end
function meta:SteamID64() return self.id end
function meta:Name() return self.name or "Player "..self.id:sub(-2) end
function meta:Team() return self.team end
function meta:Alive() return self.alive end
function meta:IsPlayer() return true end
function meta:IsBot() return self.bot or false end
function meta:IsHuman() return self.team==TEAM_HUMANS end
function meta:IsZombie() return self.team==TEAM_ZOMBIES end
function meta:IsNemesis() return self.nemesis or false end
function meta:IsSurvivor() return self.survivor or false end
function meta:Health() return self.health end
function meta:Armor() return self.armor end
function meta:GetPos() return self.position end
function meta:GetVelocity() return self.velocity end
function meta:GetClass() return "player" end
function meta:GetActiveWeapon() return self.weapon end
local function weapon(id) return {GetClass=function() return id end,IsPlayer=function() return false end} end
function meta:SetTeam(team)
    local old=self.team; self.team=team; hook.Call("OnPlayerChangedTeam",GM,self,old,team)
end
function meta:Infect() self:SetTeam(TEAM_ZOMBIES); self.health=100; hook.Call("ZPPlayerRoleChanged",GM,self) end
function meta:Cure() self:SetTeam(TEAM_HUMANS); self.health=100; hook.Call("ZPPlayerRoleChanged",GM,self) end
function meta:GetZombieClass() return {} end
function meta:AddFrags(value) self.frags=self.frags+value end
function meta:AddDeaths(value) self.deaths=self.deaths+value end
function meta:AddPoints() end
function meta:GiveAmmoPacks() end
SendPopupMessage=function() end
player={GetAll=function() return participants end}
RoundManager.IsRealisticMod=function() return true end
RoundManager.LastHuman=function() return false end
RoundManager.LastZombie=function() return false end
local human=newPlayer("76561198000000001",TEAM_HUMANS)
local zombie=newPlayer("76561198000000002",TEAM_ZOMBIES)
local other=newPlayer("76561198000000003",TEAM_HUMANS)
local schema=include("sh_statistics.lua")
local module=include("sv_statistics.lua")
local stats=module.statistics
local function start() hook.Call("Initialize",GM) end
local function row(ply,map)
    return stats.Records:Get(map or currentMap,stats:GetPlayerID(ply),ply:Name()).Roles
end
local function advance(seconds) now=now+seconds; stats:Sync() end
local function damage(target,attacker,health,armor,took)
    local event={GetAttacker=function() return attacker end,GetInflictor=function() return attacker end}
    stats.Combat:Begin(target,event)
    target.health=target.health-health; target.armor=target.armor-(armor or 0)
    stats.Combat:End(target,event,took~=false)
    return event
end
`;
