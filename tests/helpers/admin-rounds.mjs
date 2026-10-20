export const adminRoundsSetup = `
GM={}; GAMEMODE=GM
ROUND_WAITING_PLAYERS,ROUND_STARTING_NEW_ROUND,ROUND_PLAYING,ROUND_ENDING,ROUND_RESTARTING,ROUND_VOTEMAP,ROUND_CHANGING_MAP=0,1,2,3,4,5,6
ZOMBIES_WIN,HUMANS_WIN,ROUND_DRAW=1,2,3
local now,globals,players,meta=10,{},{},{}
function CurTime() return now end
function SetGlobalBool(key,value) globals[key]=value end
function GetGlobalBool(key,fallback) if globals[key]~=nil then return globals[key] end return fallback end
SetGlobalInt,GetGlobalInt=SetGlobalBool,GetGlobalBool
function IsValid(value) return type(value)=="table" and not value.invalid end
player={GetAll=function() return players end,GetBySteamID64=function(id)
    for _,p in ipairs(players) do if p:SteamID64()==id then return p end end
end}
team={GetPlayers=function(id)
    local result={}; for _,p in ipairs(players) do if p.team==id then result[#result+1]=p end end
    return result
end}
function meta:UserID() return self.id end
function meta:SteamID64() return "765611980000000"..self.id end
function meta:Name() return "Player "..self.id end
function meta:Team() return self.team end
function meta:SetTeam(value) self.team=value end
function meta:Alive() return self.alive end
function meta:IsHuman() return self.team==TEAM_HUMANS end
function meta:IsZombie() return self.team==TEAM_ZOMBIES end
function meta:IsAdmin() return self.admin==true end
function meta:IsBot() return self.bot==true end
function meta:Freeze(value) self.frozen=value end
function meta:Spawn() self.alive=true; self.spawns=(self.spawns or 0)+1 end
function meta:SetNemesis(value) self.nemesis=value end
function meta:SetSurvivor(value) self.survivor=value end
function meta:SetLight(value) self.light=value end
function meta:ResetZombieAllowedWeapons() end
function meta:GiveAmmoPacks(amount) self.reward=(self.reward or 0)+amount end
function meta:Infect() self.team=TEAM_ZOMBIES; self.infections=(self.infections or 0)+1 end
function meta:MakeNemesis() self:Infect(); self.nemesis=true end
function meta:MakeSurvivor() self.survivor=true end
function table.RemoveByValue(list,value) for i=#list,1,-1 do if list[i]==value then table.remove(list,i) end end end
local notices,cleanups={},0
function SendNotifyMessage(p,message) notices[#notices+1]={p,message.Phrase} end
function SendPopupMessage() end
function BroadcastSound() end
game={CleanUpMap=function() cleanups=cleanups+1 end}
timer.Destroy=function(id) timers[id]=nil end
timer.TimeLeft=function(id) return timers[id] and timers[id][1] end
timer.RepsLeft=function() return 0 end
net.WriteInt=function(value) sent[#sent+1]=value end
net.WriteUInt=net.WriteInt
net.Broadcast=function() end
local uints={}
net.ReadUInt=function() return table.remove(uints,1) end
UnfreezeSounds,CountDownSound,ZombieWinSounds,HumanWinSounds,DrawSounds={},{},{},{},{}
include("sh_roundmanager.lua"); include("sv_roundmanager.lua"); RoundManager:AddDefaultRounds()
include("sv_admin_rounds.lua")
local function addPlayer(id,teamID)
    local p=setmetatable({id=id,team=teamID or TEAM_HUMANS,alive=true},{__index=meta})
    players[#players+1]=p; return p
end
local a,b,c,d,e=addPlayer(1),addPlayer(2),addPlayer(3),addPlayer(4),addPlayer(5)
local admin=addPlayer(99,TEAM_SPECTATOR); admin.admin=true
RoundManager.PlayersToPlay={a,b,c,d,e}; RoundManager:SetRoundState(ROUND_STARTING_NEW_ROUND)
local function transform(role,id,sender,length,version)
    now=now+0.3; uints={version or 1,role,id}; receivers.ZPAdminPlayerRound(length or 42,sender or admin)
end
local function request(action,id,sender,length,version)
    now=now+0.3; uints={version or 1,7,action}; readString=id or ""
    receivers.ZPAdminRoundsRequest(length or (action==1 and 200 or 25),sender or admin)
end
`;
