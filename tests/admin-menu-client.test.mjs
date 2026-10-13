import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = clientSetup + panelsSetup + `
viewer.admin=true
viewer.superadmin=true
local singleplayer=false
local botsEnabled=true
GetGlobalBool=function(name,fallback) assert(name=="ZPTestBotsEnabled"); return botsEnabled end
game={SinglePlayer=function() return singleplayer end}
local botCommands={}
RunConsoleCommand=function(name,count) botCommands[#botCommands+1]={name,count} end
surface.SetFont=function() end
surface.GetTextSize=function(text) return #text*8,16 end
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
function panelMeta:SetEnabled(value) self.enabled=value end
function panelMeta:SetWrap(value) self.wrap=value end
function panelMeta:SetFont(value) self.font=value end
function panelMeta:SetText(value) self.text=value end
function panelMeta:GetValue() return self.text or "" end
local dialogs={}
function panelMeta:DoModal()
    assert(self.popup)
    self.modal=true
    dialogs[#dialogs+1]=self
end
local uints,strings={},{}
net.ReadUInt=function() return table.remove(uints,1) end
net.ReadString=function() return table.remove(strings,1) end
include("sh_admin_config.lua")
include("cl_admin_menu.lua"); include("cl_admin_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local function replyAdmin(code,values,reload,token,id)
    uints={id or sent[4],code,5,token or 0}
    strings=values or {"1","1","0","","c","100"}
    readBool=reload or false
    receivers.ZPAdminSettingsReply(1000)
end
local function openEnvironment()
    ZPMainMenu:Open(); ZPMainMenu:Activate("admin")
    assert(ZPAdminMenu:GetState().Page=="admin")
    ZPAdminMenu:Navigate("settings"); ZPAdminMenu:Navigate("environment")
    replyAdmin(0)
end
local function activeFrame()
    for _,panel in ipairs(panels) do
        if panel.kind=="DFrame" and not panel.removed then return panel end
    end
end
`;

test("admin navigation is visible only to admins and loads authoritative values", () => run(setup + `
    assert(#ZPMainMenu:GetState().Entries==3)
    viewer.admin=false
    assert(#ZPMainMenu:GetState().Entries==2)
    ZPAdminMenu:Open(); assert(not activeFrame() and requests==0)
    viewer.admin=true; openEnvironment()
    local state=ZPAdminMenu:GetState()
    assert(state.Ready and not state.Pending and not state.Dirty and requests==1)
    assert(activeFrame().keyboard==true)
    assert(not ZPMainMenu:GetState().Open and not ZPSettings:GetState().Open)
    ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="settings")
    ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="admin")
    ZPAdminMenu:Back(); assert(ZPMainMenu:GetState().Open)
    paintAll()
`));

test("bots page adds one bot through the authorized server command in every theme", () => run(setup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme)
        ZPAdminMenu:Open()
        activeFrame().children[3].children[2]:DoClick()
        assert(ZPAdminMenu:GetState().Page=="bots" and requests==0)
        local content=activeFrame().children[3]
        assert(content.children[1].text=="zombieplague.adminbotshelp")
        content.children[2]:DoClick()
        assert(botCommands[#botCommands][1]=="zp_addbot" and botCommands[#botCommands][2]=="1")
        paintAll()
        ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="admin")
    end
    assert(#botCommands==3)
    ZPAdminMenu:AddBot(); assert(#botCommands==3)
    ZPAdminMenu:Navigate("bots")
    for _,reason in ipairs({"permission","singleplayer","disabled"}) do
        viewer.superadmin=reason~="permission"
        singleplayer=reason=="singleplayer"; botsEnabled=reason~="disabled"
        ZPAdminMenu:Rebuild()
        assert(not ZPAdminMenu:GetState().CanAddBot)
        local button=activeFrame().children[3].children[2]
        assert(not button:IsEnabled())
        button:DoClick(); ZPAdminMenu:AddBot(); assert(#botCommands==3)
    end
    viewer.superadmin=true; singleplayer=false; botsEnabled=true
    viewer.admin=false; ZPAdminMenu:AddBot(); assert(#botCommands==3)
    viewer.admin=true; ZPAdminMenu:Close(); ZPAdminMenu:AddBot(); assert(#botCommands==3)
`));

test("form edits wait for save, validate bounds, and stay disabled until acknowledgment", () => run(setup + `
    openEnvironment()
    ZPAdminMenu:SetValue(5,"200"); ZPAdminMenu:Save()
    assert(requests==1 and ZPAdminMenu:GetState().Feedback=="zombieplague.adminerror")
    ZPAdminMenu:SetValue(5,"10"); ZPAdminMenu:Save()
    assert(requests==2 and sent[3]==1 and sent[5]==5 and sent[11]=="10")
    assert(ZPAdminMenu:GetState().Pending)
    ZPAdminMenu:SetValue(5,"50"); assert(ZPAdminMenu:GetState().Values[6]=="10")
    replyAdmin(1,{"1","1","0","","c","10"})
    assert(not ZPAdminMenu:GetState().Pending and not ZPAdminMenu:GetState().Dirty)
    assert(ZPAdminMenu:GetState().Feedback=="zombieplague.adminsaved")
    local detached=ZPAdminMenu:GetState(); detached.Values[1]="tampered"
    assert(ZPAdminMenu:GetState().Values[1]=="1")
    local input
    for _,panel in ipairs(panels) do if panel.kind=="DTextEntry" and not panel.removed then input=panel end end
    input:SetText("20"); input:OnChange()
    assert(ZPAdminMenu:GetState().Dirty and ZPAdminMenu:GetState().Values[6]=="20" and requests==2)
    paintAll()
`));

test("save and restart button states follow real edits and a successful save", () => run(setup + `
    openEnvironment()
    local frame=activeFrame()
    local restart,refresh,save=frame.children[4],frame.children[5],frame.children[6]
    assert(not save:IsEnabled() and not restart:IsEnabled())
    assert(refresh.tooltip=="zombieplague.adminrefreshhelp")
    ZPAdminMenu:SetValue(5,"100.0")
    assert(not ZPAdminMenu:GetState().Dirty and not save:IsEnabled())
    ZPAdminMenu:SetValue(0,"0"); assert(save:IsEnabled() and not restart:IsEnabled())
    ZPAdminMenu:SetValue(0,"1"); assert(not save:IsEnabled())
    ZPAdminMenu:Refresh(); replyAdmin(0,{"0","1","0","","c","100"},true,0)
    assert(not save:IsEnabled() and not restart:IsEnabled())
    ZPAdminMenu:SetValue(5,"10"); assert(save:IsEnabled())
    save:DoClick(); assert(not save:IsEnabled() and not restart:IsEnabled())
    replyAdmin(2); assert(save:IsEnabled() and not restart:IsEnabled())
    save:DoClick(); replyAdmin(1,{"0","1","0","","c","10"},true,99)
    assert(not save:IsEnabled() and restart:IsEnabled())
    ZPAdminMenu:SetValue(5,"20"); assert(save:IsEnabled() and not restart:IsEnabled())
    ZPAdminMenu:SetValue(5,"10"); assert(not save:IsEnabled() and restart:IsEnabled())
    local color
    draw.DrawText=function(text,font,x,y,value) color=value end
    save:Paint(save.w,save.h)
    assert(color==ZPThemes:GetTheme().Palette.Muted)
    refresh:DoClick(); replyAdmin(0,{"0","1","0","","c","10"},true,0)
    assert(not restart:IsEnabled())
`));

test("restart confirmation is modal, uses each active theme, and closes on theme changes", () => run(setup + `
    openEnvironment()
    ZPAdminMenu:SetValue(0,"0"); ZPAdminMenu:Save()
    replyAdmin(1,{"0","1","0","","c","100"},true,99)
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme)
        ZPAdminMenu:ConfirmReload()
        local dialog=dialogs[#dialogs]
        assert(dialog.modal and dialog.popup and not dialog.removed)
        local painted={}
        draw.RoundedBox=function(radius,x,y,w,h,color) painted[#painted+1]={radius,color} end
        dialog:Paint(dialog.w,dialog.h)
        assert(painted[1][1]==(theme=="cs16" and 0 or 8))
        assert(painted[1][2]==ZPThemes:GetTheme().Palette.Surface)
        assert(painted[2][2]==ZPThemes:GetTheme().Palette.Accent)
        dialog.children[3]:DoClick()
        assert(dialog.removed and requests==2)
    end
    ZPAdminMenu:ConfirmReload(); local dialog=dialogs[#dialogs]
    ZPThemes:UseTheme("classic")
    assert(dialog.removed and requests==2)
`));

test("restart requires a saved pending change and explicit confirmation; cancel sends nothing", () => run(setup + `
    openEnvironment()
    ZPAdminMenu:ConfirmReload(); assert(#dialogs==0)
    ZPAdminMenu:SetValue(0,"0"); ZPAdminMenu:ConfirmReload(); assert(#dialogs==0)
    ZPAdminMenu:Save(); replyAdmin(1,{"0","1","0","","c","100"},true,99)
    assert(ZPAdminMenu:GetState().ReloadRequired)
    local before=requests
    ZPAdminMenu:ConfirmReload()
    assert(#dialogs==1 and requests==before)
    assert(dialogs[1].children[2].text=="zombieplague.adminreloadwarning" and dialogs[1].modal)
    dialogs[1].children[3]:DoClick() -- Cancel.
    assert(dialogs[1].removed)
    assert(requests==before)
    ZPAdminMenu:ConfirmReload(); dialogs[2].children[4]:DoClick()
    assert(requests==before+1 and sent[3]==2 and sent[5]==5 and sent[6]==99)
    ZPAdminMenu:ConfirmReload(); assert(#dialogs==2)
`));

test("stale replies, closed dialogs, timeouts, and permission loss cannot reopen or reload", () => run(setup + `
    openEnvironment()
    ZPAdminMenu:SetValue(0,"0"); ZPAdminMenu:Save()
    local id=sent[4]
    replyAdmin(1,nil,false,0,id-1); assert(ZPAdminMenu:GetState().Pending)
    now=now+6; hooks.Think.ZPAdminMenu()
    assert(not ZPAdminMenu:GetState().Pending and ZPAdminMenu:GetState().Feedback=="zombieplague.weaponmenutimeout")
    replyAdmin(1,nil,false,0,id); assert(ZPAdminMenu:GetState().Dirty)
    ZPAdminMenu:Refresh(); replyAdmin(0,{"0","1","0","","c","100"},true,0)
    assert(not ZPAdminMenu:GetState().CanReload)
    ZPAdminMenu:SetValue(5,"10"); ZPAdminMenu:Save()
    replyAdmin(1,{"0","1","0","","c","10"},true,99)
    ZPAdminMenu:ConfirmReload(); local confirm=function() dialogs[1].children[4]:DoClick() end
    ZPMainMenu:Open(); assert(dialogs[1].removed)
    local before=requests; confirm(); assert(requests==before and ZPMainMenu:GetState().Open)
    ZPMainMenu:Activate("admin"); viewer.admin=false; hooks.Think.ZPAdminMenu()
    assert(not activeFrame())
    viewer.admin=true; openEnvironment()
    ZPThemes:UseTheme("hl2"); assert(activeFrame())
    ZPSettings:Open(); assert(ZPSettings:GetState().Open)
    for _,panel in ipairs(panels) do
        if panel.kind=="DTextEntry" then assert(panel.removed) end
    end
`));
