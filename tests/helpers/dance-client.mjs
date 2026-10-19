import { clientSetup, panelsSetup } from "./weapon-menu.mjs";
import { emoteActivitiesSetup } from "./emotes.mjs";

export const danceClientSetup = clientSetup + panelsSetup + emoteActivitiesSetup + `
local untilTime,started,heading,pitch=16,10,80,2
local model,networkModel="human","human"
local complete,left,cursor=true,false,false
local nativeSequence=7
IN_ATTACK,MASK_SOLID=1,33570827
function SysTime() return now end
function Vector(x,y,z) return {x=x,y=y,z=z} end
function Angle(p,y,r) return {p=p,y=y,r=r} end
function GetConVar() return {GetFloat=function() return 0.022 end} end
player={GetAll=function() return {viewer} end}
local traced,traceHit,traceSolid
util.TraceHull=function(options)
    traced=options
    return {HitPos=traceHit or options.endpos,StartSolid=traceSolid or false}
end
function viewer:GetNWFloat(key,fallback)
    if key=="ZPDanceUntil" then return untilTime end
    if not complete then return fallback end
    if key=="ZPDanceStarted" then return started end
    if key=="ZPDanceYaw" then return heading end
    if key=="ZPDancePitch" then return pitch end
    return fallback
end
function viewer:GetNWInt(key,fallback) return key=="ZPDanceSequence" and 42 or fallback end
function viewer:GetNWString() return networkModel end
function viewer:GetModel() return model end
function viewer:GetModelScale() return self.scale or 1 end
function viewer:GetViewEntity() return self.viewEntity or self end
function viewer:GetSequence() return nativeSequence end
function viewer:SequenceDuration() return 6 end
function viewer:AddVCDSequenceToGestureSlot(slot,sequence,cycle,autoKill)
    assert(slot==GESTURE_SLOT_CUSTOM)
    self.gesture={sequence=sequence,cycle=cycle,autoKill=autoKill}
    self.starts=(self.starts or 0)+1
end
function viewer:AnimResetGestureSlot(slot) assert(slot==GESTURE_SLOT_CUSTOM); self.gesture=nil end
function viewer:AnimSetGestureWeight(slot,weight) assert(slot==GESTURE_SLOT_CUSTOM); self.weight=weight end
function viewer:InvalidateBoneCache() self.invalidations=(self.invalidations or 0)+1 end
function viewer:GetRenderAngles() return self.renderAngles or Angle(0,10,0) end
function viewer:SetRenderAngles(angles) self.renderAngles=angles end
input.IsMouseDown=function(key) assert(key==MOUSE_LEFT); return left end
vgui.CursorVisible=function() return cursor end
local function command(x,y)
    return {ClearButtons=function(self) self.cleared=true end,ClearMovement=function(self) self.stopped=true end,
        SetImpulse=function(self,value) self.impulse=value end,RemoveKey=function(self,key) assert(key==IN_ATTACK); self.consumed=true end,
        SetViewAngles=function(self,value) self.angles=value end,GetMouseX=function() return x or 0 end,GetMouseY=function() return y or 0 end}
end
include("cl_dance.lua")
local function animate() return hooks.CalcMainActivity.ZPDanceAnimation(viewer,{}) end
local function move(x,y)
    local cmd=command(x,y); hooks.CreateMove.ZPDanceControls(cmd); return cmd
end
local function frame(time)
    now=time
    return hooks.CalcView.ZPDanceCamera(viewer,Vector(0,0,64),Angle(pitch,heading,0),90,4,10000)
end
local function distance(view)
    if not view then return 0 end
    return math.sqrt(view.origin.x^2+view.origin.y^2+(view.origin.z-64)^2)
end
local function near(a,b) assert(math.abs(a-b)<0.0001,tostring(a).." ~= "..tostring(b)) end
local function start()
    assert(animate()==nil and nativeSequence==7)
    move(); assert(frame(now)==nil)
    local view=frame(now+0.22); assert(view and view.drawviewer)
    return view
end
`;
