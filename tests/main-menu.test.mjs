import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

test("F4 opens the themed main menu and its weapons option opens the existing selector", () => run(clientSetup + panelsSetup + `
    KEY_NONE,KEY_F3,KEY_F4,KEY_T=0,94,95,30
    function viewer:IsTyping() return false end
    include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua"); include("cl_keymanager.lua")
    KeyManager.EventGroups.ZombiePlagueActions.MainMenu:Action()
    assert(ZPMainMenu:GetState().Open and not ZPWeaponMenu:GetState().Open and requests==0)
    paintAll()
    local first=panels[1]
    assert(first.popup and first.keyboard==false)
    local list=first.children[#first.children]
    assert(list.kind=="DScrollPanel" and #list.children==1)
    list.children[1]:DoClick()
    assert(first.removed and not ZPMainMenu:GetState().Open and ZPWeaponMenu:GetState().Open and requests==1)
    -- F4 from a submenu returns to the main menu without making a new request.
    KeyManager.EventGroups.ZombiePlagueActions.MainMenu:Action()
    assert(ZPMainMenu:GetState().Open and not ZPWeaponMenu:GetState().Open and requests==1)
    reply(1); assert(not ZPWeaponMenu:GetState().Open)
    local before=#panels
    hooks.Think.ZPMainMenuController(); hooks.Think.ZPMainMenuController()
    assert(#panels==before)
    for _,id in ipairs({"hl2","cs16","classic"}) do
        ZPThemes:UseTheme(id); paintAll()
        assert(ZPMainMenu:GetState().Open and ZPMainMenu:GetState().Theme==id and requests==1)
    end
    input.IsKeyDown=function(key) return key==KEY_ESCAPE end
    hooks.Think.ZPMainMenuController()
    assert(not ZPMainMenu:GetState().Open)
    for _,panel in ipairs(panels) do assert(panel.removed) end
`));

test("main menu options expose detached data and recheck availability when clicked", () => run(clientSetup + panelsSetup + `
    include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
    local visible,calls=true,0
    ZPMainMenu:RegisterOption({ID="addon",Label="Addon",Description="Custom option",
        Action=function() calls=calls+1 end,IsVisible=function() return visible end})
    ZPMainMenu:Open()
    local state=ZPMainMenu:GetState()
    assert(#state.Entries==2 and not state.Entries[2].Action)
    state.Entries[2].Label="tampered"
    assert(ZPMainMenu:GetState().Entries[2].Label=="Addon")
    visible=false
    ZPMainMenu:Activate("addon"); assert(calls==0 and ZPMainMenu:GetState().Open)
    hooks.Think.ZPMainMenuController(); assert(#ZPMainMenu:GetState().Entries==1)
    visible=true
    ZPMainMenu:Activate("addon"); assert(calls==1 and not ZPMainMenu:GetState().Open)
    ZPMainMenu:Activate("addon"); assert(calls==1)
`));

test("addon themes without a main menu use the default presentation with their palette", () => run(clientSetup + panelsSetup + `
    include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
    local base=ZPThemes:GetTheme()
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette=base.Palette,
        CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD})
    assert(ZPThemes:UseTheme("addon"))
    ZPMainMenu:Open(); paintAll()
    assert(ZPMainMenu:GetState().Open and panels[1].popup)
    ZPMainMenu:Close()
    local opened,destroyed=0,0
    ZPThemes:RegisterTheme("custom",{Name="Custom",Palette=base.Palette,
        CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD,
        CreateMainMenu=function() return {Open=function() opened=opened+1 end,
            Update=function() end,Destroy=function() destroyed=destroyed+1 end} end})
    ZPThemes:UseTheme("custom"); ZPMainMenu:Open(); assert(opened==1)
    ZPThemes:UseTheme("classic"); assert(destroyed==1 and ZPMainMenu:GetState().Open)
`));
