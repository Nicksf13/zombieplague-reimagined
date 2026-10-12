import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

// Equivalent to TypeScript's new operator for the emitted constructors.
const construct = `
local function construct(class, options)
    local instance = setmetatable({}, class.prototype)
    instance:____constructor(options)
    return instance
end
`;

test("content files export independent instances without temporary definition globals", () => run(`
    include("sv_utils.lua"); include("sv_weaponmanager.lua")
    include("sv_classmanager.lua"); include("sv_extraitems.lua")
    Weapon, ZPClass, ExtraItem = nil, nil, nil
    local ruger = include("weapons/arccw/arccw_ruger.lua").default
    local pistol = include("weapons/hl2/hl2_pistol.lua").default
    local human = include("classes/humans/original/default.lua").default
    local zombie = include("classes/zombies/original/default.lua").default
    local armor = include("extraitems/zp_armor.lua").default
    assert(ruger.WeaponID == "arccw_ruger" and ruger.DamageMultiplier == 2.4)
    assert(ruger ~= pistol and ruger:ShouldBeEnabled() and ruger.Order == 100)
    assert(human.ID == "DefaultHuman" and human.Team == TEAM_HUMANS and human.Armor == 25)
    assert(zombie.ID == "DefaultZombie" and zombie.Team == TEAM_ZOMBIES and zombie.MaxHealth == 2000)
    assert(human:FallFunction() and not zombie:FallFunction())
    local given
    zombie:WeaponGive({Give=function(self,id) given=id end})
    assert(given == ZOMBIE_KNIFE)
    assert(armor.Order == 100 and armor:CanBuy({Alive=function() return true end}))
    assert(not armor:CanBuy({Alive=function() return false end}))
    assert(Weapon == nil and ZPClass == nil and ExtraItem == nil)
    assert(next(ClassManager.HumanClasses) == nil and next(ExtraItemsManager.HumansExtraItems) == nil)
`));

test("constructor overrides keep callback self and the legacy ammunition rules", () => run(construct + `
    include("sv_weaponmanager.lua"); include("sv_extraitems.lua")
    local definition = construct(WeaponDefinition, {PrettyName="Custom",WeaponID="custom"})
    local clip, ammo, received = 0, nil, nil
    local entity = {GetMaxClip1=function() return clip end, GetPrimaryAmmoType=function() return 1 end,
        GetMaxClip2=function() return 3 end, GetSecondaryAmmoType=function() return 2 end}
    local ply = {GetWeapon=function(self,id) received=id; return entity end,
        GiveAmmo=function(self,count,kind,silent) ammo={count,kind}; assert(silent) end}
    definition:GiveWeapon(ply)
    assert(received == "custom" and ammo[1] == 0 and ammo[2] == 1)
    clip = -1; definition:GiveWeapon(ply); assert(ammo[1] == -10)
    clip = nil; definition:GiveWeapon(ply); assert(ammo[1] == 30 and ammo[2] == 2)
    local item = construct(ExtraItemDefinition, {ID="custom",Name="Custom",Price=7,
        OnBuy=function(self,p) p.price=self.Price end,
        CanBuy=function(self,p) return self.Price <= p.balance end})
    local buyer={balance=7}
    assert(item:CanBuy(buyer)); item:OnBuy(buyer); assert(buyer.price == 7)
    buyer.balance=6; assert(not item:CanBuy(buyer))
    local smg = include("weapons/hl2/hl2_smg1.lua").default
    smg.WeaponID = "custom_smg"
    clip = 5
    ply.Give = function(self,id) received=id end
    smg:GiveWeapon(ply); assert(received == "custom_smg")
`));

test("loaders register exported definitions on the receiving manager and honor availability", () => run(construct + `
    include("sv_utils.lua")
    local weapons = construct(include("sv_weaponmanager.lua").WeaponManager)
    local classes = construct(include("sv_classmanager.lua").ClassManager)
    local items = construct(include("sv_extraitems.lua").ExtraItemsManager)
    weapons:SearchWeapons(); classes:SearchClasses(); items:Search()
    assert(weapons:FindWeaponByWeaponId("weapon_ar2",WEAPON_PRIMARY))
    assert(not weapons:FindWeaponByWeaponId("arccw_ruger",WEAPON_SECONDARY))
    assert(classes:GetHumanClasses().DefaultHuman and classes:GetZombieClasses().DefaultZombie)
    assert(items:GetItemById(TEAM_HUMANS,"ZPArmor"))
    assert(not items:GetItemById(TEAM_HUMANS,"ZPM134"))
    assert(next(WeaponManager.PrimaryWeapons) == nil and next(ClassManager.HumanClasses) == nil)
    assert(#ExtraItemsManager.HumansExtraItems == 0)
    local alive, state = 1, ROUND_PLAYING
    RoundManager = {GetRoundState=function() return state end,CountHumansAlive=function() return alive end}
    local ability = classes:GetZombieClass("CamouflageZombie").Ability
    assert(ability.Drain == 45 and ability.MaxAbilityPower == 45 and ability:CanUseAbility())
    alive=0; assert(not ability:CanUseAbility())
    alive=1; state=0; assert(not ability:CanUseAbility())
`));

test("legacy Lua addons can still use temporary globals, factories and side-effect registration", () => run(`
    include("sv_utils.lua"); include("sv_weaponmanager.lua")
    include("sv_classmanager.lua"); include("sv_extraitems.lua")
    local originalInclude = include
    Utils.RecursiveFileSearch = function(self,folder)
        if folder:find("weapons") then return {"legacy_weapon"} end
        if folder:find("extraitems") then return {"legacy_item"} end
        if folder:find("humans") then return {"legacy_class"} end
        return {}
    end
    include = function(path)
        if path == "legacy_weapon" then
            Weapon.WeaponID, Weapon.PrettyName = "weapon_pistol", "Legacy"
            return {}
        elseif path == "legacy_item" then
            ExtraItem.ID, ExtraItem.Name, ExtraItem.Price = "legacy", "Legacy", 1
            ExtraItem.OnBuy = function(self,ply) ply.bought=self.ID end
        elseif path == "legacy_class" then
            ZPClass.Name = "Legacy"
            ClassManager:AddZPClass("legacy",ZPClass,TEAM_HUMANS)
        else return originalInclude(path) end
    end
    WeaponManager:SearchWeapons(); ClassManager:SearchClasses(); ExtraItemsManager:Search()
    local weapon = WeaponManager:FindWeaponByWeaponId("weapon_pistol",WEAPON_PRIMARY)
    assert(weapon and weapon.PrettyName == "Legacy" and weapon.DamageMultiplier == 1)
    local human = ClassManager:GetHumanClass("legacy")
    assert(human and human.Name == "Legacy" and human.Armor == 25)
    local item = ExtraItemsManager:GetItemById(TEAM_HUMANS,"legacy")
    assert(item and item.Order == 100 and item:ShouldBeEnabled())
    local ply = {}; item:OnBuy(ply); assert(ply.bought == "legacy")
`));
