import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { nativeLanguage } from "./helpers/native-localization.mjs";
const setup = clientSetup + panelsSetup + nativeLanguage + `
viewer.admin=true
function viewer:IsAdmin() return self.admin end
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local Client=include("cl_bot_statistics.lua").BotStatisticsClient
local function construct(class) local value=setmetatable({},class.prototype); value:____constructor(); return value end
local client=construct(Client)
local strokes,drawn={},{}
surface.SetDrawColor=function() end
surface.DrawLine=function(x1,y1,x2,y2) strokes[#strokes+1]={x1,y1,x2,y2} end
local originalDraw=draw.DrawText
draw.DrawText=function(text,...) drawn[#drawn+1]=text; originalDraw(text,...) end
local requestedQuery
util.TableToJSON=function(value) requestedQuery=value; return "{}" end
local function frame() for i=#panels,1,-1 do if panels[i].kind=="DFrame" and not panels[i].removed then return panels[i] end end end
local function label() for i=#panels,1,-1 do if panels[i].kind=="DLabel" and not panels[i].removed then return panels[i] end end end
local function packet() return {Version=1,Session="session",Total=0,Dropped=0,TimelineDropped=0,Truncated=0,Groups={},Timeline={},History={},Comparisons={}} end
local function reply(id,data)
    net.ReadUInt=function() return id end; net.ReadBool=function() return false end; net.ReadString=function() return "reply" end
    util.JSONToTable=function() return data end; client:Receive(500)
end
local function choices()
    local result={}; for _,panel in ipairs(frame().children) do if panel.kind=="DComboBox" then result[#result+1]=panel end end
    return result
end
local function chartPacket(role)
    local data=packet(); data.Bots={1,2}
    local analysis=include("sh_bot_statistics_analysis.lua")
    for _,hour in ipairs({"09","10"}) do
        for _,kind in ipairs({"navigation","combat"}) do
            local row=analysis.summarize({},kind); row.Period="2026-10-17 "..hour..":00 -03:00"; row.Kind=kind
            row.Role=role or "human"; row.N=1; row.Eligible=1; row.Success=1; row.Active=10; row.Kills=3
            data.Timeline[#data.Timeline+1]=row
        end
    end
    return data
end
`;

test("statistics controls use native themed inputs in every theme and preserve filters when the palette changes", () => run(setup + `
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        assert(ZPThemes:UseTheme(theme)); now=now+1.1; client:Open()
        local current=frame(); assert(current and current.popup)
        local entries=0
        for _,panel in ipairs(current.children) do if panel.kind=="DTextEntry" then
            entries=entries+1; panel:SetText("2026-10-17"); panel:Paint(panel.w,panel.h)
            assert(panel.entryColors and panel.inset and panel:GetPlaceholderText()~="")
        end end
        assert(entries==4)
        ZPThemes:UseTheme(theme=="classic" and "hl2" or "classic"); client:Tick()
        for _,panel in ipairs(current.children) do if panel.kind=="DTextEntry" then assert(panel:GetValue()=="2026-10-17") end end
        current:Remove()
    end
`));

test("late and malformed statistics replies cannot reopen a closed window; timeouts and lost permission close safely", () => run(setup + `
    client:Open(); local current=frame(); local id=sent[3]
    reply(id+1,packet()); assert(label().text==language.GetPhrase("zombieplague.weaponmenuwaiting"))
    reply(id,{Version=1}); assert(label().text==language.GetPhrase("zombieplague.weaponmenuwaiting"))
    now=now+6; client:Tick(); assert(label().text==language.GetPhrase("zombieplague.weaponmenutimeout"))
    now=now+1; client:Open(); current=frame(); id=sent[3]
    reply(id,packet()); assert(label().text:find(language.GetPhrase("zombieplague.botstatshelp"),1,true))
    current:Remove(); reply(id,packet()); assert(not frame())
    now=now+1; client:Open(); viewer.admin=false; client:Tick(); assert(not frame())
`));

test("bot and team selections queue the newest filter, ignore old replies and plot the selected statistic", () => run(setup + `
    client:Open(); local data=chartPacket()
    reply(sent[3],data); assert(requests==1 and #choices()[1].choices==2)
    now=now+1.1; client:Tick(); assert(requests==2 and requestedQuery.Bot=="1" and requestedQuery.Role=="human")
    reply(sent[3],data); paintAll(); assert(#strokes==6,"five grid lines plus the hourly series")
    local controls=choices(); assert(#controls==3 and #controls[2].choices==2 and #controls[3].choices==10)
    local before=requests
    controls[3]:OnSelect(5,"", "kills"); strokes={}; paintAll()
    assert(requests==before and #strokes==6,"metric selection reuses the filtered report")
    controls[1]:OnSelect(2,"", "2"); controls[2]:OnSelect(2,"", "zombie")
    local stale=sent[3]; reply(stale,data)
    strokes={}; paintAll(); assert(#strokes==0,"old data must disappear while the selection is pending")
    now=now+1.1; client:Tick()
    assert(requests==before+1 and requestedQuery.Bot=="2" and requestedQuery.Role=="zombie")
    reply(sent[3],chartPacket("zombie")); strokes={}; paintAll(); assert(#strokes==6)
    assert(choices()[1]==controls[1] and choices()[2]==controls[2],"native controls survive report updates")
`));

test("statistics dropdowns and graphs follow addon palettes and preserve selections on compact screens", () => run(setup + `
    local original=ZPThemes:GetTheme()
    local addon={Accent=Color(30,220,180),Surface=Color(20,30,40),Panel=Color(40,50,60),Text=Color(240,240,240),Muted=Color(110,110,110)}
    ZPThemes:RegisterTheme("statistics-addon",{Name="Statistics",Palette=addon,CreateWeaponMenu=original.CreateWeaponMenu,PaintPlayerHUD=original.PaintPlayerHUD})
    ScrW=function() return 520 end; ScrH=function() return 480 end
    for _,theme in ipairs({"classic","hl2","cs16","statistics-addon"}) do
        ZPThemes:UseTheme(theme); now=now+1.1; client:Open(); reply(sent[3],chartPacket())
        now=now+1.1; client:Tick(); reply(sent[3],chartPacket())
        local current=frame(); assert(current.w<=520 and current.h<=480)
        local controls=choices(); controls[3]:OnSelect(5,controls[3].choices[5][1],"kills")
        local colors={}; draw.RoundedBox=function(_,_,_,_,_,color) colors[#colors+1]=color end
        for _,control in ipairs(controls) do control:Paint(control.w,control.h); assert(control.OnMenuOpened and control.OnSelect and control.sorted==false) end
        assert(colors[2]==ZPThemes:GetTheme().Palette.Panel)
        local chosen=controls[3].text
        ZPThemes:UseTheme(theme=="classic" and "hl2" or "classic"); client:Tick()
        assert(choices()[3]==controls[3] and controls[3].text==chosen)
        strokes={}; drawn={}; paintAll(); assert(#strokes>0)
        for _,text in ipairs(drawn) do assert(not text:find("zombieplague.",1,true),text) end
        current:Remove()
    end
`));

test("closing the history cancels queued selection requests and Back returns to Bots", () => run(setup + `
    client:Open(); reply(sent[3],chartPacket()); local before=requests
    frame():Remove(); now=now+2; client:Tick(); assert(requests==before)
    client:Open(); local navigated
    ZPAdminMenu={Open=function() end,Navigate=function(_,page) navigated=page end}
    local window=frame()
    for _,panel in ipairs(window.children) do if panel.kind=="DButton" and panel.y==window.h-46 then panel:DoClick() end end
    assert(navigated=="bots" and not frame())
`));

test("history polls automatically without clearing the graph or replacing native controls and stops on close", () => run(setup + `
    client:Open(); reply(sent[3],chartPacket()); now=now+1.1; client:Tick(); reply(sent[3],chartPacket())
    local controls=choices(); local before=requests
    now=now+2.1; client:Tick(); assert(requests==before+1)
    strokes={}; paintAll(); assert(#strokes>0,"background polling keeps the current chart")
    reply(sent[3],chartPacket()); assert(choices()[1]==controls[1])
    frame():Remove(); now=now+10; client:Tick(); assert(requests==before+1)
`));
