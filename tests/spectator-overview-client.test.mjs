import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { panelsSetup } from "./helpers/weapon-menu.mjs";

const setup = `surface={}
` + panelsSetup + `
local now,theme=10,"classic"
function CurTime() return now end
local viewer={alive=false,team=TEAM_SPECTATOR}
function viewer:Alive() return self.alive end
function viewer:Team() return self.team end
LocalPlayer=function() return viewer end
local missing=false
Material=function(path) return {path=path,IsError=function() return missing==path end} end
CreateClientConVar=function() return {GetBool=function() return true end} end
local requests=0
net.SendToServer=function() requests=requests+1 end
net.WriteUInt=function(value) sent[#sent+1]=value end
input={LookupBinding=function() return "space" end}
local palettes={}
for _,id in ipairs({"classic","hl2","cs16","addon"}) do palettes[id]={Surface=Color(15,20,25,100),Panel=Color(25,30,35),Accent=Color(60,180,90),Text=Color(240,240,240),Muted=Color(140,140,140)} end
palettes.addon={Surface=Color(245,246,247,100),Panel=Color(215,220,225),Accent=Color(30,130,80),Text=Color(20,25,30),Muted=Color(80,85,90)}
ZPThemes={GetActiveID=function() return theme end,GetTheme=function() return {Palette=palettes[theme]} end}
HUMANS_COLOR,ZOMBIES_COLOR,NEMESIS_COLOR=Color(71,141,255),Color(255,56,56),Color(255,0,0)
local images,texts,boxes,polygons={},{},{},{}
surface.SetDrawColor=function() end
surface.SetMaterial=function(image) images[#images+1]=image.path end
surface.DrawTexturedRect=function() end
surface.DrawPoly=function(points)
    local area=0;for i=1,#points do local a,b=points[i],points[i%#points+1];area=area+a.x*b.y-b.x*a.y end
    assert(area>0,"Direction markers must use the engine's clockwise winding")
    polygons[#polygons+1]=points
end
draw.NoTexture=function() end
draw.RoundedBox=function(radius,x,y,w,h,color) boxes[#boxes+1]={Radius=radius,Color=color} end
draw.DrawText=function(text) texts[text]=true end
function panelMeta:LocalCursorPos() return self.cursorX or 0,self.cursorY or 0 end
language.GetPhrase=function(key) if key=="zombieplague.radarlevel" then return "Floor %d / %d" end
    if key=="zombieplague.overviewhelp" then return "Change view: %s" end;return key end
include("sh_radar_rules.lua");include("sh_spectator_protocol.lua");include("cl_menu_controls.lua")
include("cl_radar.lua");include("cl_spectator_overview.lua")
local definition={Material="map.png",X=0,Y=1024,Scale=1,Size=1024,Layers={{Material="lower.png",MinZ=-100,MaxZ=100},{Material="upper.png",MinZ=100,MaxZ=300}}}
local function configure() readTable=definition;receivers.ZPRadarOverview(100);requests=0 end
local function contact(id,x,z) return {ID=id,Name="Player "..id,Team=TEAM_HUMANS,Position={x=x,y=512,z=z or 0},Yaw=0} end
local function packet() return {Version=1,Team=viewer.team,Active=true,Restricted=false,Contacts={contact(1,512),contact(2,800,200)}} end
local function receive(data,length) readTable=data;receivers.ZPSpectatorOverviewState(length or 100) end
local function tick() hooks.Think.ZPSpectatorOverview() end
local function panel(kind) for _,p in ipairs(panels) do if p.kind==kind and not p.removed then return p end end end
local function mapPanel() for _,p in ipairs(panels) do if p.kind=="DPanel" and (p.w or 0)>100 and not p.removed then return p end end end
configure()
`;

test("overview uses an opaque full-screen map, themed floor selector and live marker clicks", () => run(setup + `
    local data=packet();data.Contacts[1].Role="survivor";data.Contacts[2].Role="nemesis";data.Contacts[2].Team=TEAM_ZOMBIES
    receive(data);assert(ZPSpectatorOverview:IsOpen())
    local frame=panel("DFrame");assert(frame.w==1280 and frame.h==720 and frame.keyboard==false)
    local combo=panel("DComboBox");assert(#combo.choices==3 and not combo.sorted and combo.OnMenuOpened)
    local map=mapPanel();map.cursorX=map.w/2;map.cursorY=map.h/2;paintAll()
    assert(boxes[1].Color.a==255 and images[#images]=="map.png")
    assert(texts["Player 1"] and texts["zombieplague.radarsurvivormarker"] and texts["zombieplague.radarnemesismarker"])
    combo:OnSelect(3,"Floor 2 / 2",1);paintAll();assert(images[#images]=="upper.png")
    map:OnMousePressed(MOUSE_LEFT);assert(requests==1 and sent[1]=="ZPSpectatorOverviewFollow" and sent[2]==1)
    assert(ZPSpectatorOverview:IsOpen(),"Only the server reply ends observation")
    data.Active=false;data.Contacts={};receive(data);assert(frame.removed and combo.removed and not ZPSpectatorOverview:IsOpen())
`));

test("jump binding closes the overview and commands cannot move or attack through its controls", () => run(setup + `
    receive(packet());local command={ClearButtons=function(self) self.buttons=true end,ClearMovement=function(self) self.movement=true end}
    hooks.CreateMove.ZPSpectatorOverview(command);assert(command.buttons and command.movement)
    local bind=hooks.PlayerBindPress.ZPSpectatorOverview
    assert(not bind(viewer,"+jump",false));assert(not bind(viewer,"+attack",true))
    assert(bind(viewer,"+jump",true)==true and sent[2]==0)
    local closed=packet();closed.Active=false;closed.Contacts={};receive(closed)
    command.buttons=false;hooks.CreateMove.ZPSpectatorOverview(command);assert(command.buttons,"The close click cannot fire an engine action")
    now=11;command.buttons=false;hooks.CreateMove.ZPSpectatorOverview(command);assert(not command.buttons)
`));

test("respawn, team changes, expired packets and missing textures close and clear the view", () => run(setup + `
    receive(packet());local frame=panel("DFrame");viewer.alive=true;tick();assert(frame.removed and not ZPSpectatorOverview:IsOpen())
    receive(packet());assert(not ZPSpectatorOverview:IsOpen(),"Late packets cannot expose a previous life")
    viewer.alive=false;receive(packet());viewer.team=TEAM_HUMANS;tick();assert(not ZPSpectatorOverview:IsOpen())
    receive(packet());now=11.6;tick();assert(not ZPSpectatorOverview:IsOpen())
    receive(packet());missing="upper.png";configure();tick();assert(not ZPSpectatorOverview:IsOpen())
`));

test("theme and resolution changes rebuild controls, including addon palettes and disabled single-floor selection", () => run(setup + `
    for _,id in ipairs({"classic","hl2","cs16","addon"}) do
        theme=id;receive(packet());tick();local combo=panel("DComboBox");boxes={};combo:Paint(combo.w,combo.h)
        assert(boxes[1].Radius==((id=="hl2" or id=="cs16") and 0 or 4))
        assert(boxes[2].Color==palettes[id].Panel)
    end
    boxes={};paintAll();local themedLabel=false
    for _,box in ipairs(boxes) do if box.Color.a==220 and box.Color.r==palettes.addon.Surface.r then themedLabel=true end end
    assert(themedLabel,"Map labels must remain readable with light addon palettes")
    local frame=panel("DFrame");ScrW=function() return 800 end;tick();assert(frame.removed and panel("DFrame").w==800)
    definition.Layers=nil;configure();receive(packet());assert(not panel("DComboBox"):IsEnabled())
`));

test("protocol rejects malformed or oversized snapshots, unauthorized contacts and duplicate IDs", () => run(setup + `
    local data=packet();assert(ZPSpectatorProtocol.Snapshot(data))
    data.Contacts[1].Yaw=0/0;assert(not ZPSpectatorProtocol.Snapshot(data));data.Contacts[1].Yaw=0
    data.Contacts[1].Name={};assert(not ZPSpectatorProtocol.Snapshot(data));data.Contacts[1].Name="Human"
    data.Contacts[2].ID=1;assert(not ZPSpectatorProtocol.Snapshot(data));data.Contacts[2].ID=2
    data.Team=TEAM_HUMANS;data.Restricted=true;data.Contacts[2].Team=TEAM_ZOMBIES;assert(not ZPSpectatorProtocol.Snapshot(data))
    data=packet();data.Active=false;assert(not ZPSpectatorProtocol.Snapshot(data))
    data=packet();for id=3,129 do data.Contacts[id]=contact(id,0) end;assert(not ZPSpectatorProtocol.Snapshot(data))
    receive(packet(),524289);assert(not ZPSpectatorOverview:IsOpen())
    local projection=include("cl_spectator_overview_map.lua");local points=projection.markers(definition,packet(),100)
    assert(projection.hit(points,50,50)==1 and projection.hit(points,0,0)==nil)
`));
