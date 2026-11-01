import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = clientSetup + panelsSetup + `
GM={}; GAMEMODE=GM; TEXT_ALIGN_RIGHT=2
local enabled=true
function GetGlobalBool(name,fallback) if name=="ZPStatisticsEnabled" then return enabled end; return fallback end
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local schema=include("sh_statistics.lua")
include("cl_statistics.lua")
local menu=GM.PlayerStatisticsMenu
local function replyStatistics(id)
    local profile=schema.empty("all","76561198000000001","José 玩家")
    profile.Roles.human.Kills=5; profile.Roles.human.Rounds=1
    readTable={ID=id or sent[3],Status="ready",Report={Maps={"zm_test","zm_previous"},
        Leaders={{SteamID64="76561198000000002",Name="Other",Value=9,Rank=1}},
        SelfRank=21,SelfValue=5,Players=42,Profile=profile}}
    receivers.ZPStatisticsReply(4000)
end
local function frame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function combos()
    local result={}; for _,panel in ipairs(panels) do if panel.kind=="DComboBox" and not panel.removed then result[#result+1]=panel end end
    return result
end
`;

test("public menu shows map and global rankings with own rank outside the top 20", () => run(setup + `
    ZPMainMenu:Open(); ZPMainMenu:Activate("statistics")
    assert(sent[1]=="ZPStatisticsRequest" and sent[4]=="" and frame())
    replyStatistics()
    local state=menu:GetState(); assert(state.Report.SelfRank==21 and state.Report.Players==42)
    local controls=combos(); assert(#controls==4 and #controls[1].choices==3)
    assert(controls[1].choices[1][2]=="" and controls[1].choices[3][2]=="zm_previous")
    controls[1]:OnSelect(3,"zm_previous","zm_previous")
    now=now+0.7; hook.Call("Think")
    assert(sent[4]=="zm_previous")
    replyStatistics(); paintAll()
    assert(menu:GetState().Report.Profile.Roles.human.Kills==5)
`));

test("native controls, dropdowns and scrolling follow built-in and addon palettes without losing filters", () => run(setup + `
    ZPThemes:RegisterTheme("custom",{Name="custom",Square=true,Palette={Accent=Color(1,2,3),Surface=Color(4,5,6),
        Panel=Color(7,8,9),Text=Color(10,11,12),Muted=Color(13,14,15)},CreateWeaponMenu=function() return {} end,PaintPlayerHUD=function() end})
    menu:Open(); replyStatistics()
    for _,theme in ipairs({"classic","hl2","cs16","custom"}) do
        ZPThemes:UseTheme(theme); paintAll()
        local controls=combos(); assert(#controls==4 and controls[1].OnMenuOpened and controls[4].OnMenuOpened)
        assert(menu:GetState().Query.Role=="human" and menu:GetState().Report.SelfRank==21)
        assert(controls[1].DropButton.Paint and controls[1].Paint)
    end
    menu:Select("zm_test","nemesis","DamageDealt","")
    ZPThemes:UseTheme("classic")
    assert(menu:GetState().Query.Map=="zm_test" and menu:GetState().Query.Role=="nemesis")
    menu:Close(); assert(not frame())
`));

test("queued filters reject stale replies; closing and disabling clear data and stop requests", () => run(setup + `
    menu:Open(); local old=sent[3]
    menu:Select("zm_test","survivor","Kills",""); replyStatistics(old)
    assert(menu:GetState().Pending and not menu:GetState().Report)
    now=now+0.7; hook.Call("Think"); replyStatistics()
    assert(not menu:GetState().Pending and menu:GetState().Query.Role=="survivor")
    enabled=false; hook.Call("Think")
    assert(menu:GetState().Status=="disabled" and not menu:GetState().Report)
    local before=requests; hook.Call("Think"); assert(requests==before)
    ZPMainMenu:Open()
    for _,entry in ipairs(ZPMainMenu:GetState().Entries) do assert(entry.ID~="statistics") end
    menu:Close(); replyStatistics(); assert(not menu:GetState().Report)
`));

test("malformed replies and invalid filters cannot populate or alter the menu", () => run(setup + `
    menu:Open(); local before=requests
    menu:Select("../bad","human","Kills",""); assert(requests==before)
    readTable={ID=sent[3],Status="ready",Report={Maps={"../bad"}}}; receivers.ZPStatisticsReply(500)
    assert(menu:GetState().Pending and not menu:GetState().Report)
    replyStatistics(); now=now+0.7; menu:Refresh(); now=now+9; hook.Call("Think")
    assert(not menu:GetState().Pending and menu:GetState().Status=="loading")
`));

test("weapon filters preserve role and map, show selected counts plus totals, and reset for unrelated metrics", () => run(setup + `
    menu:Open()
    local profile=schema.empty("all","76561198000000001","Player")
    profile.Roles.human.Kills=5; profile.Roles.human.Rounds=1
    readTable={ID=sent[3],Status="ready",Report={Maps={"zm_test"},Leaders={},SelfRank=1,SelfValue=5,Players=1,
        Profile=profile,Weapons={{ID="weapon_ar2",Name="AR2"},{ID="weapon_smg1",Name="SMG"}},WeaponValues={Kills=5,Infections=0}}}
    receivers.ZPStatisticsReply(4000)
    local weaponChoice=combos()[4]; assert(#weaponChoice.choices==3)
    weaponChoice:OnSelect(2,"AR2","weapon_ar2")
    now=now+0.7; hook.Call("Think")
    assert(sent[2]==3 and sent[8]=="weapon_ar2" and menu:GetState().Query.Weapon=="weapon_ar2")
    readTable.ID=sent[3]; readTable.Report.SelfValue=2; readTable.Report.WeaponValues={Kills=2,Infections=0}
    receivers.ZPStatisticsReply(4000)
    assert(menu:GetState().Report.Profile.Roles.human.Kills==5 and menu:GetState().Report.WeaponValues.Kills==2)
    for _,theme in ipairs({"hl2","cs16","classic"}) do ZPThemes:UseTheme(theme); paintAll(); assert(menu:GetState().Query.Weapon=="weapon_ar2") end
    menu:Select("zm_test","human","DamageTaken","")
    assert(menu:GetState().Query.Weapon=="")
    menu:Select("zm_test","human","Kills","","../bad")
    assert(menu:GetState().Query.Weapon=="")
`));

test("selecting damage retains the chosen weapon and displays health and armor alongside the combined total", () => run(setup + `
    menu:Open(); replyStatistics()
    menu:Select("zm_test","human","DamageDealt","","weapon_ar2")
    now=now+0.7; hook.Call("Think")
    assert(menu:GetState().Query.Weapon=="weapon_ar2" and sent[8]=="weapon_ar2" and sent[6]==3)
    local profile=schema.empty("zm_test","76561198000000001","Player")
    profile.Roles.human.DamageDealt=150.5; profile.Roles.human.ArmorDamageDealt=30; profile.Roles.human.Rounds=1
    readTable={ID=sent[3],Status="ready",Report={Maps={"zm_test"},Leaders={},SelfRank=1,SelfValue=40.5,Players=1,
        Profile=profile,Weapons={{ID="weapon_ar2",Name="AR2"}},WeaponValues={Kills=0,Infections=0,DamageDealt=40.5,ArmorDamageDealt=10}}}
    receivers.ZPStatisticsReply(4000); paintAll()
    assert(menu:GetState().Report.WeaponValues.DamageDealt==40.5 and menu:GetState().Report.WeaponValues.ArmorDamageDealt==10)
    assert(menu:GetState().Report.Profile.Roles.human.DamageDealt==150.5)
    for _,theme in ipairs({"hl2","cs16","classic"}) do ZPThemes:UseTheme(theme); paintAll(); assert(menu:GetState().Query.Weapon=="weapon_ar2") end
    menu:Select("zm_test","human","ArmorDamageDealt","")
    assert(menu:GetState().Query.Weapon=="weapon_ar2")
    menu:Select("zm_test","human","DamageDealt","","")
    assert(menu:GetState().Query.Weapon=="")
`));

test("bot ranking entries open their independent profile and render a localized bot marker in every theme", () => run(setup + `
    menu:Open()
    local id="bot:"..string.rep("a",64)..":1"
    local profile=schema.empty("all",id,"ZP Bot 1"); profile.Roles.human.Kills=4; profile.Roles.human.Rounds=1
    readTable={ID=sent[3],Status="ready",Report={Maps={"zm_test"},
        Leaders={{ID=id,SteamID64="",Bot=true,Name="ZP Bot 1",Value=4,Rank=1}},
        SelfRank=0,SelfValue=0,Players=1,Profile=profile}}
    receivers.ZPStatisticsReply(4000)
    assert(menu:GetState().Report.Profile.Bot and menu:GetState().Report.Leaders[1].ID==id)
    for _,theme in ipairs({"classic","hl2","cs16"}) do ZPThemes:UseTheme(theme); paintAll() end
    local selected
    for _,panel in ipairs(panels) do if not panel.removed and panel.tooltip=="zombieplague.pstatsbotplayer" then selected=panel end end
    assert(selected); selected:DoClick(); now=now+0.7; hook.Call("Think")
    assert(menu:GetState().Query.Target==id and sent[7]==id and sent[2]==3)
`));
