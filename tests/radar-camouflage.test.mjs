import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { radarServerSetup } from "./helpers/radar.mjs";

const setup = radarServerSetup + `
set("allies",0)
local meta={}
FindMetaTable=function() return meta end
timer.Destroy=function(name) timers[name]=nil end
include("sv_player_abilities.lua"); include("sv_classmanager.lua")
local humanClass=include("classes/humans/custom/camouflage.lua").default
local zombieClass=include("classes/zombies/custom/camouflage.lua").default
local otherZombie=newPlayer(4,TEAM_ZOMBIES,200); ready(otherZombie)
RoundManager.GetAliveHumans=function() return {human} end
RoundManager.GetAliveZombies=function() return {zombie} end
WeaponManager={GetWeaponsTableByWeaponType=function() return {{WeaponID="knife"}} end}
for _,ply in ipairs(players) do
    for _,method in ipairs({"SetHealth","SetWalkSpeed","SetRunSpeed","SetCrouchedWalkSpeed",
        "SetModel","SetupHands","SetAuxGravity","Give","GiveZombieAllowedWeapon","RemoveZombieAllowedWeapon"}) do
        ply[method]=function() end
    end
    ply.SetAbilityTimer=meta.SetAbilityTimer
    ply.GetHumanClass=function() return humanClass end
    ply.GetZombieClass=function() return zombieClass end
end
local function ability(ply) return (ply:IsZombie() and zombieClass or humanClass).Ability end
local function expire(ply)
    local name="ZPClassAbility"..ply:SteamID64()
    local callback=assert(timers[name])[2]; timers[name]=nil; callback()
end
local function contact(viewer,target)
    for _,sample in ipairs(state(viewer).Contacts) do if sample.ID==target.id then return sample end end
end
`;

for (const [name, target, enemy, ally] of [
    ["human", "human", "zombie", "friend"],
    ["zombie", "zombie", "human", "otherZombie"],
]) {
    test(`${name} camouflage fools attack detection only while the actual ability is active`, () => run(setup + `
        local target,enemy,ally=${target},${enemy},${ally}
        local team=target:Team()
        attack(target,false)
        assert(contact(enemy,target) and not contact(ally,target))
        ability(target):UseAction(target)
        assert(timers["ZPClassAbility"..target:SteamID64()][1]==30)
        assert(not contact(enemy,target),"Activation must remove the old hostile sample immediately")
        assert(not contact(ally,target),"Activation alone must not reveal a position")
        tick(10.2); attack(target,false)
        assert(not contact(enemy,target) and contact(ally,target))
        assert(not contact(target,target) and target:Team()==team and state(target).Team==team)
        set("mode",0); set("mode",2)
        tick(10.4); attack(target,false)
        assert(not contact(enemy,target) and contact(ally,target),"Mode changes must preserve active camouflage")
        expire(target)
        assert(not contact(ally,target) and not contact(enemy,target),"Expiry clears the old disguise without revealing movement")
        tick(10.6); attack(target,false)
        assert(contact(enemy,target) and not contact(ally,target))
        assert(hooks["ZPResetAbilityEvent"..target:SteamID64()].ZPRadarCamouflage==nil)
    `));

    test(`${name} camouflage is cancelled by ability reset and player lifecycle events`, () => run(setup + `
        local target,enemy,ally=${target},${enemy},${ally}
        for _,event in ipairs({"ability","PlayerDeath","PlayerSpawn","OnPlayerChangedTeam","ZPEndRound"}) do
            ability(target):UseAction(target)
            tick(now+0.2); attack(target,false)
            assert(contact(ally,target) and not contact(enemy,target))
            if event=="ability" then hook.Run("ZPResetAbilityEvent"..target:SteamID64())
            elseif event=="PlayerDeath" then target.alive=false; hook.Run(event,target)
            elseif event=="OnPlayerChangedTeam" then
                local team=target.team; target.team=enemy.team; hook.Run(event,target,team,target.team)
                target.team=team; hook.Run(event,target,enemy.team,team)
            else hook.Run(event,target) end
            assert(not contact(ally,target),event.." must clear samples of the disguise")
            assert(hooks["ZPResetAbilityEvent"..target:SteamID64()].ZPRadarCamouflage==nil)
            target.alive=true
            hook.Run("ZPResetAbilityEvent"..target:SteamID64())
            assert(timers["ZPClassAbility"..target:SteamID64()]==nil,"Cancelled timers must not keep camouflage active")
            tick(now+0.2); attack(target,false)
            assert(contact(enemy,target) and not contact(ally,target),event.." must restore the real radar team")
        end
    `));
}

test("purchased scans use perceived target teams while preserving each buyer's own team and access", () => run(setup + `
    set("mode",1)
    ZPRadar:Purchase(human); ZPRadar:Purchase(zombie)
    assert(contact(human,zombie) and contact(zombie,human))
    ability(human):UseAction(human); ability(zombie):UseAction(zombie)
    assert(not contact(human,zombie) and not contact(zombie,human))
    ZPRadar:Purchase(friend); ZPRadar:Purchase(otherZombie)
    assert(contact(friend,human).Source=="scan" and contact(otherZombie,zombie).Source=="scan")
    tick(11)
    assert(not contact(human,zombie) and not contact(zombie,human))
    assert(not contact(human,human) and not contact(zombie,zombie))
    assert(state(human).Team==TEAM_HUMANS and state(zombie).Team==TEAM_ZOMBIES)
    assert(state(human).Enabled and state(human).ScanUntil==20)
    assert(state(zombie).Enabled and state(zombie).ScanUntil==20)
    expire(human); expire(zombie)
    assert(not contact(friend,human) and not contact(otherZombie,zombie))
    assert(not contact(human,zombie) and not contact(zombie,human))
    tick(12)
    assert(contact(human,zombie).Source=="scan" and contact(zombie,human).Source=="scan")
    assert(not contact(friend,human) and not contact(otherZombie,zombie))
`));

test("camouflage activated while radar is disabled still fools subsequent scans and nearby zombie swings", () => run(setup + `
    set("mode",0)
    ability(zombie):UseAction(zombie)
    set("mode",2)
    human.position=Vector(300,0,0); zombie.position=Vector(400,0,0)
    attack(zombie,true)
    assert(not contact(human,zombie) and contact(otherZombie,zombie).Source=="attack")
    ZPRadar:Purchase(human); ZPRadar:Purchase(otherZombie)
    assert(not contact(human,zombie) and contact(otherZombie,zombie).Source=="scan")
`));

test("disconnect removes camouflage and reused entity indices cannot inherit a disguise", () => run(setup + `
    ability(human):UseAction(human)
    tick(10.2); attack(human,false); assert(contact(friend,human))
    hook.Run("PlayerDisconnected",human)
    assert(not contact(friend,human))
    assert(hooks["ZPResetAbilityEvent"..human:SteamID64()].ZPRadarCamouflage==nil)
    local replacement=newPlayer(human.id,TEAM_HUMANS,0); ready(replacement)
    tick(10.4); attack(replacement,false)
    assert(contact(zombie,replacement) and not contact(friend,replacement))
`));

test("both camouflage abilities impersonate allies while real teammates still need hostile detection", () => run(setup + `
    set("allies",1)
    for _,case in ipairs({{human,zombie,friend},{zombie,human,otherZombie}}) do
        local target,enemy,ally=case[1],case[2],case[3]
        assert(contact(ally,target).Source=="ally" and not contact(enemy,target))
        ability(target):UseAction(target)
        assert(not contact(ally,target) and not contact(enemy,target))
        tick(now+0.6)
        assert(contact(enemy,target).Source=="ally" and not contact(ally,target))
        attack(target,false)
        assert(contact(ally,target).Source=="attack" and contact(enemy,target).Source=="ally")
        expire(target)
        assert(not contact(ally,target) and not contact(enemy,target))
        tick(now+0.6)
        assert(contact(ally,target).Source=="ally" and not contact(enemy,target))
    end
`));
