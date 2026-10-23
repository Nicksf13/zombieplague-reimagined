import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { radarServerSetup } from "./helpers/radar.mjs";

const setup = radarServerSetup + `
GM={}; GAMEMODE=GM; OBS_MODE_ROAMING,OBS_MODE_CHASE,IN_JUMP,IN_ATTACK,IN_ATTACK2=6,5,2,1,2048
IsValid=function(value) return type(value)=="table" and not value.invalid end
concommand={Add=function(name,callback) commands[name]=function(ply,args) callback(ply,name,args or {}) end end}
local realistic,teamOnly=false,true
cvars.Bool=function(name,fallback) if name=="zp_spectate_team_only" then return teamOnly end; return fallback end
function RoundManager:IsRealisticMod() return realistic end
function RoundManager:GetPlayersToPlay(alive)
    local result={}; for _,p in ipairs(players) do if not p.invalid and p.team~=TEAM_SPECTATOR and (not alive or p.alive) then result[#result+1]=p end end
    return result
end
function RoundManager:GetAliveHumans() local result={};for _,p in ipairs(self:GetPlayersToPlay(true)) do if p.team==TEAM_HUMANS then result[#result+1]=p end end;return result end
function RoundManager:GetAliveZombies() local result={};for _,p in ipairs(self:GetPlayersToPlay(true)) do if p.team==TEAM_ZOMBIES then result[#result+1]=p end end;return result end
local function controls(p)
    p.mode=6;p.DeathTime=0
    function p:Name() return "Player "..self.id end
    function p:EyeAngles() return {y=self.yaw or 0} end
    function p:GetObserverMode() return self.mode end
    function p:Spectate(mode) self.mode=mode end
    function p:GetObserverTarget() return self.observed end
    function p:KeyPressed(key) return self.pressed==key end
    function p:MoveSpectateID(offset,candidates) self.SpectateID=((self.SpectateID or 0)+offset)%#candidates; self.observed=candidates[self.SpectateID+1] end
    return p
end
for _,p in ipairs(players) do controls(p) end
local spectator=controls(newPlayer(4,TEAM_SPECTATOR,0));spectator.alive=false;ready(spectator)
local function view(p) return messages[p.id] and messages[p.id].ZPSpectatorOverviewState end
local function pulse(time) now=time;timers.ZPSpectatorOverview[2]() end
local selected=0
net.ReadUInt=function() return selected end
local function follow(p,id,length) selected=id;receivers.ZPSpectatorOverviewFollow(length or 16,p) end
include("sh_spectator_protocol.lua");include("sv_spectator_overview.lua");include("sv_event_players.lua")
`;

test("spectator overview samples both teams and actual roles independently of combat radar", () => run(setup + `
    set("mode",0);zombie.nemesis=true;friend.survivor=true;zombie.yaw=-90
    assert(ZPSpectatorOverview:Open(spectator))
    local snapshot=view(spectator);assert(snapshot.Active and not snapshot.Restricted and #snapshot.Contacts==3)
    assert(snapshot.Contacts[2].Role=="nemesis" and snapshot.Contacts[2].Yaw==270)
    assert(snapshot.Contacts[3].Role=="survivor" and ZPSpectatorProtocol.Snapshot(snapshot))
    assert(not view(human) and not view(zombie),"Live participants never receive overview contacts")
    zombie.position.x=800;pulse(10.2);assert(view(spectator).Contacts[2].Position.x==800)
    zombie.alive=false;hooks.PlayerDeath.ZPSpectatorOverview(zombie);assert(#view(spectator).Contacts==2)
    follow(spectator,friend.id);assert(not view(spectator).Active and spectator.observed==friend and spectator.mode==4)
`));

test("dead participants use server team restrictions and cannot forge enemy follow requests", () => run(setup + `
    human.alive=false;assert(ZPSpectatorOverview:Open(human))
    assert(view(human).Restricted and #view(human).Contacts==1 and view(human).Contacts[1].ID==friend.id)
    follow(human,zombie.id);assert(view(human).Active and human.mode==6)
    now=10.3;follow(human,friend.id);assert(human.observed==friend and not view(human).Active)
    teamOnly=false;assert(ZPSpectatorOverview:Open(human));assert(#view(human).Contacts==2)
    realistic=true;pulse(10.5);assert(view(human).Restricted and #view(human).Contacts==1)
    realistic=false;teamOnly=true
    for _,callback in pairs(changes.zp_spectate_team_only) do callback() end
    assert(view(human).Restricted and #view(human).Contacts==1)
`));

test("Space adds overview after chase and returns to first person without stealing native target changes", () => run(setup + `
    spectator.mode=5;spectator.observed=human;spectator.pressed=IN_JUMP
    CalculateSpectator(spectator);assert(view(spectator).Active and spectator.mode==6)
    spectator.pressed=IN_ATTACK;CalculateSpectator(spectator);assert(view(spectator).Active and spectator.observed==human)
    spectator.pressed=IN_JUMP;CalculateSpectator(spectator);assert(not view(spectator).Active and spectator.mode==4)
    CalculateSpectator(spectator);assert(spectator.mode==6)
    CalculateSpectator(spectator);assert(spectator.mode==5)
    set("mode",0);CalculateSpectator(spectator);assert(view(spectator).Active)
`));

test("missing images and readiness preserve the native camera cycle and reject premature entry", () => run(setup + `
    spectator.mode=5;spectator.observed=human;spectator.pressed=IN_JUMP
    now=10.6;readBool=false;receivers.ZPRadarReady(1,spectator)
    CalculateSpectator(spectator);assert(not view(spectator) and spectator.mode==4)
    assert(not ZPSpectatorOverview:Open(human))
    now=11.2;readBool=true;receivers.ZPRadarReady(1,spectator);spectator.DeathTime=10
    assert(not ZPSpectatorOverview:Open(spectator));spectator.DeathTime=0
    assert(ZPSpectatorOverview:Open(spectator))
    readBool=false;now=12;receivers.ZPRadarReady(1,spectator);pulse(12.2)
    assert(not view(spectator).Active and #view(spectator).Contacts==0)
`));

test("initial and training spectators can cycle views without a death timestamp", () => run(setup + `
    spectator.DeathTime=nil;spectator.mode=5;spectator.observed=human;spectator.pressed=IN_JUMP
    assert(GM:PlayerDeathThink(spectator)==false)
    assert(view(spectator).Active,"Silent observer spawns must not block overview entry forever")
    human.alive=false;human.DeathTime=now
    assert(not ZPSpectatorOverview:Open(human),"Participants retain the post-death delay")
`));

test("spawn, team change, disconnect and round end revoke subscriptions and clear old contacts", () => run(setup + `
    assert(ZPSpectatorOverview:Open(spectator));spectator.team=TEAM_HUMANS;hook.Run("OnPlayerChangedTeam",spectator,TEAM_SPECTATOR,TEAM_HUMANS)
    assert(not view(spectator).Active and #view(spectator).Contacts==0)
    assert(ZPSpectatorOverview:Open(spectator));spectator.alive=true;hook.Run("PlayerSpawn",spectator)
    assert(not view(spectator).Active);spectator.alive=false;assert(ZPSpectatorOverview:Open(spectator))
    hook.Run("ZPEndRound");assert(not view(spectator).Active)
    assert(ZPSpectatorOverview:Open(spectator));spectator.invalid=true;pulse(11)
    spectator.invalid=false;follow(spectator,human.id);assert(not spectator.observed)
`));

test("follow messages validate size, active subscription, current target eligibility and request rate", () => run(setup + `
    follow(human,zombie.id);assert(not view(human))
    assert(ZPSpectatorOverview:Open(spectator));follow(spectator,human.id,15);assert(view(spectator).Active)
    follow(spectator,65535);follow(spectator,human.id);assert(view(spectator).Active)
    human.alive=false;now=10.3;follow(spectator,human.id);assert(view(spectator).Active)
    now=10.6;follow(spectator,0);assert(not view(spectator).Active and spectator.observed==zombie)
    commands.zp_overview(spectator,{});assert(view(spectator).Active)
    commands.zp_overview(spectator,{});assert(view(spectator).Active,"Toggle commands are rate limited")
    now=11;commands.zp_overview(spectator,{"extra"});assert(view(spectator).Active)
`));
