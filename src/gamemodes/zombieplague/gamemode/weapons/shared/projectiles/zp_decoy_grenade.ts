export {};
AddCSLuaFile();
ENT.Type = "anim";
ENT.Base = "zp_grenade_base";
ENT.PrintName = "#zombieplague.extraitemdecoyname";
ENT.Author = "Zombie Plague";
ENT.Category = "Zombie Plague";
ENT.Initialize = function (): void {
    this.BaseClass.Initialize(this);
    // The base's constants may load after this entity's registration file.
    this.SetMode(ARM_ON_HIT_MODE);
    this.SetModel("models/weapons/w_grenade.mdl");
    this.SetExplosionDelay(0.75);
};
ENT.PhysicsCollide = function (data, physics): void {
    if (SERVER && typeof data === "object" && data !== null && "Speed" in data &&
        typeof data.Speed === "number" && Number.isFinite(data.Speed) && data.Speed >= 40 &&
        CurTime() >= (this.NextDecoyImpact ?? 0)) {
        this.NextDecoyImpact = CurTime() + 0.15;
        this.EmitSound(file.Exists("sound/weapons/hegrenade/he_bounce-1.wav", "GAME")
            ? "weapons/hegrenade/he_bounce-1.wav" : "weapons/slam/throw.wav");
    }
    // Preserve the base's one-shot arming even when an impact is too soft to make a sound.
    this.BaseClass.PhysicsCollide(this, data, physics);
};
// The base schedules Explode after the first collision; decoys start firing instead of dealing damage.
ENT.Explode = function (): void { if (SERVER) ZPDecoy.Activate(this); };
ENT.OnRemove = function (): void { if (SERVER) ZPDecoy.Forget(this); };
