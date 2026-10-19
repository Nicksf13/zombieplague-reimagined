import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { emoteActivitiesSetup } from "./helpers/emotes.mjs";

const server = emoteActivitiesSetup + `
local now=10
function CurTime() return now end
function Angle(p,y,r) return {p=p,y=y,r=r} end
ACT_GMOD_TAUNT_DANCE,IN_ATTACK=1642,1
ROUND_WAITING_PLAYERS,ROUND_STARTING_NEW_ROUND,ROUND_PLAYING,ROUND_ENDING,ROUND_RESTARTING,ROUND_VOTEMAP,ROUND_CHANGING_MAP=0,1,2,3,4,5,6
RoundManager={state=ROUND_PLAYING,FreezeTimeActive=false,GetRoundState=function(self) return self.state end}
local message
function SendPopupMessage(_,text) message=text end
local function newPlayer(id)
    local ply={id=id,alive=true,team=TEAM_HUMANS,model="human",ground=true,nw={},duration=6,sequence=42}
    function ply:EntIndex() return self.id end
    function ply:Alive() return self.alive end
    function ply:Team() return self.team end
    function ply:GetModel() return self.model end
    function ply:IsFrozen() return self.frozen end
    function ply:OnGround() return self.ground end
    function ply:InVehicle() return self.vehicle end
    function ply:EyeAngles() return {p=2,y=80,r=0} end
    function ply:SelectWeightedSequence(activity) assert(type(activity)=="number"); self.activity=activity; return self.sequence end
    function ply:SequenceDuration(sequence) assert(sequence==self.sequence); return self.duration end
    function ply:AddVCDSequenceToGestureSlot(slot,sequence,cycle,autoKill)
        assert(slot==GESTURE_SLOT_CUSTOM)
        self.gestures=(self.gestures or 0)+1; self.gesture={sequence=sequence,cycle=cycle,autoKill=autoKill}
    end
    function ply:AnimResetGestureSlot(slot) assert(slot==GESTURE_SLOT_CUSTOM); self.resets=(self.resets or 0)+1; self.gesture=nil end
    function ply:AnimSetGestureWeight(slot,weight) assert(slot==GESTURE_SLOT_CUSTOM); self.weight=weight end
    function ply:SetPlaybackRate(rate) self.playback=rate end
    function ply:SetPoseParameter(name,value) self.poses=self.poses or {}; self.poses[name]=value; return value end
    function ply:GetSequence() return self.playing or 0 end
    function ply:IsSequenceFinished() return self.finished==true end
    function ply:SetNWFloat(key,value) self.nw[key]=value end
    ply.SetNWInt=ply.SetNWFloat; ply.SetNWString=ply.SetNWFloat
    function ply:GetNWFloat(key,fallback) return self.nw[key] or fallback end
    ply.GetNWInt=ply.GetNWFloat; ply.GetNWString=ply.GetNWFloat
    return ply
end
local ply,other=newPlayer(1),newPlayer(2)
local emoteID
net.ReadUInt=function(bits) assert(bits==8); return emoteID end
local function command(attack)
    local cmd={attack=attack,buttons=123,movement=100,impulse=201}
    function cmd:KeyDown(key) assert(key==IN_ATTACK); return self.attack end
    function cmd:ClearButtons() self.buttons=0 end
    function cmd:ClearMovement() self.movement=0 end
    function cmd:SetImpulse(value) self.impulse=value end
    function cmd:SetViewAngles(value) self.angles=value end
    function cmd:RemoveKey(key) assert(key==IN_ATTACK); self.attack=false end
    return cmd
end
include("sv_dance.lua")
`;

test("dance requests choose a supported gesture and enforce movement on the server", () => run(server + `
    receivers.ZPDanceStart(0,ply)
    assert(ply.ZPDanceUntil==16 and ply.nw.ZPDanceUntil==16)
    local activity,sequence=hooks.CalcMainActivity.ZPDanceAnimation(ply,{})
    assert(activity==nil and sequence==nil, "the native idle must remain the main sequence")
    assert(ply.gestures==1 and ply.gesture.sequence==42 and ply.gesture.cycle==0 and ply.gesture.autoKill and ply.weight==1)
    local cmd=command(false); hooks.StartCommand.ZPDanceControls(ply,cmd)
    assert(cmd.buttons==0 and cmd.movement==0 and cmd.impulse==0 and cmd.angles.y==80)
    local untouched=command(false); hooks.StartCommand.ZPDanceControls(other,untouched)
    assert(untouched.buttons==123 and untouched.movement==100)
    now=11; receivers.ZPDanceStart(0,ply); assert(ply.ZPDanceUntil==16, "a held request cannot extend a dance")
    now=16; assert(hooks.CalcMainActivity.ZPDanceAnimation(ply,{})==nil)
    hooks.Think.ZPDanceLifecycle(); assert(ply.ZPDanceUntil==nil and ply.nw.ZPDanceUntil==0)
    assert(ply.nw.ZPDanceSequence==-1 and ply.nw.ZPDanceModel=="")
    hooks.StartCommand.ZPDanceControls(ply,untouched); assert(untouched.buttons==123)
`));

test("gesture entry and exit happen once without replacing the model's base animation", () => run(server + `
    receivers.ZPDanceStart(0,ply)
    local animate=hooks.CalcMainActivity.ZPDanceAnimation
    animate(ply,{}); assert(ply.gestures==1 and ply.resets==1)
    animate(ply,{}); assert(ply.gestures==1, "the gesture must advance instead of restarting every frame")
    now=16
    assert(animate(ply,{})==nil and ply.resets==2 and ply.ZPDanceAnimationUntil==nil and not ply.gesture)
    assert(ply.nw.ZPDanceUntil==16, "simulate a delayed server stop snapshot")
    animate(ply,{}); assert(ply.resets==2, "normal gestures must not reset every frame")
    hooks.Think.ZPDanceLifecycle(); assert(ply.resets==2)
`));

test("a finished or changed main sequence cannot prematurely end a gesture", () => run(server + `
    ply.playing=42; ply.finished=true
    receivers.ZPDanceStart(0,ply)
    hooks.Think.ZPDanceLifecycle(); assert(ply.ZPDanceUntil==16, "the previous sequence must not end a new dance before activation")
    ply.finished=false
    hooks.CalcMainActivity.ZPDanceAnimation(ply,{})
    ply.finished=true; ply.playing=10
    hooks.Think.ZPDanceLifecycle(); assert(ply.ZPDanceUntil==16, "a different finished sequence is not the dance")
    ply.playing=42; now=12
    hooks.Think.ZPDanceLifecycle()
    assert(ply.ZPDanceUntil==16 and ply.gesture, "a gesture is independent of the main sequence")
    now=16; hooks.Think.ZPDanceLifecycle()
    assert(ply.ZPDanceUntil==nil and ply.nw.ZPDanceUntil==0 and ply.nw.ZPDanceSequence==-1)
    assert(ply.resets==2 and not ply.gesture and hooks.CalcMainActivity.ZPDanceAnimation(ply,{})==nil)
`));

test("attack and explicit Mouse1 cancellation consume the click without touching another player", () => run(server + `
    receivers.ZPDanceStart(0,ply); receivers.ZPDanceStart(0,other)
    local cmd=command(true); hooks.StartCommand.ZPDanceControls(ply,cmd)
    assert(ply.ZPDanceUntil==nil and other.ZPDanceUntil==16 and cmd.buttons==0)
    local held=command(true); hooks.StartCommand.ZPDanceControls(ply,held); assert(not held.attack)
    hooks.StartCommand.ZPDanceControls(ply,command(false))
    local nextClick=command(true); hooks.StartCommand.ZPDanceControls(ply,nextClick); assert(nextClick.attack)
    receivers.ZPDanceCancel(9,other); assert(other.ZPDanceUntil==16)
    receivers.ZPDanceCancel(0,other); assert(other.ZPDanceUntil==nil)
`));

test("invalid phases, death, freeze, vehicles, unsupported models and packet spam cannot start a dance", () => run(server + `
    receivers.ZPDanceStart(64,ply); assert(not ply.ZPDanceUntil)
    local checks={function(p) p.alive=false end,function(p) p.team=TEAM_SPECTATOR end,
        function(p) p.frozen=true end,function(p) p.ground=false end,function(p) p.vehicle=true end}
    for i,change in ipairs(checks) do
        local p=newPlayer(10+i); change(p); receivers.ZPDanceStart(0,p); assert(not p.ZPDanceUntil)
    end
    RoundManager.FreezeTimeActive=true; receivers.ZPDanceStart(0,ply); assert(not ply.ZPDanceUntil)
    RoundManager.FreezeTimeActive=false; now=11
    for state=ROUND_ENDING,ROUND_CHANGING_MAP do
        RoundManager.state=state; receivers.ZPDanceStart(0,ply); assert(not ply.ZPDanceUntil); now=now+1
    end
    RoundManager.state=ROUND_PLAYING; ply.sequence=-1
    receivers.ZPDanceStart(0,ply); assert(message.Phrase=="zombieplague.danceunavailable" and not ply.ZPDanceUntil)
    ply.sequence=42; receivers.ZPDanceStart(0,ply); assert(not ply.ZPDanceUntil, "rate limit")
    now=now+1; ply.duration=0/0; receivers.ZPDanceStart(0,ply); assert(not ply.ZPDanceUntil)
    now=now+1; ply.duration=math.huge; receivers.ZPDanceStart(0,ply); assert(not ply.ZPDanceUntil)
`));

test("round changes, model changes, team changes, respawn and disconnect release only dance state", () => run(server + `
    for _,change in ipairs({function() RoundManager.state=ROUND_VOTEMAP end,
        function() ply.model="zombie" end,function() ply.team=TEAM_ZOMBIES end,
        function() ply.alive=false end,function() ply.frozen=true end}) do
        now=now+1; ply=newPlayer(1); RoundManager.state=ROUND_PLAYING
        receivers.ZPDanceStart(0,ply); assert(ply.ZPDanceUntil)
        change(); hooks.Think.ZPDanceLifecycle(); assert(not ply.ZPDanceUntil)
    end
    assert(ply.frozen, "ending a dance must not undo another system's freeze")
    for _,event in ipairs({"PlayerSpawn","PlayerDeath","PlayerSilentDeath"}) do
        now=now+1; ply=newPlayer(1); receivers.ZPDanceStart(0,ply)
        hooks[event].ZPDanceReset(ply); assert(not ply.ZPDanceUntil)
    end
    now=now+1; ply=newPlayer(1); receivers.ZPDanceStart(0,ply)
    hooks.PlayerDisconnected.ZPDanceDisconnect(ply)
    ply=newPlayer(1); receivers.ZPDanceStart(0,ply); assert(ply.ZPDanceUntil, "reused entity indices have no old cooldown")
`));

test("all sixteen stable emote IDs select server-owned activities and replicate the selected activity", () => run(server + `
    local catalog=include("sh_emotes.lua").Emotes
    local expected={1642,1643,1617,1620,1618,1615,1614,1641,1610,1613,1611,1612,53,54,55,1616}
    assert(#catalog==16)
    for id,activity in ipairs(expected) do
        local p=newPlayer(100+id); emoteID=id; receivers.ZPDanceStart(8,p)
        assert(catalog[id].ID==id and p.activity==activity and p.nw.ZPDanceActivity==activity)
        local actual,sequence=hooks.CalcMainActivity.ZPDanceAnimation(p,{})
        assert(actual==nil and sequence==nil and p.gesture.sequence==42, "emotes must be layered over the weapon's base animation")
        receivers.ZPDanceCancel(0,p)
        assert(p.nw.ZPDanceActivity==-1 and p.nw.ZPDanceSequence==-1)
    end
`));

test("unknown emote IDs and malformed packets cannot choose arbitrary sequences or change another dancer", () => run(server + `
    receivers.ZPDanceStart(0,other)
    for i,id in ipairs({0,17,255}) do
        local p=newPlayer(20+i); emoteID=id; receivers.ZPDanceStart(8,p)
        assert(not p.ZPDanceUntil and not p.activity)
    end
    net.ReadUInt=function() error("malformed requests must not read payloads") end
    for _,length in ipairs({1,4,7,9,32,64}) do receivers.ZPDanceStart(length,ply) end
    assert(not ply.ZPDanceUntil and other.ZPDanceUntil==16)
`));

test("emotes preserve the weapon's base activity and do not override normal players", () => run(server + `
    receivers.ZPDanceStart(0,ply)
    local activity,sequence=hooks.CalcMainActivity.ZPDanceAnimation(ply,{})
    assert(activity==nil and sequence==nil and ply.CalcIdeal==nil and ply.CalcSeqOverride==nil)
    assert(hooks.UpdateAnimation.ZPDancePlayback(ply,{},0)==true)
    assert(ply.playback==1 and ply.poses.aim_yaw==0 and ply.poses.aim_pitch==0 and ply.poses.move_x==0)
    assert(hooks.UpdateAnimation.ZPDancePlayback(other,{},0)==nil and other.playback==nil)
    now=16; ply.playback=0.75
    assert(hooks.UpdateAnimation.ZPDancePlayback(ply,{},0)==nil and ply.playback==0.75, "normal animation updates regain ownership")
`));

test("server animation updates work without the client-only bone-cache method", () => run(server + `
    assert(ply.InvalidateBoneCache==nil, "server fixtures must not expose client rendering APIs")
    receivers.ZPDanceStart(0,ply)
    hooks.CalcMainActivity.ZPDanceAnimation(ply,{})
    for i=1,12 do
        now=10+i/10
        assert(hooks.UpdateAnimation.ZPDancePlayback(ply,{},0)==true)
        assert(ply.playback==1 and ply.poses.body_yaw==0 and ply.gesture)
    end
`));

test("late observers start the gesture at its elapsed cycle and zombies retain their own base pose", () => run(server + `
    for i,model in ipairs({"models/player/zombie_classic.mdl","models/player/zombie_soldier.mdl", "models/player/zombie_fast.mdl", "models/player/charple.mdl", "models/player/corpse1.mdl"}) do
        local p=newPlayer(100+i); p.team=TEAM_ZOMBIES; p.model=model; p.playing=7
        now=10; receivers.ZPDanceStart(0,p); now=12
        assert(hooks.CalcMainActivity.ZPDanceAnimation(p,{})==nil)
        assert(p.playing==7 and p.gesture.sequence==42 and math.abs(p.gesture.cycle-1/3)<0.0001)
        assert(p.gesture.autoKill and p.nw.ZPDanceStarted==10)
        p.model="human"; hooks.Think.ZPDanceLifecycle(); assert(not p.gesture)
    end
`));

test("the server publishes one captured facing direction before activating the emote", () => run(server + `
    local writes={}
    local original=ply.SetNWFloat
    function ply:SetNWFloat(key,value) writes[#writes+1]=key; original(self,key,value) end
    function ply:EyeAngles() return {p=-25,y=-137,r=0} end
    receivers.ZPDanceStart(0,ply)
    assert(ply.nw.ZPDanceYaw==-137 and ply.nw.ZPDancePitch==-25 and writes[#writes]=="ZPDanceUntil")
    function ply:EyeAngles() return {p=50,y=20,r=0} end
    local cmd=command(false); hooks.StartCommand.ZPDanceControls(ply,cmd)
    assert(cmd.angles.p==-25 and cmd.angles.y==-137, "orbit or later view changes cannot turn the dancer")
`));
