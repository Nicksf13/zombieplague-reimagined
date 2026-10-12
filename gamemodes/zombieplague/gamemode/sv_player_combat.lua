-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_combat.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.ZombieMadness = function(self, ZombieMadnessTime)
    self:SetLight(Color(255, 0, 0))
    self:GodEnable()
    self:ZPEmitSound(
        SafeTableRandom(ZombieMadnessSounds),
        5,
        true
    )
    self.OldWalkSpeed = self:GetWalkSpeed()
    self.selfOldRunSpeed = self:GetRunSpeed()
    self:SetWalkSpeed(200)
    self:SetRunSpeed(200)
    local ZombieMadnessIdentifier = "ZPZombieMadness" .. self:SteamID64()
    local ZombieMadnessDuration = ZombieMadnessTime or 5
    if timer.Exists(ZombieMadnessIdentifier) then
        ZombieMadnessDuration = ZombieMadnessDuration + (timer.TimeLeft(ZombieMadnessIdentifier) or 0)
        timer.Destroy(ZombieMadnessIdentifier)
    end
    timer.Create(
        ZombieMadnessIdentifier,
        ZombieMadnessDuration,
        1,
        function()
            if IsValid(self) then
                self:SetLight(nil)
                self:GodDisable()
                if self.OldWalkSpeed ~= nil then
                    self:SetWalkSpeed(self.OldWalkSpeed)
                end
                if self.selfOldRunSpeed ~= nil then
                    self:SetRunSpeed(self.selfOldRunSpeed)
                end
            end
        end
    )
    return ZombieMadnessIdentifier
end
PLAYER.TakeLastDamage = function(self)
    self:SetLastDamage(CurTime())
end
PLAYER.SetLastDamage = function(self, LastDamage)
    self.LastDamage = LastDamage
end
PLAYER.GetLastDamage = function(self)
    return self.LastDamage or 0
end
PLAYER.ShouldTakeFallDamage = function(self)
    local FallDamage = cvars.Number("zp_falldamage", 0)
    if FallDamage == FALL_DMG_NONE and not RoundManager:IsRealisticMod() then
        return false
    end
    local ____table_IsZombie_result_0
    if self:IsZombie() then
        ____table_IsZombie_result_0 = not self:GetZombieClass():FallFunction()
    else
        ____table_IsZombie_result_0 = self:IsHuman() and not self:GetHumanClass():FallFunction()
    end
    if ____table_IsZombie_result_0 then
        return false
    end
    return FallDamage == FALL_DMG_ALL or self:IsZombie() or self:IsHuman()
end
PLAYER.AddTotalDamage = function(self, TotalDamage)
    local DamageToAP = cvars.Number("zp_ap_damage", 500)
    if DamageToAP > 0 then
        local ExcedingAPTotalDamage = self:GetTotalDamage() % DamageToAP + TotalDamage
        local AmmoPacks = math.floor(ExcedingAPTotalDamage / DamageToAP)
        if AmmoPacks > 0 then
            self:GiveAmmoPacks(AmmoPacks)
        end
    end
    local DamageToPoints = cvars.Number("zp_point_damage_amount_to_point", 750)
    if DamageToPoints > 0 then
        local ExcedingPointsTotalDamage = self:GetTotalDamage() % DamageToPoints + TotalDamage
        local Points = math.floor(ExcedingPointsTotalDamage / DamageToPoints)
        if Points > 0 then
            self:AddPoints(Points * cvars.Number("zp_point_amount_received", 5))
        end
    end
    self:SetTotalDamage(self:GetTotalDamage() + TotalDamage)
end
PLAYER.SetTotalDamage = function(self, TotalDamage)
    self.TotalDamage = TotalDamage
end
PLAYER.GetTotalDamage = function(self)
    return self.TotalDamage or 0
end
PLAYER.TakeArmorDamage = function(self, Dmg)
    if self:Armor() > 0 then
        local Armor = self:Armor() - Dmg
        if Armor < 0 then
            Armor = 0
            if cvars.Bool("zp_realistic_mode", false) then
                self:SetArmor(Armor)
                return Armor * -1
            end
        end
        self:SetArmor(Armor)
        return 0
    end
    return Dmg
end
PLAYER.SetDamageAmplifier = function(self, DamageAmplifier)
    self.DamageAmplifier = DamageAmplifier
end
PLAYER.GetDamageAmplifier = function(self)
    return self.DamageAmplifier or 1
end
return ____exports
