import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { serverSetup } from "./helpers/weapon-menu.mjs";

test("remember preference is validated, rate limited and leaves current weapons intact", () => run(serverSetup + `
    selectWeapon(1,"primary","weapon_ar2")
    local weapon=ply:GetPrimaryWeapon()
    now=now+0.3
    assert(catalog(2).Snapshot.Remember==true)
    local function remember(id,value,length,version)
        now=now+0.3; uints={version or 1,id}; readBool=value
        receivers.ZPWeaponMenuRemember(length or 40,ply)
    end
    remember(3,false)
    assert(sent[2].Code=="preferences" and sent[2].Snapshot.Remember==false)
    assert(ply.RememberWeaponChoices==false and ply:GetPrimaryWeapon()==weapon and ply.gives==1)
    uints={1,4}; readBool=true; receivers.ZPWeaponMenuRemember(40,ply)
    assert(sent[2].Code=="rate_limited" and ply.RememberWeaponChoices==false)
    for _,length in ipairs({0,39,49,4096}) do
        sent={}; remember(5,true,length); assert(#sent==0 and ply.RememberWeaponChoices==false)
    end
    for _,id in ipairs({0,-1,2147483648}) do
        sent={}; remember(id,true); assert(#sent==0 and ply.RememberWeaponChoices==false)
    end
    sent={}; remember(6,true,40,2); assert(#sent==0 and ply.RememberWeaponChoices==false)
    remember(7,true); assert(ply.RememberWeaponChoices and sent[2].Snapshot.Remember)
`));

test("weapon catalog contains available data, selected IDs and per-life delivery state", () => run(serverSetup + `
    local response=catalog(1)
    assert(response.Version==1 and response.RequestID==1 and response.Code=="catalog")
    assert(sent.recipient==ply and ZPWeaponMenuProtocol.Reply(response))
    local seen={}
    for _,entry in ipairs(response.Snapshot.Entries) do
        seen[entry.ID]=true
        assert(type(entry.Name)=="string" and not entry.GiveWeapon and not entry.ShouldBeEnabled)
    end
    assert(seen.weapon_ar2 and seen.weapon_pistol and seen.weapon_crowbar and seen.m9k_usp)
    assert(not seen.m9k_an94 and not response.Snapshot.Truncated)
    assert(response.Snapshot.Selected.melee=="" and ply:GetMeleeWeapon().WeaponID=="weapon_crowbar")
    assert(response.Snapshot.CanReceive.primary)
    commands.weapons(ply)
    assert(sent[1]=="ZPWeaponMenuOpen" and sent.recipient==ply)
`));

test("spawn prompts run after loadout and open the first available category without a choice", () => run(serverSetup + `
    local deferred
    timer.Simple=function(delay,callback) assert(delay==0); deferred=callback end
    local function spawn()
        sent={}
        hooks.PlayerSpawn.ZPWeaponMenuMissingChoices(ply)
        assert(#sent==0)
        deferred()
        return sent[2]
    end
    assert(spawn()=="primary" and sent[1]=="ZPWeaponMenuMissing" and sent.recipient==ply)
    ply.PrimaryWeapon=WeaponManager:FindWeaponByWeaponId("weapon_ar2",WEAPON_PRIMARY)
    assert(spawn()=="secondary")
    ply.SecondaryWeapon=WeaponManager:FindWeaponByWeaponId("weapon_pistol",WEAPON_SECONDARY)
    assert(spawn()=="melee")
    ply.MeleeWeapon=ply:GetMeleeWeapon()
    assert(not spawn() and #sent==0)
    ply.PrimaryWeapon=nil
    for _,property in ipairs({"bot","survivor"}) do
        ply[property]=true; assert(not spawn() and #sent==0); ply[property]=false
    end
    ply.alive=false; assert(not spawn() and #sent==0); ply.alive=true
    ply.human=false; assert(not spawn() and #sent==0); ply.human=true
    -- Recheck after the deferred callback: an initial spectator spawn may have died.
    hooks.PlayerSpawn.ZPWeaponMenuMissingChoices(ply)
    ply.alive=false; sent={}; deferred(); assert(#sent==0)
`));

test("spawn skips empty categories instead of trapping players in an empty menu", () => run(serverSetup + `
    local deferred
    timer.Simple=function(_,callback) deferred=callback end
    for _,weapon in pairs(WeaponManager:GetWeaponsTableByWeaponType(WEAPON_PRIMARY)) do
        weapon.ShouldBeEnabled=function() return false end
    end
    hooks.PlayerSpawn.ZPWeaponMenuMissingChoices(ply); deferred()
    assert(sent[2]=="secondary")
    for _,kind in ipairs({WEAPON_SECONDARY,WEAPON_MELEE}) do
        for _,weapon in pairs(WeaponManager:GetWeaponsTableByWeaponType(kind)) do
            weapon.ShouldBeEnabled=function() return false end
        end
    end
    sent={}; hooks.PlayerSpawn.ZPWeaponMenuMissingChoices(ply); deferred()
    assert(#sent==0)
`));

test("all three weapon categories save choices and deliver only once per human life", () => run(serverSetup + `
    for index,pair in ipairs({{"primary","weapon_ar2"},{"secondary","weapon_pistol"},{"melee","weapon_crowbar"}}) do
        local response=selectWeapon(index,pair[1],pair[2])
        assert(response.Code=="issued" and response.Snapshot.Selected[pair[1]]==pair[2])
        assert(not response.Snapshot.CanReceive[pair[1]])
        assert(ply.inventory[pair[2]] and ply.gives==index)
    end
    local ammo=ply.ammo
    assert(selectWeapon(4,"primary","weapon_smg1").Code=="saved")
    assert(ply:GetPrimaryWeapon().WeaponID=="weapon_smg1")
    assert(ply.gives==3 and ply.ammo==ammo and not ply.inventory.weapon_smg1)
`));

test("dead humans, zombies and spectators can save without receiving weapons", () => run(serverSetup + `
    for index,state in ipairs({{false,true},{true,false},{false,false}}) do
        ply=newPlayer("7656119800000000"..index)
        ply.alive,ply.human=state[1],state[2]
        local response=selectWeapon(index,"primary","weapon_ar2")
        assert(response.Code=="saved" and ply:GetPrimaryWeapon().WeaponID=="weapon_ar2")
        assert(ply.gives==0 and not ply:GetPrimaryWeaponGiven())
    end
`));

test("invalid IDs, category spoofing and disabled weapons never change player selection", () => run(serverSetup + `
    assert(selectWeapon(1,"primary","weapon_pistol").Code=="invalid_weapon")
    assert(selectWeapon(2,"primary","unknown").Code=="invalid_weapon")
    local weapon=WeaponManager:FindWeaponByWeaponId("weapon_ar2",WEAPON_PRIMARY)
    weapon.ShouldBeEnabled=function() return false end
    assert(selectWeapon(3,"primary","weapon_ar2").Code=="invalid_weapon")
    assert(not ply:GetPrimaryWeapon() and ply.gives==0)
    for _,value in ipairs({false,{}, {Version=2,RequestID=4,Kind="primary",ID="weapon_ar2"},
        {Version=1,RequestID=0/0,Kind="primary",ID="weapon_ar2"},
        {Version=1,RequestID=4,Kind="bad",ID="weapon_ar2"},
        {Version=1,RequestID=4,Kind="primary",ID=string.rep("x",129)}}) do
        sent={}; readTable=value; receivers.ZPWeaponMenuSelect(512,ply)
        assert(#sent==0 and ply.gives==0)
    end
    local reads=0; net.ReadTable=function() reads=reads+1 end
    receivers.ZPWeaponMenuSelect(4097,ply)
    assert(reads==0)
`));

test("rate limits and replay receipts prevent repeated delivery across a life reset", () => run(serverSetup + `
    assert(selectWeapon(1,"primary","weapon_ar2").Code=="issued")
    ply:SetPrimaryWeaponGiven(false)
    assert(selectWeapon(1,"primary","weapon_ar2").Code=="issued" and ply.gives==1)
    assert(selectWeapon(1,"primary","weapon_smg1").Code=="invalid_weapon")
    assert(ply:GetPrimaryWeapon().WeaponID=="weapon_ar2")
    readTable={Version=1,RequestID=2,Kind="primary",ID="weapon_smg1"}
    receivers.ZPWeaponMenuSelect(512,ply)
    assert(sent[2].Code=="rate_limited" and ply.gives==1)
    hooks.PlayerDisconnected.ZPWeaponMenuCleanup(ply)
    assert(selectWeapon(1,"primary","weapon_smg1").Code=="issued" and ply.gives==2)
`));

test("catalogs are bounded and report truncation instead of sending oversized payloads", () => run(serverSetup + `
    for index=1,400 do
        local weapon=WeaponManager:CreateNewWeapon()
        weapon.PrettyName,weapon.WeaponID="Addon "..index,"addon_"..index
        WeaponManager:AddWeapon(weapon,WEAPON_PRIMARY)
    end
    local response=catalog(1)
    assert(response.Snapshot.Truncated and #response.Snapshot.Entries<=256)
    assert(ZPWeaponMenuProtocol.Reply(response))
    local budget=0
    for _,entry in ipairs(response.Snapshot.Entries) do budget=budget+#entry.ID+#entry.Name+256 end
    assert(budget<=48000)
`));
