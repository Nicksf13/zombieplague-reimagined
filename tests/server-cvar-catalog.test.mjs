import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { serverCvarInventory } from "./helpers/server-cvar-inventory.mjs";
import { books, locales } from "./helpers/native-localization.mjs";

const setup = `include("sh_admin_config.lua"); include("sh_server_cvars.lua")\n`;
const inventory = await serverCvarInventory();
const luaString = value => JSON.stringify(value.replaceAll("\\", "/"));

test("server settings cover every actual server cvar and preserve its registered default", () => {
    assert.equal(inventory.length, 104);
    assert.equal(inventory.filter(row => row.Managed).length, 97);
    const expected = inventory.map(row => `[${luaString(row.Name)}]=${luaString(row.Default)}`).join(",");
    run(setup + `
        local expected={${expected}}; local seen,categories={},{}
        assert(#ZPServerCvars.Categories==12 and #ZPServerCvars.Entries==104)
        for _,category in ipairs(ZPServerCvars.Categories) do
            assert(not categories[category.ID] and #ZPServerCvars.ForCategory(category.ID)>0)
            categories[category.ID]=true
        end
        for _,entry in ipairs(ZPServerCvars.Entries) do
            assert(not seen[entry.Name] and categories[entry.Category],entry.Name)
            assert(expected[entry.Name]==entry.Default,"Wrong default: "..entry.Name)
            assert(ZPServerCvars.Normalize(entry,entry.Default)==entry.Default,entry.Name)
            seen[entry.Name]=true
            assert(({live=true,event=true,spawn=true,phase=true,vote=true,map=true,unused=true,mixed=true})[entry.Apply],entry.Name)
        end
        for name in pairs(expected) do assert(seen[name],name) end
    `);
});

test("typed cvar validation rejects commands, non-finite values and invalid modes", () => run(setup + `
    local function field(name)
        for _,entry in ipairs(ZPServerCvars.Entries) do if entry.Name==name then return entry end end
        error(name)
    end
    local function accepts(name,raw,expected) assert(ZPServerCvars.Normalize(field(name),raw)==expected,name..":"..raw) end
    accepts("zp_run_should_drain"," 1 ","1")
    for _,value in ipairs({"2","true","1;quit",""}) do accepts("zp_run_should_drain",value,nil) end
    for _,value in ipairs({"nan","inf","1e3","-1","1;quit","1..2","."}) do accepts("zp_breath_recover",value,nil) end
    accepts("zp_breath_recover"," .25 ","0.25")
    accepts("zp_min_players","2.5",nil); accepts("zp_min_players","0",nil)
    accepts("zp_first_zombie_reward_mode","3",nil); accepts("zp_first_zombie_reward_mode","2","2")
    accepts("zp_bot_stats_sample","0.01",nil); accepts("zp_bot_stats_sample","11",nil)
    accepts("zp_bot_stats_utc_offset","-180","-180")
    accepts("zp_bot_stats_scenario","trial-01.a","trial-01.a")
    for _,value in ipairs({"","a b","x;quit","../cfg/server",string.rep("a",129)}) do accepts("zp_bot_stats_scenario",value,nil) end
`));

test("only audited startup consumers require map reload and dead settings do not suggest it", () => run(setup + `
    local reload={zp_map_mute_ambient=true,zp_min_players=true}
    local unused={zp_breath_drain=true,zp_infection_bomb_radius=true,zp_ap_total=true,zp_ap_kill_human=true,zp_givetake_ammopacks_allowed=true}
    for _,entry in ipairs(ZPServerCvars.Entries) do
        assert((entry.Apply=="map")==not not reload[entry.Name],entry.Name)
        assert((entry.Apply=="unused")==not not unused[entry.Name],entry.Name)
    end
`));

test("category names, friendly labels, subjects, choices and help resolve in all 32 languages", () => {
    const serialized = run(setup + `
        local keys={}
        local function add(key) if key then keys[key]=true end end
        for _,category in ipairs(ZPServerCvars.Categories) do add(category.Label) end
        for _,entry in ipairs(ZPServerCvars.Entries) do
            add(entry.Label); add(entry.Subject); add(entry.Help)
            for _,option in ipairs(entry.Options or {}) do add(option.Label) end
        end
        local list={}; for key in pairs(keys) do list[#list+1]=key end
        result=table.concat(list,"|")
    `, "result");
    for (const locale of locales) for (const key of serialized.split("|"))
        assert(books[locale][key]?.trim(), `${locale}: ${key}`);
    for (const locale of locales) for (const suffix of ["help", "range", "superadmin", "unavailable"])
        assert(books[locale]["zombieplague.sc" + suffix]?.trim(), `${locale}: ${suffix}`);
    for (const locale of locales) for (const mode of ["live", "event", "spawn", "phase", "vote", "map", "unused", "mixed"])
        assert(books[locale]["zombieplague.scapply" + mode]?.trim(), `${locale}: ${mode}`);
    assert.equal(books["pt-BR"]["zombieplague.scrundrainenabled"], "Drenar fôlego ao correr");
});
