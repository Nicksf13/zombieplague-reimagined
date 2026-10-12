import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
GM={}; GAMEMODE=GM
local serverMeta,clientMeta={},{}
function FindMetaTable() return serverMeta end
local realistic=false
RoundManager={IsRealisticMod=function() return realistic end}
local localSounds,worldSounds={},{}
NIGHTVISION_ON_SOUND,NIGHTVISION_OFF_SOUND="nv_on.mp3","nv_off.mp3"
function SendSound(ply,path) localSounds[#localSounds+1]={ply,path} end
function serverMeta:EmitSound(path) worldSounds[#worldSounds+1]={self,path} end
function serverMeta:Alive() return self.alive end
function serverMeta:IsHuman() return self.team==TEAM_HUMANS end
function serverMeta:Team() return self.team end
function serverMeta:GetBattery() return 100 end
function serverMeta:UnSpectate() self.unspectated=true end
function serverMeta:KillSilent() self.killed=true end
function serverMeta:Spectate(mode) self.observerMode=mode end
include("sv_player_resources.lua")
include("sv_event_players.lua")
function FindMetaTable() return clientMeta end
include("cl_player.lua")
local messages={}
net.Send=function(ply)
    assert(sent[1]=="SendNightvision" and #sent==2)
    messages[#messages+1]={ply,sent[2]}
    readBool=sent[2]; receivers.SendNightvision()
end
local loadouts=0
hook.Call=function(name,gm,ply)
    assert(not ply:NightvisionIsOn() and not IsNightvisionOn(), "Reset must happen before model/loadout hooks")
    if name=="PlayerLoadout" then loadouts=loadouts+1 end
end
local ply=setmetatable({alive=true,team=TEAM_HUMANS,FirstSpawn=true},{__index=serverMeta})
`;

test("every respawn synchronizes nightvision off silently in normal and realistic rounds", () => run(setup + `
    for _,mode in ipairs({false,true}) do
        realistic=mode
        for _,teamID in ipairs({TEAM_HUMANS,TEAM_ZOMBIES}) do
            ply.team=teamID
            ply:SetNightvision(true)
            assert(ply:NightvisionIsOn() and IsNightvisionOn())
            local soundCount=#localSounds+#worldSounds
            GM:PlayerSpawn(ply)
            assert(not ply:NightvisionIsOn() and not IsNightvisionOn())
            assert(#localSounds+#worldSounds==soundCount)
            assert(messages[#messages][1]==ply and messages[#messages][2]==false)
        end
    end
    assert(loadouts==4 and ply.unspectated)
    -- Resynchronize a stale client even if the server already has false.
    SetNightvision(true); GM:PlayerSpawn(ply)
    assert(not IsNightvisionOn() and loadouts==5)
    -- Also reset the initial/spectator spawn without sounds.
    local soundCount=#localSounds+#worldSounds
    ply.FirstSpawn=nil; ply.team=TEAM_SPECTATOR
    SetNightvision(true); GM:PlayerSpawn(ply)
    assert(not IsNightvisionOn() and ply.killed and ply.observerMode==6)
    assert(#localSounds+#worldSounds==soundCount)
`));

test("manual nightvision toggles retain private and realistic sounds after a silent reset", () => run(setup + `
    for _,mode in ipairs({false,true}) do
        realistic=mode
        local privateBefore,worldBefore=#localSounds,#worldSounds
        GM:PlayerSpawn(ply)
        assert(#localSounds==privateBefore and #worldSounds==worldBefore)
        receivers.RequestNightvision(0,ply)
        assert(ply:NightvisionIsOn() and IsNightvisionOn())
        receivers.RequestNightvision(0,ply)
        assert(not ply:NightvisionIsOn() and not IsNightvisionOn())
        local sounds=mode and worldSounds or localSounds
        assert(sounds[#sounds-1][2]==NIGHTVISION_ON_SOUND and sounds[#sounds][2]==NIGHTVISION_OFF_SOUND)
        assert(#localSounds==privateBefore+(mode and 0 or 2))
        assert(#worldSounds==worldBefore+(mode and 2 or 0))
    end
`));
