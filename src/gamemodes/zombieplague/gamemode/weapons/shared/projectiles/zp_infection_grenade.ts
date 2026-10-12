export {};
AddCSLuaFile();
ENT.Type = "anim";
ENT.Base = "zp_grenade_base";
ENT.PrintName = "Zombie Plague Infection Grenade";
ENT.Author = "The Fire Fuchs";
ENT.Category = "Zombie Plague";
ENT.Mode = EXPLODE_ON_HIT_MODE;
ENT.Initialize = function (): void { this.BaseClass.Initialize(this); this.SetModel("models/weapons/w_bugbait.mdl"); };
ENT.Explode = function (): void {
    if (!SERVER)
        return;
    const owner = this.GetOwner(), rounds = RoundManager as ZPServerRoundManager;
    this.EmitSound("weapons/bugbait/bugbait_impact1.wav");
    ParticleEffectManager.EmitExplosion(50, Color(0, 130, 0), this.GetPos());
    if (IsValid(owner))
        for (const human of rounds.GetAliveHumans()) {
            if (this.Visible(human) && this.GetPos().DistToSqr(human.GetPos()) <= 20000 && !human.IsSurvivor()) {
                if (!rounds.LastHuman() && !rounds.IsSpecialRound())
                    InfectionManager.Infect(human, owner);
                else
                    human.TakeDamage(10000, owner, this);
            }
        }
    this.Remove();
};
ENT.OnHit = function (): void { if (!this.Armed)
    this.EmitSound("weapons/bugbait/bugbait_impact3.wav"); };
