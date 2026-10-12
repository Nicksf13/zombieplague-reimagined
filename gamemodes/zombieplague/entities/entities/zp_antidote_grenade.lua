-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/projectiles/zp_antidote_grenade.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
AddCSLuaFile()
ENT.Type = "anim"
ENT.Base = "zp_grenade_base"
ENT.PrintName = "Zombie Plague Antidote Grenade"
ENT.Author = "The Fire Fuchs"
ENT.Category = "Zombie Plague"
ENT.Mode = EXPLODE_ON_HIT_MODE
ENT.Initialize = function(self)
    self.BaseClass.Initialize(self)
    self:SetModel("models/Items/battery.mdl")
end
ENT.Explode = function(self)
    if not SERVER then
        return
    end
    local owner = self:GetOwner()
    local rounds = RoundManager
    self:EmitSound("items/medshot4.wav")
    ParticleEffectManager:EmitExplosion(
        50,
        HUMANS_COLOR,
        self:GetPos()
    )
    if not rounds:IsSpecialRound() and not rounds:LastZombie() and IsValid(owner) then
        for ____, zombie in ipairs(rounds:GetAliveZombies()) do
            if self:Visible(zombie) and self:GetPos():DistToSqr(zombie:GetPos()) <= 20000 and not zombie:IsNemesis() then
                InfectionManager:Cure(zombie, owner)
                owner:GiveAmmoPacks(cvars.Number("zp_ap_cure_zombie", 3))
            end
        end
    end
    self:Remove()
end
ENT.OnHit = function(self)
    if not self.Armed then
        self:EmitSound("weapons/shotgun/shotgun_empty.wav")
    end
end
return ____exports
