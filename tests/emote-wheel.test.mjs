import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { emoteActivitiesSetup } from "./helpers/emotes.mjs";

const setup = clientSetup + panelsSetup + emoteActivitiesSetup + `
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
ROUND_WAITING_PLAYERS,ROUND_STARTING_NEW_ROUND,ROUND_PLAYING,ROUND_VOTEMAP=0,1,2,5
RoundManager={state=ROUND_PLAYING,GetRoundState=function(self) return self.state end}
IN_ATTACK,IN_ATTACK2=1,2048
local down,mouse={},{}
local cursorX,cursorY=640,360
local typing,externalCursor,console,gameUI=false,false,false,false
function viewer:IsTyping() return typing end
function viewer:GetViewEntity() return self.viewEntity or self end
function viewer:GetNWFloat() return self.untilTime or 0 end
function viewer:GetModel() return self.model or "human" end
function viewer:SelectWeightedSequence(activity) return self.unsupported==activity and -1 or activity end
function viewer:SequenceDuration(sequence) return 5 end
input.IsKeyDown=function(key) return down[key]==true end
input.IsMouseDown=function(key) return mouse[key]==true end
input.SetCursorPos=function(x,y) cursorX,cursorY=x,y end
gui.IsConsoleVisible=function() return console end
gui.IsGameUIVisible=function() return gameUI end
math.atan2=function(y,x) return math.atan(y,x) end
local function wheelPanel()
    for _,p in ipairs(panels) do if p.kind=="DPanel" and p.popup and not p.removed then return p end end
end
vgui.CursorVisible=function() return externalCursor or wheelPanel()~=nil end
function panelMeta:LocalCursorPos() return cursorX,cursorY end
local remove=panelMeta.Remove
function panelMeta:Remove()
    if self.removed then return end
    remove(self)
    if self.OnRemove then self:OnRemove() end
end
local polygons,colors,texts={}, {}, {}
draw.NoTexture=function() end
surface.SetDrawColor=function(r,g,b,a) colors[#colors+1]={r=r,g=g,b=b,a=a} end
surface.DrawPoly=function(points)
    assert(#points==4)
    -- Positive signed area is clockwise on screen, as required by DrawPoly.
    local area=0
    for i=1,4 do local a,b=points[i],points[i%4+1]; area=area+a.x*b.y-b.x*a.y end
    assert(area>0)
    polygons[#polygons+1]=points
end
draw.DrawText=function(text) texts[text]=true end
include("cl_emote_wheel.lua")
local function tick() hooks.Think.ZPEmoteWheel() end
local function point(slot)
    local angle=-math.pi/2+slot*math.pi/4
    cursorX,cursorY=640+math.cos(angle)*180,360+math.sin(angle)*180
end
local function open(key)
    key=key or KEY_G
    if key<=KEY_LAST then down[key]=true else mouse[key]=true end
    ZPEmoteWheel:Open(key)
    assert(ZPEmoteWheel:IsOpen() and wheelPanel().keyboard==false)
    assert(cursorX==640 and cursorY==360)
end
local function release(key)
    if key<=KEY_LAST then down[key]=nil else mouse[key]=nil end
    tick()
end
local function command()
    return {ClearButtons=function(self) self.cleared=true end,ClearMovement=function(self) self.stopped=true end,
        SetImpulse=function(self,value) self.impulse=value end,
        RemoveKey=function(self,key) self[key]=true end}
end
`;

test("holding the configured key opens a wheel, and release sends exactly the selected catalog ID", () => run(setup + `
    hooks.Think.KeyManagerHook(); down[KEY_G]=true; hooks.Think.KeyManagerHook()
    assert(ZPEmoteWheel:IsOpen() and requests==0)
    assert(hooks.PlayerBindPress.ZPEmoteWheel(viewer,"+attack",true,MOUSE_LEFT)==true)
    down[KEY_T]=true; hooks.Think.KeyManagerHook(); assert(requests==0, "other actions cannot fire through the wheel")
    point(1); tick(); assert(ZPEmoteWheel:IsOpen() and requests==0)
    release(KEY_G)
    assert(not ZPEmoteWheel:IsOpen() and not wheelPanel())
    assert(requests==1 and sent[1]=="ZPDanceStart" and sent[2]==2)
    tick(); assert(requests==1)
    local cmd=command(); hooks.CreateMove.ZPEmoteWheel(cmd)
    assert(cmd.cleared and cmd.stopped and cmd.impulse==0, "release frame cannot fire a native action")
`));

test("each radial direction and both pages match the visual slot without wraparound mistakes", () => run(setup + `
    for page=0,1 do
        for slot=0,7 do
            open(); if page==1 then wheelPanel():OnMouseWheeled(-1) end
            local state=ZPEmoteWheel:State(); assert(state.Page==page and state.Pages==2 and #state.Entries==8)
            point(slot); release(KEY_G)
            assert(sent[2]==page*8+slot+1)
            if page==1 then open(); wheelPanel():OnMouseWheeled(1); ZPEmoteWheel:Cancel(); down[KEY_G]=nil end
        end
    end
`));

test("center, outside the ring, Escape, right click and removed panels cancel without a request", () => run(setup + `
    open(); release(KEY_G); assert(requests==0)
    open(); cursorX,cursorY=0,0; release(KEY_G); assert(requests==0)
    open(); point(0); down[KEY_ESCAPE]=true; tick()
    assert(not ZPEmoteWheel:IsOpen() and requests==0); down[KEY_ESCAPE]=nil; down[KEY_G]=nil
    open(); point(0); wheelPanel():OnMousePressed(MOUSE_RIGHT)
    assert(not ZPEmoteWheel:IsOpen() and requests==0); down[KEY_G]=nil
    open(); point(0); wheelPanel():Remove()
    assert(not ZPEmoteWheel:IsOpen() and requests==0)
`));

test("console opening waits for input ownership and a model change cannot race a selection click", () => run(setup + `
    console=true; consoleCommands.zp_emotes(); tick(); assert(not ZPEmoteWheel:IsOpen())
    console=false; tick(); assert(ZPEmoteWheel:IsOpen())
    point(0); viewer.model="changed"; wheelPanel():OnMousePressed(MOUSE_LEFT)
    assert(not ZPEmoteWheel:IsOpen() and requests==0)
    console=true; consoleCommands.zp_emotes(); ZPEmoteWheel:Cancel()
    console=false; tick(); assert(not ZPEmoteWheel:IsOpen(), "cancel also discards a pending console request")
`));

test("Mouse3 and Mouse1 bindings stay open until physical release; selection clicks are consumed", () => run(setup + `
    for _,key in ipairs({MOUSE_MIDDLE,MOUSE_LEFT,MOUSE_RIGHT,MOUSE_4,MOUSE_5}) do
        KeyManager:SetBinding("Dance",key)
        mouse={}; hooks.Think.KeyManagerHook()
        mouse[key]=true; hooks.Think.KeyManagerHook()
        assert(ZPEmoteWheel:IsOpen())
        point(0); tick(); assert(ZPEmoteWheel:IsOpen())
        if key==MOUSE_LEFT or key==MOUSE_RIGHT then wheelPanel():OnMousePressed(key); assert(ZPEmoteWheel:IsOpen()) end
        release(key); assert(not ZPEmoteWheel:IsOpen() and sent[2]==1)
    end
    consoleCommands.zp_emotes(); assert(ZPEmoteWheel:IsOpen())
    point(1); mouse[MOUSE_LEFT]=true; wheelPanel():OnMousePressed(MOUSE_LEFT)
    assert(not ZPEmoteWheel:IsOpen() and sent[2]==2 and KeyManager.PressingKeyList[MOUSE_LEFT])
    local cmd=command(); hooks.CreateMove.ZPEmoteWheel(cmd)
    assert(cmd[IN_ATTACK] and cmd[IN_ATTACK2])
    cmd=command(); hooks.CreateMove.ZPEmoteWheel(cmd); assert(cmd[IN_ATTACK])
    mouse={}; hooks.CreateMove.ZPEmoteWheel(command())
    cmd=command(); hooks.CreateMove.ZPEmoteWheel(cmd); assert(not cmd[IN_ATTACK] and not cmd.cleared)
`));

test("unsupported emotes are disabled and stale player or UI state cannot execute a selection", () => run(setup + `
    viewer.unsupported=ACT_GMOD_TAUNT_ROBOT
    open(); assert(not ZPEmoteWheel:State().Entries[2].Available)
    point(1); paintAll(); assert(texts["zombieplague.danceunavailable"])
    release(KEY_G); assert(requests==0)
    local changes={function() viewer.alive=false end,function() viewer.team=TEAM_SPECTATOR end,
        function() viewer.model="changed" end,function() viewer.viewEntity={} end,function() typing=true end,
        function() gameUI=true end,function() console=true end,function() KeyManager.Capturing=true end,
        function() RoundManager.state=ROUND_VOTEMAP end,function() viewer.untilTime=20 end,
        function() vgui.focus=vgui.Create("DTextEntry") end}
    for _,change in ipairs(changes) do
        viewer.alive=true; viewer.team=TEAM_HUMANS; viewer.model=nil; viewer.viewEntity=nil; viewer.untilTime=nil
        typing,gameUI,console=false,false,false; KeyManager.Capturing=false; RoundManager.state=ROUND_PLAYING; vgui.focus=nil
        open(); point(0); change(); release(KEY_G)
        assert(not ZPEmoteWheel:IsOpen() and requests==0)
    end
`));

test("the wheel preserves other menus and paints all active theme palettes including addon colors", () => run(setup + `
    externalCursor=true; ZPEmoteWheel:Open(KEY_G); assert(not ZPEmoteWheel:IsOpen())
    externalCursor=false
    local base=ZPThemes:GetTheme()
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette={Accent=Color(9,17,29),Surface=Color(21,31,41),
        Panel=Color(43,53,63),Text=Color(231,241,251),Muted=Color(101,111,121)},
        CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD})
    for _,id in ipairs({"classic","hl2","cs16","addon"}) do
        ZPThemes:UseTheme(id); open(); point(0); colors={}; polygons={}; texts={}; paintAll()
        assert(#polygons==(id=="cs16" and 8 or 80))
        local accent=ZPThemes:GetTheme().Palette.Accent
        assert(colors[1].r==accent.r and colors[1].g==accent.g and colors[1].b==accent.b)
        assert(texts["zombieplague.keybindingdance"] and texts["zombieplague.emotedance"] and texts["zombieplague.emotepages"])
        wheelPanel():OnMouseWheeled(-1); paintAll(); assert(texts["zombieplague.emoteagree"])
        wheelPanel():OnMouseWheeled(-1); assert(ZPEmoteWheel:State().Page==0)
        ZPEmoteWheel:Cancel(); down[KEY_G]=nil
    end
`));
