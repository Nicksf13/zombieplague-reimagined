-- Generated from src/gamemodes/zombieplague/gamemode/weapons/server/sv_weapon_definition.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ObjectAssign(target, ...)
    local sources = {...}
    for i = 1, #sources do
        local source = sources[i]
        if type(source) == "table" then
            for key in pairs(source) do
                target[key] = source[key]
            end
        end
    end
    return target
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.WeaponDefinition = __TS__Class()
local WeaponDefinition = ____exports.WeaponDefinition
WeaponDefinition.name = "WeaponDefinition"
function WeaponDefinition.prototype.____constructor(self, options)
    self.WeaponType = WEAPON_PRIMARY
    self.DamageMultiplier = 1
    self.Order = 100
    self.PrettyName = options.PrettyName
    self.WeaponID = options.WeaponID
    __TS__ObjectAssign(self, options)
end
function WeaponDefinition.prototype.GiveWeapon(self, ply)
    if not self.WeaponID then
        return
    end
    local weapon = ply:GetWeapon(self.WeaponID)
    if not IsValid(weapon) then
        weapon = ply:Give(self.WeaponID)
    end
    if not IsValid(weapon) then
        return
    end
    local clip = weapon:GetMaxClip1()
    if clip ~= nil then
        ply:GiveAmmo(
            clip * 10,
            weapon:GetPrimaryAmmoType(),
            true
        )
    else
        ply:GiveAmmo(
            weapon:GetMaxClip2() * 10,
            weapon:GetSecondaryAmmoType(),
            true
        )
    end
end
function WeaponDefinition.prototype.ShouldBeEnabled(self)
    return true
end
_G.WeaponDefinition = ____exports.WeaponDefinition
return ____exports
