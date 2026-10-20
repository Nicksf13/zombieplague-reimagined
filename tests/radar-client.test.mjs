import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { books, locales } from "./helpers/native-localization.mjs";

const rules = `include("sh_radar_rules.lua")\n`;
const client = rules + `
local now=10
CurTime=function() return now end
local visible=true
CreateClientConVar=function() return {GetBool=function() return visible end,SetBool=function(_,v) visible=v end} end
local viewer={alive=true,team=TEAM_HUMANS,z=0,ground=true,water=0,move=2}
function viewer:Alive() return self.alive end
function viewer:Team() return self.team end
function viewer:GetPos() return {x=0,y=0,z=self.z} end
function viewer:EyeAngles() return {y=0} end
function viewer:OnGround() return self.ground end
function viewer:WaterLevel() return self.water end
function viewer:GetMoveType() return self.move end
MOVETYPE_LADDER,MOVETYPE_NOCLIP=9,8
LocalPlayer=function() return viewer end
local errorMaterial=false
Material=function(path) return {path=path,IsError=function() return errorMaterial==true or errorMaterial==path end} end
ZPThemes={GetTheme=function() return {Palette={}} end,GetActiveID=function() return "classic" end}
net.SendToServer=function() end
local hidden=false
hook.Call=function() if hidden then return false end end
local paints,selected,imagePath=0,nil,nil
local originalInclude=include
include=function(path)
    if path=="cl_radar_hud.lua" then return {paintRadar=function(map,image,state,pos,yaw,palette,theme,layer)
        paints=paints+1; selected=layer; imagePath=image.path
    end} end
    return originalInclude(path)
end
include("cl_radar.lua")
local overview={Material="zombieplague/radar/gm_construct.png",X=-1000,Y=1000,Scale=2,Size=1024}
local function configure(value) readTable=value; receivers.ZPRadarOverview(100) end
local function receive(value) readTable=value; receivers.ZPRadarState(100) end
local function snapshot() return {Version=1,Team=TEAM_HUMANS,Enabled=true,ScanUntil=0,Contacts={}} end
configure(overview)
`;

test("radar coordinates and continuous distance falloff have explicit bounds", () => run(rules + `
    local map={X=-1000,Y=1000,Scale=2,Size=1000}
    local point=ZPRadarRules.Point(map,{x=0,y=0,z=10000})
    assert(point.x==0.5 and point.y==0.5)
    assert(ZPRadarRules.Lifetime(0,1000,0.4,3)==3)
    assert(math.abs(ZPRadarRules.Lifetime(500,1000,0.4,3)-1.7)<0.001)
    assert(math.abs(ZPRadarRules.Lifetime(1000,1000,0.4,3)-0.4)<0.001)
    assert(ZPRadarRules.Lifetime(1001,1000,0.4,3)==nil and ZPRadarRules.Lifetime(0,0,0.4,3)==nil)
    assert(ZPRadarRules.Lifetime(0,1000,3,0.4)==3,"Reversed duration settings must remain distance ordered")
`));

test("client rejects invalid overviews, coordinates, sources and unbounded snapshots", () => run(rules + `
    local map={Material="zombieplague/map.png",X=0,Y=0,Scale=1,Size=1024}
    assert(ZPRadarRules.Overview(map))
    map.Material="../cfg/server.cfg"; assert(not ZPRadarRules.Overview(map))
    map.Material="safe.png"; map.Scale=0; assert(not ZPRadarRules.Overview(map))
    map.Scale=0/0; assert(not ZPRadarRules.Overview(map))
    local contact={ID=2,Position={x=1,y=2,z=3},Source="attack",Created=10,Expires=13}
    local data={Version=1,Team=TEAM_HUMANS,Enabled=true,ScanUntil=0,Contacts={contact}}
    assert(ZPRadarRules.Snapshot(data,10))
    contact.Source="ally"
    assert(ZPRadarRules.Snapshot(data,10).Contacts[1].Source=="ally")
    contact.Source="attack"
    contact.Position.x=math.huge; assert(not ZPRadarRules.Snapshot(data,10)); contact.Position.x=1
    contact.Source="tracking"; assert(not ZPRadarRules.Snapshot(data,10)); contact.Source="scan"
    contact.Expires=1000; assert(not ZPRadarRules.Snapshot(data,10)); contact.Expires=13
    data.Contacts={contact,contact}; assert(not ZPRadarRules.Snapshot(data,10))
    data.Contacts={}; for id=1,129 do data.Contacts[id]={ID=id,Position={x=1,y=2,z=3},Source="scan",Created=10,Expires=11} end
    assert(not ZPRadarRules.Snapshot(data,10))
`));

test("personal hiding, disabled state, death, team changes, stale state and bad materials suppress the HUD", () => run(client + `
    assert(sent[1]=="ZPRadarReady" and sent[2]==true)
    receive(snapshot()); ZPRadar:Paint(); assert(paints==1)
    hidden=true; ZPRadar:Paint(); assert(paints==1); hidden=false
    ZPRadar:SetVisible(false); ZPRadar:Paint(); assert(paints==1 and not ZPRadar:IsVisible())
    ZPRadar:SetVisible(true); viewer.alive=false; ZPRadar:Paint(); assert(paints==1)
    viewer.alive=true; viewer.team=TEAM_ZOMBIES; ZPRadar:Paint(); assert(paints==1)
    viewer.team=TEAM_HUMANS; now=16; ZPRadar:Paint(); assert(paints==1)
    now=10; local off=snapshot(); off.Enabled=false; receive(off); ZPRadar:Paint(); assert(paints==1)
    errorMaterial=true; configure(overview); assert(sent[2]==false)
    receive(snapshot()); ZPRadar:Paint(); assert(paints==1)
`));

test("all radar captions and scan format parameters exist in every supported language", () => {
    const keys = "radartitle|radarmode|radarallies|radarpaid|radarfree|radarshotrange|radarmeleerange|radarmarkmin|radarmarkmax|radarscanduration|radarscaninterval|radarscanrange|radarprice|radarshow|radarscanning|radarlevel|extraitemradarname".split("|");
    for (const locale of locales) {
        for (const key of keys) assert(books[locale]["zombieplague." + key]?.trim(), `${locale}: ${key}`);
        assert.equal((books[locale]["zombieplague.radarscanning"].match(/%[sdif]/g) ?? []).join(), "%d");
    }
});

test("floor metadata is normalized, bounded and rejects overlap, reversed ranges and unsafe paths", () => run(rules + `
    local base={Material="map.png",X=0,Y=0,Scale=1,Size=1024}
    base.Layers={{Material="upper.png",MinZ=100,MaxZ=1000},{Material="lower.png",MinZ=-1000,MaxZ=100}}
    local map=ZPRadarRules.Overview(base)
    assert(map.Layers[1].Material=="lower.png" and base.Layers[1].Material=="upper.png")
    base.Layers[1].MinZ=99; assert(not ZPRadarRules.Overview(base))
    base.Layers[1].MinZ=1000; assert(not ZPRadarRules.Overview(base))
    base.Layers[1].MinZ=100; base.Layers[1].Material="../invalid.png"; assert(not ZPRadarRules.Overview(base))
    base.Layers={}; for i=1,64 do base.Layers[i]={Material="floor.png",MinZ=i*100,MaxZ=i*100+100} end
    assert(ZPRadarRules.Overview(base),"Tall maps must support up to 64 layers")
    base.Layers[65]={Material="floor.png",MinZ=6500,MaxZ=6600}
    assert(not ZPRadarRules.Overview(base))
`));

test("floor selection has hysteresis, gaps fall back to the full map, and arrows use sampled height", () => run(rules + `
    local map={Layers={{Material="lower.png",MinZ=-1000,MaxZ=100},{Material="upper.png",MinZ=100,MaxZ=1000}}}
    assert(ZPRadarRules.Layer(map,99)==0 and ZPRadarRules.Layer(map,100)==1)
    assert(ZPRadarRules.Layer(map,115,0)==0 and ZPRadarRules.Layer(map,116,0)==1)
    assert(ZPRadarRules.Layer(map,84,1)==1 and ZPRadarRules.Layer(map,83,1)==0)
    assert(ZPRadarRules.Layer(map,1500,1)==nil and ZPRadarRules.Layer({},0)==nil)
    assert(ZPRadarRules.Elevation(map.Layers[1],116)==1)
    assert(ZPRadarRules.Elevation(map.Layers[2],83)==-1)
    assert(ZPRadarRules.Elevation(map.Layers[1],0)==0 and ZPRadarRules.Elevation(nil,500)==0)
`));

test("client accepts larger metadata packets for tall maps with 64 floor materials", () => run(client + `
    overview.Layers={}
    for index=1,64 do overview.Layers[index]={Material="floor_"..index..".png",MinZ=(index-1)*100,MaxZ=index*100} end
    readTable=overview;receivers.ZPRadarOverview(120000)
    assert(sent[1]=="ZPRadarReady" and sent[2]==true)
    receive(snapshot());ZPRadar:Paint();assert(paints==1 and imagePath=="floor_1.png")
`));

test("the HUD changes floor textures on stairs, ladders and water but does not follow ordinary jumps", () => run(client + `
    overview.Layers={{Material="lower.png",MinZ=-1000,MaxZ=100},{Material="upper.png",MinZ=100,MaxZ=1000}}
    configure(overview); receive(snapshot()); ZPRadar:Paint()
    assert(selected==0 and imagePath=="lower.png")
    viewer.z=200; viewer.ground=false; ZPRadar:Paint(); assert(selected==0)
    viewer.ground=true; ZPRadar:Paint(); assert(selected==1 and imagePath=="upper.png")
    viewer.z=90; ZPRadar:Paint(); assert(selected==1)
    viewer.z=80; ZPRadar:Paint(); assert(selected==0)
    viewer.z=200; viewer.ground=false; viewer.water=2; ZPRadar:Paint(); assert(selected==1)
    viewer.water=0; viewer.z=0; viewer.move=MOVETYPE_LADDER; ZPRadar:Paint(); assert(selected==0)
    viewer.z=200; viewer.move=MOVETYPE_NOCLIP; ZPRadar:Paint(); assert(selected==1)
    local off=snapshot(); off.Enabled=false; receive(off)
    viewer.z=0; viewer.move=2; receive(snapshot()); ZPRadar:Paint(); assert(selected==0)
    viewer.ground=true; viewer.z=1500; ZPRadar:Paint()
    assert(selected==nil and imagePath==overview.Material)
`));

test("a missing layer texture prevents the client from advertising a usable radar", () => run(client + `
    overview.Layers={{Material="missing.png",MinZ=-1000,MaxZ=1000}}
    errorMaterial="missing.png"; configure(overview)
    assert(sent[1]=="ZPRadarReady" and sent[2]==false)
    receive(snapshot()); ZPRadar:Paint(); assert(paints==0)
`));

