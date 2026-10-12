import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
GM = {}; GAMEMODE = GM
ROUND_WAITING_PLAYERS,ROUND_STARTING_NEW_ROUND,ROUND_PLAYING,ROUND_ENDING,ROUND_RESTARTING,ROUND_VOTEMAP,ROUND_CHANGING_MAP=0,1,2,3,4,5,6
ZOMBIES_WIN,HUMANS_WIN,ROUND_DRAW=1,2,3
local now, globals, players, meta = 42, {}, {}, {}
function CurTime() return now end
function SetGlobalBool(k,v) globals[k]=v end
function GetGlobalBool(k,d) if globals[k]==nil then return d end return globals[k] end
SetGlobalInt,GetGlobalInt=SetGlobalBool,GetGlobalBool
function FindMetaTable() return meta end
IsValid=function(value) return type(value)=="table" and not value.invalid end
player={GetAll=function() return players end,GetBySteamID64=function(id) for _,ply in ipairs(players) do if ply.id==id then return ply end end end}
team={GetPlayers=function(id) local found={} for _,ply in ipairs(players) do if ply.team==id then found[#found+1]=ply end end return found end}
function meta:Team() return self.team end
function meta:SetTeam(id) self.team=id end
function meta:Alive() return self.alive end
function meta:SteamID64() return self.id end
function meta:Name() return self.id end
function meta:IsHuman() return self.team==TEAM_HUMANS end
function meta:IsZombie() return self.team==TEAM_ZOMBIES end
function meta:Infect() self.team=TEAM_ZOMBIES end
function meta:Cure() self.team=TEAM_HUMANS end
function meta:IsAdmin() return self.admin==true end
function meta:IsSuperAdmin() return false end
function addPlayer(id,teamID,alive) local p=setmetatable({id=id,team=teamID,alive=alive},{__index=meta}); players[#players+1]=p; return p end
PlayerManager={GetPlayerID=function(_,ply) return ply.id end}
function SendPopupMessage() end
function SendNotifyMessage() end
function SendColorMessage() end
function BroadcastSound() end
hook.Call=function(name,gm,...) for _,action in pairs(hooks[name] or {}) do action(...) end end
timer.Destroy=function(id) timers[id]=nil end
timer.TimeLeft=function(id) return timers[id] and timers[id][1] end
timer.RepsLeft=function() return 0 end
net.WriteInt=function(value) sent[#sent+1]=value end
net.WriteFloat=net.WriteInt
net.Broadcast=function() end
game={GetMap=function() return "zm_current" end,CleanUpMap=function() end}
cvars.String=function(_,fallback) return fallback end
UnfreezeSounds,CountDownSound,ZombieWinSounds,HumanWinSounds,DrawSounds,ALLOWED_PREFIX={},{},{},{},{},{"zm_"}
include("sh_roundmanager.lua"); include("sv_roundmanager.lua")
`;

test("round participation is idempotent, removes stale entries and replaces the departing last zombie", () => run(setup + `
    local z=addPlayer("z",TEAM_ZOMBIES,true)
    local a=addPlayer("a",TEAM_HUMANS,true); local b=addPlayer("b",TEAM_HUMANS,true)
    RoundManager:SetRoundState(ROUND_PLAYING)
    RoundManager:AddPlayerToPlay(a); RoundManager:AddPlayerToPlay(a)
    assert(#RoundManager.PlayersToPlay==1)
    RoundManager.PlayersToPlay={z,a,b,{invalid=true}}
    assert(RoundManager:CountPlayersToPlay()==3 and #RoundManager.PlayersToPlay==3)
    RoundManager:RemovePlayerToPlay(z)
    assert(z:Team()==TEAM_SPECTATOR and #RoundManager.PlayersToPlay==2)
    assert(RoundManager:CountZombiesAlive()==1 and RoundManager:CountHumansAlive()==1)
`));

test("round timer captures its manager and calls the start callback without an implicit self", () => run(setup + `
    local started=false
    local round={Name="test",MinPlayers=0,Chance=100,Order=1,StartFunction=function(selected) assert(selected==nil); started=true end}
    RoundManager:StartRound(round)
    assert(started and RoundManager:GetRound()==1 and RoundManager:GetRoundState()==ROUND_PLAYING)
    assert(not RoundManager:IsSpecialRound() and not RoundManager:IsRespawn())
    timers.ZombiePlagueTimer[2]()
    assert(RoundManager:GetRoundState()==ROUND_ENDING)
    local called=false
    RoundManager.TryNewRound=function(self) assert(self==RoundManager); called=true end
    timers.ZombiePlagueTimer[2]()
    assert(called)
`));

test("default special-round callbacks retain their own definition after all rounds register", () => run(setup + `
    RoundManager:AddDefaultRounds()
    local a=addPlayer("a",TEAM_HUMANS,true); local b=addPlayer("b",TEAM_HUMANS,true)
    RoundManager.PlayersToPlay={a,b}
    meta.MakeNemesis=function(self) self:Infect() end
    RoundManager.Rounds.NemesisRound.Respawn=true
    RoundManager.Rounds.NemesisRound.StartFunction()
    assert(b.Lifes==5 and a.Lifes==nil)
`));

test("map vote lifecycle runs extension with the right manager without the retired UI", () => run(setup + `
    string.StartWith=function(text,prefix) return text:sub(1,#prefix)==prefix end
    table.RemoveByValue=function(values,value) for i=#values,1,-1 do if values[i]==value then table.remove(values,i) end end end
    file.Find=function() return {"zm_current.bsp","zm_other.bsp","de_no.bsp"},{} end
    include("sv_votemap.lua")
    ZPVoteMap:StartVotemap({"zm_"})
    assert(ZPVoteMap.Voting and ZPVoteMap.MapsToVote.zm_other==0 and not ZPVoteMap.MapsToVote.de_no)
    assert(not receivers.SendVotemap and not registered.SendVotemap)
    assert(sent[1]=="SyncTimer")
    ZPVoteMap.MapsToVote.zm_current=1
    ZPVoteMap:EndVotemap(); assert(not ZPVoteMap.Voting and RoundManager.ExtraRounds==5)
    local called=false; RoundManager.TryNewRound=function(self) assert(self==RoundManager); called=true end
    timers.ZombiePlagueTimer[2](); assert(called)
`));

test("actual Player weapon setters save in any state and deliver once to a living human", () => run(setup + `
    include("sv_player_weapons.lua")
    local count=0; local weapon={GiveWeapon=function(self,ply) assert(self==weapon or self.WeaponID=="test"); count=count+1 end,WeaponID="test"}
    local ply=addPlayer("p",TEAM_ZOMBIES,false)
    ply:GiveWeapon(weapon); assert(count==0)
    ply:SetPrimaryWeapon(weapon); assert(ply:GetPrimaryWeapon()==weapon and count==0)
    ply.alive=true; ply:SetPrimaryWeapon(weapon); assert(count==0)
    ply.team=TEAM_HUMANS; ply.alive=false; ply:SetPrimaryWeapon(weapon); assert(count==0)
    ply.alive=true; ply:SetPrimaryWeapon(weapon); ply:SetPrimaryWeapon(weapon); assert(count==1)
    ply:SetPrimaryWeaponGiven(false); ply:SetPrimaryWeapon(weapon); assert(count==2)
`));

test("human conversion keeps saved weapons and never requests a menu for missing selections", () => run(setup + `
    include("sv_classmanager.lua")
    include("sv_weaponmanager.lua")
    include("sv_player_weapons.lua")
    include("sv_player_infection.lua")
    local human = ClassManager:NewHumanClass()
    meta.GetNextHumanClass = function() return nil end
    meta.GetHumanClass = function() return human end
    meta.IsBot = function() return false end
    for _, name in ipairs({"StripWeapons", "SetMaxHealth", "SetArmor", "SetHealth", "SetWalkSpeed",
        "SetRunSpeed", "SetCrouchedWalkSpeed", "SetAuxGravity", "SetJumpPower", "SetModel",
        "SetMaxBreath", "SetBreath", "SetMaxBatteryCharge", "SetDamageAmplifier", "SetFootstep",
        "AllowFlashlight", "SetupHands", "SetMaxAbilityPower", "SetAbilityPower", "SetScreenFilter"}) do
        meta[name] = function() end
    end
    local ply = addPlayer("p", TEAM_ZOMBIES, true)
    ply:MakeHuman()
    assert(ply:IsHuman() and not ply:GetPrimaryWeaponGiven() and not ply:GetSecondaryWeaponGiven())
    assert(not ply:GetMeleeWeaponGiven() and #sent == 0)
    local given = 0
    local weapon = {GiveWeapon=function() given=given+1 end}
    ply.PrimaryWeapon, ply.SecondaryWeapon, ply.MeleeWeapon = weapon, weapon, weapon
    ply:MakeHuman()
    assert(given == 3 and ply:GetPrimaryWeaponGiven() and ply:GetSecondaryWeaponGiven() and ply:GetMeleeWeaponGiven())
    assert(#sent == 0)
    -- Keep the fallback crowbar, but allow a first explicit melee choice now.
    local fallback=WeaponManager:CreateNewWeapon()
    fallback.WeaponID="weapon_crowbar"
    fallback.GiveWeapon=function() given=given+1 end
    WeaponManager:AddWeapon(fallback,WEAPON_MELEE)
    ply.PrimaryWeapon,ply.SecondaryWeapon,ply.MeleeWeapon=nil,nil,nil
    ply:MakeHuman()
    assert(given==4 and not ply:GetMeleeWeaponGiven() and not ply.MeleeWeapon)
`));
