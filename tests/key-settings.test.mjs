import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = clientSetup + panelsSetup + `
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local down,builtIn,typing={}, {}, false
input.IsKeyDown=function(key) return down[key]==true end
local mouseDown,cursor={},false
input.IsMouseDown=function(key) return mouseDown[key]==true end
vgui.CursorVisible=function() return cursor end
input.LookupKeyBinding=function(key) return builtIn[key] end
function viewer:IsTyping() return typing end
local function activeFrame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function captureButton(frame,index)
    local buttons={}
    for _,panel in ipairs(panels) do
        if not panel.removed and panel.kind=="DButton" and panel.OnKeyCodePressed then buttons[#buttons+1]=panel end
    end
    assert(#buttons==4)
    return buttons[index]
end
`;

test("Mouse3 capture persists, waits for release and dispatches once without its original attack", () => run(setup + `
    local saved
    util.TableToJSON=function(value) saved=value; return "bindings" end
    ZPSettings:Open()
    captureButton(activeFrame(),3):DoClick()
    local layer=vgui.focus
    assert(layer.OnMousePressed and layer.OnKeyCodePressed and layer~=captureButton(activeFrame(),3))
    mouseDown[MOUSE_MIDDLE]=true
    layer:OnMousePressed(MOUSE_MIDDLE)
    assert(layer.removed and KeyManager.Keys.ZombiePlagueActions.RequestAbility==MOUSE_MIDDLE)
    hooks.Think.KeyManagerHook(); assert(requests==0)
    ZPSettings:Close()
    hooks.Think.KeyManagerHook(); assert(requests==0, "assignment must not activate a held mouse button")
    mouseDown={}; hooks.Think.KeyManagerHook()
    mouseDown[MOUSE_MIDDLE]=true; hooks.Think.KeyManagerHook()
    assert(requests==1 and sent[1]=="RequestAbility")
    hooks.Think.KeyManagerHook(); assert(requests==1)
    builtIn[MOUSE_MIDDLE]="+attack2"
    assert(hooks.PlayerBindPress.ZPExclusiveKeyBinding(viewer,"+attack2",true,MOUSE_MIDDLE)==true)
    IN_ATTACK2=2048
    local command={RemoveKey=function(self,key) assert(key==IN_ATTACK2); self.removed=true end}
    hooks.CreateMove.ZPExclusiveKeyInput(command); assert(command.removed)
    file.Read=function() return "bindings" end; util.JSONToTable=function() return saved end
    local fresh=setmetatable({},getmetatable(KeyManager)); fresh:____constructor()
    fresh.EventGroups=KeyManager.EventGroups; fresh:Load()
    assert(fresh.Keys.ZombiePlagueActions.RequestAbility==MOUSE_MIDDLE)
    ZPSettings:Open(); paintAll()
    assert(ZPSettings:GetState().Bindings[3].Key==MOUSE_MIDDLE)
`));

test("physical mouse buttons can be captured and swapped without triggering the menu underneath", () => run(setup + `
    for code=MOUSE_LEFT,MOUSE_5 do
        ZPSettings:Open()
        captureButton(activeFrame(),3):DoClick()
        vgui.focus:OnMousePressed(code)
        assert(ZPSettings:GetState().Open and ZPSettings:GetState().Capturing=="")
        assert(KeyManager.Keys.ZombiePlagueActions.RequestAbility==code)
        assert(not KeyManager.Capturing and requests==0)
        ZPSettings:Close()
    end
    KeyManager:SetBinding("NightVisionToggle",MOUSE_MIDDLE)
    local old=KeyManager.Keys.ZombiePlagueActions.RequestAbility
    KeyManager:SetBinding("RequestAbility",MOUSE_MIDDLE)
    assert(KeyManager.Keys.ZombiePlagueActions.NightVisionToggle==old)
    assert(not KeyManager:SetBinding("RequestAbility",MOUSE_5+1), "wheel movement is not a held button")
    ZPSettings:Open(); captureButton(activeFrame(),3):DoClick()
    local layer=vgui.focus; layer:OnKeyCodePressed(KEY_ESCAPE)
    assert(layer.removed and not KeyManager.Capturing and ZPSettings:GetState().Open)
`));

test("mouse bindings preserve menu clicks, chat and focused editing without delayed activations", () => run(setup + `
    KeyManager:SetBinding("RequestAbility",MOUSE_MIDDLE)
    hooks.Think.KeyManagerHook()
    local block=hooks.PlayerBindPress.ZPExclusiveKeyBinding
    cursor=true; mouseDown[MOUSE_MIDDLE]=true
    hooks.Think.KeyManagerHook(); assert(requests==0)
    assert(block(viewer,"+attack2",true,MOUSE_MIDDLE)==nil)
    hooks.CreateMove.ZPExclusiveKeyInput({RemoveKey=function() error("UI input must be preserved") end})
    cursor=false; hooks.Think.KeyManagerHook(); assert(requests==0)
    mouseDown={}; hooks.Think.KeyManagerHook()
    typing=true; mouseDown[MOUSE_MIDDLE]=true; hooks.Think.KeyManagerHook(); assert(requests==0)
    typing=false; hooks.Think.KeyManagerHook(); assert(requests==0)
    mouseDown={}; hooks.Think.KeyManagerHook()
    mouseDown[MOUSE_MIDDLE]=true; hooks.Think.KeyManagerHook(); assert(requests==1)
`));

test("key capture swaps actions, saves immediately, survives reopening and never fires while assigning", () => run(setup + `
    local writes,saved=0
    util.TableToJSON=function(value) saved=value; return "bindings" end
    file.Write=function(path) assert(path==KeyManager.SaveFileName); writes=writes+1 end
    ZPSettings:Open()
    local frame=activeFrame()
    local ability=captureButton(frame,3)
    ability:DoClick()
    assert(ZPSettings:GetState().Capturing=="RequestAbility" and frame.keyboard and vgui.focus.OnMousePressed)
    down[KEY_F3]=true
    ability:OnKeyCodePressed(KEY_F3)
    assert(ZPSettings:GetState().Capturing=="" and not frame.keyboard and not KeyManager.Capturing)
    assert(KeyManager.Keys.ZombiePlagueActions.RequestAbility==KEY_F3)
    assert(KeyManager.Keys.ZombiePlagueActions.NightVisionToggle==KEY_T and writes==1)
    hooks.Think.KeyManagerHook(); assert(requests==0)
    down={}; hooks.Think.KeyManagerHook()
    down[KEY_F3]=true; hooks.Think.KeyManagerHook()
    assert(requests==1 and sent[1]=="RequestAbility")
    hooks.Think.KeyManagerHook(); assert(requests==1)
    ZPSettings:Close(); ZPSettings:Open()
    assert(ZPSettings:GetState().Bindings[3].Key==KEY_F3)
    file.Read=function() return "bindings" end
    util.JSONToTable=function() return saved end
    local fresh=setmetatable({},getmetatable(KeyManager)); fresh:____constructor()
    fresh.EventGroups=KeyManager.EventGroups; fresh:Load()
    assert(fresh.Keys.ZombiePlagueActions.RequestAbility==KEY_F3 and fresh.Keys.ZombiePlagueActions.NightVisionToggle==KEY_T)
`));

test("escape cancels capture, reserved keys are rejected, themes and closing release keyboard focus", () => run(setup + `
    ZPSettings:Open()
    local button=captureButton(activeFrame(),3)
    button:DoClick()
    button:OnKeyCodePressed(KEY_BACKQUOTE)
    assert(ZPSettings:GetState().Capturing=="RequestAbility")
    down[KEY_ESCAPE]=true; button:OnKeyCodePressed(KEY_ESCAPE)
    hooks.Think.ZPSettingsController()
    assert(ZPSettings:GetState().Open and ZPSettings:GetState().Capturing=="")
    assert(KeyManager.Keys.ZombiePlagueActions.RequestAbility==KEY_T)
    down={}; hooks.Think.ZPSettingsController()
    button:DoClick(); ZPThemes:UseTheme("hl2")
    assert(not KeyManager.Capturing and ZPSettings:GetState().Capturing=="" and vgui.focus==nil)
    captureButton(activeFrame(),1):DoClick(); ZPSettings:Close()
    assert(not KeyManager.Capturing and vgui.focus==nil)
    assert(not KeyManager:SetBinding("RequestAbility",KEY_ESCAPE))
    assert(not KeyManager:SetBinding("RequestAbility",MOUSE_5+1))
    assert(not KeyManager:SetBinding("RequestAbility",0/0))
    assert(not KeyManager:SetBinding("unknown",22))
`));

test("every theme paints current keys, uses addon colors and can restore all four defaults", () => run(setup + `
    local base=ZPThemes:GetTheme()
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette=base.Palette,
        CreateWeaponMenu=base.CreateWeaponMenu,CreateHUD=base.CreateHUD})
    for _,theme in ipairs({"classic","hl2","cs16","addon"}) do
        ZPThemes:UseTheme(theme); ZPSettings:Open()
        local frame=activeFrame()
        captureButton(frame,3):DoClick(); captureButton(frame,3):OnKeyCodePressed(22)
        local rendered={}
        local original=draw.DrawText
        draw.DrawText=function(text) rendered[text]=true end
        paintAll(); draw.DrawText=original
        assert(rendered.KEY22 and rendered["zombieplague.settingskeys"])
        assert(rendered["zombieplague.keybindingrequestability"] and rendered["zombieplague.settingskeysreset"])
        ZPSettings:ResetBindings()
        assert(KeyManager.Keys.ZombiePlagueActions.MainMenu==KEY_F4 and KeyManager.Keys.ZombiePlagueActions.RequestAbility==KEY_T)
        assert(KeyManager.Keys.ZombiePlagueActions.NightVisionToggle==KEY_F3)
        assert(KeyManager.Keys.ZombiePlagueActions.Dance==KEY_G)
        ZPSettings:Close()
    end
`));

test("mapped keys suppress native binds but typing, console and focused inputs retain normal editing", () => run(setup + `
    assert(KeyManager:SetBinding("RequestAbility",22))
    down={}; hooks.Think.KeyManagerHook()
    local block=hooks.PlayerBindPress.ZPExclusiveKeyBinding
    assert(block(viewer,"impulse 201",true,22)==true)
    assert(block(viewer,"+reload",true,23)==nil)
    typing=true; assert(block(viewer,"messagemode",true,22)==nil)
    down[22]=true; hooks.Think.KeyManagerHook(); assert(requests==0)
    typing=false; hooks.Think.KeyManagerHook(); assert(requests==0)
    down={}; hooks.Think.KeyManagerHook()
    gui.IsConsoleVisible=function() return true end
    down[22]=true; hooks.Think.KeyManagerHook(); assert(requests==0)
    gui.IsConsoleVisible=function() return false end
    down={}; hooks.Think.KeyManagerHook()
    local focus=vgui.Create("DTextEntry"); focus:RequestFocus()
    down[22]=true; hooks.Think.KeyManagerHook(); assert(requests==0)
    assert(block(viewer,"impulse 201",true,22)==nil)
    vgui.focus=nil; down={}; hooks.Think.KeyManagerHook()
    down[22]=true; hooks.Think.KeyManagerHook(); assert(requests==1)
`));

test("mapped movement, jump, reload and impulses are removed without erasing unrelated command inputs", () => run(setup + `
    IN_JUMP,IN_RELOAD,IN_ATTACK,IN_FORWARD,IN_BACK,IN_MOVELEFT,IN_MOVERIGHT=2,8192,1,8,16,512,1024
    IN_SCORE,IN_LEFT,IN_RIGHT=65536,128,256
    IN_ATTACK2,IN_DUCK,IN_USE,IN_WALK,IN_ZOOM=2048,4,32,262144,524288
    KeyManager:SetBinding("RequestAbility",22)
    down[22]=true
    local command={keys={[IN_JUMP]=true,[IN_ATTACK]=true,[IN_RELOAD]=true},forward=150,side=-80,up=10,impulse=201}
    function command:RemoveKey(key) self.keys[key]=nil end
    function command:GetForwardMove() return self.forward end
    function command:SetForwardMove(value) self.forward=value end
    function command:GetSideMove() return self.side end
    function command:SetSideMove(value) self.side=value end
    function command:GetUpMove() return self.up end
    function command:SetUpMove(value) self.up=value end
    function command:SetImpulse(value) self.impulse=value end
    builtIn[22]="+jump; +reload; impulse 201"
    hooks.CreateMove.ZPExclusiveKeyInput(command)
    assert(not command.keys[IN_JUMP] and not command.keys[IN_RELOAD] and command.keys[IN_ATTACK])
    assert(command.forward==150 and command.side==-80 and command.impulse==0)
    builtIn[22]="+forward; +moveleft; +moveup"
    hooks.CreateMove.ZPExclusiveKeyInput(command)
    assert(command.forward==0 and command.side==0 and command.up==0)
    command.forward=-150; command.side=80; command.up=-10
    hooks.CreateMove.ZPExclusiveKeyInput(command)
    assert(command.forward==-150 and command.side==80 and command.up==-10)
    down={}; command.keys[IN_JUMP]=true; builtIn[22]="+jump"
    hooks.CreateMove.ZPExclusiveKeyInput(command); assert(command.keys[IN_JUMP])
    down[22]=true; builtIn[22]="custom_jump"
    input.TranslateAlias=function(bind) if bind=="custom_jump" then return "+jump" end end
    hooks.CreateMove.ZPExclusiveKeyInput(command); assert(not command.keys[IN_JUMP])
    command.keys[IN_SCORE]=true; builtIn[22]="+showscores"
    hooks.CreateMove.ZPExclusiveKeyInput(command); assert(not command.keys[IN_SCORE])
`));
