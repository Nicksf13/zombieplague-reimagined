export {};
// Included while GMod's SWEP registration table is active, in both realms.
const weapon = SWEP;
const infection = weapon.PrintName === "Infection Grenade";
weapon.Initialize = function (): void {
    this.ID = (infection ? "InfectionGrenade" : "CureGrenade") + tostring(this.EntIndex()) + ":" + tostring(CurTime());
    this.SetHoldType(infection ? "grenade" : this.HoldType);
    this.ProjectileMode = EXPLODE_ON_HIT_MODE;
    this.ProjectileDelay = 5;
    if (infection)
        timer.Create("SetIdle" + this.ID, 0.1, 1, () => { if (IsValid(this))
            this.SendWeaponAnim(ACT_VM_IDLE); });
    if (!infection && CLIENT)
        this.InitializeConstruction();
};
weapon.PrimaryAttack = function (): void {
    if (!this.CanPrimaryAttack() || !IsValid(this.Owner))
        return;
    if (infection) {
        this.SendWeaponAnim(ACT_VM_THROW);
        this.Owner.SetAnimation(PLAYER_ATTACK1);
        this.ShootGrenade();
    }
    else {
        this.ShootGrenade();
        this.SendWeaponAnim(ACT_VM_THROW);
        this.Owner.SetAnimation(PLAYER_ATTACK1);
    }
    if (SERVER)
        timer.Create(this.WeaponReloadIdentifier(), 0.3, 1, () => {
            if (IsValid(this) && IsValid(this.Owner))
                this.Owner.StripWeapon(this.GetClass());
        });
};
weapon.SecondaryAttack = function (): void {
    if (this.Reloading)
        return;
    this.ProjectileMode = ((this.ProjectileMode + 1) % 3) as ZPGrenadeMode;
    if (infection)
        this.SendWeaponAnim(ACT_VM_SECONDARYATTACK);
    if (CLIENT) {
        const sound = infection ? SafeTableRandom(this.AlternateSounds) : this.AlternateSound;
        if (sound)
            this.EmitSound(sound);
        const phrase = this.ProjectileMode === EXPLODE_ON_HIT_MODE ? "ZPGrenadeExplodeOnHit" : this.ProjectileMode === ARM_ON_HIT_MODE ? "ZPGrenadeArmOnHit" : "ZPGrenadeTimeMode";
        notification.AddLegacy(string.format(language.GetPhrase("zombieplague." + string.lower(phrase)), this.ProjectileDelay), NOTIFY_GENERIC, 5);
    }
};
weapon.WeaponReloadIdentifier = function (): string { return this.ID + "Reload"; };
weapon.Reload = function (): void {
    if (!IsValid(this.GetOwner()) || this.Clip1() === this.Primary.ClipSize || this.GetOwner().GetAmmoCount(this.Primary.Ammo) <= 0)
        return;
    const duration = infection ? 2 : 1.5;
    this.Reloading = true;
    this.SetNextPrimaryFire(CurTime() + duration);
    this.DefaultReload(ACT_VM_DRAW);
    timer.Create(this.WeaponReloadIdentifier(), duration, 1, () => { if (IsValid(this))
        this.Reloading = false; });
};
weapon.ShootGrenade = function (): void {
    const owner = this.GetOwner();
    if (!IsValid(owner) || CLIENT)
        return;
    const entity = ents.Create(infection ? "zp_infection_grenade" : "zp_antidote_grenade");
    if (!IsValid(entity))
        return;
    entity.SetOwner(owner);
    entity.SetMode(this.ProjectileMode);
    const direction = owner.GetAimVector(), pos = Vector(direction.x * 40, direction.y * 40, direction.z * 40);
    pos.Add(owner.EyePos());
    entity.SetPos(pos);
    entity.Spawn();
    // Initialize sets the default delay, so configure the spawned entity afterwards.
    entity.SetExplosionDelay(this.ProjectileDelay);
    if (this.ProjectileMode === TIME_MODE)
        entity.Arm();
    const physics = entity.GetPhysicsObject();
    if (!IsValid(physics)) {
        entity.Remove();
        return;
    }
    direction.Mul(infection ? 1000 : 1500);
    direction.Add(VectorRand(-10, 10));
    physics.ApplyForceCenter(direction);
    this.TakePrimaryAmmo(1);
};
weapon.Deploy = function (): boolean {
    if (this.Clip1() === 0 && !this.Reloading)
        this.Reload();
    if (infection)
        timer.Create("SetIdle" + this.ID, 0.1, 1, () => { if (IsValid(this))
            this.SendWeaponAnim(ACT_VM_IDLE); });
    return true;
};
weapon.Holster = function (): boolean {
    if (!infection && CLIENT && IsValid(this.Owner)) {
        const vm = this.Owner.GetViewModel();
        if (IsValid(vm))
            this.ResetBonePositions(vm);
    }
    this.Reloading = false;
    timer.Remove(this.WeaponReloadIdentifier());
    return true;
};
if (!infection)
    weapon.OnRemove = function (): void { this.Holster(); if (CLIENT)
        this.RemoveConstructionModels(); };
