import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
local enabled,available,created,removed,updates=false,true,0,0,0
local position,angles,tint={x=1,y=2,z=3},{p=0,y=45,r=0},Color(0,255,0)
local ply={GetShootPos=function() return position end,EyeAngles=function() return angles end,
    GetNightvisionColor=function() return tint end}
function LocalPlayer() return ply end
function IsNightvisionOn() return enabled end
function DynamicLight() error("Nightvision must not use ambient-dependent dynamic lighting") end
local lights={}
function ProjectedTexture()
    if not available then return nil end
    created=created+1
    local light={valid=true}
    for _,field in ipairs({"Texture","FOV","NearZ","FarZ","Brightness","EnableShadows","Pos","Angles","Color"}) do
        light["Set"..field]=function(self,value) self[field]=value end
    end
    function light:IsValid() return self.valid end
    function light:Update() assert(self.valid); updates=updates+1 end
    function light:Remove() assert(self.valid); self.valid=false; removed=removed+1 end
    lights[#lights+1]=light
    return light
end
include("cl_nightvision.lua")
local function think() hooks.Think.ZPNightvisionLight() end
`;

test("nightvision illuminates a bounded forward cone, tracks class color and reuses its projected light", () => run(setup + `
    think(); assert(created==0)
    enabled=true; think()
    local light=lights[1]
    assert(created==1 and updates==1 and light.Texture=="effects/flashlight001")
    assert(light.FOV==120 and light.NearZ>0 and light.FarZ==750)
    assert(light.Brightness>0 and light.Brightness<1 and not light.EnableShadows)
    assert(light.Pos==position and light.Angles==angles and light.Color==tint)
    position={x=10,y=20,z=30}; angles={p=5,y=90,r=0}; tint=Color(255,0,0)
    think(); think()
    assert(created==1 and updates==3 and light.Pos==position and light.Angles==angles and light.Color==tint)
    enabled=false; think(); think()
    assert(removed==1 and not light.valid)
    enabled=true; think(); assert(created==2 and lights[2].valid)
`));

test("nightvision releases its light on invalid player, Lua refresh and shutdown", () => run(setup + `
    enabled=true; think()
    local previous=ply; ply=nil; think(); assert(removed==1)
    ply=previous; think(); assert(created==2)
    include("cl_nightvision.lua"); assert(removed==2 and not lights[2].valid)
    think(); assert(created==3)
    hooks.ShutDown.ZPNightvisionLight(); assert(removed==3)
    hooks.ShutDown.ZPNightvisionLight(); assert(removed==3)
`));

test("nightvision retries unavailable or invalidated projected lights without restoring the map", () => run(setup + `
    enabled=true; available=false; think(); assert(created==0)
    available=true; think(); assert(created==1)
    lights[1].valid=false; think(); assert(created==2 and removed==0 and updates==2)
`));
