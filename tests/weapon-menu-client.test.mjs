import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

test("spawn selection advances only on server confirmation and closes after the missing choices", () => run(clientSetup + `
    snapshot.Entries[3]={ID="weapon_crowbar",Name="Crowbar",Kind="melee",Order=100}
    readString="primary"; receivers.ZPWeaponMenuMissing(64)
    assert(ZPWeaponMenu:GetState().Open and ZPWeaponMenu:GetState().Category=="primary")
    reply(1)
    ZPWeaponMenu:Select("weapon_ar2")
    assert(ZPWeaponMenu:GetState().Category=="primary")
    ZPWeaponMenu:RegisterPresentation("custom",function() return {
        Open=function() end,Update=function() end,Destroy=function() end} end)
    ZPWeaponMenu:UsePresentation("custom")
    assert(requests==2 and ZPWeaponMenu:GetState().Pending)
    reply(2,"invalid_weapon")
    assert(ZPWeaponMenu:GetState().Category=="primary" and ZPWeaponMenu:GetState().Open)
    ZPWeaponMenu:Select("weapon_ar2")
    snapshot.Selected.primary="weapon_ar2"; reply(3,"issued")
    assert(ZPWeaponMenu:GetState().Category=="secondary")
    ZPWeaponMenu:Select("weapon_pistol")
    snapshot.Selected.secondary="weapon_pistol"; reply(4,"issued")
    assert(ZPWeaponMenu:GetState().Category=="melee")
    ZPWeaponMenu:Select("weapon_crowbar")
    snapshot.Selected.melee="weapon_crowbar"; reply(5,"issued")
    assert(not ZPWeaponMenu:GetState().Open and requests==5)
`));

test("spawn prompts validate categories, skip saved choices and cannot reopen a closed menu", () => run(clientSetup + `
    readString="unknown"; receivers.ZPWeaponMenuMissing(64); assert(requests==0)
    readString="secondary"; receivers.ZPWeaponMenuMissing(129); assert(requests==0)
    viewer.human=false; receivers.ZPWeaponMenuMissing(64); assert(requests==0); viewer.human=true
    snapshot.Selected.primary="weapon_ar2"
    receivers.ZPWeaponMenuMissing(64); reply(1)
    assert(ZPWeaponMenu:GetState().Category=="secondary")
    ZPWeaponMenu:Select("weapon_pistol"); ZPWeaponMenu:Close()
    snapshot.Selected.secondary="weapon_pistol"; reply(2,"issued")
    assert(not ZPWeaponMenu:GetState().Open)
    -- Manual opening keeps the category available after a selection.
    ZPWeaponMenu:Open(); reply(3)
    assert(ZPWeaponMenu:GetState().Open)
    ZPWeaponMenu:Close(); snapshot.Selected.secondary=""
    ZPWeaponMenu:OpenMissing("secondary"); reply(4)
    viewer.alive=false; hooks.Think.ZPWeaponMenuController()
    assert(not ZPWeaponMenu:GetState().Open)
`));

test("changing presentations preserves pending choices and requires no new network request", () => run(clientSetup + `
    local opened,destroyed,updated=0,0,0
    local function factory()
        return {Open=function(self,state,actions) opened=opened+1; assert(actions==ZPWeaponMenu) end,
            Update=function(self,state) updated=updated+1 end,
            Destroy=function(self) destroyed=destroyed+1 end}
    end
    ZPWeaponMenu:RegisterPresentation("classic",factory)
    ZPWeaponMenu:RegisterPresentation("custom",factory)
    ZPWeaponMenu:Open()
    assert(requests==1 and ZPWeaponMenu:GetState().Pending)
    reply(999); assert(ZPWeaponMenu:GetState().Pending)
    reply(1)
    ZPWeaponMenu:Select("weapon_ar2")
    assert(requests==2 and sent[1]=="ZPWeaponMenuSelect")
    local request=sent[2]
    assert(request.Kind=="primary" and request.ID=="weapon_ar2")
    ZPWeaponMenu:Select("weapon_ar2"); ZPWeaponMenu:Refresh()
    assert(requests==2)
    ZPWeaponMenu:UsePresentation("custom")
    assert(opened==2 and destroyed==1 and requests==2 and ZPWeaponMenu:GetState().Pending)
    snapshot.Selected.primary="weapon_ar2"
    reply(2,"saved")
    local state=ZPWeaponMenu:GetState()
    assert(state.Snapshot.Selected.primary=="weapon_ar2" and not state.Pending)
    state.Snapshot.Selected.primary="tampered"
    state.Snapshot.Entries[1].Name="tampered"
    assert(ZPWeaponMenu:GetState().Snapshot.Selected.primary=="weapon_ar2")
    assert(ZPWeaponMenu:GetState().Snapshot.Entries[1].Name=="AR2")
    assert(updated>=3)
`));

test("closed HUDs receive results without reopening and timeouts allow reconciliation", () => run(clientSetup + `
    ZPWeaponMenu:Open(); reply(1)
    ZPWeaponMenu:Select("weapon_ar2"); ZPWeaponMenu:Close()
    snapshot.Selected.primary="weapon_ar2"; reply(2,"issued")
    assert(not ZPWeaponMenu:GetState().Open and not ZPWeaponMenu:GetState().Pending)
    assert(ZPWeaponMenu:GetState().Feedback=="zombieplague.weaponmenuissued")
    ZPWeaponMenu:Open()
    now=16; hooks.Think.ZPWeaponMenuController()
    assert(not ZPWeaponMenu:GetState().Pending and ZPWeaponMenu:GetState().Feedback=="zombieplague.weaponmenutimeout")
    ZPWeaponMenu:Refresh()
    reply(3); assert(ZPWeaponMenu:GetState().Pending)
    reply(4); assert(not ZPWeaponMenu:GetState().Pending)
    input.IsKeyDown=function(key) return key==KEY_ESCAPE end
    hooks.Think.ZPWeaponMenuController()
    assert(not ZPWeaponMenu:GetState().Open)
`));

test("malformed replies and unknown local choices leave the previous snapshot intact", () => run(clientSetup + `
    ZPWeaponMenu:Open()
    snapshot.Entries[1].Order=0/0; reply(1)
    assert(ZPWeaponMenu:GetState().Pending and not ZPWeaponMenu:GetState().Snapshot)
    snapshot.Entries[1].Order=100
    snapshot.Entries[3]=snapshot.Entries[1]; reply(1)
    assert(ZPWeaponMenu:GetState().Pending)
    snapshot.Entries[3]=nil; reply(1)
    ZPWeaponMenu:Select("not_in_catalog"); assert(requests==1)
    ZPWeaponMenu:SetCategory("secondary")
    ZPWeaponMenu:Select("weapon_ar2"); assert(requests==1)
    ZPWeaponMenu:Select("weapon_pistol"); assert(requests==2)
    reply(2,"invalid_weapon")
    assert(not ZPWeaponMenu:GetState().Pending and ZPWeaponMenu:GetState().Snapshot)
    assert(ZPWeaponMenu:GetState().Feedback=="zombieplague.weaponmenuinvalidweapon")
`));

test("built-in themed menus paint, switch, dispatch selections and clean their panels", () => run(clientSetup + panelsSetup + `
    include("cl_theme_hud.lua")
    include("cl_weapon_menu_hud.lua")
    consoleCommands.zp_weapons()
    local firstFrame=panels[1]
    assert(firstFrame.kind=="DFrame" and firstFrame.popup and firstFrame.keyboard==false)
    reply(1); paintAll()
    for _,panel in ipairs(panels) do if not panel.removed then assert(panel.keyboard==false) end end
    local content=firstFrame.children[#firstFrame.children]
    local scroll
    for _,panel in ipairs(content.children) do if panel.kind=="DScrollPanel" then scroll=panel end end
    assert(scroll and #scroll.children==1)
    scroll.children[1]:DoClick()
    assert(sent[1]=="ZPWeaponMenuSelect" and sent[2].ID=="weapon_ar2")
    local count=requests
    consoleCommands.zp_weapon_hud_hl2()
    assert(firstFrame.removed and requests==count and ZPWeaponMenu:GetState().Pending)
    reply(2,"saved"); paintAll()
    -- Refresh/category updates replace content, without accumulating header controls.
    local activeFrame
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then activeFrame=panel end end
    ZPWeaponMenu:SetCategory("secondary"); paintAll()
    local liveChildren=0
    for _,panel in ipairs(activeFrame.children) do if not panel.removed then liveChildren=liveChildren+1 end end
    assert(liveChildren==2)
    ZPWeaponMenu:Close()
    for _,panel in ipairs(panels) do assert(panel.removed) end
`));
