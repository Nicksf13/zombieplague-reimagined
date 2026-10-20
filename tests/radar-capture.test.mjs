import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const planning = `
include("sh_radar_rules.lua")
local planning=include("cl_radar_capture_plan.lua")
local samples={{x=0,y=0,z=0,area=10000},{x=1024,y=1024,z=128,area=10000}}
`;

test("floor planning handles gm_construct sample counts without unpacking or mutating input", () => run(planning + `
    local nativeUnpack=unpack
    unpack=function(values,...)
        if #values>8000 then error("too many results to unpack") end
        return nativeUnpack(values,...)
    end
    local large={}
    for index=1,10293 do
        large[index]={x=index%100,y=math.floor(index/100),z=index%2*128,area=index<=4337 and 1000 or 0}
    end
    local first=large[1]
    local diagnostic={}
    local plan=planning.plan("gm_construct",large,{},diagnostic)
    assert(plan and #plan.Heights==2 and plan.Heights[1]==0 and plan.Heights[2]==128)
    assert(diagnostic.Samples==10293 and diagnostic.HeightCount==2)
    assert(#large==10293 and large[1]==first and first.z==128,"Planning must not reorder analyser samples")
`));

test("automatic floor groups retain shared bounds, cuts and non-overlapping radar bands", () => run(planning + `
    local plan=planning.plan("zm_street",samples,{})
    assert(plan and #plan.Heights==2 and plan.Heights[1]==0 and plan.Heights[2]==128)
    assert(plan.Cuts[1]==80 and plan.Cuts[2]==208)
    assert(plan.Overview.Layers[1].MaxZ==64 and plan.Overview.Layers[2].MinZ==64)
    assert(plan.Overview.X<0 and plan.Overview.Y>1024 and plan.Overview.Size==1024)
    assert(not planning.plan("../escape",samples,{}))
    assert(not planning.plan("map",{},{}))
    local stairs={}; for n=0,64 do stairs[#stairs+1]={x=0,y=0,z=n*64,area=10000} end
    local diagnostic={}
    assert(not planning.plan("map",stairs,{},diagnostic),"Excess floors must require an override instead of silently dropping floors")
    assert(diagnostic.Code=="too_many_floors" and diagnostic.HeightCount==65 and #diagnostic.Heights==64)
    assert(not planning.plan("map",{},{},diagnostic) and diagnostic.Code=="no_floor_samples")
    local chain=planning.plan("map",{{x=0,y=0,z=0,area=10000},{x=100,y=100,z=40,area=10000},
      {x=100,y=100,z=80,area=10000}},{})
    assert(#chain.Heights==2,"Clustering must not chain stairs across storeys")
`));

test("capture overrides validate numeric sequences, optional bounds and cut heights", () => run(planning + `
    assert(planning.options({Heights={0,128},Cuts={80,208}}))
    assert(not planning.options({Heights={[1]=0,[3]=128}}))
    assert(not planning.options({Heights={0,0}}))
    assert(not planning.options({Cuts={80}}))
    assert(not planning.options({Heights={0},Cuts={80,100}}))
    assert(not planning.options({Bounds={MinX=1,MaxX=0,MinY=0,MaxY=100}}))
    assert(not planning.options({HeightRange={MinZ=100,MaxZ=0}}))
    assert(planning.options({HeightRange={MinZ=-1024,MaxZ=4096}}))
    assert(not planning.plan("map",samples,{Heights={0,128},Cuts={0,208}}))
    local data=planning.options({Heights={0},Bounds={MinX=-64,MaxX=64,MinY=-64,MaxY=64}})
    local plan=planning.plan("map",samples,data)
    assert(#plan.Heights==1 and plan.Overview.Scale*1024<256)
    assert(planning.plan("map",{},data),"Explicit heights and bounds can describe displacement-only maps")
`));

// Reported representatives from gm_construct. Sample weights here are synthetic;
// this checks selection and bounds, not the engine's collision/rendering result.
const constructHeights = [-511.96875, -399.52986169790574, -255.96875, -146.11307596409213, -95.78406828684194,
    -31.530345448701347, 60.13627902388791, 128.7458347871598, 239.98177813132838, 256.4516202061201,
    366.9028916531945, 405.2773536607468, 494.327366529034, 528.8550341149904, 622.3273665290341,
    656.8550341149901, 750.3273712742916, 769.6935243172042, 878.3273665290341, 912.8550341149908,
    1006.3273665290341, 1040.8551035198877, 1135.9563464167622, 1168.6921601274742, 1289.1547719030395,
    1424.6155655766233, 1552.7013247371362, 1680.7013247371365, 1793.6581563117684, 1936.7013247371362,
    2064.701324737136, 2192.701253979119, 2305.658153199971, 2441.7186834443537, 2496.031249999999,
    2560.468016033738, 2624.0312499999986, 2688.4680160337384, 2845.299542682923, 2976.0312499999986,
    10873.232421875, 10996.508535342084];
test("gm_construct reported heights select playable layers and exclude the distant skybox footprint", () => run(planning + `
    local reported={${constructHeights.join(",")}}
    local points={}
    for index,height in ipairs(reported) do
        local scenery=height>10000
        points[#points+1]={x=scenery and 30000 or index*16,y=scenery and 30000 or index*16,z=height,area=10000}
    end
    points[#points+1]={x=32700,y=32700,z=11000,area=0}
    local diagnostic={}
    local plan=planning.plan("gm_construct",points,{},diagnostic)
    assert(plan,"The reported map must no longer fail its floor plan")
    assert(#plan.Heights>16 and #plan.Heights<=ZPRadarRules.MaxLayers)
    assert(plan.Heights[#plan.Heights]<4000 and diagnostic.ExcludedSamples==3)
    assert(plan.Overview.Scale*1024<2048,"Scenery must not enlarge the radar footprint")
    assert(diagnostic.HeightRange.MaxZ<4000 and diagnostic.CandidateHeightCount>=#plan.Heights)
    for index=2,#plan.Heights do assert(plan.Heights[index]-plan.Heights[index-1]>=48) end
`));

test("vertical island selection follows supported area and explicit height ranges preserve remote rooms", () => run(planning + `
    local points={{x=0,y=0,z=0,area=5000},{x=100,y=100,z=5000,area=10000},
        {x=100,y=100,z=5128,area=10000}}
    local automatic=planning.plan("high_map",points,{})
    assert(automatic.Heights[1]==5000 and #automatic.Heights==2,"There must be no hardcoded 4096 ceiling")
    local explicit=planning.plan("high_map",points,{HeightRange={MinZ=-100,MaxZ=6000}})
    assert(#explicit.Heights==3 and explicit.Heights[1]==0)
`));

test("floor analysis requires solid upward faces, player clearance and preserves face corners", () => run(`
include("sh_radar_rules.lua")
Vector=function(x,y,z) return {x=x,y=y,z=z} end
MASK_PLAYERSOLID=1
local function surface(z,sky,nodraw)
 return {IsSky=function() return sky end,IsNoDraw=function() return nodraw end,
 GetVertices=function() return {Vector(0,0,z),Vector(128,0,z),Vector(128,128,z),Vector(0,128,z)} end}
end
game={GetMap=function() return "gm_fixture" end,GetWorld=function() return {GetBrushSurfaces=function() return {
 surface(0,false,false),surface(128,true,false),surface(256,false,true),surface(64,false,false)} end} end}
file.Open=function() return nil end
-- util.IsInWorld exists only on the server; the authoring tool runs on the client.
util.IsInWorld=nil
util.TraceLine=function(data) return {Hit=true,StartSolid=data.start.z~=4,HitSky=false,
 HitPos=Vector(data.start.x,data.start.y,0),HitNormal=Vector(0,0,1)} end
local blocked=false
util.TraceHull=function() return {Hit=blocked,StartSolid=false} end
local module=include("cl_radar_capture_analysis.lua")
local analysis=module.analyse({})
assert(analysis:Step())
local samples=analysis:Samples(); assert(#samples==9)
local sum=0;for _,point in ipairs(samples) do sum=sum+point.area;assert(point.z==0) end
assert(math.abs(sum-16384)<0.01)
local diagnostic=analysis:Diagnostics()
assert(diagnostic.Surfaces==4 and diagnostic.Processed==4 and diagnostic.Candidates==2 and diagnostic.ClearSamples==5)
blocked=true;local blockedAnalysis=module.analyse({});assert(blockedAnalysis:Step() and #blockedAnalysis:Samples()==0)
`));

const rendering = `
local module=include("cl_radar_capture_render.lua")
Vector=function(x,y,z) return {x=x,y=y,z=z} end
local plan={Overview={X=0,Y=1024,Scale=1,Size=1024},Heights={0,128},Cuts={80,208}}
local view={origin=Vector(-512,1024,2000),angles={p=90,y=90,r=0},ortho={left=0,right=2048,top=-1024,bottom=0}}
local targets,planes,clipping,fail=0,0,false,false
GetRenderTarget=function() return {} end
render={GetViewSetup=function() return view end,
 PushRenderTarget=function() targets=targets+1 end,PopRenderTarget=function() targets=targets-1 end,
 Clear=function() end,EnableClipping=function(value) local old=clipping;clipping=value;return old end,
 PushCustomClipPlane=function(normal,distance) assert(normal.z==-1 and distance==-80);planes=planes+1 end,
 PopCustomClipPlane=function() planes=planes-1 end,
 RenderView=function(data) assert(data.origin.x==0 and data.origin.y==1024 and data.znear==1920)
 assert(data.w==1024 and data.h==1024 and data.ortho.right==1024 and not data.drawhud)
 if fail then error("render failure") end end,
 Capture=function(data) assert(data.alpha==false and targets==1);return "PNG" end}
`;
test("native overview capture uses a square target and restores clipping and target on failure", () => run(rendering + `
    assert(module.capture(plan,0)=="PNG")
    assert(targets==0 and planes==0 and clipping==false)
    fail=true;assert(not pcall(module.capture,plan,0));assert(targets==0 and planes==0 and clipping==false)
    fail=false;view.ortho=nil;assert(module.capture(plan,0)==nil and targets==0)
`));

const controller = `
include("sh_radar_rules.lua")
local now,localGame,admin,writeFailure,captureFailure,analysed=1,true,true,false,false,0
SysTime=function() return now end
local values,original,writes,messages,jsonValues={},{},{},{},{}
for _,name in ipairs({"cl_leveloverview","cl_leveloverviewmarker","r_novis","r_3dsky","cl_drawhud","r_drawviewmodel",
 "mat_fullbright","fog_override","fog_enable"}) do values[name]="old:"..name;original[name]=values[name] end
values.sv_cheats="1"
GetConVar=function(name) if values[name] then return {GetString=function() return values[name] end,GetBool=function() return values[name]=="1" end} end end
RunConsoleCommand=function(name,value) values[name]=value end
LocalPlayer=function() return {IsAdmin=function() return admin end} end
game={GetMap=function() return "zm_street" end,SinglePlayer=function() return localGame end}
language={GetPhrase=function(key) return key end}
print=function(message) messages[#messages+1]=message end
Vector=function(x,y,z) return {x=x,y=y,z=z} end
Angle=function(p,y,r) return {p=p,y=y,r=r} end
file.Read=function() return nil end
file.CreateDir=function() end
file.Write=function(name,value) if writeFailure then return false end;writes[name]=value;return true end
util.TableToJSON=function(value) jsonValues[#jsonValues+1]=value;return "json" end
concommand={Add=function(name,callback) commands[name]=callback end}
-- Stub source modules share the state through these explicit environment functions.
_G.captureTestAnalysed=function() analysed=analysed+1 end
sources["zombieplague/gamemode/cl_radar_capture_analysis.lua"]=[[
return {analyse=function() captureTestAnalysed();return {Diagnostics=function() return {} end,Step=function() return true end,Samples=function() return {
 {x=0,y=0,z=0,area=10000},{x=1024,y=1024,z=128,area=10000}} end} end}
]]
_G.captureTestRender=function()
 assert(hooks.PrePlayerDraw.ZPRadarCapture()==true)
 hooks.PostRender.ZPRadarCapture() -- A recursive render callback must not capture twice.
 if captureFailure then error("capture failure") end
 return "PNG"
end
sources["zombieplague/gamemode/cl_radar_capture_render.lua"]="return {capture=function() return captureTestRender() end}"
include("cl_radar_capture.lua")
local function start() commands.zp_radar_generate();hooks.Think.ZPRadarCapture() end
local function frame() now=now+2;hooks.PostRender.ZPRadarCapture() end
local function restored() for key,value in pairs(original) do assert(values[key]==value,key) end end
`;
test("capture command authorizes a local admin with cheats and restores settings after exporting", () => run(controller + `
    localGame=false;start();assert(analysed==0)
    localGame=true;admin=false;start();assert(analysed==0)
    admin=true;values.sv_cheats="0";start();assert(analysed==0)
    values.sv_cheats="1";start();assert(analysed==1 and values.cl_drawhud=="0")
    local view=hooks.CalcView.ZPRadarCapture();assert(view and view.angles.p==90)
    frame();frame();frame();restored();assert(not hooks.CalcView.ZPRadarCapture())
    local count=0;for name in pairs(writes) do count=count+1 end;assert(count==5)
    assert(messages[#messages-1]:find("radarcapturesaved",1,true))
`));
test("capture cancel, render failure, write failure and timeout restore the previous settings", () => run(controller + `
    start();commands.zp_radar_generate_cancel();restored()
    start();captureFailure=true;frame();restored();captureFailure=false
    start();writeFailure=true;frame();restored();writeFailure=false
    start();now=now+181;hooks.Think.ZPRadarCapture();restored()
    for filename in pairs(writes) do assert(not filename:find("/exports/",1,true),"Failed runs must not commit an export") end
    start();hooks.ZPResetRadarCapture.ZPRadarCapture();restored()
`));

test("capture diagnostics retain engine errors, stages and a persistent report", () => run(controller + `
    start();captureFailure=true;frame();restored()
    local report=jsonValues[#jsonValues]
    assert(report.Map=="zm_street" and report.Stage=="capture" and report.Error:find("capture failure",1,true))
    assert(writes["zombieplague/radar/capture_error.json"]=="json")
    assert(messages[#messages]=="[ZP Radar] json")
    captureFailure=false
    captureTestAnalysed=function() error("startup error") end
    commands.zp_radar_generate();restored()
    report=jsonValues[#jsonValues]
    assert(report.Stage=="start" and report.Error:find("startup error",1,true))
`));
