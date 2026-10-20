import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { skyboxBspFixture } from "./helpers/radar-skybox-bsp.mjs";

const rules = 'include("sh_radar_rules.lua")\n';
test("zm_canals BSP identifies the sky camera area even at the same height as playable rooms", () => run(rules + skyboxBspFixture() + `
    local filter=include("cl_radar_capture_skybox.lua").readSkybox()
    assert(filter and bspClosed==1)
    assert(filter.Contains({x=3072,y=0,z=417}),"The miniature island belongs to the sky camera's area")
    assert(not filter.Contains({x=0,y=0,z=40}),"The canal must remain playable")
    assert(not filter.Contains({x=640,y=0,z=80}))
`));

test("skybox classification does not erase player spawn areas or require a sky camera", () => {
    for (const entities of ['', '{"classname" "sky_camera" "origin" "0 0 40"} {"classname" "info_player_start" "origin" "0 0 40"}'])
        run(rules + skyboxBspFixture({ entities }) + `
            local filter=include("cl_radar_capture_skybox.lua").readSkybox()
            assert(filter and not filter.Contains({x=0,y=0,z=40}) and bspClosed==1)
        `);
});

test("legacy version-zero leaves use their ambient-lighting stride", () => run(rules + skyboxBspFixture({ leafVersion: 0 }) + `
    local filter=include("cl_radar_capture_skybox.lua").readSkybox()
    assert(filter and filter.Contains({x=3072,y=0,z=417}))
    assert(not filter.Contains({x=0,y=0,z=40}) and bspClosed==1)
`));

test("invalid, compressed and cyclic BSP classifier data fail safely and close the file", () => {
    for (const mutate of [
        bytes => bytes.writeInt32LE(999, 4),
        bytes => bytes.writeInt32LE(1, 20 + 5 * 16),
        bytes => bytes.writeInt32LE(bytes.length + 1, 8 + 10 * 16),
        bytes => bytes.writeInt32LE(999999, bytes.readInt32LE(8 + 5 * 16)),
    ]) run(rules + skyboxBspFixture({ mutate }) + `
        assert(include("cl_radar_capture_skybox.lua").readSkybox()==nil and bspClosed==1)
    `);
    run(rules + skyboxBspFixture({ mutate: bytes => {
        const node = bytes.readInt32LE(8 + 5 * 16);
        bytes.writeInt32LE(0, node + 4); bytes.writeInt32LE(0, node + 8);
    } }) + `
        local filter=include("cl_radar_capture_skybox.lua").readSkybox()
        assert(filter and not filter.Contains({x=3072,y=0,z=417}) and bspClosed==1)
    `);
});

test("floor analysis excludes skybox samples and their corners before calculating map bounds", () => run(rules + skyboxBspFixture() + `
    Vector=function(x,y,z) return {x=x,y=y,z=z} end
    MASK_PLAYERSOLID=1
    local function face(x,z)
        return {IsSky=function() return false end,IsNoDraw=function() return false end,
        GetVertices=function() return {Vector(x,16,z),Vector(x+32,16,z),Vector(x+32,48,z),Vector(x,48,z)} end}
    end
    game.GetWorld=function() return {GetBrushSurfaces=function() return {face(0,36),face(3088,413)} end} end
    util.TraceLine=function(data) return {Hit=true,StartSolid=false,HitSky=false,HitNormal=Vector(0,0,1),
        HitPos=Vector(data.start.x,data.start.y,data.start.z-4)} end
    util.TraceHull=function() return {Hit=false,StartSolid=false} end
    local analysis=include("cl_radar_capture_analysis.lua").analyse({})
    assert(analysis:Step())
    local samples,diagnostic=analysis:Samples(),analysis:Diagnostics()
    assert(diagnostic.SkyboxFilter and diagnostic.SkyboxSamples>0)
    for _,sample in ipairs(samples) do assert(sample.x<=128,"Skybox corners must not enlarge the overview") end
    local plan=include("cl_radar_capture_plan.lua").plan("zm_canals",samples,{})
    assert(plan and plan.Overview.X+plan.Overview.Scale*1024<1024)
`));
