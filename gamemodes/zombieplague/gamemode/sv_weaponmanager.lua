-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/sv_weaponmanager.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local __TS__Symbol, Symbol
do
    local symbolMetatable = {__tostring = function(self)
        return ("Symbol(" .. (self.description or "")) .. ")"
    end}
    function __TS__Symbol(description)
        return setmetatable({description = description}, symbolMetatable)
    end
    Symbol = {
        asyncDispose = __TS__Symbol("Symbol.asyncDispose"),
        dispose = __TS__Symbol("Symbol.dispose"),
        iterator = __TS__Symbol("Symbol.iterator"),
        hasInstance = __TS__Symbol("Symbol.hasInstance"),
        species = __TS__Symbol("Symbol.species"),
        toStringTag = __TS__Symbol("Symbol.toStringTag")
    }
end

local function __TS__InstanceOf(obj, classTbl)
    if type(classTbl) ~= "table" then
        error("Right-hand side of 'instanceof' is not an object", 0)
    end
    if classTbl[Symbol.hasInstance] ~= nil then
        return not not classTbl[Symbol.hasInstance](classTbl, obj)
    end
    if type(obj) == "table" then
        local luaClass = obj.constructor
        while luaClass ~= nil do
            if luaClass == classTbl then
                return true
            end
            luaClass = luaClass.____super
        end
    end
    return false
end

local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
for ____, kind in ipairs({"primary", "secondary", "melee"}) do
    ConvarManager:CreateConVar(("zp_max_allowed_" .. kind) .. "_weapons", 1, 8, ("cvar used to define how many " .. kind) .. " weapons a player can have")
end
_G.WEAPON_PRIMARY = 1
_G.WEAPON_SECONDARY = 2
_G.WEAPON_MELEE = 3
_G.NATIVE_WEAPONS = {
    "weapon_357",
    "weapon_ar2",
    "weapon_crossbow",
    "weapon_pistol",
    "weapon_smg1",
    "weapon_shotgun",
    "weapon_crowbar",
    "weapon_stunstick"
}
include("sv_weapon_definition.lua")
local function isRegistered(weapon)
    return weapon.PrettyName ~= nil and weapon.WeaponID ~= nil
end
____exports.WeaponManager = __TS__Class()
local WeaponManager = ____exports.WeaponManager
WeaponManager.name = "WeaponManager"
function WeaponManager.prototype.____constructor(self)
    self.PrimaryWeapons = {}
    self.SecondaryWeapons = {}
    self.MeleeWeapons = {}
    self.WeaponsMultiplier = {}
    self.ServerWeapons = {unpack(NATIVE_WEAPONS)}
end
function WeaponManager.prototype.SearchWeapons(self)
    for ____, weapon in ipairs(weapons.GetList()) do
        local ____self_ServerWeapons_0 = self.ServerWeapons
        ____self_ServerWeapons_0[#____self_ServerWeapons_0 + 1] = weapon.ClassName
    end
    for ____, path in pairs(Utils:RecursiveFileSearch("zombieplague/gamemode/weapons", ".lua")) do
        _G.Weapon = self:CreateNewWeapon()
        local loaded = include(path)
        local ____temp_1
        if type(loaded) == "table" and loaded ~= nil and loaded.default ~= nil then
            ____temp_1 = loaded.default
        else
            ____temp_1 = loaded
        end
        local exported = ____temp_1
        local definition = __TS__InstanceOf(exported, WeaponDefinition) and exported or Weapon
        if not definition.PrettyName then
            Utils:Print(WARNING_MESSAGE, ("Cannot load: '" .. path) .. "', unknown 'Pretty Name'!")
        elseif not definition.WeaponID then
            Utils:Print(WARNING_MESSAGE, ("Cannot load: '" .. path) .. "', unknown 'WeaponID'!")
        elseif not self:IsValidWeaponType(definition.WeaponType) then
            Utils:Print(WARNING_MESSAGE, ("Cannot load: '" .. path) .. "', Invalid weapon type!")
        elseif isRegistered(definition) and self:ServerHasWeapon(definition.WeaponID) and definition:ShouldBeEnabled() then
            self:AddWeapon(definition, definition.WeaponType)
        end
    end
end
function WeaponManager.prototype.ServerHasWeapon(self, id)
    return __TS__ArrayIncludes(self.ServerWeapons, id)
end
function WeaponManager.prototype.IsChoosableWeapon(self, id)
    for ____, weapon in pairs(self.PrimaryWeapons) do
        if weapon.WeaponID == id then
            return true
        end
    end
    for ____, weapon in pairs(self.SecondaryWeapons) do
        if weapon.WeaponID == id then
            return true
        end
    end
    return false
end
function WeaponManager.prototype.IsChosenWeapon(self, id)
    return self:IsChoosableWeapon(id)
end
function WeaponManager.prototype.IsValidWeaponType(self, kind)
    return kind == WEAPON_PRIMARY or kind == WEAPON_SECONDARY or kind == WEAPON_MELEE
end
function WeaponManager.prototype.CreateNewWeapon(self)
    return {
        WeaponType = WEAPON_PRIMARY,
        DamageMultiplier = 1,
        Order = 100,
        GiveWeapon = WeaponDefinition.prototype.GiveWeapon,
        ShouldBeEnabled = WeaponDefinition.prototype.ShouldBeEnabled
    }
end
function WeaponManager.prototype.GetWeaponMultiplier(self, id)
    return self.WeaponsMultiplier[id]
end
function WeaponManager.prototype.AddWeaponMultiplier(self, id, multiplier)
    self.WeaponsMultiplier[id] = multiplier
end
function WeaponManager.prototype.AddWeapon(self, weapon, kind)
    self:GetWeaponsTableByWeaponType(kind)[weapon.WeaponID] = weapon
    self:AddWeaponMultiplier(weapon.ProjectileID or weapon.WeaponID, weapon.DamageMultiplier)
end
function WeaponManager.prototype.GetPrimaryWeapons(self)
    return self.PrimaryWeapons
end
function WeaponManager.prototype.GetSecondaryWeapons(self)
    return self.SecondaryWeapons
end
function WeaponManager.prototype.GetMeleeWeapons(self)
    return self.MeleeWeapons
end
function WeaponManager.prototype.GetWeaponsTableByWeaponType(self, kind)
    return kind == WEAPON_PRIMARY and self.PrimaryWeapons or (kind == WEAPON_SECONDARY and self.SecondaryWeapons or self.MeleeWeapons)
end
function WeaponManager.prototype.FindWeaponByWeaponId(self, id, kind)
    for ____, weapon in pairs(self:GetWeaponsTableByWeaponType(kind)) do
        if weapon.WeaponID == id then
            return weapon
        end
    end
    return nil
end
function WeaponManager.prototype.PlayerCanPickupWeapon(self, ply, id)
    for ____, ____value in ipairs({{WEAPON_PRIMARY, "primary"}, {WEAPON_SECONDARY, "secondary"}, {WEAPON_MELEE, "melee"}}) do
        local kind = ____value[1]
        local name = ____value[2]
        if self:GetWeaponsTableByWeaponType(kind)[id] then
            return self:CountPlayerWeaponsByWeaponType(ply, kind) < cvars.Number(("zp_max_allowed_" .. name) .. "_weapons", 1)
        end
    end
    return true
end
function WeaponManager.prototype.CountPlayerWeaponsByWeaponType(self, ply, kind)
    local registry = self:GetWeaponsTableByWeaponType(kind)
    local count = 0
    for ____, weapon in ipairs(ply:GetWeapons()) do
        if registry[weapon:GetClass()] then
            count = count + 1
        end
    end
    return count
end
local weaponManager = __TS__New(____exports.WeaponManager)
_G.WeaponManager = weaponManager
return ____exports
