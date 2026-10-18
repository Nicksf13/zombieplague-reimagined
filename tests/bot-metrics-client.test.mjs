import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { nativeLanguage } from "./helpers/native-localization.mjs";

const setup = clientSetup + panelsSetup + nativeLanguage + `
selectedLocale="pt-BR"
viewer.admin=true; viewer.superadmin=true
function viewer:IsAdmin() return self.admin end
function viewer:IsSuperAdmin() return self.superadmin end
GetGlobalBool=function() return true end
game={SinglePlayer=function() return false end}
local botCommands={}
RunConsoleCommand=function(name,count) botCommands[#botCommands+1]={name,count} end
local strokes,strokeColor={},{}
surface.SetDrawColor=function(r,g,b,a) strokeColor={r,g,b,a} end
surface.DrawLine=function(x1,y1,x2,y2) strokes[#strokes+1]={x1,y1,x2,y2,color=strokeColor} end
include("sh_admin_config.lua"); include("sh_bot_metrics_protocol.lua")
include("cl_admin_menu.lua"); include("cl_admin_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local function activeFrame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function packet(page,total)
    local rows={}
    for i=page*16+1,math.min(total,(page+1)*16) do
        rows[#rows+1]={ID=i,EntityID=i,Name="Bot "..i,Profile="aggressive",
            Scope={Map="gm_construct",Role="zombie",ClassID="ZombieDefault",ClassName="ZombieDefaultClassName",Variant="normal"},
            Action="attack",Reason="learned",Alive=true,Active=true,Route="mesh",Remaining=200,Goal="200, 0, 0",Replans=2,Blocked=false,
            Breath=100,MaxBreath=100,Sprinting=true,DrainEnabled=false,Samples=10,LastReward=0.5,Totals=ZPBotMetricsProtocol.Empty()}
        local function score(profile,health,threat,distance,cohesion,learned)
            return {Profile=profile,Health=health,Threat=threat,Distance=distance,Cohesion=cohesion,Learned=learned,
                Total=profile+health+threat+distance+cohesion+learned,Samples=10,Eligible=true}
        end
        rows[#rows].Decision={Health=0.2,Distance=400,Allies=0,Enemies=3,HasAlly=true,Held=false,Age=0,
            Scores={attack=score(0.65,-0.35,0,0,0,0.13),defend=score(0.1,0,0,0.15,0,0),
                retreat=score(0.05,0.8,0.45,0,0,0),group=score(0.75,0,0.35,0,0,0)}}
    end
    return {Version=1,RequestID=sent[3],Page=page,Total=total,Learning=true,Rows=rows}
end
local function metricsReply(data)
    readTable=data; receivers.ZPBotMetricsReply(8000)
end
local function openBots()
    ZPAdminMenu:Open(); ZPAdminMenu:Navigate("botadd")
end
`;

test("admin bot metrics poll once per second, update cards in place, and stop when closed", () => run(setup + `
    openBots(); assert(requests==1 and sent[1]=="ZPBotMetricsRequest" and sent[2]==1 and sent[4]==0)
    assert(ZPAdminMenu:GetState().BotMetricsLoading)
    local frame=activeFrame(); local view=frame.children[3].children[4]
    metricsReply(packet(0,1))
    local state=ZPAdminMenu:GetState(); assert(state.BotMetrics.Rows[1].Scope.Map=="gm_construct" and not state.BotMetricsLoading)
    local card=view.children[4]; local text=card.children[1].text
    assert(text:find("gm_construct",1,true) and text:find("ZombieDefault",1,true), text)
    assert(text:find("10",1,true), "learned sample count is visible")
    state.BotMetrics.Rows[1].Totals.Actions.attack.Episodes=999
    assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].Totals.Actions.attack.Episodes==0)
    now=10.5; ZPAdminMenu:Tick(); assert(requests==1)
    now=11; ZPAdminMenu:Tick(); assert(requests==2)
    local reply=packet(0,1); reply.Rows[1].Samples=15; metricsReply(reply)
    assert(view.children[4]==card and not card.removed and ZPAdminMenu:GetState().BotMetrics.Rows[1].Samples==15)
    now=12; ZPAdminMenu:Tick(); local late=packet(0,1)
    ZPAdminMenu:Close(); now=13; ZPAdminMenu:Tick(); metricsReply(late)
    assert(requests==3 and not activeFrame() and not ZPAdminMenu:GetState().BotMetrics)
`));

test("metrics pagination rejects stale or malformed replies and follows disappearing bots", () => run(setup + `
    openBots(); local first=packet(0,20)
    first.RequestID=first.RequestID+1; metricsReply(first); assert(not ZPAdminMenu:GetState().BotMetrics)
    first=packet(0,20); first.Rows[1].Totals.Distance=-1; metricsReply(first); assert(not ZPAdminMenu:GetState().BotMetrics)
    metricsReply(packet(0,20)); ZPAdminMenu:BotPage(1)
    assert(sent[4]==1 and ZPAdminMenu:GetState().BotMetricsLoading)
    metricsReply(packet(0,20)); assert(ZPAdminMenu:GetState().BotMetrics.Page==0)
    metricsReply(packet(1,20)); assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].ID==17)
    now=12; ZPAdminMenu:Tick(); metricsReply(packet(1,2)); ZPAdminMenu:Tick()
    assert(sent[4]==0); metricsReply(packet(0,2))
    assert(ZPAdminMenu:GetState().BotMetrics.Page==0 and #ZPAdminMenu:GetState().BotMetrics.Rows==2)
    now=13; ZPAdminMenu:Tick(); local reply=packet(0,2)
    viewer.admin=false; metricsReply(reply); assert(not ZPAdminMenu:GetState().BotMetrics)
    ZPAdminMenu:Tick(); assert(not activeFrame())
`));

test("bot metrics time out and retry without reopening pages or accepting an earlier visit", () => run(setup + `
    openBots(); local old=packet(0,1)
    now=16; ZPAdminMenu:Tick(); assert(requests==2 and ZPAdminMenu:GetState().BotMetricsLoading)
    metricsReply(old); assert(not ZPAdminMenu:GetState().BotMetrics)
    ZPAdminMenu:Back(); assert(ZPAdminMenu:GetState().Page=="bots")
    now=20; ZPAdminMenu:Tick(); assert(requests==2)
    ZPAdminMenu:Navigate("botadd"); metricsReply(old); assert(not ZPAdminMenu:GetState().BotMetrics)
    metricsReply(packet(0,0)); assert(ZPAdminMenu:GetState().BotMetrics.Total==0)
`));

test("AI quantity dropdown stays alive and themed during metrics polling", () => run(setup + `
    openBots(); local content=activeFrame().children[3]; local quantity=content.children[2].children[2]
    quantity:OnSelect(8,"8",8); quantity.menuOpen=true
    local choices=quantity.choices
    metricsReply(packet(0,1)); now=11; ZPAdminMenu:Tick(); metricsReply(packet(0,1))
    assert(content.children[2].children[2]==quantity and quantity.menuOpen and quantity.choices==choices and quantity.text=="8")
    content.children[3]:DoClick(); assert(botCommands[1][1]=="zp_addaibot" and botCommands[1][2]=="8")
    local colors={}; draw.RoundedBox=function(radius,x,y,w,h,color) colors[#colors+1]=color end
    quantity:Paint(quantity.w,quantity.h); assert(colors[2]==ZPThemes:GetTheme().Palette.Panel)
`));

test("diagnostic cards and AI creation use every active theme, including compact screens", () => run(setup + `
    ScrW=function() return 520 end
    for _,theme in ipairs({"classic","hl2","cs16"}) do
        ZPThemes:UseTheme(theme); openBots(); metricsReply(packet(0,1))
        local content=activeFrame().children[3]
        content.children[3]:DoClick()
        assert(botCommands[#botCommands][1]=="zp_addaibot" and botCommands[#botCommands][2]=="1")
        local view=content.children[4]; local card=view.children[4]
        assert(card.h==692 and card.w<=520)
        local colors={}
        draw.RoundedBox=function(radius,x,y,w,h,color) colors[#colors+1]={radius,color} end
        card:Paint(card.w,card.h)
        assert(colors[1][1]==(theme=="cs16" and 0 or 6) and colors[1][2]==ZPThemes:GetTheme().Palette.Panel)
        local textColor
        draw.DrawText=function(text,font,x,y,color) textColor=color end
        view.children[2]:Paint(100,30)
        assert(textColor==ZPThemes:GetTheme().Palette.Muted)
        paintAll(); ZPAdminMenu:Close()
    end
    assert(#botCommands==3)
    viewer.superadmin=false; openBots(); activeFrame().children[3].children[3]:DoClick()
    assert(#botCommands==3)
`));

test("visual decisions draw real signed connections, stop animating stale data and keep expanded details during polling", () => run(setup + `
    openBots(); metricsReply(packet(0,2))
    local view=activeFrame().children[3].children[4]
    local card,second=view.children[4],view.children[5]
    local diagram,button,details=card.children[2],card.children[4],card.children[5]
    assert(details.visible==false and second.y==90+card.h+10)
    button:DoClick(); assert(details.visible and card.h>692 and second.y==90+card.h+10)
    now=11; ZPAdminMenu:Tick(); metricsReply(packet(0,2))
    assert(view.children[4]==card and details.visible and card.h>692)
    local pulses=0
    draw.RoundedBox=function(radius,x,y,w,h) if w==6 and h==6 then pulses=pulses+1 end end
    diagram:Paint(diagram.w,diagram.h)
    assert(#strokes>10 and pulses>0, "positive and negative contributions plus selection are rendered")
    local strong=false; for _,stroke in ipairs(strokes) do if stroke.color[4]==190 then strong=true end end
    assert(strong, "selected path is highlighted")
    local decision=ZPAdminMenu:GetState().BotMetrics.Rows[1].Decision
    decision.Scores.attack.Learned=999
    assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].Decision.Scores.attack.Learned==0.13)
    strokes={}; pulses=0; now=14
    diagram:Paint(diagram.w,diagram.h)
    assert(pulses==0, "late network replies must not appear live")
    for _,stroke in ipairs(strokes) do assert(stroke.color[4]==45) end
    now=15; ZPAdminMenu:Tick(); local inactive=packet(0,2); inactive.Rows[1].Decision=nil
    metricsReply(inactive); strokes={}; diagram:Paint(diagram.w,diagram.h)
    assert(#strokes==0, "searching must not fabricate decision connections")
    button:DoClick(); assert(not details.visible and card.h==692 and second.y==90+card.h+10)
`));

test("visual labels preserve UTF-8 when shortened and render native labels without changing polling", () => run(setup + `
    local graph=include("cl_bot_decision_graph.lua")
    surface.GetTextSize=function(text) return utf8.len(text)*8,16 end
    local shortened=graph.fitted("Противники / союзники",64)
    assert(utf8.len(shortened) and shortened:sub(-3)=="…" and utf8.len(shortened)<=8)
    for _,locale in ipairs({"pt-BR","ru","ja","zh-CN","el"}) do
        selectedLocale=locale; openBots(); metricsReply(packet(0,1))
        local labels={}
        draw.DrawText=function(text) labels[#labels+1]=text; assert(utf8.len(text)) end
        paintAll(); assert(#labels>20)
        for _,text in ipairs(labels) do assert(not text:find("zombieplague.",1,true), text) end
        ZPAdminMenu:Close()
    end
    assert(requests==5, "rendering never sends additional requests")
`));

test("locomotion tab renders paths, real input keys and learned values, and survives polling with detached state", () => run(setup + `
    local function movement()
        local values={}; for i=1,15 do values[i]=i==1 and 0.5 or 0 end
        return {Action="sprint",Mode="ground",From=1,To=2,Samples=10,Reward=0.5,Progress=50,Attempts=10,Successes=5,Failures=1,
            Seconds=30,Stuck=2,Breath=3,Goals=2,Recoveries=1,Water=1,Ladders=1,Harm=0,Keys=131080,Look=0,
            Path={0,0,0,100,50,0,200,50,64,300,50,64,400,50,64},Values=values,Passage={6,5,1.2}}
    end
    openBots(); local data=packet(0,1); data.Rows[1].Motion=movement(); metricsReply(data)
    local card=activeFrame().children[3].children[4].children[4]
    local diagram=card.children[2]; card.children[7]:DoClick()
    local labels={}; draw.DrawText=function(text) labels[#labels+1]=text end
    diagram:Paint(diagram.w,diagram.h)
    assert(labels[1]==language.GetPhrase("zombieplague.botmotiontitle") and #strokes>=4)
    for _,label in ipairs(labels) do assert(not label:find("zombieplague.",1,true),label) end
    local state=ZPAdminMenu:GetState(); state.BotMetrics.Rows[1].Motion.Values[1]=999; state.BotMetrics.Rows[1].Motion.Path[1]=999
    assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].Motion.Values[1]==0.5 and ZPAdminMenu:GetState().BotMetrics.Rows[1].Motion.Path[1]==0)
    now=11; ZPAdminMenu:Tick(); data=packet(0,1); data.Rows[1].Motion=movement(); metricsReply(data)
    labels={}; diagram:Paint(diagram.w,diagram.h)
    assert(labels[1]==language.GetPhrase("zombieplague.botmotiontitle"), "selected category remains open during updates")
    card.children[6]:DoClick(); labels={}; diagram:Paint(diagram.w,diagram.h)
    assert(labels[1]==language.GetPhrase("zombieplague.botvisualtitle"))
    now=12; ZPAdminMenu:Tick(); local bad=packet(0,1); bad.Rows[1].Motion=movement(); bad.Rows[1].Motion.Path[1]=1/0
    metricsReply(bad); assert(ZPAdminMenu:GetState().BotMetricsLoading)
    bad=packet(0,1); bad.Rows[1].Motion=movement(); bad.Rows[1].Motion.Passage={1,2,1}
    metricsReply(bad); assert(ZPAdminMenu:GetState().BotMetricsLoading)
    local good=packet(0,1); good.Rows[1].Motion=movement(); metricsReply(good)
    assert(not ZPAdminMenu:GetState().BotMetricsLoading and requests==3)
`));

test("shelter and hunt indicators render native states and detach goal points across polling", () => run(setup + `
    local function place()
        return {State="guard",Reason="learned",Point={240,0,0},Value=0.3,Hold=8,Visits=4,Finds=0,Escapes=2,Deaths=1,Empty=0,Damage=20,Seconds=12}
    end
    for _,locale in ipairs({"pt-BR","ru","ja","zh-CN"}) do
        selectedLocale=locale; openBots()
        local data=packet(0,1); data.Rows[1].Place=place()
        data.Rows[1].Motion={Action="duck",Mode="ground",From=1,To=2,Samples=1,Reward=0,Progress=0,Attempts=1,Successes=1,Failures=0,
            Seconds=2,Stuck=0,Breath=0,Goals=1,Recoveries=0,Water=0,Ladders=0,Harm=0,Keys=4,Look=0,Path={0,0,0,240,0,0},
            Values={0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},Passage={1,1,1}}
        metricsReply(data)
        local card=activeFrame().children[3].children[4].children[4]; local diagram=card.children[2]
        card.children[7]:DoClick(); card.children[4]:DoClick()
        local labels={}; draw.DrawText=function(text) labels[#labels+1]=text; assert(utf8.len(text)) end
        diagram:Paint(diagram.w,diagram.h)
        assert(labels[1]:find(language.GetPhrase("zombieplague.botplaceguard"),1,true))
        for _,label in ipairs(labels) do assert(not label:find("zombieplague.",1,true),label) end
        assert(card.children[5].text:find(language.GetPhrase("zombieplague.botplacetitle"),1,true))
        local state=ZPAdminMenu:GetState(); state.BotMetrics.Rows[1].Place.Point[1]=999
        assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].Place.Point[1]==240)
        now=now+1; ZPAdminMenu:Tick(); data.Rows[1].Place.State="inspect"; data.Rows[1].Place.Reason="clue"; data.RequestID=sent[3]
        metricsReply(data); labels={}; diagram:Paint(diagram.w,diagram.h)
        assert(labels[1]:find(language.GetPhrase("zombieplague.botplaceinspect"),1,true))
        ZPAdminMenu:Close()
    end
    openBots(); local bad=packet(0,1); bad.Rows[1].Place=place(); bad.Rows[1].Place.Point={1/0,0,0}
    metricsReply(bad); assert(ZPAdminMenu:GetState().BotMetricsLoading)
    bad.Rows[1].Place=place(); bad.Rows[1].Place.State="teleport"; metricsReply(bad); assert(ZPAdminMenu:GetState().BotMetricsLoading)
`));

test("descent phases and local movement rejection reasons render natively with detached projected paths", () => run(setup + `
    for _,locale in ipairs({"pt-BR","de","ru","ja","zh-CN","he"}) do for _,rejection in ipairs({"fall","ground","occupied"}) do
        selectedLocale=locale; openBots(); local data=packet(0,1)
        data.Rows[1].Motion={Action="forward",Mode="ground",From=840,To=841,Samples=1,Reward=0,Progress=0,Attempts=1,Successes=0,Failures=0,
            Seconds=2,Stuck=0,Breath=0,Goals=0,Recoveries=0,Water=0,Ladders=0,Harm=0,Keys=8,Look=0,
            Path={},Values={0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},Passage={0,0,0},
            Navigation={Reason=rejection,Phase="align",From=840,To=841,Height=-220,Damage=27,Path={0,0,220,20,0,220,60,0,220,100,0,0}}}
        metricsReply(data)
        local card=activeFrame().children[3].children[4].children[4]; card.children[7]:DoClick(); card.children[4]:DoClick()
        local labels={}; draw.DrawText=function(text) labels[#labels+1]=text end
        card.children[2]:Paint(card.children[2].w,card.children[2].h)
        local reason,found=language.GetPhrase("zombieplague.botnavreason"..rejection),false
        local fitted=include("cl_bot_decision_graph.lua").fitted(reason,card.children[2].w*0.48-16)
        for _,label in ipairs(labels) do if label==fitted then found=true end; assert(not label:find("zombieplague.",1,true)) end
        assert(found and card.children[5].text:find(reason,1,true),locale..": "..rejection)
        local state=ZPAdminMenu:GetState(); state.BotMetrics.Rows[1].Motion.Navigation.Path[1]=999
        assert(ZPAdminMenu:GetState().BotMetrics.Rows[1].Motion.Navigation.Path[1]==0)
        ZPAdminMenu:Close()
    end end
`));
