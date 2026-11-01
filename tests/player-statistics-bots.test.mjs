import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { statisticsSetup as setup } from "./helpers/player-statistics.mjs";

const bots = setup + `
local function newBot(team)
    local bot=newPlayer("0",team); bot.bot=true; return bot
end
local function report(ply,role,metric,map)
    return stats:Report(stats:GetPlayerID(ply),{Map=map or "",Role=role,Metric=metric,Target=""})
end
local function assertIndependentProfiles()
    for _,role in ipairs(schema.roles) do
        local seen={}
        for _,entry in ipairs(report(human,role,"Rounds").Leaders) do
            assert(not seen[entry.ID] and schema.profileID(entry.ID)); seen[entry.ID]=true
            assert(entry.Bot and entry.SteamID64=="" or not entry.Bot and entry.SteamID64==entry.ID)
        end
    end
end
`;

test("ten infections count for the player and keep each infected bot's independent profile", () => run(bots + `
    start(); include("sv_infectionmanager.lua")
    hook.Call("ZPFirstZombieEvent",GM,zombie)
    for i=1,10 do InfectionManager:Infect(newBot(TEAM_HUMANS),zombie) end
    assert(zombie.frags==10)
    assert(row(zombie).zombie.Infections==10 and row(zombie).zombie.BestInfections==10)
    assert(row(zombie).zombie.FirstZombieInfections==10 and row(zombie).zombie.Kills==0)
    assert(report(zombie,"zombie","Infections",currentMap).SelfValue==10)
    assert(report(zombie,"zombie","Infections").SelfValue==10)
    local botProfiles=0
    for _,entry in ipairs(report(human,"human","Infected").Leaders) do if entry.Bot then
        botProfiles=botProfiles+1; assert(entry.Value==1)
    end end
    assert(botProfiles==10)
    assertIndependentProfiles()
    stats:Flush()
    local Store=include("sv_statistics_json.lua").StatisticsJSONStorage
    local saved
    construct(Store):Load(function(records) saved=records end)
    for _,entry in ipairs(saved) do assert(entry.ID~="0" and schema.profileID(entry.ID)) end
`));

test("cures and infections credit both real players and bots without mixing their identities", () => run(bots + `
    start(); include("sv_infectionmanager.lua")
    InfectionManager:Cure(newBot(TEAM_ZOMBIES),human)
    assert(row(human).human.Cures==1 and human.frags==1)
    local attacker=newBot(TEAM_ZOMBIES)
    InfectionManager:Infect(other,attacker)
    assert(row(other).human.Infected==1 and row(other).human.Deaths==0)
    assert(row(attacker).zombie.Infections==1)
    InfectionManager:Cure(other,other)
    assert(row(other).zombie.SelfCures==1 and row(other).zombie.Cured==1)
    assertIndependentProfiles()
`));

test("damage, armor, kills and assists against bots count for players with exclusive special roles", () => run(bots + `
    start()
    local target=newBot(TEAM_ZOMBIES); target.health=40; target.armor=20; target.nemesis=true
    human.survivor=true; hook.Call("ZPPlayerRoleChanged",GM,human)
    damage(target,other,10,20); damage(target,human,1000)
    target.alive=false; hook.Call("PlayerDeath",GM,target,{},human)
    assert(row(other).human.DamageDealt==10 and row(other).human.ArmorDamageDealt==20)
    assert(row(other).human.Assists==1)
    assert(row(human).survivor.DamageDealt==30 and row(human).survivor.Kills==1)
    assert(row(human).survivor.NemesisKills==1 and row(human).human.Kills==0)
    assertIndependentProfiles()
`));

test("incoming bot damage and deaths count while a bot finisher can credit another player's assist", () => run(bots + `
    start()
    local attacker=newBot(TEAM_ZOMBIES); human.armor=15
    damage(human,attacker,25,15)
    human.alive=false; hook.Call("PlayerDeath",GM,human,{},attacker)
    assert(row(human).human.DamageTaken==25 and row(human).human.ArmorDamageTaken==15)
    assert(row(human).human.Deaths==1)
    local target=newBot(TEAM_ZOMBIES); local finisher=newBot(TEAM_HUMANS)
    damage(target,other,10)
    target.alive=false; hook.Call("PlayerDeath",GM,target,{},finisher)
    assert(row(other).human.Assists==1 and row(other).human.Kills==0)
    assertIndependentProfiles()
`));

test("nonparticipants and disabled statistics cannot generate bot-related counters", () => run(bots + `
    start(); include("sv_infectionmanager.lua")
    local target=newBot(TEAM_HUMANS); table.remove(participants,#participants)
    InfectionManager:Infect(target,zombie)
    assert(row(zombie).zombie.Infections==0)
    enabled=false; callbacks.zp_statistics_enabled()
    InfectionManager:Infect(newBot(TEAM_HUMANS),zombie)
    assert(row(zombie).zombie.Infections==0)
    assertIndependentProfiles()
`));

test("bots sharing SteamID64 zero and the same name receive distinct persistent profiles", () => run(bots + `
    local first=newBot(TEAM_ZOMBIES); local second=newBot(TEAM_ZOMBIES)
    first.name="Twin"; second.name="Twin"
    start()
    local a,b=stats:GetPlayerID(first),stats:GetPlayerID(second)
    assert(a~=b and schema.botID(a) and schema.botID(b))
    stats.Tracking:Add(first,"Kills",2); stats.Tracking:Add(second,"Kills",3)
    assert(report(first,"zombie","Kills").SelfValue==2 and report(second,"zombie","Kills").SelfValue==3)
    stats:Flush()
    local saved=util.JSONToTable(files["zombieplague/statistics/v1/"..currentMap..".json"])
    assert(saved.Version==4)
    local count=0
    for _,entry in ipairs(saved.Records) do if entry.Bot then
        count=count+1; assert(entry.SteamID64=="" and (entry.ID==a or entry.ID==b))
    end end
    assert(count==2)
`));

test("bot combat accumulates damage, armor, kills, assists and weapon counters independently of humans", () => run(bots + `
    local attacker=newBot(TEAM_HUMANS); local helper=newBot(TEAM_HUMANS); local target=newBot(TEAM_ZOMBIES)
    attacker.name="Attacker"; helper.name="Helper"; target.name="Target"
    attacker.weapon=weapon("weapon_ar2"); helper.weapon=weapon("weapon_smg1")
    target.health=50; target.armor=10
    start(); damage(target,helper,10,10); damage(target,attacker,1000)
    target.alive=false; hook.Call("PlayerDeath",GM,target,weapon("weapon_ar2"),attacker)
    assert(row(attacker).human.DamageDealt==40 and row(attacker).human.Kills==1)
    assert(row(helper).human.Assists==1 and row(helper).human.ArmorDamageDealt==10)
    assert(row(target).zombie.DamageTaken==50 and row(target).zombie.Deaths==1)
    local data=report(attacker,"human","Kills").Profile
    assert(data.Bot and data.SteamID64=="" and data.Weapons.weapon_ar2.human.DamageDealt==40)
    assert(data.Weapons.weapon_ar2.human.Kills==1 and row(human).human.Kills==0)
`));

test("bot identities remain stable across respawns and round changes and named replacements resume history", () => run(bots + `
    local first=newBot(TEAM_ZOMBIES); first.name="Persistent"
    start(); local id=stats:GetPlayerID(first)
    stats.Tracking:Add(first,"Infections",2); stats:End(); stats:Sync()
    hook.Call("PlayerSpawn",GM,first); assert(stats:GetPlayerID(first)==id)
    hook.Call("PlayerDisconnected",GM,first)
    for index,ply in ipairs(participants) do if ply==first then table.remove(participants,index); break end end
    local replacement=newBot(TEAM_ZOMBIES); replacement.name="Persistent"
    assert(stats:GetPlayerID(replacement)==id)
    advance(1); stats.Tracking:Add(replacement,"Infections",1)
    assert(report(replacement,"zombie","Infections").SelfValue==3)
`));

test("bots retain per-map history and resume persisted totals after the service is recreated", () => run(bots + `
    local bot=newBot(TEAM_ZOMBIES); bot.name="Across maps"
    start(); local id=stats:GetPlayerID(bot)
    stats.Tracking:Add(bot,"Kills",2); stats:End()
    currentMap="zm_second"; stats:Sync(); stats.Tracking:Add(bot,"Kills",3); stats:End()
    assert(report(bot,"zombie","Kills").SelfValue==5)
    assert(report(bot,"zombie","Kills","zm_test").SelfValue==2)
    local fresh=construct(module.PlayerStatistics)
    fresh:Initialize(); assert(fresh:GetPlayerID(bot)==id)
    local data=fresh:Report(id,{Map="",Role="zombie",Metric="Kills",Target=""})
    assert(data.SelfValue==5 and data.Profile.Bot)
    assert(fresh:Report(human.id,{Map="",Role="zombie",Metric="Kills",Target=id}).Profile.ID==id)
`));

test("training bots collect survival, round results and combat while the server toggle still disables collection", () => run(bots + `
    training=true
    local bot=newBot(TEAM_HUMANS); bot.name="Training"
    start(); assert(stats:IsEnabled())
    advance(2); stats.Tracking:Add(bot,"Kills",1)
    state=3; hook.Call("ZPEndRound",GM,HUMANS_WIN)
    assert(row(bot).human.AliveTime==2 and row(bot).human.Wins==1 and row(bot).human.SurvivedRounds==1)
    assert(row(bot).human.Rounds==1 and row(bot).human.Kills==1)
    enabled=false; callbacks.zp_statistics_enabled()
    stats.Tracking:Add(bot,"Kills",20); advance(10)
    assert(not stats:IsEnabled() and row(bot).human.Kills==1)
`));

test("identity validation accepts legacy human profiles and rejects zero, mismatched metadata and malformed bot IDs", () => run(bots + `
    local bot=newBot(TEAM_HUMANS); local id=stats:GetPlayerID(bot)
    local data=schema.empty(currentMap,id,"Bot")
    assert(schema.parse(data) and data.Bot and data.SteamID64=="")
    data.SteamID64=human.id; assert(not schema.parse(data))
    data.SteamID64=""; data.Bot=false; assert(not schema.parse(data))
    assert(not schema.profileID("0") and not schema.botID("bot:"..string.rep("a",64)..":0"))
    assert(not schema.botID("bot:"..string.rep("a",64)..":129"))
    assert(not schema.botID("bot:"..string.rep("a",64)..":01"))
    local legacy=schema.empty(currentMap,human.id,human:Name()); legacy.ID=nil; legacy.Bot=nil
    local parsed=schema.parse(legacy); assert(parsed.ID==human.id and not parsed.Bot and parsed.SteamID64==human.id)
`));
