-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_weapons.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.GiveZombieAllowedWeapon = function(self, Weap)
    self:AddZombieAllowedWeapon(Weap)
    self:Give(Weap)
    self:SelectWeapon(Weap)
end
PLAYER.AddZombieAllowedWeapon = function(self, Weap)
    local ____temp_0 = self:GetZombieAllowedWeapons()
    ____temp_0[#____temp_0 + 1] = Weap
end
PLAYER.SetZombieAllowedWeapons = function(self, AllowedWeapons)
    self.AllowedWeapons = AllowedWeapons
end
PLAYER.GetZombieAllowedWeapons = function(self)
    return self.AllowedWeapons or ({})
end
PLAYER.ZombieCanUseWeapon = function(self, Weap)
    if Weap == ZOMBIE_KNIFE then
        return true
    end
    for ____, LocalWeap in ipairs(self:GetZombieAllowedWeapons()) do
        if LocalWeap == Weap then
            return true
        end
    end
    return false
end
PLAYER.RemoveZombieAllowedWeapon = function(self, Weapon)
    self:StripWeapon(Weapon)
    table.RemoveByValue(
        self:GetZombieAllowedWeapons(),
        Weapon
    )
end
PLAYER.ResetZombieAllowedWeapons = function(self)
    self:SetZombieAllowedWeapons({ZOMBIE_KNIFE})
end
PLAYER.GiveWeapon = function(self, Weap)
    if self:Alive() and self:IsHuman() then
        Weap:GiveWeapon(self)
    end
end
PLAYER.SetPrimaryWeapon = function(self, PrimaryWeapon)
    self.PrimaryWeapon = PrimaryWeapon
    if PrimaryWeapon then
        if self:Alive() and self:IsHuman() and not self:GetPrimaryWeaponGiven() then
            self:GiveWeapon(PrimaryWeapon)
            self:SetPrimaryWeaponGiven(true)
        end
    end
end
PLAYER.GetPrimaryWeapon = function(self)
    return self.PrimaryWeapon
end
PLAYER.SetSecondaryWeapon = function(self, SecondaryWeapon)
    self.SecondaryWeapon = SecondaryWeapon
    if SecondaryWeapon then
        if self:Alive() and self:IsHuman() and not self:GetSecondaryWeaponGiven() then
            self:GiveWeapon(SecondaryWeapon)
            self:SetSecondaryWeaponGiven(true)
        end
    end
end
PLAYER.GetSecondaryWeapon = function(self)
    return self.SecondaryWeapon
end
PLAYER.SetPrimaryWeaponGiven = function(self, PrimaryWeaponGiven)
    self.PrimaryWeaponGiven = PrimaryWeaponGiven
end
PLAYER.GetPrimaryWeaponGiven = function(self)
    local ____self_PrimaryWeaponGiven_1 = self.PrimaryWeaponGiven
    if ____self_PrimaryWeaponGiven_1 == nil then
        ____self_PrimaryWeaponGiven_1 = false
    end
    return ____self_PrimaryWeaponGiven_1
end
PLAYER.SetSecondaryWeaponGiven = function(self, SecondaryWeaponGiven)
    self.SecondaryWeaponGiven = SecondaryWeaponGiven
end
PLAYER.GetSecondaryWeaponGiven = function(self)
    local ____self_SecondaryWeaponGiven_2 = self.SecondaryWeaponGiven
    if ____self_SecondaryWeaponGiven_2 == nil then
        ____self_SecondaryWeaponGiven_2 = false
    end
    return ____self_SecondaryWeaponGiven_2
end
PLAYER.SetMeleeWeapon = function(self, MeleeWeapon)
    self.MeleeWeapon = MeleeWeapon
    if MeleeWeapon then
        if self:Alive() and self:IsHuman() and not self:GetMeleeWeaponGiven() then
            self:GiveWeapon(MeleeWeapon)
            self:SetMeleeWeaponGiven(true)
        end
    end
end
PLAYER.GetMeleeWeapon = function(self)
    return self.MeleeWeapon or WeaponManager:FindWeaponByWeaponId("weapon_crowbar", WEAPON_MELEE)
end
PLAYER.SetMeleeWeaponGiven = function(self, MeleeWeaponGiven)
    self.MeleeWeaponGiven = MeleeWeaponGiven
end
PLAYER.GetMeleeWeaponGiven = function(self)
    local ____self_MeleeWeaponGiven_3 = self.MeleeWeaponGiven
    if ____self_MeleeWeaponGiven_3 == nil then
        ____self_MeleeWeaponGiven_3 = false
    end
    return ____self_MeleeWeaponGiven_3
end
return ____exports
