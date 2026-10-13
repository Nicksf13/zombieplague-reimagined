import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { classClientSetup } from "./helpers/class-menu.mjs";

test("F4 class list expands independent cards locally and selects like weapons in every theme", () => run(classClientSetup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); ZPMainMenu:Open(); ZPMainMenu:Activate("classes")
        assert(ZPClassMenu:GetState().Open and not ZPMainMenu:GetState().Open)
        classReply(sent[3]); ZPClassMenu:SetKind("zombie")
        local frame=classFrame()
        local scroll=frame.children[4]
        local rows={}
        for _,child in ipairs(scroll.children) do if not child.removed then rows[#rows+1]=child end end
        assert(scroll.kind=="DScrollPanel" and #rows==2)
        for _,child in ipairs(frame.children) do assert(child.kind~="DComboBox") end
        assert(frame.popup and frame.keyboard and rows[2].children[1]:IsEnabled())
        local before=requests
        local first,second=rows[1],rows[2]
        local firstHeight=first.h
        assert(first.children[3].visible==false and second.children[3].visible==false)
        first.children[2]:DoClick()
        assert(first.h>firstHeight and second.y>first.h and first.children[3].visible)
        second.children[2]:DoClick()
        assert(requests==before and second.children[3].visible and first.children[3].visible)
        assert(ZPClassMenu:GetState().Preview=="DefaultZombie")
        local details=second.children[3]
        assert(details.children[1].text=="zombieplague.zombieheavyclassdescription" and details.children[1].wrap)
        assert(details.children[2].text=="zombieplague.classhealth" and details.children[3].text=="4000")
        local labels=0
        for _,child in ipairs(details.children) do if child.kind=="DLabel" then labels=labels+1 end end
        assert(labels==33, "Description plus all 16 characteristic labels/values")
        first.children[2]:DoClick()
        assert(first.h==firstHeight and second.y==firstHeight+10 and first.children[3].visible==false)
        assert(second.children[3].visible and frame.children[4]==scroll and not scroll.removed)
        paintAll()
        second.children[1]:DoClick()
        assert(sent[1]=="ZPClassMenuSelect" and sent[2].ID=="HeavyZombie" and sent[2].Kind=="zombie")
        assert(ZPClassMenu:GetState().Open and ZPClassMenu:GetState().Pending)
        local sentID=sent[2].RequestID
        for _,row in ipairs(scroll.children) do
            if not row.removed then
                assert(not row.children[1]:IsEnabled())
                row.children[1]:DoClick(); row.children[2]:DoClick()
            end
        end
        assert(requests==before+1)
        classReply(sentID,"saved")
        assert(not ZPClassMenu:GetState().Open and frame.removed)
    end
`));

test("first prompts select the matching team and close after acknowledgment or death", () => run(classClientSetup + `
    readString="human"; receivers.ZPClassMenuMissing(64); classReply(1)
    assert(ZPClassMenu:GetState().Kind=="human" and ZPClassMenu:GetState().Open)
    ZPClassMenu:Confirm(); classReply(2,"invalid")
    assert(ZPClassMenu:GetState().Open and ZPClassMenu:GetState().Feedback=="zombieplague.classmenuinvalid")
    ZPClassMenu:Confirm(); classSnapshot.First.human=false; classReply(3,"applied")
    assert(not ZPClassMenu:GetState().Open)
    viewer.human=false; viewer.team=TEAM_ZOMBIES
    readString="zombie"; receivers.ZPClassMenuMissing(64); classReply(4)
    assert(ZPClassMenu:GetState().Kind=="zombie" and ZPClassMenu:GetState().Open)
    viewer.alive=false; hooks.Think.ZPClassMenuController()
    assert(not ZPClassMenu:GetState().Open)
    readString="human"; receivers.ZPClassMenuMissing(64)
    assert(not ZPClassMenu:GetState().Open)
`));

test("malformed snapshots and stale replies cannot enable confirmation", () => run(classClientSetup + `
    ZPClassMenu:Open("zombie")
    local entry=classSnapshot.Entries[3]
    entry.Health=0/0; classReply(1)
    assert(ZPClassMenu:GetState().Pending and not ZPClassMenu:GetState().Snapshot)
    entry.Health=4000; classSnapshot.Entries[4]=entry; classReply(1)
    assert(ZPClassMenu:GetState().Pending)
    classSnapshot.Entries[4]=nil
    classReply(99); assert(ZPClassMenu:GetState().Pending)
    classReply(1); assert(not ZPClassMenu:GetState().Pending)
    local state=ZPClassMenu:GetState(); state.Snapshot.Entries[1].Health=1
    assert(ZPClassMenu:GetState().Snapshot.Entries[1].Health==100)
    ZPClassMenu:Confirm(); ZPClassMenu:Close(); classReply(2,"saved")
    assert(not ZPClassMenu:GetState().Open)
`));

test("theme changes rebuild class menus with the active palette and preserve pending selections", () => run(classClientSetup + `
    ZPClassMenu:Open("zombie"); classReply(1); ZPClassMenu:Preview("HeavyZombie"); ZPClassMenu:Confirm()
    local frame=classFrame()
    ZPThemes:UseTheme("cs16")
    assert(frame.removed and classFrame()~=frame and requests==2)
    assert(ZPClassMenu:GetState().Pending and ZPClassMenu:GetState().Preview=="HeavyZombie")
    classReply(2,"rate_limited"); assert(ZPClassMenu:GetState().Open)
    local base=ZPThemes:GetTheme()
    local palette={Accent=Color(10,20,30),Surface=Color(30,40,50),Panel=Color(40,50,60),Text=Color(230,230,230),Muted=Color(160,160,160)}
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette=palette,CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD})
    ZPThemes:UseTheme("addon")
    local surfaceSeen=false
    draw.RoundedBox=function(_,_,_,_,_,color) if color==palette.Surface then surfaceSeen=true end end
    paintAll(); assert(surfaceSeen)
    ZPMainMenu:Open(); assert(not ZPClassMenu:GetState().Open)
    ZPClassMenu:Open("human"); classReply(3)
    ZPWeaponMenu:Open(); assert(not ZPClassMenu:GetState().Open)
`));

test("empty catalogs and timeouts leave refresh available without submitting choices", () => run(classClientSetup + `
    ZPClassMenu:Open("human")
    now=16; hooks.Think.ZPClassMenuController()
    assert(not ZPClassMenu:GetState().Pending and ZPClassMenu:GetState().Feedback=="zombieplague.weaponmenutimeout")
    ZPClassMenu:Refresh(); classSnapshot.Entries={}; classReply(2)
    local before=requests; ZPClassMenu:Confirm(); assert(requests==before)
    local frame=classFrame(); local scroll=frame.children[4]
    local labels=0
    for _,child in ipairs(scroll.children) do
        if not child.removed then assert(child.kind=="DLabel" and child.text=="zombieplague.classmenuempty"); labels=labels+1 end
    end
    assert(labels==1)
    ZPClassMenu:Refresh(); classReply(3,"rate_limited")
    assert(ZPClassMenu:GetState().Open and not ZPClassMenu:GetState().Pending)
`));

test("a late human confirmation cannot dismiss the first zombie prompt", () => run(classClientSetup + `
    readString="human"; receivers.ZPClassMenuMissing(64); classReply(1)
    ZPClassMenu:SetKind("zombie"); assert(ZPClassMenu:GetState().Kind=="human")
    ZPClassMenu:Confirm()
    viewer.human=false; viewer.team=TEAM_ZOMBIES
    readString="zombie"; receivers.ZPClassMenuMissing(64)
    assert(ZPClassMenu:GetState().Pending and ZPClassMenu:GetState().Kind=="zombie")
    classReply(2,"applied")
    assert(ZPClassMenu:GetState().Open and not ZPClassMenu:GetState().Pending)
    ZPClassMenu:Confirm(); classReply(3,"applied")
    assert(not ZPClassMenu:GetState().Open)
`));
