import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = clientSetup + panelsSetup + `
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local function activeFrame()
    for _,panel in ipairs(panels) do
        if panel.kind=="DFrame" and not panel.removed then return panel end
    end
end
`;

test("F4 settings option moves theme selection out of the main and weapon menus", () => run(setup + `
    ZPMainMenu:Open()
    local main=activeFrame()
    assert(#main.children==2, "Main menu must contain only close and option list controls")
    main.children[2].children[2]:DoClick()
    assert(main.removed and ZPSettings:GetState().Open and not ZPMainMenu:GetState().Open and requests==0)
    local settings=activeFrame()
    assert(settings.popup and settings.keyboard==false)
    local content=settings.children[3]
    content.children[3]:DoClick() -- HL2 theme
    assert(settings.removed and ZPSettings:GetState().Open and ZPSettings:GetState().Theme=="hl2" and requests==0)
    paintAll()
    activeFrame().children[2]:DoClick() -- Back
    assert(not ZPSettings:GetState().Open and ZPMainMenu:GetState().Open)
    ZPMainMenu:Activate("weapons"); reply(1)
    local frame=activeFrame()
    local weaponContent=frame.children[#frame.children]
    local categories=0
    for _,panel in ipairs(weaponContent.children) do
        if panel.kind=="DButton" then categories=categories+1 end
    end
    assert(categories==3, "Weapon menu must expose categories, without theme buttons")
`));

test("always run is an archived local preference shared by reopened settings controllers", () => run(setup + `
    local preference=clientPreferences.zp_always_run
    assert(preference.archive and not preference.userinfo and not preference:GetBool())
    ZPSettings:Open()
    local first=activeFrame()
    local content=first.children[3]
    content.children[#content.children]:DoClick()
    assert(ZPSettings:GetState().AlwaysRun and requests==0)
    local count=#panels
    hooks.Think.ZPSettingsController(); assert(#panels==count)
    local detached=ZPSettings:GetState()
    detached.Themes[1].Name="tampered"
    assert(ZPSettings:GetState().Themes[1].Name~="tampered")
    ZPSettings:Close(); ZPSettings:Open()
    assert(ZPSettings:GetState().AlwaysRun)
    local prototype=getmetatable(ZPSettings)
    local fresh=setmetatable({},prototype); fresh:____constructor()
    assert(fresh:GetState().AlwaysRun)
    consoleCommands.zp_theme(nil,nil,{"cs16"})
    assert(ZPSettings:GetState().Open and ZPSettings:GetState().Theme=="cs16")
    assert(ZPSettings:GetState().AlwaysRun)
    input.IsKeyDown=function(key) return key==KEY_ESCAPE end
    hooks.Think.ZPSettingsController()
    assert(not ZPSettings:GetState().Open)
    for _,panel in ipairs(panels) do assert(panel.removed) end
`));

test("always run adds only sprint while alive, preserving manual input when disabled", () => run(setup + `
    local command={keys={[1]=true,[2]=true,[4]=true}}
    function command:AddKey(key) self.keys[key]=true end
    local apply=hooks.CreateMove.ZPAlwaysRun
    apply(command); assert(not command.keys[IN_SPEED])
    ZPSettings:SetAlwaysRun(true); apply(command)
    assert(command.keys[IN_SPEED] and command.keys[1] and command.keys[2] and command.keys[4])
    command.keys[IN_SPEED]=nil; viewer.alive=false; apply(command)
    assert(not command.keys[IN_SPEED])
    viewer.alive=true; viewer.team=TEAM_SPECTATOR; apply(command)
    assert(not command.keys[IN_SPEED])
    viewer.team=TEAM_ZOMBIES; apply(command); assert(command.keys[IN_SPEED])
    ZPSettings:SetAlwaysRun(false); apply(command)
    assert(command.keys[IN_SPEED], "Disabling must not release a manually held sprint key")
    assert(requests==0)
`));

test("stamina modes disable saved always run and warn only on explicit activation", () => run(setup + `
    local mode={}
    cvars.Bool=function(name,default) return mode[name] or default end
    local notices={}
    NOTIFY_GENERIC=0
    notification={AddLegacy=function(text,kind,duration)
        assert(kind==NOTIFY_GENERIC and duration>=5)
        notices[#notices+1]=text
    end}
    local preference=clientPreferences.zp_always_run
    local command={sprinting=false}
    function command:AddKey(key) assert(key==IN_SPEED); self.sprinting=true end
    for _,name in ipairs({"zp_realistic_mode","zp_run_should_drain"}) do
        mode={}
        ZPSettings:SetAlwaysRun(true)
        local count=#notices
        mode[name]=true
        hooks.CreateMove.ZPAlwaysRun(command)
        assert(not command.sprinting and not preference:GetBool())
        assert(not ZPSettings:GetState().AlwaysRun and #notices==count)
        ZPSettings:Open()
        local content=activeFrame().children[3]
        content.children[#content.children]:DoClick()
        assert(ZPSettings:GetState().AlwaysRun and #notices==count+1)
        assert(notices[#notices]=="zombieplague.settingsalwaysrunstaminawarning")
        hooks.CreateMove.ZPAlwaysRun(command)
        assert(command.sprinting)
        ZPSettings:Close(); ZPSettings:Open()
        hooks.Think.ZPSettingsController()
        assert(ZPSettings:GetState().AlwaysRun and #notices==count+1)
        ZPSettings:SetAlwaysRun(true)
        ZPSettings:SetAlwaysRun(false)
        assert(#notices==count+1)
        command.sprinting=false
        ZPSettings:Close()
        -- Simulate an archived enabled value loaded by a new controller/session.
        preference:SetBool(true)
        local fresh=setmetatable({},getmetatable(ZPSettings)); fresh:____constructor()
        assert(not fresh:GetState().AlwaysRun and not preference:GetBool())
    end
    assert(requests==0)
`));

test("settings support addon themes, scrolling at small resolutions and submenu cleanup", () => run(setup + `
    local base=ZPThemes:GetTheme()
    local screenWidth,screenHeight=640,480
    function ScrW() return screenWidth end
    function ScrH() return screenHeight end
    for _,id in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(id); ZPSettings:Open(); paintAll()
        local frame=activeFrame()
        local content=frame.children[3]
        assert(frame.w<=screenWidth-32 and frame.h<=screenHeight-180 and content.h>0)
        assert(content.y+content.h<=frame.h-40)
        for _,child in ipairs(content.children) do assert(child.x+child.w<=content.w) end
    end
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette=base.Palette,
        CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD})
    hooks.Think.ZPSettingsController()
    assert(#ZPSettings:GetState().Themes==4)
    ZPSettings:UseTheme("addon"); paintAll()
    assert(ZPSettings:GetState().Open and ZPSettings:GetState().Theme=="addon")
    ZPMainMenu:Toggle()
    assert(not ZPSettings:GetState().Open and ZPMainMenu:GetState().Open)
    ZPSettings:Open(); ZPWeaponMenu:OpenMissing("secondary")
    assert(not ZPSettings:GetState().Open and ZPWeaponMenu:GetState().Open)
    ZPWeaponMenu:Close()
    for _,panel in ipairs(panels) do assert(panel.removed) end
`));
