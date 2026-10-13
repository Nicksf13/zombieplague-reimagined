import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { classServerSetup } from "./helpers/class-menu.mjs";

test("class catalog exposes enabled definitions without server callbacks or models", () => run(classServerSetup + `
    local catalog=classCatalog(1)
    assert(catalog.Code=="catalog" and #catalog.Snapshot.Entries==18)
    assert(catalog.Snapshot.First.human and catalog.Snapshot.First.zombie)
    for _,entry in ipairs(catalog.Snapshot.Entries) do
        assert(entry.Health>0 and entry.Jump>0 and not entry.WeaponGive and not entry.PModel)
        local registry=entry.Kind=="human" and ClassManager.HumanClasses or ClassManager.ZombieClasses
        local definition=registry[entry.ID]
        assert(entry.CrouchSpeed==definition.CrouchSpeed and entry.Breath==definition.Breath)
        assert(entry.Scale==(definition.Scale or 1) and entry.Footstep==definition.Footstep)
        assert(entry.FallDamage==definition:FallFunction())
        assert(entry.AbilityCost==(definition.Ability and definition.Ability.Drain or 0))
    end
    ClassManager.HumanClasses.DefaultHuman.ShouldBeEnabled=function() return false end
    for _,entry in ipairs(classCatalog(2).Snapshot.Entries) do assert(entry.ID~="DefaultHuman") end
    commands.classes(ply); assert(sent[1]=="ZPClassMenuOpen" and sent.recipient==ply)
`));

test("human first choice applies once, preserves damage and inventory, then opens weapons", () => run(classServerSetup + `
    ply.health=50; ply.armor=10; ply.inventory.pickup={}
    local heavy=ClassManager.HumanClasses.HeavyHuman
    assert(heavy)
    chooseClass(1,"human","HeavyHuman")
    assert(ply:GetHumanClass()==heavy and ply:GetMaxHealth()==heavy.MaxHealth)
    assert(ply:Health()==math.floor(heavy.MaxHealth/2))
    assert(ply:Armor()==math.floor((heavy.Armor or 0)*0.4))
    assert(ply.inventory.pickup and not ply.stripped)
    assert(sent[1]=="ZPWeaponMenuMissing" and sent[2]=="primary")
    assert(not ZPClassMenu:NeedsChoice(ply,"human") and ZPClassMenu:NeedsChoice(ply,"zombie"))
    assert(chooseClass(2,"human","DefaultHuman").Code=="saved")
    assert(ply:GetHumanClass()==heavy and ply.NextHumanClass==ClassManager.HumanClasses.DefaultHuman)
`));

test("first zombie prompt runs after infection, skips special roles, and applies class equipment", () => run(classServerSetup + `
    hook.Run("ZPClassSelectionReady",ply)
    ply.human=false; ply.health=1000; ply.maxHealth=2000
    flush(); assert(sent[1]=="ZPClassMenuMissing" and sent[2]=="zombie")
    local response=chooseClass(1,"zombie","BomberZombie")
    assert(response.Code=="applied" and not response.Snapshot.First.zombie)
    assert(ply:GetZombieClass()==ClassManager.ZombieClasses.BomberZombie)
    assert(ply.stripped==1 and ply.inventory[ZOMBIE_KNIFE])
    assert(chooseClass(2,"zombie","DefaultZombie").Code=="saved" and ply.stripped==1)
    for _,property in ipairs({"bot","nemesis","survivor"}) do
        local previous=ply; ply=newPlayer("skip-"..property); ply.human=false; ply[property]=true
        sent={}; hook.Run("ZPClassSelectionReady",ply); flush(); assert(#sent==0)
        ply=previous
    end
`));

test("later choices queue for the right team, including dead players and special roles", () => run(classServerSetup + `
    assert(chooseClass(1,"zombie","HeavyZombie").Code=="saved")
    assert(ply.NextZombieClass==ClassManager.ZombieClasses.HeavyZombie and not ply.ZombieClass)
    ply.alive=false
    assert(chooseClass(2,"human","HeavyHuman").Code=="saved" and not ply.HumanClass)
    assert(ply:GetNextHumanClass()==ClassManager.HumanClasses.HeavyHuman and not ply:GetNextHumanClass())
    assert(ply:GetNextZombieClass()==ClassManager.ZombieClasses.HeavyZombie and not ply:GetNextZombieClass())
    hooks.PlayerDisconnected.ZPClassMenuCleanup(ply)
    assert(ZPClassMenu:NeedsChoice(ply,"human") and ZPClassMenu:NeedsChoice(ply,"zombie"))
    ply.alive=true; ply.nemesis=true; ply.human=false
    assert(chooseClass(3,"zombie","DefaultZombie").Code=="saved" and not ply.stripped)
`));

test("invalid, disabled, mismatched and replayed requests never grant another class change", () => run(classServerSetup + `
    assert(chooseClass(1,"human","missing").Code=="invalid")
    assert(chooseClass(2,"human","DefaultZombie").Code=="invalid")
    ClassManager.HumanClasses.HeavyHuman.ShouldBeEnabled=function() return false end
    assert(chooseClass(3,"human","HeavyHuman").Code=="invalid")
    ply.alive=false
    assert(chooseClass(4,"human","DefaultHuman").Code=="saved")
    ply.NextHumanClass=nil
    assert(chooseClass(4,"human","DefaultHuman").Code=="saved" and not ply.NextHumanClass)
    assert(chooseClass(4,"zombie","DefaultZombie").Code=="invalid")
    local last=sent
    readTable={Version=1,RequestID=5,Kind="human",ID=string.rep("x",129)}
    receivers.ZPClassMenuSelect(512,ply); assert(sent==last)
    readTable={Version=2,RequestID=5,Kind="human",ID="DefaultHuman"}
    receivers.ZPClassMenuSelect(512,ply); assert(sent==last)
    readTable={Version=1,RequestID=5,Kind="human",ID="DefaultHuman"}
    receivers.ZPClassMenuSelect(5000,ply); assert(sent==last)
    uints={1,6}; receivers.ZPClassMenuCatalog(39,ply)
    assert(sent[2].Code=="rate_limited")
`));

test("spawn waits for the human class choice and deferred prompts recheck life state", () => run(classServerSetup + `
    sent={}; hooks.PlayerSpawn.ZPWeaponMenuMissingChoices(ply); flush(); assert(#sent==0)
    hook.Run("ZPClassSelectionReady",ply); flush()
    assert(sent[1]=="ZPClassMenuMissing" and sent[2]=="human")
    hook.Run("ZPClassSelectionReady",ply); ply.alive=false; sent={}; flush(); assert(#sent==0)
`));
