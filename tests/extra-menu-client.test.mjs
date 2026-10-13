import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { extraClientSetup } from "./helpers/extra-menu.mjs";

test("F4 extra items show themed prices and availability and keep the shop open after purchase", () => run(extraClientSetup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); ZPMainMenu:Open(); ZPMainMenu:Activate("extras")
        assert(ZPExtraMenu:GetState().Open and not ZPMainMenu:GetState().Open)
        extraSnapshot.Balance=20; extraSnapshot.Entries[1].Availability="available"
        extraReply(sent[3]); local frame=extraFrame(); local cards=extraCards()
        assert(frame.popup and frame.keyboard and #cards==2 and cards[1]:IsEnabled() and not cards[2]:IsEnabled())
        local before=requests; cards[2]:DoClick(); assert(requests==before)
        local texts={}; local original=draw.DrawText
        draw.DrawText=function(text,...) texts[text]=true; original(text,...) end
        paintAll(); draw.DrawText=original
        assert(texts["12 zombieplague.ap"] and texts["zombieplague.ap: 20"])
        cards[1]:DoClick()
        local id=sent[2].RequestID
        assert(sent[1]=="ZPExtraMenuBuy" and sent[2].ID=="ZPArmor" and sent[2].Kind=="human")
        assert(ZPExtraMenu:GetState().Pending and not extraCards()[1]:IsEnabled())
        ZPExtraMenu:Buy("ZPArmor"); assert(requests==before+1)
        extraSnapshot.Balance=8; extraSnapshot.Entries[1].Availability="insufficient"; extraReply(id,"bought")
        assert(ZPExtraMenu:GetState().Open and not ZPExtraMenu:GetState().Pending and ZPExtraMenu:GetState().Snapshot.Balance==8)
        assert(ZPExtraMenu:GetState().Feedback=="zombieplague.extramenubought" and not extraCards()[1]:IsEnabled())
        ZPExtraMenu:Close(); assert(frame.removed)
    end
`));

test("the shop exposes only the local team with no category tabs and rejects stale life state", () => run(extraClientSetup + `
    ZPExtraMenu:Open(); extraReply(1)
    assert(#extraFrame().children==4, "Only close, list, feedback and refresh controls")
    assert(#ZPExtraMenu:GetState().Snapshot.Entries==2)
    local before=requests; ZPExtraMenu:SetKind("zombie")
    assert(requests==before and #extraCards()==2 and ZPExtraMenu:GetState().Kind=="human")
    for _,entry in ipairs(ZPExtraMenu:GetState().Snapshot.Entries) do assert(entry.Kind=="human") end
    ZPExtraMenu:Buy("ZPZombieMadness"); assert(requests==before)
    ZPExtraMenu:SetKind("human")
    viewer.alive=false; extraCards()[1]:DoClick(); assert(requests==before)
    viewer.alive=true; viewer.team=TEAM_ZOMBIES
    extraCards()[1]:DoClick(); assert(requests==before)
    viewer.team=TEAM_HUMANS; extraCards()[1]:DoClick(); assert(requests==before+1)
    extraReply(2,"restricted"); assert(ZPExtraMenu:GetState().Open and not ZPExtraMenu:GetState().Pending)
`));

test("team-changing purchases and periodic updates follow the authoritative catalog", () => run(extraClientSetup + `
    ZPExtraMenu:Open(); extraReply(1)
    extraSnapshot.Entries[2].Availability="available"
    ZPExtraMenu:Refresh(); extraReply(2)
    ZPExtraMenu:Buy("ZPTVirus")
    viewer.team=TEAM_ZOMBIES; viewer.human=false
    extraSnapshot.Team="zombie"; extraSnapshot.Entries[3].Availability="available"
    extraReply(3,"bought")
    assert(ZPExtraMenu:GetState().Kind=="zombie" and extraCards()[1]:IsEnabled())
    local before=requests; now=11.9; hooks.Think.ZPExtraMenuController(); assert(requests==before)
    now=12; hooks.Think.ZPExtraMenuController()
    assert(requests==before+1 and sent[1]=="ZPExtraMenuCatalog")
    hooks.Think.ZPExtraMenuController(); assert(requests==before+1)
    viewer.alive=false; extraSnapshot.Alive=false; extraSnapshot.Entries[3].Availability="not_alive"
    extraReply(4); assert(not extraCards()[1]:IsEnabled())
`));

test("theme and submenu changes preserve pending requests without reopening the shop", () => run(extraClientSetup + `
    ZPExtraMenu:Open(); extraReply(1); ZPExtraMenu:Buy("ZPArmor")
    local first=extraFrame(); ZPThemes:UseTheme("hl2")
    assert(first.removed and ZPExtraMenu:GetState().Pending and requests==2)
    local theme=ZPThemes:GetTheme()
    local palette={Accent=Color(8,20,40),Surface=Color(10,30,50),Panel=Color(30,50,70),Text=Color(240,240,240),Muted=Color(170,170,170)}
    ZPThemes:RegisterTheme("addon",{Name="Addon",Palette=palette,CreateWeaponMenu=theme.CreateWeaponMenu,PaintPlayerHUD=theme.PaintPlayerHUD})
    ZPThemes:UseTheme("addon")
    local surfaceSeen=false
    draw.RoundedBox=function(_,_,_,_,_,color) if color==palette.Surface then surfaceSeen=true end end
    paintAll(); assert(surfaceSeen and requests==2)
    ZPMainMenu:Open(); assert(not ZPExtraMenu:GetState().Open)
    extraReply(2,"bought"); assert(not ZPExtraMenu:GetState().Open)
    ZPExtraMenu:Open(); extraReply(3)
    ZPSettings:Open(); assert(not ZPExtraMenu:GetState().Open)
    ZPSettings:Close(); ZPExtraMenu:Open(); extraReply(4)
    ZPWeaponMenu:Open(); assert(not ZPExtraMenu:GetState().Open)
`));

test("malformed catalogs, stale replies and timeouts never submit a second purchase", () => run(extraClientSetup + `
    ZPExtraMenu:Open()
    extraSnapshot.Entries[1].Price=-1; extraReply(1)
    assert(ZPExtraMenu:GetState().Pending and not ZPExtraMenu:GetState().Snapshot)
    extraSnapshot.Entries[1].Price=12; extraSnapshot.Entries[1].Availability="anything"; extraReply(1)
    assert(ZPExtraMenu:GetState().Pending)
    extraSnapshot.Entries[1].Availability="available"; extraSnapshot.Entries[4]=extraSnapshot.Entries[1]; extraReply(1)
    assert(ZPExtraMenu:GetState().Pending)
    extraSnapshot.Entries[4]=nil; extraReply(99); assert(ZPExtraMenu:GetState().Pending)
    extraReply(1); local detached=ZPExtraMenu:GetState(); detached.Snapshot.Entries[1].Price=0
    assert(ZPExtraMenu:GetState().Snapshot.Entries[1].Price==12)
    ZPExtraMenu:Buy("ZPArmor"); now=16; hooks.Think.ZPExtraMenuController()
    assert(not ZPExtraMenu:GetState().Pending and ZPExtraMenu:GetState().Feedback=="zombieplague.weaponmenutimeout" and requests==2)
    extraReply(2,"bought"); assert(ZPExtraMenu:GetState().Feedback=="zombieplague.weaponmenutimeout" and requests==2)
    ZPExtraMenu:Close(); now=30; hooks.Think.ZPExtraMenuController(); assert(requests==2)
`));

test("empty catalogs and smaller windows keep the extra shop usable", () => run(extraClientSetup + `
    function ScrW() return 640 end
    function ScrH() return 360 end
    ZPExtraMenu:Open(); extraSnapshot.Entries={}; extraReply(1)
    local frame,cards=extraFrame(),extraCards()
    assert(frame.w<=ScrW() and frame.h<=ScrH() and cards[1].kind=="DLabel" and cards[1].text=="zombieplague.extramenuempty")
    assert(frame.children[2].kind=="DScrollPanel" and frame.children[2].h>0)
    ZPExtraMenu:Buy("ZPArmor"); assert(requests==1)
    input.IsKeyDown=function(key) return key==KEY_ESCAPE end
    hooks.Think.ZPExtraMenuController(); assert(not ZPExtraMenu:GetState().Open)
`));

test("team changes immediately hide old items even while a request or stale reply is pending", () => run(extraClientSetup + `
    ZPExtraMenu:Open(); extraReply(1); ZPExtraMenu:Refresh()
    viewer.team=TEAM_ZOMBIES; viewer.human=false; now=10.1
    hooks.Think.ZPExtraMenuController()
    assert(ZPExtraMenu:GetState().Kind=="zombie" and #ZPExtraMenu:GetState().Snapshot.Entries==0)
    assert(extraCards()[1].kind=="DLabel" and requests==2)
    extraReply(2) -- A late human catalog must stay hidden.
    assert(#ZPExtraMenu:GetState().Snapshot.Entries==0 and extraCards()[1].kind=="DLabel")
    now=10.5; hooks.Think.ZPExtraMenuController(); assert(requests==3)
    extraSnapshot.Team="zombie"; extraSnapshot.Entries[3].Availability="available"; extraReply(3)
    assert(#extraCards()==1 and extraCards()[1].kind=="DButton")
    local entries=ZPExtraMenu:GetState().Snapshot.Entries
    assert(#entries==1 and entries[1].ID=="ZPZombieMadness")
    viewer.team=TEAM_SPECTATOR; now=10.6; hooks.Think.ZPExtraMenuController()
    assert(ZPExtraMenu:GetState().Kind=="spectator" and #ZPExtraMenu:GetState().Snapshot.Entries==0)
    assert(extraCards()[1].kind=="DLabel")
    ZPExtraMenu:Buy("ZPZombieMadness"); assert(requests==3)
`));
