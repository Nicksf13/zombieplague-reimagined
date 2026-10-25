import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
local now,eye=10,{x=0,y=0,z=64}
function CurTime() return now end
function EyePos() return eye end
function Vector(x,y,z) return {x=x,y=y,z=z} end
NEMESIS_COLOR,SURVIVOR_COLOR=Color(255,0,0),Color(0,0,255)
OBS_MODE_IN_EYE=4
local materials,beams,sprites={},{},{}
local material
local function texture(name,errorTexture)
    return {GetName=function() return name end,IsError=function() return false end,
        IsErrorTexture=function() return errorTexture==true end}
end
local textures={
    ["sprites/laserbeam"]=texture("sprites/laserbeam"),
    ["sprites/light_glow02"]=texture("sprites/light_glow02")
}
local sourceMaterials={
    ["sprites/laserbeam"]={texture=textures["sprites/laserbeam"]},
    ["sprites/light_glow02_add"]={texture=textures["sprites/light_glow02"]}
}
function Material(path)
    local source=sourceMaterials[path]
    return {IsError=function() return not source or source.missing==true end,
        GetTexture=function(_,parameter) assert(parameter=="$basetexture");return source and source.texture end}
end
function CreateMaterial(name,shader,parameters)
    assert(shader=="UnlitGeneric" and parameters["$ignorez"]==0 and parameters["$additive"]==1)
    assert(parameters["$vertexcolor"]==1 and parameters["$vertexalpha"]==1)
    assert(textures[parameters["$basetexture"]],"CreateMaterial requires a texture name, not a VMT name")
    materials[name]=materials[name] or {name=name,texture=textures[parameters["$basetexture"]],
        SetTexture=function(self,parameter,value) assert(parameter=="$basetexture");self.texture=value end}
    return materials[name]
end
local function copyColor(color) return Color(color.r,color.g,color.b,color.a) end
render={
    SetMaterial=function(value) material=value end,
    DrawBeam=function(start,finish,width,textureStart,textureEnd,color)
        assert(material==materials.zp_special_aura_ribbon)
        assert(material.texture==textures["sprites/laserbeam"])
        beams[#beams+1]={start=start,finish=finish,width=width,color=copyColor(color)}
    end,
    DrawSprite=function(position,width,height,color)
        assert(material==materials.zp_special_aura_glow)
        assert(material.texture==textures["sprites/light_glow02"])
        sprites[#sprites+1]={position=position,width=width,height=height,color=copyColor(color)}
    end
}
local meta={}
function meta:Alive() return not self.dead end
function meta:IsDormant() return self.dormant==true end
function meta:GetNoDraw() return self.hidden==true end
function meta:IsNemesis() return self.Nemesis end
function meta:IsSurvivor() return self.Survivor end
function meta:IsZombie() return self.team==TEAM_ZOMBIES end
function meta:IsHuman() return self.team==TEAM_HUMANS end
function meta:GetPos() return self.position end
function meta:EntIndex() return self.index end
function meta:OBBMins() return Vector(-16,-16,0) end
function meta:OBBMaxs() return Vector(16,16,self.height or 72) end
function meta:ShouldDrawLocalPlayer() return self.thirdPerson==true end
function meta:GetObserverMode() return self.observerMode or 0 end
function meta:GetObserverTarget() return self.target end
local function makePlayer(index,team)
    return setmetatable({index=index,team=team,position=Vector(100,0,0)},{__index=meta})
end
local viewer=makePlayer(1,TEAM_HUMANS)
local nemesis,survivor,normal=makePlayer(2,TEAM_ZOMBIES),makePlayer(3,TEAM_HUMANS),makePlayer(4,TEAM_HUMANS)
nemesis.Nemesis=true;survivor.Survivor=true
local players={nemesis,survivor,normal}
player={GetAll=function() return players end}
function LocalPlayer() return viewer end
include("cl_special_aura.lua")
local function paint(depth,skybox)
    beams,sprites={},{}
    hooks.PostDrawTranslucentRenderables.ZPSpecialRoleAura(depth or false,skybox or false,false)
end
`;

test("aura materials resolve VMT base textures and repair the previously cached checkerboard on Lua refresh", () => run(setup + `
    local cached=materials.zp_special_aura_glow
    assert(cached.texture:GetName()=="sprites/light_glow02")
    cached.texture=texture("error",true)
    include("cl_special_aura.lua");paint()
    assert(materials.zp_special_aura_glow==cached)
    assert(cached.texture==textures["sprites/light_glow02"] and #beams>0 and #sprites>0)
`));

test("missing materials or missing and error textures skip only the unavailable aura layer", () => run(setup + `
    local source=sourceMaterials["sprites/light_glow02_add"]
    source.missing=true
    include("cl_special_aura.lua");paint();assert(#beams>0 and #sprites==0)
    source.missing=false;source.texture=nil
    include("cl_special_aura.lua");paint();assert(#beams>0 and #sprites==0)
    source.texture=texture("error",true)
    include("cl_special_aura.lua");paint();assert(#beams>0 and #sprites==0)
    source.texture={IsError=function() return true end,IsErrorTexture=function() return false end}
    include("cl_special_aura.lua");paint();assert(#beams>0 and #sprites==0)
    source.texture=textures["sprites/light_glow02"]
    sourceMaterials["sprites/laserbeam"].missing=true
    include("cl_special_aura.lua");paint();assert(#beams==0 and #sprites>0)
    sourceMaterials["sprites/laserbeam"].missing=false
    include("cl_special_aura.lua");paint();assert(#beams>0 and #sprites>0)
`));

test("special roles have animated red and blue plasma, without adding an aura to normal players", () => run(setup + `
    paint()
    assert(#beams>0 and #sprites>0)
    local red,blue=false,false
    for _,beam in ipairs(beams) do
        assert(beam.width>0 and beam.color.a>0 and beam.color.a<=255)
        red=red or beam.color.r>beam.color.b
        blue=blue or beam.color.b>beam.color.r
    end
    assert(red and blue)
    local before=beams[1].start
    now=10.25;paint()
    assert(beams[1].start.x~=before.x or beams[1].start.y~=before.y)
    players={normal};paint();assert(#beams==0 and #sprites==0)
    normal.Light=NEMESIS_COLOR;paint();assert(#beams==0)
`));

test("auras stop immediately on death, role removal, team changes and loss of visibility", () => run(setup + `
    players={nemesis}
    for _,field in ipairs({"dead","dormant","hidden"}) do
        nemesis[field]=true;paint();assert(#beams==0 and #sprites==0,field)
        nemesis[field]=false;paint();assert(#beams>0)
    end
    nemesis.Nemesis=false;paint();assert(#beams==0)
    nemesis.Nemesis=true;nemesis.team=TEAM_HUMANS;paint();assert(#beams==0)
    players={survivor};survivor.team=TEAM_ZOMBIES;paint();assert(#beams==0)
    players={};paint();assert(#beams==0 and #sprites==0)
`));

test("auras respect first person, spectator cameras, depth passes and the skybox", () => run(setup + `
    players={survivor};viewer=survivor
    paint();assert(#beams==0)
    viewer.thirdPerson=true;paint();assert(#beams>0)
    viewer=makePlayer(5,TEAM_SPECTATOR);viewer.target=survivor;viewer.observerMode=OBS_MODE_IN_EYE
    paint();assert(#beams==0)
    viewer.observerMode=5;paint();assert(#beams>0)
    paint(true,false);assert(#beams==0 and #sprites==0)
    paint(false,true);assert(#beams==0 and #sprites==0)
    viewer=nil;paint();assert(#beams==0)
`));

test("auras follow movement and crouching, fade at a distance, and leave no persistent effects on reload", () => run(setup + `
    players={nemesis};paint()
    local first,alpha=beams[1].start,beams[1].color.a
    nemesis.position=Vector(200,20,10);nemesis.height=36;paint()
    assert(math.abs(beams[1].start.x-first.x-100)<0.001)
    for _,beam in ipairs(beams) do assert(beam.finish.z<=46 and beam.start.z>=10) end
    eye=Vector(2500,20,10);paint();assert(#beams>0 and beams[1].color.a<alpha)
    eye=Vector(2800,20,10);paint();assert(#beams==0 and #sprites==0)
    eye=Vector(0,0,64);include("cl_special_aura.lua");paint();assert(#beams>0)
    local count=0;for _ in pairs(hooks.PostDrawTranslucentRenderables) do count=count+1 end
    assert(count==1)
    nemesis.dead=true;paint();assert(#beams==0 and #sprites==0)
`));

test("joining during a round restores special roles before drawing and rejects truthy malformed flags", () => run(setup + `
    GM={};function FindMetaTable() return meta end
    PlayerManager={DiscoverPlayerByTextID=function(_,id)
        if id=="nemesis" then return nemesis elseif id=="survivor" then return survivor end
    end}
    RoundManager={SetTimer=function() end,SetRoundState=function() end,SetRound=function() end}
    concommand={Add=function() end}
    local runtimeInclude=include
    include=function(path)
        if path=="cl_init.lua" or path=="cl_player.lua" or path=="cl_data.lua" or path=="cl_special_aura.lua" then
            return runtimeInclude(path)
        end
    end
    include("cl_init.lua")
    local function status(id,nemesisRole,survivorRole)
        return {ID=id,Battery=100,AmmoPacks=0,ZombieClass="Classic",HumanClass="Human",
            AbilityPower=0,MaxAbilityPower=100,Nemesis=nemesisRole,Survivor=survivorRole}
    end
    nemesis:SetNemesis(false);survivor:SetSurvivor(false)
    readTable={Timer=100,Round=1,RoundState=2,Players={status("nemesis",true,false),status("survivor",false,true)}}
    receivers.SendServerStatus();paint();assert(#beams>0)
    assert(nemesis:IsNemesis() and survivor:IsSurvivor())
    readTable.Players={status("nemesis","true",0),status("survivor",nil,{})}
    receivers.SendServerStatus();paint();assert(#beams==0)
    assert(not nemesis:IsNemesis() and not survivor:IsSurvivor())
    readTable.Players={status("nemesis",true,false)};receivers.SendServerStatus()
    readString,readBool="nemesis",false;receivers.SendNemesis();paint();assert(#beams==0)
    readString,readBool="survivor",true;receivers.SendSurvivor();paint();assert(#beams>0)
`));
