import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { playerHUDSetup } from "./helpers/player-hud.mjs";

const setup = clientSetup + panelsSetup + playerHUDSetup;

test("three complete themes switch from console, menu and API without resending pending selections", () => run(setup + `
    local themes=ZPThemes:GetThemes()
    assert(#themes==3 and themes[1].ID=="classic" and themes[2].ID=="hl2" and themes[3].ID=="cs16")
    ZPWeaponMenu:Open(); reply(1)
    ZPWeaponMenu:SetCategory("secondary"); ZPWeaponMenu:Select("weapon_pistol")
    local requestCount=requests
    for _,id in ipairs({"hl2","cs16","classic"}) do
        consoleCommands.zp_theme(viewer,"zp_theme",{id})
        assert(ZPThemes:GetActiveID()==id and ZPWeaponMenu:GetState().Presentation==id)
        assert(ZPWeaponMenu:GetState().Pending and ZPWeaponMenu:GetState().Category=="secondary")
        assert(requests==requestCount)
        paintAll(); hooks.HUDPaint.HUDZombiePlague()
    end
    -- The same action used by each theme button updates the player HUD too.
    ZPWeaponMenu:UsePresentation("cs16")
    assert(ZPThemes:GetActiveID()=="cs16" and requests==requestCount)
    assert(not ZPThemes:UseTheme("missing") and ZPThemes:GetActiveID()=="cs16")
    reply(2,"saved")
    assert(not ZPWeaponMenu:GetState().Pending)
    ZPWeaponMenu:Close(); ZPThemes:UseTheme("hl2")
    assert(not ZPWeaponMenu:GetState().Open and requests==requestCount)
`));

test("theme preference survives registration, tolerates bad data and supports late addon themes", () => run(setup + `
    local saved,writes={Theme="hl2"},{}
    file.Read=function(path) assert(path=="zombieplague/theme.json"); return "saved" end
    util.JSONToTable=function() return saved end
    util.TableToJSON=function(value) return value.Theme end
    file.Write=function(path,value) assert(path=="zombieplague/theme.json"); writes[#writes+1]=value end
    include("cl_theme_manager.lua"); include("cl_weapon_menu_hud.lua")
    assert(ZPThemes:GetActiveID()=="hl2" and ZPWeaponMenu:GetState().Presentation=="hl2" and #writes==0)
    ZPThemes:UseTheme("cs16"); ZPThemes:UseTheme("cs16")
    assert(#writes==1 and writes[1]=="cs16")
    saved={Theme="addon"}
    include("cl_theme_manager.lua"); include("cl_weapon_menu_hud.lua")
    assert(ZPThemes:GetActiveID()=="classic" and #writes==1)
    local theme=ZPThemes:GetTheme()
    ZPThemes:RegisterTheme("addon",theme)
    assert(ZPThemes:GetActiveID()=="addon" and ZPWeaponMenu:GetState().Presentation=="addon" and #writes==1)
    ZPThemes:RegisterTheme("addon",theme)
    assert(#ZPThemes:GetThemes()==4)
    saved={Theme=false}
    include("cl_theme_manager.lua"); include("cl_weapon_menu_hud.lua")
    assert(ZPThemes:GetActiveID()=="classic" and ZPWeaponMenu:GetState().Presentation=="classic")
    saved=nil
    include("cl_theme_manager.lua"); include("cl_weapon_menu_hud.lua")
    assert(ZPThemes:GetActiveID()=="classic")
`));

test("HUD ammo keeps both clips and reserves, zero counts, clipless and secondary-only weapons", () => run(setup + `
    local state=ZPPlayerHUD:GetState()
    assert(state.Timer=="02:05" and state.Ammo.Primary.Clip==30 and state.Ammo.Primary.Reserve==90)
    assert(state.Ammo.Secondary.Clip==-1 and state.Ammo.Secondary.Reserve==3)
    state.Ammo.Primary.Clip=999
    assert(ZPPlayerHUD:GetState().Ammo.Primary.Clip==30 and weapon.clip==30)
    weapon.clip,weapon.clip2=0,2; viewer.ammo[0]=0
    state=ZPPlayerHUD:GetState()
    assert(state.Ammo.Primary.Clip==0 and state.Ammo.Primary.Reserve==0 and state.Ammo.Secondary.Clip==2)
    weapon.primary=-1
    assert(not ZPPlayerHUD:GetState().Ammo.Primary and ZPPlayerHUD:GetState().Ammo.Secondary)
    assert(hooks.HUDShouldDraw.HideHUD("CHudAmmo")==false)
    weapon.secondary=-1
    assert(not ZPPlayerHUD:GetState().Ammo and hooks.HUDShouldDraw.HideHUD("CHudAmmo")==nil)
    viewer.weapon=nil
    assert(not ZPPlayerHUD:GetState().Ammo)
    assert(hooks.HUDShouldDraw.HideHUD("CHudHealth")==false and hooks.HUDShouldDraw.HideHUD("CHudBattery")==false)
    assert(hooks.HUDShouldDraw.HideHUD("CHudCrosshair")==nil)
`));

test("HUD observes players safely, keeps the round timer and preserves screen filters and custom info", () => run(setup + `
    local target=hudPlayer("Observed Player")
    target.health=42; target.ammo={[0]=17,[1]=1}; viewer.alive=false; viewer.target=target
    local state=ZPPlayerHUD:GetState()
    assert(state.Spectating and not state.Ammo)
    assert(hooks.HUDShouldDraw.HideHUD("CHudAmmo")==nil)
    local names={}; for _,entry in ipairs(state.Entries) do names[entry.ID]=entry.Value end
    assert(names.HUDZPSpectatingPlayer=="Observed Player" and names.HUDHealth==42)
    target.filter=Color(8,9,10,20)
    local firstColor
    draw.RoundedBox=function(_,_,_,_,_,color) firstColor=firstColor or color end
    hooks.HUDPaint.HUDZombiePlague(); assert(firstColor==target.filter)
    HudManager:CreateHudInfo("AddonInfo",function() return "Extra" end,function(ply) return ply:Health()*2 end,function() return true end)
    state=ZPPlayerHUD:GetState(); assert(state.Entries[#state.Entries].Value==84)
    viewer.target={IsPlayer=function() return false end}
    assert(#ZPPlayerHUD:GetState().Entries==0 and not ZPPlayerHUD:GetState().Ammo)
    viewer.target=target; viewer.mode=OBS_MODE_ROAMING
    assert(#ZPPlayerHUD:GetState().Entries==0 and ZPPlayerHUD:GetState().Timer=="02:05")
    viewer.invalid=true; hooks.HUDPaint.HUDZombiePlague()
    assert(#ZPPlayerHUD:GetState().Entries==0)
`));

test("all themed HUDs render primary and secondary ammo inside fixed responsive layouts", () => run(setup + `
    assert(not HudManager.HUDConfig and not HudManager.Save and not HudManager.CalculatePos and not HUD_LEFT)
    local texts,rectangles={},{}
    draw.DrawText=function(text,font,x,y,color)
        assert(type(text)=="string" and x>=0 and y>=0 and x<screenWidth and y<screenHeight)
        texts[text]=true
    end
    draw.RoundedBox=function(radius,x,y,w,h,color)
        assert(w>0 and h>0 and x>=0 and y>=0 and x+w<=screenWidth and y+h<=screenHeight)
        rectangles[#rectangles+1]={x,y,w,h}
    end
    for _,resolution in ipairs({{640,480},{900,600},{960,600},{1280,720},{1920,1080},{2560,1080}}) do
        screenWidth,screenHeight=resolution[1],resolution[2]
        for _,id in ipairs({"classic","hl2","cs16"}) do
            ZPThemes:UseTheme(id); texts={}; rectangles={}; hooks.HUDPaint.HUDZombiePlague()
            assert(texts["30 / 90"] and texts["3"] and texts["02:05"])
            assert(texts["zombieplague.hudprimaryammo"] and texts["zombieplague.hudsecondaryammo"])
            assert(texts["100"] and texts["25"] and texts["160"])
            local cards={}
            for _,rectangle in ipairs(rectangles) do
                if rectangle[4]==64 then cards[#cards+1]=rectangle end
            end
            for index,a in ipairs(cards) do
                for other=index+1,#cards do
                    local b=cards[other]
                    assert(a[1]+a[3]<=b[1] or b[1]+b[3]<=a[1] or a[2]+a[4]<=b[2] or b[2]+b[4]<=a[2],
                        "HUD cards overlap: "..id.." at "..screenWidth)
                end
            end
        end
    end
    viewer.maxPower=0; viewer.power=-1
    for _,entry in ipairs(ZPPlayerHUD:GetState().Entries) do
        if entry.ID=="HUDAbilityPower" then assert(entry.Value=="0%") end
    end
`));

test("theme menus reserve room for the HUD and keep lists above their footers on small screens", () => run(setup + `
    panelMeta.Center=function(self) self.x=(ScrW()-self.w)/2; self.y=(ScrH()-self.h)/2 end
    for _,resolution in ipairs({{640,480},{1280,720},{1920,1080}}) do
        screenWidth,screenHeight=resolution[1],resolution[2]
        ZPWeaponMenu:Open()
        for _,id in ipairs({"classic","hl2","cs16"}) do
            ZPThemes:UseTheme(id); paintAll()
            local frame
            for _,panel in ipairs(panels) do
                if panel.kind=="DFrame" and not panel.removed then frame=panel end
            end
            local content=frame.children[#frame.children]
            local scroll,footer
            for _,panel in ipairs(content.children) do
                if panel.kind=="DScrollPanel" then scroll=panel end
                if panel.kind=="DPanel" then footer=panel end
            end
            assert(scroll and footer and scroll.h>0 and scroll.y+scroll.h<=footer.y)
            assert(footer.y+footer.h<=content.h and frame.h<=screenHeight-180)
        end
        ZPWeaponMenu:Close()
        ZPMainMenu:Open(); paintAll()
        for _,panel in ipairs(panels) do
            if panel.kind=="DFrame" and not panel.removed then
                local margin=screenWidth<800 and 12 or 24
                assert(panel.y+panel.h<screenHeight-margin-64, "Main menu overlaps the bottom HUD")
            end
        end
        ZPMainMenu:Close()
    end
`));
