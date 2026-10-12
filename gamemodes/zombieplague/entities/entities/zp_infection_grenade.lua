-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/projectiles/zp_infection_grenade.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
AddCSLuaFile()
ENT.Type = "anim"
ENT.Base = "zp_grenade_base"
ENT.PrintName = "Zombie Plague Infection Grenade"
ENT.Author = "The Fire Fuchs"
ENT.Category = "Zombie Plague"
ENT.Mode = EXPLODE_ON_HIT_MODE
ENT.Initialize = function(self)
    self.BaseClass.Initialize(self)
    self:SetModel("models/weapons/w_bugbait.mdl")
end
ENT.Explode = function(self)
    if not SERVER then
        return
    end
    local owner = self:GetOwner()
    local rounds = RoundManager
    self:EmitSound("weapons/bugbait/bugbait_impact1.wav")
    ParticleEffectManager:EmitExplosion(
        50,
        Color(0, 130, 0),
        self:GetPos()
    )
    if IsValid(owner) then
        for ____, human in ipairs(rounds:GetAliveHumans()) do
            if self:Visible(human) and self:GetPos():DistToSqr(human:GetPos()) <= 20000 and not human:IsSurvivor() then
                if not rounds:LastHuman() and not rounds:IsSpecialRound() then
                    InfectionManager:Infect(human, owner)
                else
                    human:TakeDamage(10000, owner, self)
                end
            end
        end
    end
    self:Remove()
end
ENT.OnHit = function(self)
    if not self.Armed then
        self:EmitSound("weapons/bugbait/bugbait_impact3.wav")
    end
end
return ____exports
