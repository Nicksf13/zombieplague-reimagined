import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { bspFixture } from "./helpers/map-bsp.mjs";

const setup = `
local exposure, nightvision, downloads, writes, scans, recomputes=1, false, 0, 0, 0, 0
concommand={Add=function(name,callback) commands[name]=callback end}
net.ReadFloat=function() return exposure end
function IsNightvisionOn() return nightvision end
function Vector(x,y,z) return {x=x,y=y,z=z} end
function DrawColorModify() error("Darkness must not use a screen filter") end
local function material(shader,color,reflection)
    local m={shader=shader,values={["$color2"]=color,["$envmaptint"]=reflection,
        ["$color"]=Vector(0.9,0.7,0.5)},rendered={["$color2"]=color,["$envmaptint"]=reflection}}
    function m:GetName() return self.name end
    function m:GetShader() return self.shader end
    function m:GetVector(key) return self.values[key] end
    function m:SetVector(key,value)
        assert(key=="$color2" or key=="$envmaptint", "Do not change flashlight textures or shader flags")
        self.values[key]=value; writes=writes+1
    end
    -- Render snapshots do not change merely because a shader variable changed.
    function m:Recompute()
        self.rendered={["$color2"]=self.values["$color2"],["$envmaptint"]=self.values["$envmaptint"]}
        recomputes=recomputes+1
    end
    return m
end
local materials={
    wall=material("LightmappedGeneric",Vector(0.8,0.6,0.4),Vector(0.3,0.2,0.1)),
    ground=material("WORLDVERTEXTRANSITION",Vector(1,1,1)),
    dx9=material("LightmappedGeneric_DX9",Vector(1,1,1)),
    default=material("LightmappedGeneric"),
    water=material("Water",Vector(1,1,1)),
    sky=material("UnlitGeneric",Vector(1,1,1)),
    model=material("VertexLitGeneric",Vector(1,1,1)),
    custom=material("CustomShader",Vector(1,1,1)),
    missing=material("shader_error",Vector(1,1,1))
}
for name,m in pairs(materials) do m.name=name end
materials.sky.name="skybox/test"
file.Open=function() return nil end
local world={}
function world:IsWorld() return true end
function world:IsValid() return false end
local originalIsValid=IsValid
function IsValid(value)
    if value==world then return value:IsValid() end
    return originalIsValid(value)
end
function world:GetMaterials() return {} end
function world:GetBrushSurfaces()
    scans=scans+1
    local surfaces={}
    for _,name in ipairs({"wall","ground","dx9","default","water","sky","model","custom","missing","wall"}) do
        local m=materials[name]
        surfaces[#surfaces+1]={GetMaterial=function() return m end}
    end
    return surfaces
end
game={GetWorld=function() return world end,GetMap=function() return "gm_fixture" end}
function Material(name) return materials[name] end
local suppressed,modelBrightness,modelChanges=false,1,0
render={SuppressEngineLighting=function(value) suppressed=value; modelChanges=modelChanges+1 end,
ResetModelLighting=function(r,g,b) assert(r==g and g==b); modelBrightness=r end,
RedownloadAllLightmaps=function(props,lighting)
    assert(props and lighting); downloads=downloads+1
end}
local function apply() hooks.PreRender.ZPMapEnvironment() end
local function receive(pattern,percent,refresh)
    readString=pattern; exposure=percent; readBool=refresh
    receivers.ZPRefreshMapLighting(49)
    apply()
end
local function near(value,expected) assert(math.abs(value-expected)<0.000001, tostring(value).." expected "..tostring(expected)) end
include("cl_map_environment.lua")
`;

for (const shader of ["UnlitGeneric", "VertexLitGeneric", "VertexLitGeneric_DX9"])
test(`${shader} static buildings follow darkness and restore at noon without tinting player materials`, () => run(setup +
    bspFixture({ staticModels: ["models/props_buildings/city.mdl", "models/props_c17/bench.mdl"] }) + `
    materials.city=material("${shader}",Vector(0.7,0.8,0.9)); materials.city.name="gm_construct/citycard01"
    materials["gm_construct/citycard01"]=materials.city
    util.GetModelMeshes=function(model)
        return {{material=model=="models/props_buildings/city.mdl" and "gm_construct/citycard01" or "model"}}
    end
    receive("m",0.1,false)
    near(materials.city.rendered["$color2"].x,0.07)
    receive("m",0,false); near(materials.city.rendered["$color2"].x,0)
    receive("m",1,false); near(materials.city.rendered["$color2"].x,0.7)
    assert(materials.model.values["$color2"].x==1 and materials.sky.values["$color2"].x==1)
`));

test("map material darkness scopes changes to supported world shaders and keeps original tints", () => run(setup + `
    apply(); assert(writes==0 and scans==0)
    receive("b",1,true)
    near(materials.wall.values["$color2"].x,0.2)
    near(materials.wall.values["$color2"].y,0.15)
    near(materials.wall.values["$envmaptint"].x,0.075)
    assert(materials.ground.values["$color2"].x==0.25)
    assert(materials.dx9.values["$color2"].x==0.25)
    assert(materials.default.values["$color2"].x==0.25)
    for _,name in ipairs({"water","sky","model","custom","missing"}) do
        assert(materials[name].values["$color2"].x==1)
    end
    assert(scans==1 and writes==5 and recomputes==4, "Duplicate materials must not be modified twice")
    for i=1,10 do apply() end
    assert(scans==1 and writes==5 and recomputes==4, "Unchanged frames must not rebuild materials")
    assert(not hooks.RenderScreenspaceEffects or not hooks.RenderScreenspaceEffects.ZPMapEnvironment)
    assert(not hooks.HUDPaint and not hooks.Think)
`));

test("world shader render snapshots darken and restore without overwriting entity color modulation", () => run(setup + `
    receive("b",0,false)
    assert(materials.wall.rendered["$color2"].x==0 and materials.wall.rendered["$envmaptint"].x==0)
    assert(materials.ground.rendered["$color2"].x==0)
    assert(materials.wall.values["$color"].x==0.9, "Engine modulation must remain independent")
    assert(recomputes==4)
    nightvision=true; apply()
    assert(materials.wall.rendered["$color2"].x==0 and materials.wall.rendered["$envmaptint"].x==0)
    assert(recomputes==4, "Nightvision must not restore daytime materials")
    nightvision=false; apply()
    assert(materials.wall.rendered["$color2"].x==0 and recomputes==4)
    receive("m",1,true)
    assert(materials.wall.rendered["$color2"].x==0.8 and recomputes==8)
`));

test("model material list supplements surfaces and empty world capture retries before caching", () => run(setup + `
    local ready=false
    world.GetBrushSurfaces=function() return nil end
    world.GetMaterials=function() return ready and {"wall","ground","wall"} or {} end
    receive("b",1,false)
    assert(writes==0 and recomputes==0)
    ready=true; apply()
    assert(materials.wall.rendered["$color2"].x==0.2)
    assert(materials.ground.rendered["$color2"].x==0.25 and recomputes==2)
`));

test("environment diagnostics distinguish missing synchronization and captured shaders without mutating lighting", () => run(setup + `
    local diagnostic
    util.TableToJSON=function(value) diagnostic=value; return "{}" end
    print=function(value) assert(value=="{}") end
    commands.zp_map_environment_status()
    assert(diagnostic.implementation=="material-color2-v7" and not diagnostic.synchronized)
    assert(diagnostic.materials==0 and diagnostic.packet_bits==0 and writes==0)
    receive("b",0.1,false)
    local before=writes
    commands.zp_map_environment_status()
    assert(diagnostic.synchronized and diagnostic.packet_bits==49)
    near(diagnostic.requested_scale,0.025); near(diagnostic.applied_scale,0.025)
    assert(diagnostic.materials==4 and diagnostic.candidates==9)
    assert(diagnostic.shaders.lightmappedgeneric==2 and diagnostic.shaders.water==1)
    assert(not diagnostic.nightvision and writes==before)
`));

test("BSP decals and detail vegetation darken with the world and restore their original tints", () => run(setup +
    bspFixture({ entities: '{"classname" "worldspawn" "detailmaterial" "detail/grass"}\n' +
        '{"classname" "infodecal" "texture" "decals/graffiti"}', textures: ["wall", "decals/overlay"] }) + `
    materials["decals/graffiti"]=material("UnlitGeneric",Vector(0.8,0.7,0.6))
    materials["decals/overlay"]=material("LightmappedGeneric",Vector(0.4,0.5,0.6))
    materials["detail/grass"]=material("UnlitGeneric_DX9",Vector(1,0.8,0.6))
    for name,m in pairs(materials) do if not m.name then m.name=name end end
    receive("b",0.1,false)
    near(materials["detail/grass"].rendered["$color2"].x,0.025)
    near(materials["decals/graffiti"].rendered["$color2"].x,0.02)
    near(materials["decals/overlay"].rendered["$color2"].x,0.01)
    assert(materials.sky.values["$color2"].x==1 and materials.model.values["$color2"].x==1)
    receive("b",0,false)
    assert(materials["detail/grass"].rendered["$color2"].x==0)
    assert(materials["decals/graffiti"].rendered["$color2"].x==0)
    nightvision=true; apply()
    assert(materials["decals/graffiti"].rendered["$color2"].x==0)
    nightvision=false; apply(); receive("m",1,true)
    assert(materials["detail/grass"].rendered["$color2"].x==1)
    assert(bspOpens==1 and bspCloses==1, "Do not read the map every frame or leave it open")
`));

test("opaque and translucent model passes replace baked light without tinting player textures or HUD", () => run(setup + `
    receive("b",0,false)
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    assert(suppressed and modelBrightness==0)
    assert(materials.model.values["$color2"].x==1, "Keep player albedo for projected flashlights")
    hooks.PostDrawOpaqueRenderables.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    hooks.PreDrawTranslucentRenderables.ZPMapEnvironment(false,false,false)
    assert(suppressed and modelBrightness==0)
    hooks.PostDrawTranslucentRenderables.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    local before=modelChanges
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(true,false,false)
    assert(not suppressed and modelChanges==before, "Depth/shadow passes must stay intact")
    nightvision=true
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    assert(suppressed and modelBrightness==0, "Nightvision must not restore baked player lighting")
    hooks.PostDrawOpaqueRenderables.ZPMapEnvironment()
    nightvision=false; receive("b",0.2,false)
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    near(modelBrightness,0.05)
    hooks.PreDrawHUD.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    hooks.PostRender.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    hooks.ShutDown.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    receive("m",1,true); before=modelChanges
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    assert(not suppressed and modelChanges==before)
`));

test("first-person hands and weapons keep night lighting through their whole pass and restore before effects", () => run(setup + `
    receive("b",0.2,false)
    hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
    hooks.PostDrawOpaqueRenderables.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    assert(hooks.PreDrawViewModels.ZPMapEnvironment()==nil)
    assert(suppressed); near(modelBrightness,0.05)
    -- The engine or a weapon can reset state between the viewmodel and hands.
    suppressed=false; modelBrightness=1
    assert(hooks.PreDrawViewModel.ZPMapEnvironment({}, {}, {}, 1)==nil)
    assert(suppressed); near(modelBrightness,0.05)
    suppressed=false; modelBrightness=1
    assert(hooks.PreDrawPlayerHands.ZPMapEnvironment({}, {}, {}, {}, 1)==nil)
    assert(suppressed); near(modelBrightness,0.05)
    assert(materials.model.values["$color2"].x==1, "Keep textures available to projected lighting")
    hooks.PreDrawEffects.ZPMapEnvironment()
    assert(not suppressed and modelBrightness==1)
    nightvision=true; receive("b",0,false)
    hooks.PreDrawViewModel.ZPMapEnvironment({}, {}, {}, 1)
    hooks.PreDrawPlayerHands.ZPMapEnvironment({}, {}, {}, {}, 1)
    assert(suppressed and modelBrightness==0, "Nightvision must not restore bright hands")
    -- A skipped effects hook must not leave lighting active in menus or later frames.
    hooks.PreDrawHUD.ZPMapEnvironment(); assert(not suppressed and modelBrightness==1)
    hooks.PreDrawViewModels.ZPMapEnvironment()
    hooks.PostRender.ZPMapEnvironment(); assert(not suppressed and modelBrightness==1)
    receive("m",1,true)
    local before=modelChanges
    hooks.PreDrawViewModels.ZPMapEnvironment()
    hooks.PreDrawViewModel.ZPMapEnvironment({}, {}, {}, 1)
    hooks.PreDrawPlayerHands.ZPMapEnvironment({}, {}, {}, {}, 1)
    hooks.PreDrawEffects.ZPMapEnvironment()
    assert(not suppressed and modelChanges==before, "Daytime must preserve engine lighting")
`));

test("clock-cycle m packets vary world, player and first-person brightness without lightmap rebuilds", () => run(setup + `
    for _,scale in ipairs({0,0.1,0.5,0.9,1,0.5,0}) do
        receive("m",scale,false)
        near(materials.wall.rendered["$color2"].x,0.8*scale)
        near(materials.ground.rendered["$color2"].x,scale)
        hooks.PreDrawOpaqueRenderables.ZPMapEnvironment(false,false,false)
        near(modelBrightness,scale)
        hooks.PostDrawOpaqueRenderables.ZPMapEnvironment()
        hooks.PreDrawViewModels.ZPMapEnvironment()
        hooks.PreDrawPlayerHands.ZPMapEnvironment({}, {}, {}, {}, 1)
        near(modelBrightness,scale)
        hooks.PreDrawEffects.ZPMapEnvironment()
        assert(not suppressed and modelBrightness==1)
    end
    assert(downloads==0 and not timers.ZPRefreshMapLighting)
    receive("b",0.2,true)
    near(materials.ground.rendered["$color2"].x,0.05)
    assert(timers.ZPRefreshMapLighting, "Switching back to fixed mode still supports lightmap refresh")
`));

test("zero ambient tint avoids a screen filter, survives nightvision and restores only on day", () => run(setup + `
    receive("b",0,true)
    assert(materials.wall.values["$color2"].x==0 and materials.wall.values["$envmaptint"].x==0)
    assert(materials.ground.values["$color2"].x==0)
    -- Flashlights are left to the engine's separate shader pass; actual rendering
    -- still needs GMod validation. The fixture cannot reproduce GPU lighting.
    assert(materials.wall.shader=="LightmappedGeneric" and materials.model.values["$color2"].x==1)
    nightvision=true; apply()
    assert(materials.wall.values["$color2"].x==0 and materials.wall.values["$envmaptint"].x==0)
    nightvision=false; apply(); assert(materials.wall.values["$color2"].x==0)
    receive("m",1,true)
    assert(materials.wall.values["$color2"].x==0.8 and materials.ground.values["$color2"].x==1)
    assert(materials.wall.values["$envmaptint"].x==0.3 and materials.default.values["$color2"].x==1)
`));

test("exposure edits update materials without rebuilding lightmaps while cleanup refreshes props", () => run(setup + `
    receive("b",1,true); receive("b",1,true)
    assert(downloads==0 and timers.ZPRefreshMapLighting[1]==0.1)
    timers.ZPRefreshMapLighting[2](); timers.ZPRefreshMapLighting=nil
    receive("b",0.1,false); near(materials.ground.values["$color2"].x,0.025)
    receive("b",0,false)
    assert(downloads==1 and not timers.ZPRefreshMapLighting)
    receive("b",0,true)
    timers.ZPRefreshMapLighting[2](); assert(downloads==2)
`));

test("invalid lighting packets preserve materials and older packets retain their brightness", () => run(setup + `
    receive("b",0.5,false); assert(materials.ground.values["$color2"].x==0.125)
    for _,value in ipairs({-1,1.1,0/0,math.huge,-math.huge}) do
        receive("b",value,false); assert(materials.ground.values["$color2"].x==0.125)
    end
    for _,pattern in ipairs({"a","z","","bc","B","1"}) do
        readString=pattern; receivers.ZPRefreshMapLighting(16); apply()
        assert(materials.ground.values["$color2"].x==0.125)
    end
    readString="m"
    for _,bits in ipairs({0,32,48,50}) do
        receivers.ZPRefreshMapLighting(bits); apply(); assert(materials.ground.values["$color2"].x==0.125)
    end
    readString="b"; receivers.ZPRefreshMapLighting(16); apply()
    assert(materials.ground.values["$color2"].x==0.25)
`));

test("material capture waits for the world and restores snapshots before Lua reload and shutdown", () => run(setup + `
    local ready=false
    game.GetWorld=function() return ready and world or nil end
    receive("b",1,true); assert(writes==0 and scans==0)
    ready=true; apply(); assert(scans==1 and materials.ground.values["$color2"].x==0.25)
    include("cl_map_environment.lua")
    assert(materials.wall.values["$color2"].x==0.8 and materials.ground.values["$color2"].x==1)
    receive("b",1,true)
    assert(materials.ground.values["$color2"].x==0.25, "Reload must not compound darkened tints")
    hooks.ShutDown.ZPMapEnvironment()
    assert(materials.wall.values["$color2"].x==0.8 and materials.wall.values["$envmaptint"].x==0.3)
`));

test("worldspawn rejected by IsValid still receives darkness, while a NULL world waits for map readiness", () => run(setup + `
    assert(not IsValid(world) and world:IsWorld(), "Match GMod's special worldspawn validity")
    local nullWorld={IsWorld=function() return false end}
    function nullWorld:GetMaterials() error("Do not access materials before worldspawn exists") end
    game.GetWorld=function() return nullWorld end
    receive("b",0,false)
    assert(scans==0 and writes==0 and recomputes==0)
    game.GetWorld=function() return world end
    apply()
    assert(scans==1 and writes==5 and recomputes==4)
    assert(materials.wall.rendered["$color2"].x==0 and materials.ground.rendered["$color2"].x==0)
    hooks.ShutDown.ZPMapEnvironment()
    assert(materials.wall.rendered["$color2"].x==0.8)
`));
