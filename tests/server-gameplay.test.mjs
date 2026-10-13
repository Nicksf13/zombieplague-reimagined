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
function meta:Freeze(frozen) self.frozen=frozen end
function meta:IsFrozen() return self.frozen==true end
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

test("unsaved loadouts are cleared before the next round spawn while remembered choices survive", () => run(setup + `
    include("sv_player_weapons.lua")
    local a=addPlayer("a",TEAM_HUMANS,true); local b=addPlayer("b",TEAM_HUMANS,true)
    RoundManager.PlayersToPlay={a,b}
    local weapon={WeaponID="test"}
    a.PrimaryWeapon,a.SecondaryWeapon,a.MeleeWeapon=weapon,weapon,weapon
    b.PrimaryWeapon,b.SecondaryWeapon,b.MeleeWeapon=weapon,weapon,weapon
    a.RememberWeaponChoices=false
    for _,name in ipairs({"SetNemesis","SetSurvivor","SetLight","ResetZombieAllowedWeapons"}) do meta[name]=function() end end
    local spawns=0
    meta.Spawn=function(self)
        spawns=spawns+1
        if self==a then assert(not self.PrimaryWeapon and not self.SecondaryWeapon and not self.MeleeWeapon)
        else assert(self.PrimaryWeapon==weapon and self.SecondaryWeapon==weapon and self.MeleeWeapon==weapon) end
    end
    assert(RoundManager:Prepare() and spawns==2)
    assert(a.RememberWeaponChoices==false)
    a.PrimaryWeapon,a.SecondaryWeapon,a.MeleeWeapon=weapon,weapon,weapon
    assert(RoundManager:Prepare() and spawns==4)
`));

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

test("freeze time uses engine freezing and releases players before the infection delay", () => run(setup + `
    local human=addPlayer("h",TEAM_HUMANS,true)
    local zombie=addPlayer("z",TEAM_ZOMBIES,true)
    local spectator=addPlayer("s",TEAM_SPECTATOR,false)
    -- Engine Freeze owns camera/attack suppression; class movement values stay intact.
    human.walkSpeed,human.runSpeed,human.jumpPower=110,240,190
    RoundManager:FreezeTime()
    assert(RoundManager.FreezeTimeActive and human:IsFrozen() and zombie:IsFrozen())
    assert(not spectator:IsFrozen())
    timers.ZombiePlagueTimer[2]()
    assert(not RoundManager.FreezeTimeActive and not human:IsFrozen() and not zombie:IsFrozen())
    assert(human.walkSpeed==110 and human.runSpeed==240 and human.jumpPower==190)
    assert(timers.ZombiePlagueTimer[1]==10)
`));

test("interrupted preparation and leaving participation release frozen players", () => run(setup + `
    local ply=addPlayer("h",TEAM_HUMANS,true)
    RoundManager:FreezeTime()
    RoundManager:WaitPlayers()
    assert(not ply:IsFrozen() and not RoundManager.FreezeTimeActive and not timers.ZombiePlagueTimer)
    RoundManager:FreezeTime()
    RoundManager:RestartRound()
    assert(not ply:IsFrozen() and not RoundManager.FreezeTimeActive)
    RoundManager:FreezeTime()
    RoundManager:RemovePlayerToPlay(ply)
    assert(not ply:IsFrozen() and ply:Team()==TEAM_SPECTATOR)
    ply:SetTeam(TEAM_HUMANS)
    RoundManager:FreezeTime()
    assert(not RoundManager:Prepare())
    assert(not ply:IsFrozen() and not RoundManager.FreezeTimeActive)
`));

test("respawning during freeze stays frozen and custom actions resume after unfreezing", () => run(setup + `
    include("sv_event_players.lua"); include("sv_classmanager.lua")
    local ply=addPlayer("h",TEAM_HUMANS,true)
    ply.FirstSpawn=true
    meta.SetNightvision=function(self,on) self.nightvision=on end
    meta.NightvisionIsOn=function(self) return self.nightvision end
    meta.GetBattery=function() return 100 end
    meta.UnSpectate=function() end
    local activations=0
    local ability={Drain=0,CanUseAbility=function() return true end,UseAction=function() activations=activations+1 end}
    meta.GetZPClass=function() return {Ability=ability} end
    meta.IsNemesis=function() return false end
    meta.IsSurvivor=function() return false end
    meta.GetAbilityPower=function() return 100 end
    RoundManager:FreezeTime()
    ply:Freeze(false) -- Simulate the engine clearing flags at respawn.
    GM:PlayerSpawn(ply)
    assert(ply:IsFrozen())
    receivers.RequestAbility(0,ply); receivers.RequestNightvision(0,ply)
    assert(activations==0 and not ply.nightvision)
    timers.ZombiePlagueTimer[2]()
    ply:Freeze(false)
    GM:PlayerSpawn(ply)
    assert(not ply:IsFrozen())
    receivers.RequestAbility(0,ply); receivers.RequestNightvision(0,ply)
    assert(activations==1 and ply.nightvision)
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

test("map vote lifecycle runs extension with the right manager and the new vote protocol", () => run(setup + `
    concommand={Add=function() end}
    string.StartWith=function(text,prefix) return text:sub(1,#prefix)==prefix end
    table.RemoveByValue=function(values,value) for i=#values,1,-1 do if values[i]==value then table.remove(values,i) end end end
    file.Find=function() return {"zm_current.bsp","zm_other.bsp","de_no.bsp"},{} end
    include("sh_map_vote_protocol.lua"); include("sv_map_nominations.lua"); include("sv_votemap.lua")
    ZPVoteMap:StartVotemap({"zm_"})
    assert(ZPVoteMap.Voting and ZPVoteMap.MapsToVote.zm_other==0 and not ZPVoteMap.MapsToVote.de_no)
    assert(not receivers.SendVotemap and not registered.SendVotemap)
    assert(receivers.ZPMapVoteSelect and registered.ZPMapVoteSnapshot)
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

test("human conversion preserves saved weapons and class movement respects the zombie sprint rule", () => run(setup + `
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
    meta.SetWalkSpeed=function(self,speed) self.walkSpeed=speed end
    meta.SetRunSpeed=function(self,speed) self.runSpeed=speed end
    ply:MakeHuman()
    assert(ply.walkSpeed==100 and ply.runSpeed==230)
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
    local zombie=ClassManager:NewZombieClass()
    zombie.WeaponGive=nil
    meta.GetNextZombieClass=function() return nil end
    meta.GetZombieClass=function() return zombie end
    meta.GetActiveWeapon=function() return nil end
    meta.FlashlightIsOn=function() return false end
    meta.ScreenFade=function() end
    SCREENFADE={IN=1}
    ply:Infect(true)
    assert(ply.walkSpeed==100 and ply.runSpeed==290)
    cvars.Bool=function(name,default) if name=="zp_zombie_should_run" then return false end return default end
    ply:Infect(true)
    assert(ply.walkSpeed==100 and ply.runSpeed==100)
`));
