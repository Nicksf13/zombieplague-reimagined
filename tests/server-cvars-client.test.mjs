import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = clientSetup + panelsSetup + `
viewer.admin=true; viewer.superadmin=true
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
local dialogs={}
function panelMeta:DoModal() self.modal=true; dialogs[#dialogs+1]=self end
game={SinglePlayer=function() return false end}
GetGlobalBool=function(_,fallback) return fallback end
include("sh_admin_config.lua"); include("sh_server_cvars.lua"); include("sh_bot_metrics_protocol.lua")
include("cl_admin_menu.lua"); include("cl_admin_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local uints,strings,bools={},{},{}
net.ReadUInt=function() return table.remove(uints,1) end
net.ReadString=function() return table.remove(strings,1) end
net.ReadBool=function() return table.remove(bools,1) end
local function category(id)
    for index,value in ipairs(ZPServerCvars.Categories) do if value.ID==id then return index-1 end end
    error(id)
end
local function field(group,name)
    for index,value in ipairs(ZPServerCvars.ForCategory(group)) do if value.Name==name then return index-1 end end
    error(name)
end
local function open(group)
    ZPAdminMenu:Open(); ZPAdminMenu:Navigate("settings"); ZPAdminMenu:OpenCvars(category(group))
end
local function replyCvars(code,overrides,id,index,length,count,reload,token)
    local group=ZPServerCvars.Categories[(index or sent[5])+1].ID
    local entries=ZPServerCvars.ForCategory(group)
    uints={2,id or sent[4],index or sent[5],code or 0,7,count or #entries,token or 0}; strings={}; bools={}
    for _,entry in ipairs(entries) do
        strings[#strings+1]=(overrides or {})[entry.Name] or entry.Default; bools[#bools+1]=true
    end
    bools[#bools+1]=reload or false
    receivers.ZPServerCvarsReply(length or 4000)
end
local function frame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function live(kind)
    local found={}
    for _,panel in ipairs(panels) do if panel.kind==kind and not panel.removed then found[#found+1]=panel end end
    return found
end
`;

test("server settings navigate all categories and label controls with friendly and technical names", () => run(setup + `
    ZPAdminMenu:Open(); ZPAdminMenu:Navigate("settings")
    local buttons={}
    for _,child in ipairs(frame().children[3].children) do if child.kind=="DButton" then buttons[#buttons+1]=child end end
    assert(#buttons==12)
    buttons[4]:DoClick(); assert(ZPAdminMenu:GetState().Page=="cvars" and requests==1)
    replyCvars()
    local labels=live("DLabel"); local found=false
    for _,label in ipairs(labels) do
        if label.text=="zombieplague.scrundrainenabled (zp_run_should_drain)" then found=true end
    end
    assert(found and ZPAdminMenu:GetState().Cvars.Ready)
    ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="settings")
    ZPAdminMenu:OpenCvars(0); assert(ZPAdminMenu:GetState().Page=="environment")
    assert(sent[1]=="ZPAdminSettingsRequest")
`));

test("cached settings expose a themed reload confirmation after save and cancel sends nothing", () => run(setup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); now=now+1; open("rounds")
        if not ZPAdminMenu:GetState().Cvars.Pending then now=now+1; ZPAdminMenu:RefreshCvars() end
        replyCvars()
        ZPAdminMenu:SetCvar(field("rounds","zp_min_players"),"3")
        now=now+1; ZPAdminMenu:SaveCvars()
        replyCvars(1,{zp_min_players="3"},nil,nil,nil,nil,true,99)
        assert(ZPAdminMenu:GetState().Cvars.ReloadRequired and ZPAdminMenu:GetState().Cvars.CanReload)
        assert(frame().children[4]:IsEnabled())
        local before=requests; ZPAdminMenu:ConfirmReload()
        local dialog=dialogs[#dialogs]; assert(dialog.modal and dialog.popup)
        paintAll(); dialog.children[3]:DoClick(); assert(requests==before)
        now=now+1; ZPAdminMenu:ConfirmReload(); dialog=dialogs[#dialogs]
        dialog.children[4]:DoClick()
        assert(sent[2]==2 and sent[3]==2 and sent[5]==category("rounds") and sent[6]==7 and sent[7]==99)
        assert(requests==before+1 and not ZPAdminMenu:GetState().Cvars.CanReload)
        dialog.children[4]:DoClick(); assert(requests==before+1)
        ZPAdminMenu:Close()
    end
`));

test("reads, unsaved edits, navigation and closed dialogs cannot authorize category reloads", () => run(setup + `
    open("rounds"); replyCvars(0,{zp_min_players="3"},nil,nil,nil,nil,true,0)
    ZPAdminMenu:ConfirmReload(); assert(#dialogs==0 and not ZPAdminMenu:GetState().Cvars.CanReload)
    ZPAdminMenu:SetCvar(field("rounds","zp_round_time"),"301"); now=now+1
    ZPAdminMenu:SaveCvars(); replyCvars(1,{zp_min_players="3",zp_round_time="301"},nil,nil,nil,nil,true,99)
    ZPAdminMenu:SetCvar(field("rounds","zp_round_time"),"302")
    ZPAdminMenu:ConfirmReload(); assert(#dialogs==0)
    ZPAdminMenu:SetCvar(field("rounds","zp_round_time"),"301")
    ZPAdminMenu:ConfirmReload(); assert(#dialogs==1)
    local old=dialogs[1]; ZPAdminMenu:Back(); local before=requests
    old.children[4]:DoClick(); assert(requests==before)
    ZPAdminMenu:OpenCvars(category("rounds")); ZPAdminMenu:ConfirmReload()
    old=dialogs[#dialogs]; ZPAdminMenu:Close(); old.children[4]:DoClick()
    assert(requests==before)
`));

test("a save sends only normalized edits and becomes clean only after acknowledgment", () => run(setup + `
    open("movement"); replyCvars()
    local index=field("movement","zp_breath_recover")
    ZPAdminMenu:SetCvar(index,"0.50"); assert(not ZPAdminMenu:GetState().Cvars.Dirty)
    ZPAdminMenu:SetCvar(index," 0.25 "); assert(ZPAdminMenu:GetState().Cvars.Dirty)
    now=now+1; ZPAdminMenu:SaveCvars()
    assert(sent[1]=="ZPServerCvarsRequest" and sent[3]==1 and sent[6]==7 and sent[7]==1)
    assert(sent[8]==index and sent[9]=="0.25" and #sent==9)
    assert(ZPAdminMenu:GetState().Cvars.Pending and ZPAdminMenu:GetState().Cvars.Dirty)
    ZPAdminMenu:SetCvar(index,"0.75"); assert(ZPAdminMenu:GetState().Cvars.Values[index+1]==" 0.25 ")
    replyCvars(1,{zp_breath_recover="0.25"})
    assert(not ZPAdminMenu:GetState().Cvars.Dirty and not ZPAdminMenu:GetState().Cvars.Pending)
    assert(ZPAdminMenu:GetState().Cvars.Feedback=="zombieplague.adminsaved")
    ZPAdminMenu:SetCvar(index,"-1"); now=now+1; local before=requests
    ZPAdminMenu:SaveCvars(); assert(requests==before and ZPAdminMenu:GetState().Cvars.Dirty)
`));

test("drafts survive category navigation and theme rebuilding and refresh affects only its category", () => run(setup + `
    open("movement"); replyCvars()
    local index=field("movement","zp_run_should_drain")
    ZPAdminMenu:SetCvar(index,"1"); ZPAdminMenu:Back()
    now=now+1; ZPAdminMenu:OpenCvars(category("combat")); replyCvars()
    ZPAdminMenu:SetCvar(field("combat","zp_friendly_fire"),"1"); ZPAdminMenu:Back()
    ZPAdminMenu:OpenCvars(category("movement"))
    assert(ZPAdminMenu:GetState().Cvars.Dirty and ZPAdminMenu:GetState().Cvars.Values[index+1]=="1")
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); ZPAdminMenu:Rebuild(); paintAll()
        assert(ZPAdminMenu:GetState().Cvars.Dirty and #live("DTextEntry")==5)
    end
    now=now+1; ZPAdminMenu:RefreshCvars(); replyCvars()
    assert(not ZPAdminMenu:GetState().Cvars.Dirty)
    ZPAdminMenu:Back(); ZPAdminMenu:OpenCvars(category("combat"))
    assert(ZPAdminMenu:GetState().Cvars.Dirty)
    local combos=live("DComboBox"); assert(#combos==2)
    assert(combos[2].choices[2][2]=="1" and combos[2].Paint~=nil and combos[2].DropButton.Paint~=nil)
    combos[2]:OnSelect(2,"reserve","1")
    assert(ZPAdminMenu:GetState().Cvars.Values[field("combat","zp_clip_mode")+1]=="1")
    paintAll()
`));

test("nonstandard current values remain visible and untouched when saving another field", () => run(setup + `
    open("movement"); replyCvars(0,{zp_zombie_should_run="2",zp_run_drain="2000000000"})
    local content=frame().children[3]; local toggle
    for _,panel in ipairs(content.children) do
        if panel.kind=="DButton" and panel.y==268 then toggle=panel end
    end
    assert(toggle)
    local caption; draw.DrawText=function(text) caption=text end
    toggle:Paint(toggle.w,toggle.h); assert(caption=="2")
    ZPAdminMenu:SetCvar(field("movement","zp_run_should_drain"),"1")
    now=now+1; ZPAdminMenu:SaveCvars()
    assert(sent[7]==1 and sent[8]==field("movement","zp_run_should_drain") and sent[9]=="1")
`));

test("superadmin controls are read-only to admins and authorization loss blocks edits", () => run(setup + `
    viewer.superadmin=false; open("bots"); replyCvars()
    assert(ZPAdminMenu:GetState().Cvars.Ready and not ZPAdminMenu:GetState().Cvars.CanEdit)
    local before=requests
    ZPAdminMenu:SetCvar(field("bots","zp_bot_learning"),"0"); now=now+1; ZPAdminMenu:SaveCvars()
    assert(requests==before and not ZPAdminMenu:GetState().Cvars.Dirty)
    local disabled=0
    for _,button in ipairs(frame().children[3].children) do
        if button.kind=="DButton" then assert(not button:IsEnabled()); disabled=disabled+1 end
    end
    assert(disabled==5)
    viewer.superadmin=true; ZPAdminMenu:Rebuild()
    assert(ZPAdminMenu:GetState().Cvars.CanEdit)
    viewer.admin=false; ZPAdminMenu:SetCvar(0,"1"); ZPAdminMenu:SaveCvars()
    assert(requests==before)
`));

test("malformed, stale and closed replies cannot commit a draft and timeouts can be retried", () => run(setup + `
    open("movement")
    replyCvars(0,nil,sent[4]+1); assert(ZPAdminMenu:GetState().Cvars.Pending and not ZPAdminMenu:GetState().Cvars.Ready)
    replyCvars(0,nil,nil,nil,4000,1); assert(not ZPAdminMenu:GetState().Cvars.Ready)
    replyCvars(0,{zp_breath_recover=string.rep("a",129)})
    assert(not ZPAdminMenu:GetState().Cvars.Ready)
    now=now+6; hooks.Think.ZPAdminMenu()
    assert(not ZPAdminMenu:GetState().Cvars.Pending and ZPAdminMenu:GetState().Cvars.Feedback=="zombieplague.weaponmenutimeout")
    ZPAdminMenu:RefreshCvars(); local pendingID=sent[4]; replyCvars(); assert(ZPAdminMenu:GetState().Cvars.Ready)
    now=now+1; ZPAdminMenu:RefreshCvars(); pendingID=sent[4]; ZPAdminMenu:Close()
    replyCvars(0,nil,pendingID,category("movement"))
    assert(not frame() and not ZPAdminMenu:GetState().Open)
`));
