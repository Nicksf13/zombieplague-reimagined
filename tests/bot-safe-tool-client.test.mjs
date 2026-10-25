import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { nativeLanguage } from "./helpers/native-localization.mjs";

const setup=clientSetup+panelsSetup+nativeLanguage+`
viewer.admin=true; viewer.superadmin=false
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
viewer.weapon={GetClass=function() return "zp_bot_safe_tool" end}
function viewer:GetActiveWeapon() return self.weapon end
function viewer:EyePos() return Vector(0,0,64) end
function viewer:GetEyeTrace() return self.trace end
local aimX=0
local vectorMeta={ToScreen=function(self) return {x=self.x-aimX+640,y=self.y+360,visible=self.x-aimX<500} end}
function Vector(x,y,z) return setmetatable({x=x,y=y,z=z},{__index=vectorMeta}) end
viewer.trace={Hit=true,HitPos=Vector(40,0,0),HitNormal=Vector(0,0,1),Entity={GetClass=function() return "worldspawn" end}}
vgui.CursorVisible=function() return false end
IN_ATTACK,IN_ATTACK2,IN_RELOAD=1,2048,8192
SERVER=false; CLIENT=true
SWEP={Primary={},Secondary={},SetNextPrimaryFire=function() end,SetNextSecondaryFire=function() end}
include("zombieplague/entities/weapons/zp_bot_safe_tool.lua"); local tool=SWEP
local drawn,labels={},{}
render={DrawWireframeSphere=function(position,radius,_,_,color,depth) drawn[#drawn+1]={position=position,radius=radius,color=color,depth=depth} end,
    DrawLine=function() end}
local targetCount,rtDepth,camDepth=0,0,0
local clipping=false
function GetRenderTarget(name,w,h) targetCount=targetCount+1; assert(name=="ZPBotSafeScreen" and w==512 and h==512); return {GetName=function() return name end} end
function CreateMaterial(name,shader,params) assert(shader=="UnlitGeneric" and params["$basetexture"]=="ZPBotSafeScreen"); return {GetName=function() return name end} end
function DisableClipping(value) local old=clipping; clipping=value; return old end
render.PushRenderTarget=function() rtDepth=rtDepth+1 end
render.PopRenderTarget=function() rtDepth=rtDepth-1 end
render.Clear=function() assert(rtDepth==1) end
cam={Start2D=function() camDepth=camDepth+1 end,End2D=function() camDepth=camDepth-1 end}
local overrides={[1]="addon/screen",[2]="addon/other"}
local vm={GetMaterials=function() return {"models/weapons/body","models/weapons/v_toolgun/screen","models/weapons/other"} end,
    GetSubMaterial=function(_,id) return overrides[id] or "" end,SetSubMaterial=function(_,id,value) overrides[id]=value end}
draw.DrawText=function(text) labels[#labels+1]=text end
local boostCloses=0; ZPBotBoostEditor={Close=function() boostCloses=boostCloses+1 end}
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
include("cl_bot_safe_points.lua")
local saved={{ID=1,Role="human",Position={0,0,0}},{ID=2,Role="zombie",Position={200,0,0}},
    {ID=3,Role="both",Position={600,0,0}}}
local function ack(fields)
    readTable={Request=sent[3],Revision=1,Feedback="ready",Equipped=true,Points=saved}
    for key,value in pairs(fields or {}) do readTable[key]=value end
    receivers.ZPBotSafeReply(4096)
end
local function commandInput(keys)
    local cmd={keys=keys}
    function cmd:KeyDown(key) return self.keys & key~=0 end
    function cmd:RemoveKey(key) self.keys=self.keys & ~key end
    hooks.CreateMove.ZPBotSafeInput(cmd); return cmd
end
local function press(key) now=now+0.25; commandInput(key); commandInput(0) end
local function wheel(direction) return hooks.PlayerBindPress.ZPBotSafeWheel(viewer,direction or "invnext",true) end
local function screenText()
    labels={}; hooks.PreDrawViewModel.ZPBotSafeScreen(vm,viewer,viewer.weapon)
    assert(overrides[1]=="!ZPBotSafeScreenMaterial" and overrides[2]=="addon/other")
    hooks.PostDrawViewModel.ZPBotSafeScreen()
    assert(overrides[1]=="addon/screen" and rtDepth==0 and camDepth==0 and not clipping)
    return table.concat(labels,"|"),labels
end
local function choose(key)
    local phrase=language.GetPhrase("zombieplague."..key)
    for _=1,12 do
        local _,text=screenText()
        for _,line in ipairs(text) do
            if line:sub(1,#("▶ "..phrase))=="▶ "..phrase or line:sub(1,#("▶ ✓ "..phrase))=="▶ ✓ "..phrase then press(IN_ATTACK); return end
        end
        assert(wheel()==true)
    end
    error("Missing option "..phrase)
end
local function open() now=now+0.25; ZPBotSafeEditor:Open(); assert(sent[5]==4); ack() end
`;

test("safe points use a separate toolgun with immediate role choices and no Derma editor",()=>run(setup+`
    selectedLocale="pt-BR"; open()
    assert(boostCloses==1 and tool.ViewModel=="models/weapons/c_toolgun.mdl" and tool.PrintName=="#zombieplague.bsafetitle")
    assert(#panels==0 and requests==1)
    local text=screenText(); assert(text:find("Humanos",1,true) and text:find("Zumbis",1,true))
    choose("bsafehuman"); press(IN_ATTACK)
    assert(sent[1]=="ZPBotSafeRequest" and sent[2]==2 and sent[5]==2 and sent[6]==0)
    ack({Revision=2,Feedback="saved"})
    now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0); ack({Revision=2})
    assert(not screenText():find("▶ ",1,true), "polling does not reopen the choices")
    assert(wheel()==true); press(IN_ATTACK); assert(sent[6]==1)
    ack({Revision=3,Feedback="saved"}); wheel(); press(IN_ATTACK); assert(sent[6]==2)
`));

test("right click opens a focused Remove action for the aimed safe point without a prior selection",()=>run(setup+`
    selectedLocale="pt-BR"; open()
    local before=requests; press(IN_ATTACK2)
    assert(requests==before and screenText():find("▶ Remover ponto #1",1,true))
    assert(not screenText():find("Humanos e zumbis",1,true), "point actions do not require navigating the main choices")
    press(IN_ATTACK); assert(sent[5]==3 and sent[7]==1 and requests==before+1)
    ack({Revision=2,Feedback="saved",Points={saved[2],saved[3]}})
    assert(not screenText():find("▶ ",1,true), "removal returns directly to the equipped tool")
    aimX=200; press(IN_ATTACK2); assert(screenText():find("#2",1,true))
    press(IN_ATTACK); assert(sent[5]==3 and sent[7]==2 and sent[4]==2)
    assert(#panels==0 and boostCloses==1, "repeated removals do not require reopening the admin menu")
`));

test("R offers the aimed point, locks its ID while the camera moves, and cancels without deleting",()=>run(setup+`
    open(); press(IN_RELOAD)
    assert(screenText():find("▶ "..language.GetPhrase("zombieplague.bsafedelete").." #1",1,true))
    local before=requests; aimX=200; press(IN_RELOAD); assert(requests==before)
    press(IN_RELOAD); assert(screenText():find("#2",1,true), "a new contextual action uses the new aim target")
    aimX=0; press(IN_ATTACK)
    assert(sent[5]==3 and sent[7]==2, "moving the crosshair after opening cannot silently change the deletion target")
    ack({Revision=2,Feedback="saved",Points={saved[1],saved[3]}})
    press(IN_ATTACK2); before=requests; press(IN_ATTACK2); assert(requests==before)
    press(IN_ATTACK2); input.IsKeyDown=function(key) return key==KEY_ESCAPE end
    hooks.Think.ZPBotSafeEditor(); assert(requests==before and not screenText():find("▶ ",1,true))
`));

test("a user removal queues behind a status poll with its original ID and revision",()=>run(setup+`
    open(); choose("bsafeboth")
    now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    local before=requests; press(IN_ATTACK2); press(IN_ATTACK)
    assert(requests==before, "a concurrent status request cannot swallow the deletion or create another request")
    aimX=200; press(IN_ATTACK2); press(IN_ATTACK); assert(requests==before, "the queued target is not replaced by another click")
    ack({Revision=2}); now=now+0.3; hooks.Think.ZPBotSafeEditor()
    assert(requests==before+1 and sent[5]==3 and sent[7]==1 and sent[4]==1,
        "the removal keeps its original revision so a concurrent edit can be rejected safely")
    ack({Revision=2,Feedback="stale"})
    assert(screenText():find(language.GetPhrase("zombieplague.bsafestale"),1,true))
    now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0, "stale edits are never replayed automatically")
`));

test("a safe point deleted remotely closes its contextual action without selecting a replacement",()=>run(setup+`
    open(); choose("bsafeboth"); press(IN_ATTACK2)
    now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    ack({Revision=2,Points={saved[2]}})
    assert(not screenText():find("▶ ",1,true) and not screenText():find("#1",1,true))
    local before=requests; press(IN_ATTACK2); assert(requests==before and not screenText():find("▶ ",1,true))
`));

test("a timed-out status poll never replays a queued removal after reconnecting",()=>run(setup+`
    open(); choose("bsafeboth")
    now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    press(IN_ATTACK2); press(IN_ATTACK)
    now=now+3.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    ack(); now=now+1.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    ack(); press(IN_ATTACK2); press(IN_ATTACK)
    assert(sent[5]==3 and sent[7]==1, "a fresh explicit click can remove the point after reconciliation")
`));

test("safe points retain visible markers and theme-aware contextual actions",()=>run(setup+`
    selectedLocale="pt-BR"; open(); choose("bsafeboth")
    drawn={}; hooks.PostDrawTranslucentRenderables.ZPBotSafeEditor()
    assert(#drawn==4)
    for i=1,3 do assert(drawn[i].depth==false) end
    assert(drawn[4].depth==true)
    labels={}; hooks.HUDPaint.ZPBotSafeEditor(); local text=table.concat(labels,"|")
    assert(text:find("Ponto 1",1,true) and text:find("Humanos",1,true) and text:find("Zumbis",1,true))
    assert(not text:find("Ponto 3",1,true))
    press(IN_ATTACK2); local before=requests
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); assert(screenText():find("▶ Remover ponto #1",1,true))
    end
    assert(requests==before and targetCount==1)
    press(IN_ATTACK); ack({Revision=2,Feedback="saved",Points={saved[2]}})
    drawn={}; hooks.PostDrawTranslucentRenderables.ZPBotSafeEditor(); assert(#drawn==2 and drawn[1].position.x==200)
`));

test("safe marker picking follows its visible base and stem rather than only the raised text",()=>run(setup+`
    local markers=include("cl_bot_safe_markers.lua")
    local aimHeight=4
    vectorMeta.ToScreen=function(self) return {x=self.x+640,y=360-(self.z-aimHeight)*5,visible=self.x<500} end
    assert(markers.pick(saved)==1)
    aimHeight=40; assert(markers.pick(saved)==1)
    assert(markers.pick({{ID=4,Role="both",Position={40,0,0}}})==0)
`));

test("held safe-tool keys and engine callbacks cannot repeat a contextual removal",()=>run(setup+`
    open(); now=now+0.25; commandInput(IN_RELOAD); commandInput(IN_RELOAD)
    assert(screenText():find("▶ "..language.GetPhrase("zombieplague.bsafedelete"),1,true))
    commandInput(0); local before=requests; now=now+0.25
    local cmd=commandInput(IN_ATTACK); commandInput(IN_ATTACK)
    tool:PrimaryAttack(); tool:SecondaryAttack(); tool:Reload()
    assert(cmd.keys==0 and requests==before+1 and sent[5]==3 and sent[7]==1)
    commandInput(0); ack({Revision=2,Feedback="saved",Points={saved[2]}})
    aimX=1000; press(IN_RELOAD); choose("bsafemark"); assert(sent[5]==1)
`));

test("safe tool ignores invalid replies and cleans markers, input and material when closed or permissions change",()=>run(setup+`
    ZPBotSafeEditor:Open(); ack({Request=sent[3]+1}); assert(not screenText():find("▶ ",1,true))
    ack({Equipped="yes"}); assert(not screenText():find("▶ ",1,true))
    ack(); choose("bsafeboth"); press(IN_ATTACK); local id=sent[3]
    ZPBotSafeEditor:Close(); assert(sent[5]==5)
    readTable={Request=id,Revision=2,Points=saved,Feedback="saved",Equipped=true}; receivers.ZPBotSafeReply(4096)
    drawn={}; labels={}; hooks.PostDrawTranslucentRenderables.ZPBotSafeEditor(); hooks.HUDPaint.ZPBotSafeEditor()
    assert(#drawn==0 and #labels==0 and wheel()==nil and commandInput(IN_ATTACK).keys==IN_ATTACK)
    open(); viewer.admin=false; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==5)
    viewer.admin=true; open(); hooks.Think.ZPBotSafeEditor(); viewer.weapon={GetClass=function() return "weapon_pistol" end}
    hooks.Think.ZPBotSafeEditor(); assert(sent[5]==5)
`));

test("safe tool timeouts reconcile deletion without repeating it, and screen errors restore render state",()=>run(setup+`
    open(); press(IN_ATTACK2); press(IN_ATTACK); assert(sent[5]==3)
    now=now+3.1; hooks.Think.ZPBotSafeEditor(); assert(sent[5]==0)
    ack({Revision=2,Points={saved[2]}}); assert(not screenText():find("▶ ",1,true))
    local drawText=draw.DrawText; draw.DrawText=function() error("paint failed") end
    hooks.PreDrawViewModel.ZPBotSafeScreen(vm,viewer,viewer.weapon)
    assert(overrides[1]=="addon/screen" and rtDepth==0 and camDepth==0 and not clipping)
    draw.DrawText=drawText; screenText()
    now=now+0.3; press(IN_ATTACK); ack({Equipped=false,Feedback="invalid"}); assert(sent[5]==5)
`));

