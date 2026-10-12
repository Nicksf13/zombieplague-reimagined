export {};
AddCSLuaFile();
_G.EXPLODE_ON_HIT_MODE = 0;
_G.ARM_ON_HIT_MODE = 1;
_G.TIME_MODE = 2;
ENT.Type = "anim";
ENT.Base = "base_anim";
ENT.PrintName = "Zombie Plague Base Grenade";
ENT.Author = "The Fire Fuchs";
ENT.Category = "Zombie Plague";
ENT.Mode = EXPLODE_ON_HIT_MODE;
ENT.Initialize = function (): void {
    this.SetModel("models/Items/grenadeAmmo.mdl");
    this.PhysicsInit(SOLID_VPHYSICS);
    this.SetMoveType(MOVETYPE_VPHYSICS);
    this.SetSolid(SOLID_VPHYSICS);
    this.SetExplosionDelay(0);
};
ENT.PhysicsCollide = function (): void {
    if (!SERVER)
        return;
    if (this.Mode === EXPLODE_ON_HIT_MODE)
        this.Explode();
    else if (this.Mode === ARM_ON_HIT_MODE) {
        this.OnHit();
        this.Arm();
    }
};
ENT.SetMode = function (mode): void { this.Mode = mode; };
ENT.SetExplosionDelay = function (delay): void { this.ExplosionDelay = delay; };
ENT.GetExplosionDelay = function (): number { return this.ExplosionDelay; };
ENT.OnHit = function (): void { };
ENT.Explode = function (): void { if (SERVER)
    this.Remove(); };
ENT.Arm = function (): void {
    if (!SERVER || this.Timer)
        return;
    this.Armed = true;
    this.Timer = "ZPGrenade" + tostring(this.EntIndex()) + ":" + tostring(CurTime());
    timer.Create(this.Timer, Math.max(0, this.GetExplosionDelay()), 1, () => { if (IsValid(this))
        this.Explode(); });
};
if (SERVER)
    ENT.Think = function (): void { if (!this.FirstThink) {
        this.PhysWake();
        this.FirstThink = true;
        delete this.Think;
    } };
