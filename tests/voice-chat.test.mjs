import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
GM={}
RoundManager={playing=true,realistic=false}
function RoundManager:IsPlayingRound() return self.playing end
function RoundManager:IsRealisticMod() return self.realistic end
local values={zp_can_hear_death=false}
cvars.Bool=function(name,fallback) if values[name]~=nil then return values[name] end return fallback end
cvars.Number=cvars.Bool
function IsValid(value) return type(value)=="table" and not value.invalid end
local function position(x,y,z)
    return {x=x,y=y or 0,z=z or 0,DistToSqr=function(self,other)
        return (self.x-other.x)^2+(self.y-other.y)^2+(self.z-other.z)^2
    end}
end
local function playerAt(x)
    return {team=TEAM_HUMANS,alive=true,pos=position(x),Team=function(self) return self.team end,
        Alive=function(self) return self.alive end,GetPos=function(self) return self.pos end}
end
local listener,talker=playerAt(0),playerAt(100)
include("sv_event_players.lua")
local function hears(expected,spatial)
    local result={GM:PlayerCanHearPlayersVoice(listener,talker)}
    assert(#result==2 and result[1]==expected and result[2]==spatial)
end
`;

test("voice defaults to positional audio within an inclusive three-dimensional radius", () => run(setup + `
    hears(true,true)
    talker.pos=position(1000); hears(true,true)
    talker.pos=position(1000.01); hears(false,true)
    talker.pos=position(600,800,0); hears(true,true)
    talker.pos.z=1; hears(false,true)
    listener.pos=position(600,800,1); hears(true,true)
`));

test("voice range and proximity toggle change live without bypassing team permissions", () => run(setup + `
    talker.pos=position(1500); hears(false,true)
    values.zp_voice_radius=1600; hears(true,true)
    values.zp_voice_radius=1400; hears(false,true)
    values.zp_voice_local=false; hears(true,false)
    talker.GetPos=function() error("global voice does not need positions") end
    hears(true,false)
    values.zp_voice_all=false; talker.team=TEAM_ZOMBIES; hears(false,false)
    talker.team=TEAM_HUMANS; hears(true,false)
`));

test("proximity voice preserves cross-team and dead-player rules during normal rounds", () => run(setup + `
    talker.team=TEAM_ZOMBIES
    values.zp_voice_all=false; hears(false,false)
    values.zp_voice_all=true; hears(true,true)
    talker.alive=false; hears(false,false)
    values.zp_can_hear_death=true; hears(true,true)
    talker.pos=position(1001); hears(false,true)
    talker.pos=position(100); listener.alive=false
    values.zp_voice_all=false; values.zp_can_hear_death=false; hears(true,true)
    listener.team=TEAM_SPECTATOR; hears(true,true)
    talker.pos=position(1001); hears(false,true)
`));

test("realistic mode still requires matching teams and life states even when voice permissions are open", () => run(setup + `
    RoundManager.realistic=true
    values.zp_voice_all=true; values.zp_can_hear_death=true
    talker.team=TEAM_ZOMBIES; hears(false,false)
    talker.team=TEAM_HUMANS; talker.alive=false; hears(false,false)
    listener.alive=false; hears(true,true)
    talker.pos=position(1001); hears(false,true)
    values.zp_voice_local=false; hears(true,false)
    talker.alive=true; hears(false,false)
`));

test("proximity remains active outside rounds and text chat keeps its existing unrestricted distance", () => run(setup + `
    RoundManager.playing=false; RoundManager.realistic=true
    values.zp_voice_all=false; talker.team=TEAM_ZOMBIES; talker.alive=false
    hears(true,true)
    talker.pos=position(1001); hears(false,true)
    assert(GM:PlayerCanSeePlayersChat("hello",false,listener,talker))
    values.zp_voice_local=false; hears(true,false)
`));

test("invalid players are rejected and externally configured radii stay bounded and finite", () => run(setup + `
    talker.invalid=true; hears(false,false)
    talker.invalid=false; listener.invalid=true; hears(false,false)
    listener.invalid=false
    for _,value in ipairs({0,-100}) do
        values.zp_voice_radius=value
        talker.pos=position(64); hears(true,true)
        talker.pos=position(64.01); hears(false,true)
    end
    values.zp_voice_radius=1000000000
    talker.pos=position(32768); hears(true,true)
    talker.pos=position(32769); hears(false,true)
    for _,value in ipairs({0/0,math.huge,-math.huge}) do
        values.zp_voice_radius=value
        talker.pos=position(1000); hears(true,true)
        talker.pos=position(1001); hears(false,true)
    end
`));
