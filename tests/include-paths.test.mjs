import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("relative includes cannot silently find a root file from a nested registration", () => run(`
    sources["zombieplague/gamemode/fixtures/registration.lua"]=[[
        local value=include("sv_radar_item.lua")
        return value
    ]]
    local ok,message=pcall(include,"zombieplague/gamemode/fixtures/registration.lua")
    assert(not ok and message:find("fixtures/sv_radar_item.lua",1,true),"Missing nested dependencies must not fall back to the root")
`));

test("relative sibling and explicit Lua-root paths resolve from the same nested caller", () => run(`
    sources["zombieplague/gamemode/fixtures/sibling.lua"]=[[return "sibling"]]
    sources["zombieplague/gamemode/fixtures/registration.lua"]=[[
        local sibling=include("sibling.lua")
        local factory=include("zombieplague/gamemode/sv_radar_item.lua")
        return {Sibling=sibling,Factory=factory}
    ]]
    local result=include("zombieplague/gamemode/fixtures/registration.lua")
    assert(result.Sibling=="sibling" and type(result.Factory.createItem)=="function")
`));

test("both radar item registrations load their root factory from the actual extra item directory", () => run(`
    include("sv_extraitems.lua")
    local human=include("zombieplague/gamemode/extraitems/zp_radar_human.lua").default
    local zombie=include("zombieplague/gamemode/extraitems/zp_radar_zombie.lua").default
    assert(human and zombie and human~=zombie)
    assert(human.ID=="ZPRadar" and zombie.ID=="ZPRadar")
    assert(human.Type==ITEM_HUMAN and zombie.Type==ITEM_ZOMBIE)
    assert(human.Price==10 and zombie.Price==10)
    ExtraItemsManager:AddExtraItem(human,human.Type)
    ExtraItemsManager:AddExtraItem(zombie,zombie.Type)
    assert(ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPRadar")==human)
    assert(ExtraItemsManager:GetItemById(TEAM_ZOMBIES,"ZPRadar")==zombie)
`));
