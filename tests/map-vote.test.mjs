import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";

const server = `
local now=10
function CurTime() return now end
ROUND_VOTEMAP,ROUND_CHANGING_MAP=5,6
local players,maps,values={},{"zm_current.bsp","de_bad.bsp"},{}
for i=1,12 do maps[#maps+1]="zm_map"..i..".bsp" end
file.Find=function() return maps,{} end
game={GetMap=function() return "zm_current" end}
ALLOWED_PREFIX={"zm_"}
string.StartWith=function(text,prefix) return text:sub(1,#prefix)==prefix end
cvars.Number=function(name,fallback) if values[name]~=nil then return values[name] end return fallback end
cvars.Bool=cvars.Number
cvars.String=function(name,fallback) return tostring(values[name] or fallback) end
RoundManager={state=ROUND_PLAYING,extensions=0}
function RoundManager:GetRoundState() return self.state end
function RoundManager:SetRoundState(state) self.state=state end
function RoundManager:SetTimer(seconds,callback) self.seconds,self.callback=seconds,callback end
function RoundManager:AddExtraRounds(count) self.extensions=self.extensions+count end
function RoundManager:TryNewRound() self.restarted=true end
player={GetAll=function() return players end}
local events={}
net.Send=function(ply) events[#events+1]={ply=ply,snapshot=sent[2]} end
concommand={Add=function(name,action) commands[name]=action end}
local message,console
function SendColorMessage(_,text) message=text end
function SendConsoleMessage(_,text) console=text end
local changed
function RunConsoleCommand(command,map) changed={command,map} end
local function newPlayer(id,bot)
    local ply={SteamID64=function() return id end,IsBot=function() return bot==true end}
    players[#players+1]=ply
    return ply
end
local a,b=newPlayer("76561198000000001"),newPlayer("76561198000000002")
include("sh_map_vote_protocol.lua"); include("sv_votemap.lua"); include("sv_map_nominations.lua")
local function vote(ply,map,id)
    readTable={Version=1,ID=id or 1,Map=map}
    receivers.ZPMapVoteSelect(512,ply)
end
`;

test("eight eligible maps plus extension prioritize nominations without duplicate candidates", () => run(server + `
    commands.nominate(a,{"zm_map12"}); assert(message.Phrase=="zombieplague.mapvotenominated")
    commands.nominate(b,{"zm_map12"})
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    local snapshot=events[#events].snapshot
    assert(#snapshot.Entries==9 and snapshot.Entries[1].Map=="zm_map12")
    assert(snapshot.Entries[9].Extend and RoundManager.seconds==20)
    local seen={}
    for _,entry in ipairs(snapshot.Entries) do
        assert(not seen[entry.Map] and entry.Map~="de_bad"); seen[entry.Map]=true
    end
    assert(seen.zm_current)
    local count=#events; ZPVoteMap:StartVotemap(ALLOWED_PREFIX); assert(#events==count)
`));

test("nomination commands validate installed maps, replace per-player choices and lock during the vote", () => run(server + `
    commands.nominate(a,{"../zm_map12"}); assert(message.Phrase=="zombieplague.mapvoteusage")
    now=12; commands.nominate(a,{"de_bad"}); assert(message.Phrase=="zombieplague.mapvoteinvalid")
    now=14; commands.nominate(a,{"zm_map11"})
    now=16; commands.nominate(a,{"zm_map12"})
    assert(ZPMapNominations:Candidates(ALLOWED_PREFIX,1)[1]=="zm_map12")
    now=18; commands.nominate(a,{"zm_current"}); assert(message.Phrase=="zombieplague.mapvoteinvalid")
    ZPMapNominations:Remove(a)
    commands.nominar(b,{"zm_map10"}); assert(ZPMapNominations:Candidates(ALLOWED_PREFIX,1)[1]=="zm_map10")
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    now=20; commands.nominate(b,{"zm_map12"}); assert(message.Phrase=="zombieplague.mapvotelocked")
`));

test("votes are authoritative, replaceable, bounded and broadcast with each recipient's selection", () => run(server + `
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    local first,second=events[1].snapshot.Entries[1].Map,events[1].snapshot.Entries[2].Map
    vote(a,first); assert(ZPVoteMap.MapsToVote[first]==1)
    local count=#events
    vote(a,first); vote(a,second); assert(#events==count)
    now=11; vote(a,second)
    assert(ZPVoteMap.MapsToVote[first]==0 and ZPVoteMap.MapsToVote[second]==1)
    assert(events[#events-1].snapshot.Selected==second and events[#events].snapshot.Selected=="")
    vote(b,second); assert(ZPVoteMap.MapsToVote[second]==2)
    now=12; vote(a,"unknown"); vote(a,first,999); assert(ZPVoteMap.MapsToVote[second]==2)
    readTable={}; receivers.ZPMapVoteSelect(512,a)
    readTable={Version=1,ID=1,Map=first}; receivers.ZPMapVoteSelect(5000,a)
    local bot=newPlayer("0",true); vote(bot,first); assert(ZPVoteMap.MapsToVote[first]==0)
    ZPVoteMap:Remove(a); assert(ZPVoteMap.MapsToVote[second]==1)
    now=30; vote(a,first); assert(ZPVoteMap.MapsToVote[first]==0)
`));

test("late clients receive current votes, map changes run once and expired packets are rejected", () => run(server + `
    values.zp_can_repeat_map=false
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    assert(#events[1].snapshot.Entries==8)
    local map=events[1].snapshot.Entries[1].Map
    vote(a,map)
    now=15; local late=newPlayer("76561198000000003")
    hooks.ZPPlayerEnvironmentReady.ZPMapVoteReady(late)
    assert(sent[2].Remaining==15 and sent[2].Entries[1].Votes==1 and sent[2].Selected=="")
    ZPVoteMap:EndVotemap()
    assert(not ZPVoteMap.Voting and sent[2].Winner==map and RoundManager.state==6 and RoundManager.seconds==5)
    RoundManager.callback(); assert(changed[1]=="changelevel" and changed[2]==map)
    local count=#events; ZPVoteMap:EndVotemap(); assert(#events==count)
    vote(b,map); assert(ZPVoteMap.MapsToVote[map]==1)
`));

test("extension, empty candidate fallback, clamped settings and random ties keep the round lifecycle valid", () => run(server + `
    values.zp_maps_to_vote=100
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX); assert(#sent[2].Entries==9)
    vote(a,"zm_current"); ZPVoteMap:EndVotemap()
    assert(RoundManager.extensions==5 and sent[2].Winner=="zm_current", "extension winner")
    RoundManager.callback(); assert(RoundManager.restarted)
    values.zp_can_repeat_map=false; maps={"de_bad.bsp"}
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    assert(not ZPVoteMap.Voting and RoundManager.extensions==10, "empty vote fallback")
    maps={"zm_a.bsp","zm_b.bsp"}; values.zp_maps_to_vote=8
    ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    math.random=function(low,high) assert(low==1 and high==2); return 2 end
    ZPVoteMap:EndVotemap(); assert(sent[2].Winner~="")
`));

const client = clientSetup + panelsSetup + `
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
include("sh_map_vote_protocol.lua"); include("cl_map_vote_hud.lua"); include("cl_map_vote.lua")
local paths,loads,textures,rendered={},0,0,{}
file.Exists=function(path) return path=="maps/thumb/zm_a.png" end
function Material(path) paths[#paths+1]=path; loads=loads+1; return {IsError=function() return false end} end
surface.SetDrawColor=function() end
surface.SetMaterial=function() end
surface.DrawTexturedRect=function() textures=textures+1 end
language.GetPhrase=function(key)
    if key=="zombieplague.mapvoteremaining" then return "%d s" end
    if key=="zombieplague.mapvotewinner" then return "Winner: %s" end
    if key=="zombieplague.mapvotevotes" then return "Votes: %d" end
    return key
end
draw.DrawText=function(text) rendered[text]=true end
local function receive(data)
    readTable=data; receivers.ZPMapVoteSnapshot(4096)
end
local function state(id,selected,voting,winner)
    return {Version=1,ID=id or 1,Voting=voting~=false,Remaining=20,Selected=selected or "",Winner=winner or "",
        Entries={{Map="zm_a",Votes=1,Extend=false},{Map="zm_b",Votes=0,Extend=false},{Map="zm_current",Votes=0,Extend=true}}}
end
local function liveFrame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
`;

test("vote UI opens automatically, keeps panels and scroll during live counts, and waits for confirmed selections", () => run(client + `
    receive(state()); local frame=liveFrame(); assert(frame and not frame.keyboard, "automatic open")
    local count=#panels; paintAll(); assert(loads==1 and textures>0, "native thumbnail")
    ZPMapVoteMenu:Select("zm_b"); assert(sent[1]=="ZPMapVoteSelect" and sent[2].Map=="zm_b")
    assert(ZPMapVoteMenu:GetSnapshot().Selected=="")
    local update=state(1,"zm_b"); update.Entries[1].Votes=0; update.Entries[2].Votes=2
    receive(update); paintAll()
    assert(#panels==count, "panel count")
    assert(liveFrame()==frame, "same frame")
    assert(loads==1, "thumbnail cache")
    assert(rendered["Votes: 2"], "live counts")
    assert(rendered["zombieplague.mapvoteselected"])
    local copy=ZPMapVoteMenu:GetSnapshot(); copy.Entries[1].Votes=999
    assert(ZPMapVoteMenu:GetSnapshot().Entries[1].Votes==0)
    ZPMapVoteMenu:Close(); receive(update); assert(not liveFrame())
    consoleCommands.zp_votemap(); assert(liveFrame())
`));

test("vote menus preserve votes through all themes, escape, final result and the next voting session", () => run(client + `
    receive(state()); local previous=liveFrame()
    for _,theme in ipairs({"hl2","cs16","classic"}) do
        assert(ZPThemes:UseTheme(theme)); assert(previous.removed)
        previous=liveFrame(); assert(previous and ZPMapVoteMenu:GetSnapshot().ID==1); paintAll()
    end
    local result=state(1,"zm_a",false,"zm_a"); result.Remaining=5
    receive(result); paintAll(); assert(rendered["Winner: zm_a"])
    ZPMapVoteMenu:Select("zm_b"); assert(requests==0)
    now=16; hooks.Think.ZPMapVoteMenu(); assert(not liveFrame())
    receive(state(2)); assert(liveFrame())
    input.IsKeyDown=function() return true end; hooks.Think.ZPMapVoteMenu(); assert(not liveFrame())
    input.IsKeyDown=function() return false end
    receive(state(2)); assert(not liveFrame())
    receivers.ZPMapVoteOpen(); assert(liveFrame())
    receive(state(3)); assert(liveFrame() and previous.removed)
`));

test("malformed snapshots and choices cannot open menus or trigger votes", () => run(client + `
    receive({}); assert(not liveFrame())
    local invalid=state(); invalid.Entries[2].Map="zm_a"; receive(invalid); assert(not liveFrame())
    invalid=state(); invalid.Remaining=0/0; receive(invalid); assert(not liveFrame())
    invalid=state(); invalid.Selected="unknown"; receive(invalid); assert(not liveFrame())
    invalid=state(); invalid.Entries[2].Map="../map"; receive(invalid); assert(not liveFrame())
    receive(state()); ZPMapVoteMenu:Select("unknown"); assert(requests==0)
    readTable=state(2); receivers.ZPMapVoteSnapshot(40000); assert(ZPMapVoteMenu:GetSnapshot().ID==1)
    now=31; ZPMapVoteMenu:Select("zm_b"); assert(requests==0)
`));
