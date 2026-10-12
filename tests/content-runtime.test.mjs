import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("weapon loader reads nested TS registrations, addon availability and projectile multipliers", () => run(`
    include("sv_utils.lua")
    include("sv_weaponmanager.lua")
    WeaponManager:SearchWeapons()
    local usp = WeaponManager:FindWeaponByWeaponId("m9k_usp", WEAPON_SECONDARY)
    assert(usp and usp.DamageMultiplier == 1.9)
    assert(WeaponManager:GetWeaponMultiplier("crossbow_bolt") == 2.2)
    assert(not WeaponManager:FindWeaponByWeaponId("m9k_an94", WEAPON_PRIMARY))
    assert(WeaponManager:IsChoosableWeapon("weapon_ar2"))
    assert(not WeaponManager:IsChoosableWeapon("weapon_crowbar"))
`));

test("class registry preserves defaults and method callbacks", () => run(`
    include("sv_utils.lua"); include("sv_classmanager.lua"); ClassManager:SearchClasses()
    local humans,zombies=0,0
    for _ in pairs(ClassManager:GetHumanClasses()) do humans=humans+1 end
    for _ in pairs(ClassManager:GetZombieClasses()) do zombies=zombies+1 end
    assert(humans==7 and zombies==11)
    assert(ClassManager:GetZPClass("DefaultHuman",TEAM_HUMANS).Armor==25)
    assert(ClassManager:GetZPClass("unknown",TEAM_ZOMBIES))
    assert(not ClassManager:GetHumanClass("LightHuman"):FallFunction())
    local ply={SetAbilityTimer=function(self,name,delay,callback) self.reset=callback; assert(delay==30) end}
    local ability=ClassManager:CreateClassAbility(true,function(p) p.active=true end,function(p) p.active=false end,30)
    ability:UseAction(ply); assert(ply.active); ply.reset(); assert(not ply.active)
`));

test("text backend handles missing and corrupt balances and writes exact SteamID64 paths", () => run(`
    Bank={}
    local contents,stored
    file.Exists=function() return false end
    file.CreateDir=function(path) assert(path=="zombie_plague") end
    file.Read=function(path) assert(path=="zombie_plague/76561198012345678.txt"); return contents end
    file.Write=function(path,value) stored={path,value} end
    include("bankstorage/text.lua")
    local storage=Bank.BankStorageSource
    local ply={SteamID64=function() return "76561198012345678" end}
    storage:Init(); assert(storage:GetPlayerAmmopacks(ply)==0)
    contents="invalid"; assert(storage:GetPlayerAmmopacks(ply)==0)
    contents="123"; assert(storage:GetPlayerAmmopacks(ply)==123)
    storage.Save(ply:SteamID64(),123)
    assert(stored[1]=="zombie_plague/76561198012345678.txt" and stored[2]=="123")
`));

test("extra item loader, purchase checks and end-round cleanup use the public contracts", () => run(`
    include("sv_utils.lua")
    include("sv_weaponmanager.lua"); WeaponManager:SearchWeapons()
    include("sv_extraitems.lua"); ExtraItemsManager:Search()
    local armor=ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPArmor")
    assert(armor and armor.Price==12)
    assert(not ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPM134"))
    assert(ExtraItemsManager:GetItemById(TEAM_ZOMBIES,"ZPZombieMadness"))
    local balance,healthArmor,notices=12,0,{}
    SendPopupMessage=function(ply,text) notices[#notices+1]=text end
    local ply={Alive=function() return true end,
        GetAmmoPacks=function() return balance end,TakeAmmoPacks=function(self,amount) balance=balance-amount end,
        Armor=function() return healthArmor end,SetArmor=function(self,value) healthArmor=value end}
    ExtraItemsManager:BuyItem(ply,armor)
    assert(balance==0 and healthArmor==100)
    assert(notices[1].Phrase=="zombieplague.extraitembought")
    assert(notices[1].Arguments[1].Phrase=="zombieplague.extraitemarmorname")
    ExtraItemsManager:BuyItem(ply,armor)
    assert(balance==0 and healthArmor==100 and #notices==2)
    local order={}
    ExtraItemsManager:AddRemoveFunction(function() order[#order+1]=1 end)
    ExtraItemsManager:AddRemoveFunction(function() order[#order+1]=2 end)
    hooks.ZPEndRound.ZPExtraItemsRemove()
    hooks.ZPEndRound.ZPExtraItemsRemove()
    assert(table.concat(order,",")=="2,1" and #ExtraItemsManager.PostRoundEvents==0)
`));
