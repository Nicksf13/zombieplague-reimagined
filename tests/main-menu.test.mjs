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
    local originalDraw=draw.DrawText
    local close=first.children[1]
    draw.DrawText=function(text,font,x,y)
        assert(text=="X" and font=="Trebuchet18")
        assert(x==(close.w-8)/2 and y==(close.h-16)/2, "F4 close label must be centered on both axes")
    end
    close:Paint(close.w,close.h)
    draw.DrawText=originalDraw
    assert(first.popup and first.keyboard==false)
    local list=first.children[#first.children]
    assert(list.kind=="DScrollPanel" and #list.children==4)
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

test("option titles keep non-additive text and contrasting colors on hover in every theme", () => run(clientSetup + panelsSetup + `
    include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
    local font=createdFonts.ZPMenuOptionTitle
    assert(font and font.font=="Trebuchet MS" and font.size==24 and font.additive==false)
    local function luminance(color)
        local function channel(value)
            value=value/255
            return value<=0.04045 and value/12.92 or ((value+0.055)/1.055)^2.4
        end
        return 0.2126*channel(color.r)+0.7152*channel(color.g)+0.0722*channel(color.b)
    end
    for _,id in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(id); ZPMainMenu:Open()
        local frame
        for _,panel in ipairs(panels) do
            if panel.kind=="DFrame" and not panel.removed then frame=panel end
        end
        for _,button in ipairs(frame.children[2].children) do
            for _,hovered in ipairs({false,true}) do
                button.IsHovered=function() return hovered end
                local background,texts
                texts={}
                draw.RoundedBox=function(_,_,_,_,_,color) background=color end
                draw.DrawText=function(text,font,_,_,color) texts[#texts+1]={font=font,color=color} end
                button:Paint(button.w,button.h)
                assert(#texts==2 and texts[1].font=="ZPMenuOptionTitle")
                for _,text in ipairs(texts) do
                    local fg,bg=luminance(text.color),luminance(background)
                    local contrast=(math.max(fg,bg)+0.05)/(math.min(fg,bg)+0.05)
                    assert(contrast>=4.5, "Unreadable option in "..id)
                end
            end
        end
        ZPMainMenu:Close()
    end
`));

test("main menu options expose detached data and recheck availability when clicked", () => run(clientSetup + panelsSetup + `
    include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
    local visible,calls=true,0
    ZPMainMenu:RegisterOption({ID="addon",Label="Addon",Description="Custom option",
        Action=function() calls=calls+1 end,IsVisible=function() return visible end})
    ZPMainMenu:Open()
    local state=ZPMainMenu:GetState()
    assert(#state.Entries==5 and not state.Entries[5].Action)
    state.Entries[5].Label="tampered"
    assert(ZPMainMenu:GetState().Entries[5].Label=="Addon")
    visible=false
    ZPMainMenu:Activate("addon"); assert(calls==0 and ZPMainMenu:GetState().Open)
    hooks.Think.ZPMainMenuController(); assert(#ZPMainMenu:GetState().Entries==4)
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
