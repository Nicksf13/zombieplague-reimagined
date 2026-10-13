import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("all supported weapon packs load explicit families, including scoped and fictional variants", () => {
    const root = new URL("../src/gamemodes/zombieplague/gamemode/weapons/server/", import.meta.url);
    const registrations = readdirSync(root, { recursive: true }).filter(path => /[/\\]/.test(path) && path.endsWith(".ts"));
    const ids = registrations.map(path => {
        const source = readFileSync(new URL(path.replaceAll("\\", "/"), root), "utf8");
        assert.match(source, /Family: "[a-z]+"/);
        return source.match(/WeaponID: "([^"]+)"/)[1];
    });
    assert.equal(ids.length, 154);
    const list = ids.map(id => `{ClassName=${JSON.stringify(id)}}`).join(",");
    run(`
        include("sh_weapon_menu_protocol.lua"); include("sv_utils.lua"); include("sv_weaponmanager.lua")
        weapons.GetList=function() return {${list}} end
        WeaponManager:SearchWeapons()
        local count=0
        for _,kind in ipairs({WEAPON_PRIMARY,WEAPON_SECONDARY,WEAPON_MELEE}) do
            for _,weapon in pairs(WeaponManager:GetWeaponsTableByWeaponType(kind)) do
                assert(ZPWeaponMenuProtocol.Family(weapon.Family) and weapon.Family~="other", weapon.WeaponID)
                count=count+1
            end
        end
        assert(count==154)
        local function family(id,expected)
            local weapon=WeaponManager:FindWeaponByWeaponId(id,WEAPON_PRIMARY)
            assert(weapon and weapon.Family==expected,id)
        end
        family("swb_css_m249","machinegun")
        family("m9k_honeybadger","smg")
        family("m9k_m14sp","rifle")
        family("m9k_remington7615p","sniper")
        family("arccw_contender","sniper")
        local secondaryCounts={pistol=0,revolver=0}
        for _,weapon in pairs(WeaponManager:GetWeaponsTableByWeaponType(WEAPON_SECONDARY)) do
            assert(secondaryCounts[weapon.Family], weapon.WeaponID)
            secondaryCounts[weapon.Family]=secondaryCounts[weapon.Family]+1
        end
        assert(secondaryCounts.pistol==29 and secondaryCounts.revolver==11)
        assert(WeaponManager:FindWeaponByWeaponId("m9k_scoped_taurus",WEAPON_SECONDARY).Family=="revolver")
        assert(WeaponManager:FindWeaponByWeaponId("arccw_deagle357",WEAPON_SECONDARY).Family=="pistol")
        family("arccw_augpara","smg")
        family("weapon_crossbow","sniper")
    `);
});
