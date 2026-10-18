import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { nativeLanguage } from "./helpers/native-localization.mjs";

const setup = clientSetup + panelsSetup + nativeLanguage + `
viewer.admin=true; viewer.superadmin=true
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
local singleplayer=false
game={SinglePlayer=function() return singleplayer end}
GetGlobalBool=function() return true end
local uints={}; net.ReadUInt=function() return table.remove(uints,1) end
include("sh_admin_config.lua"); include("sh_bot_metrics_protocol.lua")
include("cl_admin_menu.lua"); include("cl_admin_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local function frame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function replyPopulation(code,enabled,target,revision,requestID,length)
    uints={1,requestID or sent[4],code or 0,revision or 1,target or 0,31,1,30,0,1}; readBool=enabled or false
    receivers.ZPBotPopulationReply(length or 119)
end
local function openPopulation()
    ZPAdminMenu:Open(); ZPAdminMenu:Navigate("botadd")
    local list=frame().children[3].children
    assert(#list==5 and list[5].y==198)
    list[5]:DoClick(); assert(ZPAdminMenu:GetState().Page=="population")
    assert(sent[1]=="ZPBotPopulationRequest" and sent[3]==0)
end
`;

test("population controls use native themed inputs and localized labels in every palette", () => run(setup + `
    local original=ZPThemes:GetTheme()
    local addon={Accent=Color(30,220,180),Surface=Color(20,30,40),Panel=Color(40,50,60),Text=Color(240,240,240),Muted=Color(110,110,110)}
    ZPThemes:RegisterTheme("population-addon",{Name="Population",Palette=addon,CreateWeaponMenu=original.CreateWeaponMenu,PaintPlayerHUD=original.PaintPlayerHUD})
    ScrW=function() return 520 end; ScrH=function() return 480 end
    selectedLocale="pt-BR"
    for _,theme in ipairs({"classic","hl2","cs16","population-addon"}) do
        ZPThemes:UseTheme(theme); openPopulation()
        local window=frame(); local children=window.children[3].children; local combo=children[5]
        assert(not children[3]:IsEnabled() and not combo:IsEnabled() and not children[8]:IsEnabled())
        replyPopulation()
        assert(window.w<=520 and window.h<=480 and combo.kind=="DComboBox" and combo:IsEnabled())
        assert(#combo.choices==32 and combo.choices[1][2]==0 and combo.choices[32][2]==31)
        local palette=ZPThemes:GetTheme().Palette; local painted=false
        draw.RoundedBox=function(_,_,_,_,_,color) if color==palette.Panel then painted=true end end
        combo:Paint(combo.w,combo.h); assert(painted and combo.OnMenuOpened and combo.OnSelect)
        local labels={}; draw.DrawText=function(text) labels[#labels+1]=text end; paintAll()
        for _,text in ipairs(labels) do assert(not text:find("zombieplague.",1,true),text) end
        assert(children[6]:GetText():find("Bots: 30",1,true) and children[6]:GetText():find("Vagas livres: 1",1,true))
        now=now+1.1; hooks.Think.ZPAdminMenu(); replyPopulation()
        assert(frame()==window and frame().children[3].children[5]==combo,"polling preserves the native control")
        ZPAdminMenu:Close()
    end
`));

test("population drafts survive status polling and saving waits for the authoritative acknowledgment", () => run(setup + `
    openPopulation(); replyPopulation()
    local children=frame().children[3].children; local toggle,combo,save=children[3],children[5],children[8]
    toggle:DoClick(); combo:OnSelect(26,"25",25)
    local state=ZPAdminMenu:GetState().BotPopulation
    assert(state.Enabled and state.Target==25 and state.Dirty and save:IsEnabled())
    local before=requests; now=now+1.1; hooks.Think.ZPAdminMenu(); assert(requests==before+1)
    replyPopulation(0,false,0)
    state=ZPAdminMenu:GetState().BotPopulation; assert(state.Enabled and state.Target==25 and state.Dirty)
    save:DoClick()
    assert(sent[3]==1 and sent[5]==1 and sent[6]==true and sent[7]==25)
    assert(not save:IsEnabled() and not toggle:IsEnabled() and not combo:IsEnabled())
    replyPopulation(1,true,25,2)
    state=ZPAdminMenu:GetState().BotPopulation
    assert(state.Enabled and state.Target==25 and not state.Dirty and state.Feedback=="zombieplague.adminsaved")
    assert(not save:IsEnabled() and toggle:IsEnabled())
    ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="botadd")
`));

test("population RPC timeouts, invalid packets, stale replies and closed pages cannot apply settings", () => run(setup + `
    openPopulation(); local old=sent[4]
    replyPopulation(0,false,0,1,nil,118); assert(ZPAdminMenu:GetState().BotPopulation.Pending)
    replyPopulation(0,false,32); assert(ZPAdminMenu:GetState().BotPopulation.Pending)
    replyPopulation(0,false,0,1,old+1); assert(ZPAdminMenu:GetState().BotPopulation.Pending)
    now=now+5.1; hooks.Think.ZPAdminMenu(); assert(sent[4]~=old)
    assert(ZPAdminMenu:GetState().BotPopulation.Feedback=="zombieplague.weaponmenutimeout")
    replyPopulation(); ZPAdminMenu:ToggleBotPopulation(); ZPAdminMenu:SaveBotPopulation()
    replyPopulation(2,false,0,2)
    assert(ZPAdminMenu:GetState().BotPopulation.Dirty and ZPAdminMenu:GetState().BotPopulation.Feedback=="zombieplague.adminerror")
    ZPAdminMenu:Close(); local before=requests
    replyPopulation(1,true,0,3); hooks.Think.ZPAdminMenu()
    assert(not frame() and requests==before)
`));

test("population editing validates targets and stops for lost permissions or unavailable AI mode", () => run(setup + `
    openPopulation(); replyPopulation()
    for _,target in ipairs({-1,32,1.5,0/0,math.huge}) do ZPAdminMenu:SetBotPopulationTarget(target) end
    assert(ZPAdminMenu:GetState().BotPopulation.Target==0)
    viewer.superadmin=false; local before=requests
    ZPAdminMenu:ToggleBotPopulation(); ZPAdminMenu:SetBotPopulationTarget(20); ZPAdminMenu:SaveBotPopulation()
    hooks.Think.ZPAdminMenu(); assert(requests==before and not ZPAdminMenu:GetState().BotPopulation.Enabled)
    ZPAdminMenu:Navigate("botadd"); ZPAdminMenu:Navigate("population"); assert(ZPAdminMenu:GetState().Page=="botadd")
    viewer.superadmin=true; singleplayer=true
    ZPAdminMenu:Navigate("population"); assert(ZPAdminMenu:GetState().Page=="botadd")
    singleplayer=false; GetGlobalBool=function() return false end
    ZPAdminMenu:Navigate("population"); assert(ZPAdminMenu:GetState().Page=="botadd")
`));
