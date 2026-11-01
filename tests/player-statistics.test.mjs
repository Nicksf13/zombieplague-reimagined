import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { statisticsSetup as setup } from "./helpers/player-statistics.mjs";

test("four exclusive roles track real kills separately from legacy infection and cure frags", () => run(setup + `
    start(); include("sv_infectionmanager.lua")
    InfectionManager:Infect(human,zombie)
    assert(zombie.frags==1 and human.deaths==1)
    assert(row(zombie).zombie.Infections==1 and row(zombie).zombie.Kills==0)
    assert(row(human).human.Infected==1 and row(human).human.Deaths==0)
    InfectionManager:Cure(human,other)
    assert(other.frags==1 and row(other).human.Cures==1 and row(other).human.Kills==0)
    InfectionManager:Cure(zombie,zombie)
    assert(row(zombie).zombie.SelfCures==1 and row(zombie).human.SelfCures==0)
    zombie:Infect(); zombie.nemesis=true; hook.Call("ZPPlayerRoleChanged",GM,zombie)
    human.survivor=true; hook.Call("ZPPlayerRoleChanged",GM,human)
    zombie.alive=false; hook.Call("PlayerDeath",GM,zombie,{},human)
    assert(row(human).survivor.Kills==1 and row(human).human.Kills==0)
    assert(row(human).survivor.NemesisKills==1 and row(zombie).nemesis.Deaths==1)
    assert(row(zombie).zombie.Deaths==0)
`));

test("effective health and armor damage exclude overkill and duplicate receipts; assists expire", () => run(setup + `
    start(); zombie.health=40; zombie.armor=20
    local event=damage(zombie,other,10,20)
    stats.Combat:End(zombie,event,true)
    assert(row(other).human.DamageDealt==10 and row(other).human.ArmorDamageDealt==20)
    damage(zombie,human,1000)
    zombie.alive=false; hook.Call("PlayerDeath",GM,zombie,{},human)
    assert(row(human).human.DamageDealt==30 and row(zombie).zombie.DamageTaken==40)
    assert(row(other).human.Assists==1 and row(human).human.Kills==1)
    zombie.alive=true; zombie.health=100; hook.Call("PlayerSpawn",GM,zombie)
    damage(zombie,other,10); advance(11)
    zombie.alive=false; hook.Call("PlayerDeath",GM,zombie,{},human)
    assert(row(other).human.Assists==1)
`));

test("survival, distance and per-role participation stop at conversion, death and round end", () => run(setup + `
    start(); human.position=vector(100); advance(1)
    assert(row(human).human.AliveTime==1 and row(human).human.Distance==100)
    human:Infect(); advance(2)
    assert(row(human).human.AliveTime==1 and row(human).zombie.AliveTime==2)
    assert(row(human).human.Rounds==1 and row(human).zombie.Rounds==1)
    human.position=vector(20000); advance(0.5)
    assert(row(human).zombie.Distance==0)
    human.alive=false; hook.Call("PlayerDeath",GM,human,{},other); advance(5)
    assert(row(human).zombie.AliveTime==2.5 and row(human).zombie.BestSurvival==2.5)
    state=3; hook.Call("ZPEndRound",GM,HUMANS_WIN); advance(20)
    assert(row(other).human.Wins==1 and row(other).human.SurvivedRounds==1)
    assert(row(human).zombie.SurvivedRounds==0)
`));

test("disabled collection preserves history, stops network access and resumes without counting downtime", () => run(setup + `
    start(); advance(2); enabled=false; callbacks.zp_statistics_enabled()
    local before=writes; advance(100)
    stats.Tracking:Add(human,"Kills",50); assert(row(human).human.Kills==0)
    assert(row(human).human.AliveTime==2 and not globals.ZPStatisticsEnabled)
    stats:Flush(); assert(writes==before)
    enabled=true; callbacks.zp_statistics_enabled(); advance(1)
    assert(row(human).human.AliveTime==3)
`));

test("all-map reports add totals, preserve records, include offline players and rank ties consistently", () => run(setup + `
    start()
    local a=stats.Records:Get("zm_a",human:SteamID64(),"First")
    local b=stats.Records:Get("zm_b",human:SteamID64(),"First")
    a.Roles.human.Kills=3; a.Roles.human.BestKills=3; a.Roles.human.Rounds=1
    b.Roles.human.Kills=4; b.Roles.human.BestKills=4; b.Roles.human.Rounds=1
    local offline=stats.Records:Get("zm_b","76561198000000009","Offline")
    offline.Roles.human.Kills=7; offline.Roles.human.Rounds=1
    local query={Map="",Role="human",Metric="Kills",Target=""}
    local report=stats:Report(human:SteamID64(),query)
    assert(report.SelfRank==1 and report.SelfValue==7 and report.Leaders[2].Rank==1)
    assert(report.Profile.Roles.human.BestKills==4)
    report.Profile.Roles.human.Kills=500; assert(a.Roles.human.Kills==3)
    query.Map="zm_a"; report=stats:Report(human:SteamID64(),query)
    assert(report.SelfValue==3 and report.Players==1)
`));

test("asynchronous storage loads before collection and retains updates made during a save", () => run(setup + `
    local loaded,saved,batches
    local backend={Load=function(self,callback) loaded=callback end,
        Save=function(self,records,callback) batches=records; saved=callback end}
    assert(stats:SetStorage(backend)); start(); advance(2)
    assert(not stats.Tracking.Active and not stats:SetStorage(backend))
    loaded({}); stats:Sync(); stats.Tracking:Add(human,"Kills",1); stats:Flush()
    assert(batches[1].Roles.human.Kills==1)
    stats.Tracking:Add(human,"Kills",1); saved(true); stats:Flush()
    assert(batches[1].Roles.human.Kills==2)
    saved(false); stats:Flush(); assert(batches[1].Roles.human.Kills==2)
`));

test("JSON storage survives reload, retries failed writes and preserves corrupt files", () => run(setup + `
    start(); stats.Tracking:Add(human,"Kills",3); stats:Flush()
    local Store=include("sv_statistics_json.lua").StatisticsJSONStorage
    local store=construct(Store); local restored
    store:Load(function(records) restored=records end)
    local found=false; for _,entry in ipairs(restored) do if entry.SteamID64==human.id then found=entry.Roles.human.Kills==3 end end
    assert(found)
    failWrites=true; stats.Tracking:Add(human,"Kills",1); stats:Flush()
    failWrites=false; stats:Flush()
    store=construct(Store); store:Load(function(records) restored=records end)
    for _,entry in ipairs(restored) do if entry.SteamID64==human.id then assert(entry.Roles.human.Kills==4) end end
    files["zombieplague/statistics/v1/zm_broken.json"]="broken"
    store=construct(Store); store:Load(function(records) restored=records end); assert(restored==nil)
    local before=writes; store:Save({},function(success) assert(not success) end)
    assert(writes==before and files["zombieplague/statistics/v1/zm_broken.json"]=="broken")
`));

test("armor consumed by an infection is attributed before the team changes and role hooks do not stop addons", () => run(setup + `
    start(); include("sv_infectionmanager.lua")
    human.armor=10
    local event={GetAttacker=function() return zombie end,GetInflictor=function() return zombie end}
    stats.Combat:Begin(human,event); human.armor=0
    InfectionManager:Infect(human,zombie)
    stats.Combat:End(human,event,false)
    assert(row(zombie).zombie.ArmorDamageDealt==10 and row(zombie).zombie.DamageDealt==0)
    assert(row(human).human.ArmorDamageTaken==10 and row(human).human.Infected==1)
    assert(hooks.ZPPlayerRoleChanged.ZPPlayerStatistics(human)==nil)
    assert(hooks.PlayerSilentDeath.ZPPlayerStatistics(human)==nil)
`));

test("validation rejects corrupt counters and UTF-8 names retain complete codepoints", () => run(setup + `
    local profile=schema.empty("zm_test",human.id,string.rep("界",30))
    assert(#profile.Name==63 and profile.Name==string.rep("界",21))
    assert(schema.parse(profile))
    profile.Roles.human.Kills=1.5; assert(not schema.parse(profile))
    profile.Roles.human.Kills=0; profile.Roles.human.DamageDealt=math.huge; assert(not schema.parse(profile))
    profile.Roles.human.DamageDealt=0/0; assert(not schema.parse(profile))
`));
