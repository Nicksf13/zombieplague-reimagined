import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
GAMEMODE={}
DMG_DROWN,DMG_DROWNRECOVER=16384,524288
local meta={}
function FindMetaTable() return meta end
function DamageInfo()
    return {
        SetDamage=function(self,value) self.amount=value end,
        SetDamageType=function(self,value) self.kind=value end
    }
end
local damage,sounds,flashes={},{},{}
function meta:TakeDamageInfo(info) damage[#damage+1]=info end
SCREENFADE={IN=1}
function meta:ScreenFade(mode,color,duration,hold)
    flashes[#flashes+1]={mode,color,duration,hold}
end
function meta:Alive() return not self.dead end
IN_SPEED,IN_FORWARD,IN_BACK,IN_MOVELEFT,IN_MOVERIGHT=1,2,4,8,16
local sprinting=true
function meta:KeyDown(key) return sprinting and (key==IN_SPEED or key==IN_FORWARD) end
function meta:GetWalkSpeed() return 100 end
function meta:GetRunSpeed() return 220 end
function meta:WaterLevel() return self.water or 0 end
function meta:IsHuman() return self.human~=false end
function meta:ZPEmitSound(path,delay) sounds[#sounds+1]={path,delay} end
PlayerManager={GetPlayerID=function(_,ply) return "player-id" end}
RoundManager={IsRealisticMod=function() return true end}
hook.Call=function(name,gm,...) for _,action in pairs(hooks[name] or {}) do action(...) end end
net.WriteFloat=function(value) sent[#sent+1]=value end
net.Broadcast=function() end
local amount=4
cvars.Number=function(name,fallback) if name=="zp_breath_damage" then return amount end return fallback end
HumanDrownSounds,ZombieDrownSounds={"human-drown"},{"zombie-drown"}
HumanSuffocateSound,ZombieSuffocateSound={"human-suffocate"},{"zombie-suffocate"}
local ply=setmetatable({Breath=2,MaxBreath=100},{__index=meta})
RoundManager.GetPlayersToPlay=function() return {ply} end
include("sv_player_resources.lua")
include("sv_event_ticks.lua")
`;

test("land exhaustion only makes a sound and still synchronizes clamped breath", () => run(setup + `
    ply:TakeBreath(3)
    assert(ply:GetBreath()==0 and #damage==0 and #flashes==0)
    assert(#sounds==1 and sounds[1][1]=="human-suffocate" and sounds[1][2]==1)
    assert(sent[1]=="SendBreath" and sent[2]=="player-id" and sent[3]==0)
    ply:AddBreath(0.5)
    assert(ply:GetBreath()==0.5 and #damage==0 and #sounds==1)
    ply:SetBreath(150)
    assert(ply:GetBreath()==100 and #damage==0 and #sounds==1)
`));

test("only exhausted submerged humans and zombies receive drown damage and the white flash", () => run(setup + `
    for _,human in ipairs({true,false}) do
        ply.human=human
        for water=0,3 do
            ply.water=water
            damage,sounds,flashes={},{},{}
            ply.Breath=1
            hooks.ZPSuffocate.ZPBreathDamage(ply)
            assert(#damage==0 and #sounds==0 and #flashes==0)
            ply.Breath=0
            hooks.ZPSuffocate.ZPBreathDamage(ply)
            local expected=water==3 and (human and "human-drown" or "zombie-drown") or
                (human and "human-suffocate" or "zombie-suffocate")
            assert(#sounds==1 and sounds[1][1]==expected and sounds[1][2]==1)
            if water==3 then
                assert(#damage==1 and damage[1].kind==DMG_DROWN and damage[1].amount==4)
                assert(#flashes==1 and flashes[1][1]==SCREENFADE.IN)
                local color=flashes[1][2]
                assert(color.r==255 and color.g==255 and color.b==255 and color.a==20)
                assert(flashes[1][3]==0.3 and flashes[1][4]==0)
            else
                assert(#damage==0 and #flashes==0)
            end
        end
    end
`));

test("crossing zero underwater and subsequent ticks share one drowning path and stop after surfacing", () => run(setup + `
    ply.water=3
    hooks.HalfSecondTickManager.ZPBreathManager()
    assert(#damage==1 and #flashes==1 and #sounds==1)
    hooks.HalfSecondTickManager.ZPBreathManager()
    assert(#damage==2 and #flashes==2 and #sounds==2)
    ply.water=2
    hooks.HalfSecondTickManager.ZPBreathManager()
    assert(#damage==2 and #flashes==2 and sounds[3][1]=="human-suffocate")
    sprinting=false
    hooks.HalfSecondTickManager.ZPBreathManager()
    assert(ply:GetBreath()==1 and #damage==2 and #flashes==2 and #sounds==3)
    ply.dead=true
    ply.Breath=0
    hooks.ZPSuffocate.ZPBreathDamage(ply)
    assert(#damage==2 and #flashes==2 and #sounds==3)
`));
