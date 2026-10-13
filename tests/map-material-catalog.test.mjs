import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { bspFixture } from "./helpers/map-bsp.mjs";

const setup = 'game={GetMap=function() return "gm_fixture" end}\n';
const read = 'local names=include("cl_map_material_catalog.lua").ReadMapMaterialNames()\n';

test("BSP catalog discovers unlit skyline materials absent from the brush texture table", () => run(setup +
    bspFixture({ textures: ["wall"], staticModels: ["models/city.mdl", "models/city.mdl", "../bad.mdl"] }) + `
    local meshCalls=0
    util.GetModelMeshes=function(model)
        assert(model=="models/city.mdl"); meshCalls=meshCalls+1
        return {{material="gm_construct/citycard01"}}
    end
` + read + `
    assert(table.concat(names,",")=="gm_construct/citycard01,wall" and meshCalls==1 and bspCloses==1)
`));

test("BSP material catalog combines texture table, map decals, overlays and custom detail sprites", () => run(setup +
    bspFixture({ entities: `
        {"classname" "worldspawn" "detailmaterial" "detail/Grass"}
        {"classname" "infodecal" "texture" "decals/graffiti"}
        {"classname" "info_decal" "texture" "decals/second"}
        {"classname" "info_overlay" "material" "decals/overlay"}
        {"classname" "env_sprite" "model" "effects/spark"}
        {"classname" "prop_dynamic" "model" "models/player.mdl"}
    `, textures: ["WALL", "wall", "decals/overlay"] }) + read + `
    assert(table.concat(names,",")=="wall,decals/overlay,detail/grass,decals/graffiti,decals/second")
    assert(bspOpens==1 and bspCloses==1 and bspReads<#bspData)
`));

test("BSP catalog skips invalid paths and ignores unrelated entity keys", () => run(setup +
    bspFixture({ entities: '{"classname" "infodecal" "texture" "../invalid"}',
        textures: ["", "/absolute", "c:/absolute", "../outside", "..\\outside", "x".repeat(261), "valid/path"] }) + read + `
    assert(#names==1 and names[1]=="valid/path" and bspCloses==1)
`));

test("BSP catalog safely rejects invalid headers and unavailable maps", () => {
    run(setup + 'file.Open=function() return nil end\n' + read + 'assert(#names==0)');
    run(setup + bspFixture({ mutate: bytes => bytes.write("NOPE") }) + read + 'assert(#names==0 and bspCloses==1)');
});

test("BSP catalog skips oversized, compressed and out-of-bounds lumps while preserving valid references", () => {
    for (const [offset, value] of [[8, -1], [8, 0], [8, 2147483647], [12, 8 * 1024 * 1024 + 1], [20, 1024]]) {
        run(setup + bspFixture({ entities: '{"classname" "infodecal" "texture" "decals/skipped"}',
            textures: ["valid/wall"], mutate: bytes => bytes.writeInt32LE(value, offset) }) + read + `
            assert(#names==1 and names[1]=="valid/wall" and bspCloses==1)
        `);
    }
});
