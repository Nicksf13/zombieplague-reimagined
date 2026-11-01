import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { statisticsSetup as setup } from "./helpers/player-statistics.mjs";

const weaponsSetup = setup + `
local function enemy(team)
    local ply=newPlayer("0",team or TEAM_ZOMBIES); ply.bot=true; return ply
end
local function kill(id,attacker)
    attacker=attacker or human
    local target=enemy(attacker:Team()==TEAM_HUMANS and TEAM_ZOMBIES or TEAM_HUMANS)
    local inflictor=weapon(id)
    hook.Call("DoPlayerDeath",GM,target,attacker,{GetInflictor=function() return inflictor end})
    attacker.weapon=weapon("weapon_pistol")
    target.alive=false; hook.Call("PlayerDeath",GM,target,attacker,attacker)
end
local function report(id,map)
    return stats:Report(human.id,{Map=map or "",Role="human",Metric="Kills",Target="",Weapon=id or ""})
end
`;

test("two AR2 kills and three SMG kills give five overall, with independent per-weapon rankings", () => run(weaponsSetup + `
    start()
    for i=1,2 do kill("weapon_ar2") end
    for i=1,3 do kill("weapon_smg1") end
    local total=report()
    assert(total.SelfValue==5 and total.Profile.Roles.human.Kills==5)
    assert(report("weapon_ar2").SelfValue==2 and report("weapon_smg1").SelfValue==3)
    assert(report("weapon_ar2",currentMap).SelfValue==2)
    assert(total.Profile.Weapons.weapon_ar2.human.Kills==2 and total.Profile.Weapons.weapon_smg1.human.Kills==3)
    assert(row(human).survivor.Kills==0)
    kill("weapon_ar2",other)
    assert(report("weapon_ar2").SelfRank==1 and report("weapon_smg1").SelfRank==1)
`));

test("melee and grenade infections retain the weapon before class callbacks or a weapon switch", () => run(weaponsSetup + `
    start(); include("sv_infectionmanager.lua")
    zombie.weapon=weapon("zp_weapon_fists")
    zombie.GetZombieClass=function() return {InfectionFunction=function(attacker) attacker.weapon=weapon("weapon_smg1") end} end
    InfectionManager:Infect(enemy(TEAM_HUMANS),zombie)
    InfectionManager:Infect(enemy(TEAM_HUMANS),zombie,weapon("zp_infection_grenade"))
    local profile=stats.Records:Get(currentMap,zombie.id,zombie:Name())
    assert(profile.Roles.zombie.Infections==2)
    assert(profile.Weapons.zp_weapon_fists.zombie.Infections==1)
    assert(profile.Weapons.zp_infection_grenade_thrower.zombie.Infections==1)
    assert(not profile.Weapons.weapon_smg1)
`));

test("old JSON history preserves totals under unknown attribution and saves new weapon counters separately", () => run(weaponsSetup + `
    local legacy=schema.empty(currentMap,human.id,human:Name())
    legacy.Roles.human.Kills=5; legacy.Roles.human.Rounds=1; legacy.Weapons=nil
    files["zombieplague/statistics/v1/"..currentMap..".json"]=util.TableToJSON({Version=1,Map=currentMap,Records={legacy}})
    start(); kill("weapon_ar2")
    assert(report().SelfValue==6 and report("unattributed").SelfValue==5 and report("weapon_ar2").SelfValue==1)
    stats:Flush()
    local stored=util.JSONToTable(files["zombieplague/statistics/v1/"..currentMap..".json"])
    assert(stored.Version==4)
    local Store=include("sv_statistics_json.lua").StatisticsJSONStorage
    local restored; construct(Store):Load(function(records) restored=records end)
    for _,entry in ipairs(restored) do if entry.SteamID64==human.id then
        assert(entry.Roles.human.Kills==6 and entry.Weapons.weapon_ar2.human.Kills==1)
    end end
`));

test("map aggregation adds matching weapon counters without changing other maps or role totals", () => run(weaponsSetup + `
    start(); kill("weapon_ar2"); stats:End()
    currentMap="zm_other"; stats:Sync(); kill("weapon_ar2"); kill("weapon_smg1")
    assert(report().SelfValue==3 and report("weapon_ar2").SelfValue==2)
    assert(report("weapon_ar2","zm_test").SelfValue==1 and report("weapon_smg1","zm_test").SelfValue==0)
    local data=report(); data.Profile.Weapons.weapon_ar2.human.Kills=500
    assert(report("weapon_ar2").SelfValue==2)
`));

test("weapon payload validation rejects invalid classes and counts larger than the total", () => run(weaponsSetup + `
    local profile=schema.empty(currentMap,human.id,human:Name())
    local attribution=include("sh_statistics_weapons.lua")
    local values=attribution.empty(); values.human.Kills=1
    profile.Weapons["../bad"]=values; assert(not schema.parse(profile))
    profile.Weapons={weapon_ar2=values}; assert(not schema.parse(profile))
    profile.Roles.human.Kills=1; assert(schema.parse(profile))
    values.human.Kills=0/0; assert(not schema.parse(profile))
`));

test("weapon limits fold additional sources into unknown while preserving totals and valid saved data", () => run(weaponsSetup + `
    start()
    for i=1,140 do kill("weapon_custom_"..i) end
    local data=report()
    assert(data.SelfValue==140 and #data.Weapons<=128)
    local sum,count=0,0
    for _,entry in pairs(data.Profile.Weapons) do sum=sum+entry.human.Kills; count=count+1 end
    assert(sum==140 and count==128 and data.Profile.Weapons.unattributed.human.Kills==13)
    assert(schema.parse(data.Profile))
    stats:Flush()
`));

test("weapon damage tracks fractional effective health and armor loss even without kills or infections", () => run(weaponsSetup + `
    start(); human.weapon=weapon("weapon_ar2"); zombie.armor=20
    local event={GetAttacker=function() return human end,GetInflictor=function() return human end}
    stats.Combat:Begin(zombie,event)
    human.weapon=weapon("weapon_smg1"); zombie.health=89.75; zombie.armor=7.5
    stats.Combat:End(zombie,event,true); stats.Combat:End(zombie,event,true)
    damage(zombie,human,20.5,2.5)
    local function query(id,metric,map)
        return stats:Report(human.id,{Map=map or "",Role="human",Metric=metric,Target="",Weapon=id})
    end
    assert(query("weapon_ar2","DamageDealt").SelfValue==10.25)
    assert(query("weapon_smg1","DamageDealt").SelfValue==20.5)
    assert(query("","DamageDealt").SelfValue==30.75)
    assert(query("weapon_ar2","ArmorDamageDealt",currentMap).SelfValue==12.5)
    assert(query("weapon_smg1","ArmorDamageDealt").SelfValue==2.5)
    local total=query("","DamageDealt")
    assert(#total.Weapons==2 and total.Profile.Roles.human.Kills==0)
    assert(query("weapon_ar2","DamageDealt").WeaponValues.DamageDealt==10.25)
    stats:Flush()
    local stored=util.JSONToTable(files["zombieplague/statistics/v1/"..currentMap..".json"])
    assert(stored.Version==4)
`));

test("projectile damage retains its launcher and the original special role before post-damage callbacks", () => run(weaponsSetup + `
    start(); human.survivor=true; hook.Call("ZPPlayerRoleChanged",GM,human)
    local projectile=weapon("grenade_ar2")
    local event={GetAttacker=function() return human end,GetInflictor=function() return projectile end}
    stats.Combat:Begin(zombie,event)
    human.survivor=false; human.weapon=weapon("weapon_smg1"); hook.Call("ZPPlayerRoleChanged",GM,human)
    zombie.health=-900
    stats.Combat:End(zombie,event,true)
    local data=stats.Records:Get(currentMap,human.id,human:Name())
    assert(data.Roles.survivor.DamageDealt==100 and data.Roles.human.DamageDealt==0)
    assert(data.Weapons.weapon_ar2.survivor.DamageDealt==100)
    assert(data.Weapons.weapon_ar2.human.DamageDealt==0 and not data.Weapons.weapon_smg1)
`));

test("version two weapon history preserves known kills and keeps old damage unattributed after migration", () => run(weaponsSetup + `
    local legacy=schema.empty(currentMap,human.id,human:Name())
    legacy.Roles.human.Kills=2; legacy.Roles.human.Rounds=1
    legacy.Roles.human.DamageDealt=100; legacy.Roles.human.ArmorDamageDealt=25
    legacy.Weapons.weapon_ar2=include("sh_statistics_weapons.lua").empty()
    legacy.Weapons.weapon_ar2.human.Kills=2
    for _,role in ipairs(schema.roles) do
        legacy.Weapons.weapon_ar2[role].DamageDealt=nil; legacy.Weapons.weapon_ar2[role].ArmorDamageDealt=nil
    end
    files["zombieplague/statistics/v1/"..currentMap..".json"]=util.TableToJSON({Version=2,Map=currentMap,Records={legacy}})
    start(); human.weapon=weapon("weapon_smg1"); zombie.armor=10
    damage(zombie,human,15.5,5.25)
    local data=report().Profile
    assert(data.Roles.human.DamageDealt==115.5 and data.Roles.human.ArmorDamageDealt==30.25)
    assert(data.Weapons.weapon_ar2.human.Kills==2 and data.Weapons.weapon_ar2.human.DamageDealt==0)
    assert(data.Weapons.unattributed.human.DamageDealt==100 and data.Weapons.unattributed.human.ArmorDamageDealt==25)
    assert(data.Weapons.weapon_smg1.human.DamageDealt==15.5)
    stats:Flush()
    local Store=include("sv_statistics_json.lua").StatisticsJSONStorage
    local restored; construct(Store):Load(function(records) restored=records end)
    for _,entry in ipairs(restored) do if entry.SteamID64==human.id then
        assert(entry.Weapons.weapon_smg1.human.DamageDealt==15.5 and entry.Weapons.unattributed.human.DamageDealt==100)
    end end
`));

test("damage attribution accepts fractional counters and floating-point summation without accepting corrupt totals", () => run(weaponsSetup + `
    local profile=schema.empty(currentMap,human.id,human:Name())
    local attribution=include("sh_statistics_weapons.lua")
    profile.Roles.human.DamageDealt=0.3
    profile.Weapons.weapon_ar2=attribution.empty(); profile.Weapons.weapon_smg1=attribution.empty()
    profile.Weapons.weapon_ar2.human.DamageDealt=0.1; profile.Weapons.weapon_smg1.human.DamageDealt=0.2
    assert(schema.parse(profile))
    profile.Weapons.weapon_ar2.human.DamageDealt=math.huge; assert(not schema.parse(profile))
    profile.Weapons.weapon_ar2.human.DamageDealt=-0.1; assert(not schema.parse(profile))
    profile.Weapons.weapon_ar2.human.DamageDealt=1; assert(not schema.parse(profile))
`));
