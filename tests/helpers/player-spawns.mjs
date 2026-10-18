export const spawnSetup = `
GM={}; GAMEMODE=GM
local points, configured, checks, players = {}, {}, {}, {}
local extraClasses={"info_player_counterterrorist","info_player_terrorist","info_player_deathmatch","addon_spawn","info_survivor_position"}
local searches,now=0,10
local spawnChecks={}
timer.Simple=function(delay,callback) assert(delay==0); spawnChecks[#spawnChecks+1]=callback end
local function finishSpawns()
    local callbacks=spawnChecks; spawnChecks={}; now=now+0.015
    for _,callback in ipairs(callbacks) do callback() end
end
function CurTime() return now end
function Vector(x,y,z) return {x=x,y=y,z=z} end
local function hull() return Vector(-16,-16,0),Vector(16,16,72) end
local function intersects(a,amin,amax,b,bmin,bmax)
    return a.x+amin.x<b.x+bmax.x and a.x+amax.x>b.x+bmin.x and
        a.y+amin.y<b.y+bmax.y and a.y+amax.y>b.y+bmin.y and a.z+amin.z<b.z+bmax.z and a.z+amax.z>b.z+bmin.z
end
IsValid=function(value) return type(value)=="table" and not value.invalid end
ents={FindByClass=function(class)
    searches=searches+1
    local found={}
    for _,point in ipairs(points) do if point.class==class then found[#found+1]=point end end
    return found
end}
scripted_ents={GetMember=function(class,member)
    assert(class=="gmod_player_start" and member=="SpawnPointClasses")
    return extraClasses
end}
team={GetSpawnPoints=function(id) return configured[id] end}
player={GetAll=function()
    local result={}
    for _,ply in ipairs(players) do result[#result+1]=ply end
    for _,point in ipairs(points) do if point.blocked then result[#result+1]=point.blocker end end
    return result
end}
function GM:IsSpawnpointSuitable(ply,point,makeSuitable)
    assert(not makeSuitable, "spawn selection must not kill occupants")
    checks[#checks+1]=point
    for _,other in ipairs(player.GetAll()) do
        if other~=ply and IsValid(other) and other:Alive() and other:Team()~=TEAM_SPECTATOR then
            local mins,maxs=other:GetHull()
            if intersects(point:GetPos(),Vector(-16,-16,0),Vector(16,16,64),other:GetPos(),mins,maxs) then return false end
        end
    end
    return true
end
hook.Call=function(name,gm,...) return gm[name](gm,...) end
local function addPoint(class,x,y,z)
    local point={class=class,position=Vector(x or #points*128,y or 0,z or 0)}
    function point:IsInWorld() assert(not self.invalid); return not self.outside end
    function point:GetPos() return self.position end
    point.blocker={Alive=function() return true end,Team=function() return TEAM_HUMANS end,GetHull=hull,GetPos=function() return point.position end}
    points[#points+1]=point
    return point
end
local function newPlayer(teamID)
    local ply={FirstSpawn=true,alive=false,position=Vector(-10000,0,0),team=teamID or TEAM_HUMANS}
    function ply:Team() return self.team end
    function ply:Alive() return self.alive end
    function ply:GetPos() return self.position end
    function ply:SetPos(pos) self.position=pos; self.teleports=(self.teleports or 0)+1 end
    function ply:GetHull() return self.mins or Vector(-16,-16,0),self.maxs or Vector(16,16,72) end
    players[#players+1]=ply
    return ply
end
local function publish(ply,point) ply.position=point:GetPos(); ply.alive=true end
-- A repeated random result must still consume every point before reuse.
math.random=function(min,max) assert(max>=min); return max end
include("sv_player_spawns.lua")
local function select(ply,transition) return GM:PlayerSelectSpawn(ply or newPlayer(),transition) end
local function cleanup() hooks.PostCleanupMap.ZPResetPlayerSpawnQueue() end
`;
