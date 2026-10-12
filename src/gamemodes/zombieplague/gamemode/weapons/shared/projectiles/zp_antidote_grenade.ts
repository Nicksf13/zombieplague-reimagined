export {};
AddCSLuaFile();
ENT.Type = "anim";
ENT.Base = "zp_grenade_base";
ENT.PrintName = "Zombie Plague Antidote Grenade";
ENT.Author = "The Fire Fuchs";
ENT.Category = "Zombie Plague";
ENT.Mode = EXPLODE_ON_HIT_MODE;
ENT.Initialize = function (): void { this.BaseClass.Initialize(this); this.SetModel("models/Items/battery.mdl"); };
ENT.Explode = function (): void {
    if (!SERVER)
        return;
    const owner = this.GetOwner(), rounds = RoundManager as ZPServerRoundManager;
    this.EmitSound("items/medshot4.wav");
    ParticleEffectManager.EmitExplosion(50, HUMANS_COLOR, this.GetPos());
    if (!rounds.IsSpecialRound() && !rounds.LastZombie() && IsValid(owner))
        for (const zombie of rounds.GetAliveZombies()) {
            if (this.Visible(zombie) && this.GetPos().DistToSqr(zombie.GetPos()) <= 20000 && !zombie.IsNemesis()) {
                InfectionManager.Cure(zombie, owner);
                owner.GiveAmmoPacks(cvars.Number("zp_ap_cure_zombie", 3));
            }
        }
    this.Remove();
};
ENT.OnHit = function (): void { if (!this.Armed)
    this.EmitSound("weapons/shotgun/shotgun_empty.wav"); };
