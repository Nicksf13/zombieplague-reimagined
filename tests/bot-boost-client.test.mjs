import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { nativeLanguage } from "./helpers/native-localization.mjs";

const setup = clientSetup + panelsSetup + nativeLanguage + `
viewer.admin=true; viewer.superadmin=false
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
viewer.weapon={GetClass=function() return "zp_bot_boost_tool" end}
function viewer:GetActiveWeapon() return self.weapon end
IN_RELOAD=8192; viewer.reloadHeld=false
function viewer:KeyDown(key) return key==IN_RELOAD and self.reloadHeld end
function viewer:EyePos() return Vector(0,0,64) end
function viewer:GetEyeTrace() return self.trace end
local vectorMeta={ToScreen=function(self) return {x=self.x+640,y=self.y+360,visible=true} end}
function Vector(x,y,z) return setmetatable({x=x,y=y,z=z},{__index=vectorMeta}) end
viewer.trace={Hit=true,HitPos=Vector(10,20,0),HitNormal=Vector(0,0,1),Entity={GetClass=function() return "worldspawn" end}}
SERVER=false; CLIENT=true; local predicted=true
function IsFirstTimePredicted() return predicted end
SWEP={Primary={},Secondary={},SetNextPrimaryFire=function() end,SetNextSecondaryFire=function() end}
include("zombieplague/entities/weapons/zp_bot_boost_tool.lua"); local tool=SWEP
local drawn,labels={},{}
render={DrawWireframeSphere=function(position,radius,_,_,color,depth) drawn[#drawn+1]={position=position,radius=radius,color=color,depth=depth} end,DrawLine=function() end}
local targetCount,materialCount,rtDepth,camDepth=0,0,0,0
local clipping=false
function GetRenderTarget(name,w,h) targetCount=targetCount+1; assert(w==512 and h==512); return {GetName=function() return name end} end
function CreateMaterial(name,shader,parameters) materialCount=materialCount+1; assert(shader=="UnlitGeneric" and parameters["$basetexture"]=="ZPBotBoostScreen"); return {GetName=function() return name end} end
function DisableClipping(value) local old=clipping; clipping=value; return old end
render.PushRenderTarget=function() rtDepth=rtDepth+1 end
render.PopRenderTarget=function() rtDepth=rtDepth-1 end
render.Clear=function() assert(rtDepth==1) end
cam={Start2D=function() camDepth=camDepth+1 end,End2D=function() camDepth=camDepth-1 end}
local function viewModel(materials)
    local overrides={[1]="addon/screen",[2]="addon/unrelated"}
    return {GetMaterials=function() return materials or {"models/weapons/body","models/weapons/v_toolgun/screen","models/weapons/other"} end,
        GetSubMaterial=function(_,index) return overrides[index] or "" end,
        SetSubMaterial=function(_,index,value) overrides[index]=value end},overrides
end
draw.DrawText=function(text) labels[#labels+1]=text end
include("sh_bot_boost_protocol.lua"); include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua"); include("cl_bot_boost.lua")
local saved={ID=1,Base={0,0,0},Approach={-64,0,0},Exit={64,0,72}}
local other={ID=2,Base={200,0,0},Approach={136,0,0},Exit={264,0,72}}
local function frame() for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end end
local function ack(fields)
    readTable={Version=1,RequestID=sent[3],Revision=1,Feedback="ready",Draft={ID=0,Base={},Approach={},Exit={}},Editing=false,Dirty=false,Selected=0,
        Sessions={},Results={},Points={saved,other}}
    for key,value in pairs(fields or {}) do readTable[key]=value end
    receivers.ZPBotBoostReply(4096)
end
local function press(method) now=now+0.2; tool[method](tool) end
local function clickDerma(key)
    local expected=language.GetPhrase("zombieplague."..key)
    for _,panel in ipairs(panels) do
        if panel.kind=="DButton" and not panel.removed and panel.visible~=false then
            labels={}; panel:Paint(panel.w,panel.h)
            if labels[1] and labels[1]:sub(1,#expected)==expected then now=now+0.2; panel:DoClick(); return panel end
        end
    end
    error("Missing button "..key)
end
local function screenText()
    local vm=viewModel(); labels={}; hooks.PreDrawViewModel.ZPBotBoostScreen(vm,viewer,viewer.weapon)
    hooks.PostDrawViewModel.ZPBotBoostScreen(); return table.concat(labels,"|"), labels
end
local function menuOpen()
    local _,text=screenText()
    return text[1] and (text[1]:find(language.GetPhrase("zombieplague.botboostactions"),1,true) or
        text[1]:find(language.GetPhrase("zombieplague.botboostchoose"),1,true))
end
local function chooseText(expected)
    assert(menuOpen(), "weapon menu must be open")
    for _=1,34 do
        local _,text=screenText()
        for _,line in ipairs(text) do
            if line:sub(1,#("▶ "..expected))=="▶ "..expected then press("PrimaryAttack"); return end
        end
        assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true)
    end
    error("Missing tool action "..expected)
end
local function click(key) chooseText(language.GetPhrase("zombieplague."..key)) end
local function selectSaved(id) click("botboostchoose"); chooseText("#"..id) end
local function tick() now=now+0.2; hooks.Think.ZPBotBoostEditor() end
local function open() now=now+0.2; ZPBotBoostEditor:Open(); assert(sent[5]==10); ack() end
local function newDraft() press("Reload"); click("botboostnew"); assert(sent[5]==1); ack({Editing=true}) end
`;

test("aim selection immediately edits the nearest highlighted boost without opening the menu", () => run(setup + `
    open(); assert(not frame())
    hooks.PostDrawTranslucentRenderables.ZPBotBoostEditor(); assert(#drawn==6)
    for _,marker in ipairs(drawn) do assert(marker.depth==false, "saved boosts remain visible through geometry") end
    labels={}; hooks.HUDPaint.ZPBotBoostEditor(); local all=table.concat(labels,"|")
    assert(all:find("#1",1,true) and all:find("#2",1,true))
    press("PrimaryAttack"); assert(sent[5]==9 and sent[6]==1, "selection starts editing in one request")
    ack({Selected=1,Editing=true,Draft=saved,Issue={Code="physics",Slot=4,Actual=72,Min=0,Max=40}})
    assert(not frame())
    drawn={}; hooks.PostDrawTranslucentRenderables.ZPBotBoostEditor()
    assert(drawn[6].color.r==240 and drawn[6].color.g==80, "errors highlight the affected draft point")
    local count=requests; predicted=false; press("PrimaryAttack"); predicted=true; assert(requests==count)
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true)
    assert(requests==count, "cycling changes no server data")
    press("PrimaryAttack"); assert(sent[5]==3)
    assert(not hooks.PlayerBindPress or not hooks.PlayerBindPress.ZPBotBoostEditor)
`));

test("new boosts guide all three points, offer Save when complete, then target Test and End from the same tool", () => run(setup + `
    selectedLocale="pt-BR"; open(); newDraft()
    press("PrimaryAttack"); assert(sent[5]==2)
    ack({Editing=true,Dirty=true,Draft={ID=0,Base={0,0,0},Approach={},Exit={}},Issue={Code="incomplete",Slot=3,Actual=0,Min=0,Max=0}})
    viewer.trace.HitPos=Vector(-64,0,0); press("PrimaryAttack"); assert(sent[5]==3)
    ack({Editing=true,Dirty=true,Draft={ID=0,Base={0,0,0},Approach={-64,0,0},Exit={}}})
    viewer.trace.HitPos=Vector(64,0,72); press("PrimaryAttack"); assert(sent[5]==4)
    ack({Editing=true,Dirty=true,Draft=saved}); assert(not frame(), "completing or adjusting points keeps editing in the weapon")
    press("Reload")
    click("botboostsave"); assert(sent[5]==5)
    ack({Feedback="saved",Selected=2,Draft=other}); click("botboosttest"); assert(sent[5]==7 and sent[6]==2)
    ack({Feedback="testing",Selected=2}); click("botboostclose"); assert(sent[5]==11 and not frame())
`));

test("right click pauses and resumes editing without a menu, saving, discarding or replacing the draft", () => run(setup + `
    open(); press("PrimaryAttack"); assert(sent[5]==9)
    ack({Selected=1,Editing=true,Draft=saved}); press("PrimaryAttack")
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); local count=requests
    press("SecondaryAttack"); assert(not frame() and requests==count)
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true, "paused editing cannot switch weapons by scrolling")
    press("SecondaryAttack"); assert(not frame() and requests==count)
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invprev",true)==true)
    press("PrimaryAttack"); assert(sent[5]==4, "backward cycling wraps from support to destination")
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); assert(not frame())
    press("Reload"); click("botboostclose"); assert(sent[5]==11)
`));

test("wheel navigates tool actions and never switches weapons during selection, pending requests or saved state", () => run(setup + `
    open(); local count=requests
    for _,bind in ipairs({"invnext","invprev"}) do
        assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,bind,true)==true)
        assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,bind,false)==true)
    end
    assert(requests==count and hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"slot2",true)==nil)
    press("PrimaryAttack"); assert(sent[5]==9); count=requests
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true and requests==count)
    ack({Selected=1,Editing=true,Draft=saved}); press("PrimaryAttack"); assert(sent[5]==2)
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invprev",true)==true)
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved})
    for _=1,3 do assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true) end
    press("PrimaryAttack"); assert(sent[5]==2, "cycling wraps through points while staying in the tool")
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); press("Reload")
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true and menuOpen())
    click("botboostsave"); ack({Feedback="saved",Selected=1,Draft=saved}); click("botboostback")
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==true)
    viewer.weapon={GetClass=function() return "weapon_pistol" end}
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)==nil)
    viewer.weapon={GetClass=function() return "zp_bot_boost_tool" end}; viewer.admin=false
    assert(hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invprev",true)==nil)
`));

test("reselecting the current draft resumes its active point while choosing another boost protects unsaved changes", () => run(setup + `
    open(); press("PrimaryAttack"); ack({Selected=1,Editing=true,Draft=saved})
    hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)
    press("PrimaryAttack"); ack({Selected=1,Editing=true,Dirty=true,Draft=saved})
    press("Reload"); local count=requests; selectSaved(1)
    assert(not menuOpen() and not frame() and requests==count, "reselecting the same draft does not replace or save it")
    press("PrimaryAttack"); assert(sent[5]==3)
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); press("SecondaryAttack"); count=requests
    press("PrimaryAttack"); assert(requests==count and not frame(), "aim selection resumes a paused current draft")
    press("Reload"); selectSaved(2)
    assert(menuOpen() and not frame() and requests==count, "a different boost requires an unsaved-draft choice on the weapon")
    click("admincancel"); click("botboostback")
    press("PrimaryAttack"); assert(sent[5]==3, "cancel preserves the original draft and active point")
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); press("Reload")
    selectSaved(2)
    click("botboostdiscard"); assert(sent[5]==8); ack(); tick()
    assert(sent[5]==9 and sent[6]==2, "discard continues directly to editing the chosen boost")
    ack({Selected=2,Editing=true,Draft=other}); assert(not frame())
    press("PrimaryAttack"); assert(sent[5]==2)
`));

test("server-side capture errors stay in the tool display and never force the quick menu open", () => run(setup + `
    open(); newDraft(); press("PrimaryAttack")
    ack({Feedback="invalid",Editing=true,Issue={Code="floor",Slot=2,Actual=0,Min=0,Max=0}})
    assert(not frame()); labels={}; hooks.HUDPaint.ZPBotBoostEditor()
    local text=table.concat(labels,"")
    assert(text:find(language.GetPhrase("zombieplague.botnavreasonground"),1,true))
    press("PrimaryAttack"); assert(sent[5]==2, "the same role remains available for correction")
`));

test("reload toggles once per press, disabled actions do not capture and returning retains the placement role", () => run(setup + `
    open(); viewer.reloadHeld=true; press("Reload"); assert(menuOpen() and not frame())
    local count=requests
    for _=1,4 do press("Reload"); assert(menuOpen() and requests==count) end
    click("botboostsave"); click("botboosttest"); click("botboostremove")
    assert(requests==count, "disabled actions neither send requests nor place world points")
    viewer.reloadHeld=false; tick(); ack(); viewer.reloadHeld=true; press("Reload"); assert(not menuOpen())
    viewer.reloadHeld=false; tick(); press("PrimaryAttack"); ack({Selected=1,Editing=true,Draft=saved})
    hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invprev",true)
    press("Reload"); click("botboostchoose"); count=requests; press("SecondaryAttack")
    assert(menuOpen() and requests==count, "right click returns from the ID list without changing the draft")
    press("SecondaryAttack"); assert(not menuOpen() and requests==count)
    press("PrimaryAttack"); assert(sent[5]==4, "menu navigation does not change the placement role")
    ack({Selected=1,Editing=true,Dirty=true,Draft=saved}); press("Reload"); click("botboostnew")
    local text=screenText(); assert(text:find(language.GetPhrase("zombieplague.botboostunsaved"),1,true))
    count=requests; press("PrimaryAttack"); assert(requests==count, "unsaved confirmation defaults to Cancel")
    press("SecondaryAttack"); press("PrimaryAttack"); assert(sent[5]==4)
`));

test("the weapon ID list reaches all 32 boosts, keeps focus by ID through polling and selects directly into editing", () => run(setup + `
    open(); local many={}
    for id=1,32 do many[#many+1]={ID=id,Base={id*200,0,0},Approach={id*200-64,0,0},Exit={id*200+64,0,72}} end
    now=now+1.1; hooks.Think.ZPBotBoostEditor(); ack({Points=many})
    press("Reload"); click("botboostchoose")
    for _=1,31 do hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true) end
    local text=screenText(); assert(text:find("▶ #32",1,true) and text:find("#31",1,true))
    local count=requests; table.remove(many,1)
    now=now+1.1; hooks.Think.ZPBotBoostEditor(); ack({Points=many})
    text=screenText(); assert(text:find("▶ #32",1,true), "catalog updates retain the focused ID instead of its old row")
    press("PrimaryAttack"); assert(sent[5]==9 and sent[6]==32 and requests==count+2)
    ack({Selected=32,Editing=true,Draft=many[#many],Points=many}); assert(not menuOpen() and not frame())
    press("PrimaryAttack"); assert(sent[5]==2 and sent[6]==32)
`));

test("weapon confirmations default to Cancel and End remains usable while a server action is pending", () => run(setup + `
    open(); press("PrimaryAttack"); ack({Selected=1,Editing=true,Draft=saved}); press("Reload")
    click("botboostremove"); local text=screenText()
    assert(text:find(string.format(language.GetPhrase("zombieplague.botboostconfirmremove"),1),1,true))
    local count=requests; press("PrimaryAttack"); assert(requests==count, "delete confirmation defaults to Cancel")
    click("botboostsave"); assert(sent[5]==5); count=requests
    press("PrimaryAttack"); assert(requests==count, "pending action cannot be submitted twice")
    click("botboostclose"); assert(sent[5]==11 and not menuOpen() and not frame())
    ack({Feedback="saved",Selected=1,Draft=saved}); assert(not menuOpen(), "late replies cannot reopen the tool menu")
`));

test("the toolgun screen shows live roles and mode, restores only its screen material and reuses its render target", () => run(setup + `
    selectedLocale="pt-BR"; open(); newDraft()
    local vm,overrides=viewModel(); labels={}
    hooks.PreDrawViewModel.ZPBotBoostScreen(vm,viewer,viewer.weapon)
    assert(overrides[1]=="!ZPBotBoostScreenMaterial" and overrides[2]=="addon/unrelated")
    assert(rtDepth==0 and camDepth==0 and not clipping)
    local text=table.concat(labels,"|")
    assert(text:find(language.GetPhrase("zombieplague.botboostediting"),1,true))
    assert(text:find(language.GetPhrase("zombieplague.botboostbase"),1,true) and text:find(language.GetPhrase("zombieplague.botboostdraft"),1,true))
    hooks.PostDrawViewModel.ZPBotBoostScreen(); assert(overrides[1]=="addon/screen")
    hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true); labels={}
    hooks.PreDrawViewModel.ZPBotBoostScreen(vm,viewer,viewer.weapon)
    assert(table.concat(labels,"|"):find("▶ ○ "..language.GetPhrase("zombieplague.botboostapproach"),1,true))
    assert(targetCount==1 and materialCount==1, "one texture and material per realm")
    ZPBotBoostEditor:Close(); assert(overrides[1]=="addon/screen")
    hooks.PostDrawViewModel.ZPBotBoostScreen(); assert(overrides[1]=="addon/screen")
`));

test("screen painting failures restore camera, viewport and clipping, and other models and players are untouched", () => run(setup + `
    open(); local vm,overrides=viewModel()
    draw.DrawText=function() error("injected drawing failure") end
    hooks.PreDrawViewModel.ZPBotBoostScreen(vm,viewer,viewer.weapon)
    assert(rtDepth==0 and camDepth==0 and not clipping and overrides[1]=="addon/screen")
    local count=targetCount; local unrelated=viewModel({"models/weapons/pistol"})
    hooks.PreDrawViewModel.ZPBotBoostScreen(unrelated,viewer,viewer.weapon)
    hooks.PreDrawViewModel.ZPBotBoostScreen(vm,{},viewer.weapon)
    assert(targetCount==count and overrides[2]=="addon/unrelated")
    draw.DrawText=function() end
    hooks.PreDrawViewModel.ZPBotBoostScreen(vm,viewer,viewer.weapon)
    overrides[1]="addon/late-change"; hooks.PostDrawViewModel.ZPBotBoostScreen()
    assert(overrides[1]=="addon/late-change", "cleanup preserves a later override by another addon")
`));

test("editor instructions stay above the health HUD and avoid the top-right compact ammo-pack card", () => run(setup + `
    open(); local boxes={}
    draw.RoundedBox=function(_,x,y,w,h) boxes[#boxes+1]={x=x,y=y,w=w,h=h} end
    for _,size in ipairs({{1280,720},{800,600},{520,480}}) do
        ScrW=function() return size[1] end; ScrH=function() return size[2] end; boxes={}
        hooks.HUDPaint.ZPBotBoostEditor(); local panel=boxes[#boxes]
        assert(panel.y<100 and panel.y+panel.h<ScrH()-96 and panel.x>ScrW()*0.25)
        if ScrW()<1000 then assert(panel.x+panel.w<ScrW()-116, "compact ammo-pack card remains visible") end
    end
`));

test("unsaved drafts require an explicit choice, failed saves preserve them and cannot trigger a queued destructive action", () => run(setup + `
    open(); newDraft(); press("PrimaryAttack")
    ack({Editing=true,Dirty=true,Draft=saved}); press("Reload")
    local count=requests; click("botboostnew"); assert(requests==count)
    click("admincancel"); assert(requests==count)
    click("botboostnew"); click("botboostsave"); assert(sent[5]==5)
    ack({Feedback="invalid",Editing=true,Dirty=true,Draft=saved,Issue={Code="storage",Slot=0,Actual=0,Min=0,Max=0}})
    tick(); assert(sent[5]==5, "failed save never continues New")
    click("botboostnew"); click("botboostdiscard"); assert(sent[5]==8)
    ack(); tick(); assert(sent[5]==1, "discard acknowledgement precedes the queued action")
    ack({Editing=true}); assert(not frame())
    ZPBotBoostEditor:Close(); ack(); assert(not frame(), "late replies cannot reopen a closed tool")
`));

test("deletion names the selected boost and requires confirmation while End only releases the SWEP", () => run(setup + `
    open(); press("PrimaryAttack"); ack({Selected=1,Editing=true,Draft=saved}); press("Reload")
    local count=requests; click("botboostremove"); assert(requests==count)
    click("admincancel"); assert(requests==count)
    click("botboostremove"); click("botboostremove"); assert(sent[5]==6 and sent[6]==1)
    ack({Feedback="saved",Points={other}}); click("botboostclose"); assert(sent[5]==11)
`));

test("preview footprints follow the aim and explicit measurements and errors resolve in every native language", () => run(setup + `
    open(); newDraft()
    drawn={}; hooks.PostDrawTranslucentRenderables.ZPBotBoostEditor(); assert(#drawn==7 and drawn[7].position.x==10)
    local count=requests; viewer.trace.HitSky=true; press("PrimaryAttack"); assert(requests==count)
    viewer.trace.HitSky=false; viewer.trace.HitPos=Vector(5000,0,0); press("PrimaryAttack"); assert(requests==count)
    local ui=include("cl_bot_boost_presentation.lua")
    for locale in pairs(translations) do
        selectedLocale=locale
        for _,code in ipairs(include("sh_bot_boost_rules.lua").codes) do
            local message=ui.issueText({Code=code,Slot=3,Actual=300,Min=40,Max=128})
            assert(not message:find("zombieplague.",1,true),locale..":"..code)
            assert(message:find("300",1,true) and message:find("128",1,true))
        end
        local text=language.GetPhrase("zombieplague.botboostsurface")
        local wrapped=ui.wrap(text,120); assert(table.concat(wrapped,"")==text, "UTF-8 wrapping preserves "..locale)
    end
`));

test("weapon actions stay themed and focused through polling while closing or permission loss stops all requests", () => run(setup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); open(); press("Reload"); assert(menuOpen() and not frame())
        click("botboostchoose"); hooks.PlayerBindPress.ZPBotBoostPointWheel(viewer,"invnext",true)
        local surface=ZPThemes:GetTheme().Palette.Surface; local colored=false
        draw.RoundedBox=function(_,_,_,_,_,color) if color==surface then colored=true end end
        screenText(); assert(colored)
        now=now+1.1; hooks.Think.ZPBotBoostEditor(); ack()
        local text=screenText(); assert(text:find("▶ #2",1,true), "polling preserves the focused saved ID")
        ZPThemes:UseTheme(theme=="classic" and "hl2" or "classic")
        text=screenText(); assert(text:find("▶ #2",1,true), "theme changes also preserve navigation")
        press("PrimaryAttack"); assert(sent[5]==9 and sent[6]==2)
        ack({Selected=2,Editing=true,Draft=other}); assert(not menuOpen() and not frame(), "weapon selection closes the menu and starts editing")
        press("PrimaryAttack"); assert(sent[5]==2 and sent[6]==2)
        ack({Selected=2,Editing=true,Dirty=true,Draft=other})
        ZPBotBoostEditor:Close()
    end
    open(); viewer.admin=false; tick(); assert(sent[5]==11 and not frame())
    local count=requests; ZPBotBoostEditor:Open(); assert(requests==count)
    viewer.admin=true; open(); tick(); viewer.weapon=nil; tick(); assert(sent[5]==11)
`));

test("F4 only equips the tool for normal admins and its menu uses addon palettes without opening Derma", () => run(setup + `
    GetGlobalBool=function() return true end; game={SinglePlayer=function() return false end}
    include("sh_admin_config.lua"); include("sh_bot_metrics_protocol.lua"); include("cl_admin_menu.lua"); include("cl_admin_menu_hud.lua")
    local original=ZPThemes:GetTheme()
    local palette={Accent=Color(10,200,180),Surface=Color(20,25,30),Panel=Color(35,40,45),Text=Color(240,235,230),Muted=Color(120,125,130)}
    ZPThemes:RegisterTheme("boost-addon",{Name="Boost test",Palette=palette,CreateWeaponMenu=original.CreateWeaponMenu,PaintPlayerHUD=original.PaintPlayerHUD})
    ZPThemes:UseTheme("boost-addon"); ScrW=function() return 520 end; ScrH=function() return 480 end
    ZPAdminMenu:Open(); ZPAdminMenu:Navigate("bots"); clickDerma("botboostequip"); assert(sent[5]==10 and not frame()); ack()
    assert(not menuOpen()); press("Reload"); assert(menuOpen() and not frame())
    local colored=false; draw.RoundedBox=function(_,_,_,_,_,color) if color==palette.Surface then colored=true end end
    screenText(); assert(colored); click("botboostclose"); assert(not menuOpen() and not frame())
`));

test("singleplayer forwards SWEP callbacks to the client and multiplayer server callbacks dispatch no duplicate actions", () => run(setup + `
    SERVER=true; CLIENT=false; local single=true; game={SinglePlayer=function() return single end}
    local calls={}; function tool:CallOnClient(method) calls[#calls+1]=method end
    tool:PrimaryAttack(); tool:SecondaryAttack(); tool:Reload()
    assert(table.concat(calls,",")=="PrimaryAttack,SecondaryAttack,Reload")
    single=false; tool:PrimaryAttack(); tool:SecondaryAttack(); tool:Reload(); assert(#calls==3)
`));

test("incomplete saves identify the missing role and polling recovers a timed-out draft without replaying New", () => run(setup + `
    selectedLocale="pt-BR"; open(); newDraft(); press("Reload"); click("botboostsave")
    ack({Feedback="invalid",Editing=true,Issue={Code="incomplete",Slot=3,Actual=0,Min=0,Max=0}})
    local ui=include("cl_bot_boost_presentation.lua")
    labels={}; hooks.HUDPaint.ZPBotBoostEditor()
    assert(table.concat(labels,""):find(language.GetPhrase("zombieplague.botboostincomplete"),1,true))
    click("botboostnew"); local originalRequest=sent[3]
    now=now+3.1; hooks.Think.ZPBotBoostEditor(); assert(sent[5]==0 and sent[3]~=originalRequest)
    ack({Editing=true,Dirty=true,Draft={ID=0,Base={0,0,0},Approach={},Exit={}}})
    click("botboostback")
    press("PrimaryAttack"); assert(sent[5]==3, "the recovered draft resumes its next missing role")
`));
