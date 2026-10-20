export {};
AddCSLuaFile();
SWEP.PrintName = "Fists";
SWEP.Author = "Kilburn, robotboy655, MaxOfS2D & Tenrys";
SWEP.Purpose = "Well we sure as hell didn't use guns! We would just wrestle Hunters to the ground with our bare hands! I used to kill ten, twenty a day, just using my fists.";
SWEP.Slot = 0;
SWEP.SlotPos = 4;
SWEP.Spawnable = true;
SWEP.ViewModel = Model("models/weapons/c_arms.mdl");
SWEP.WorldModel = "";
SWEP.ViewModelFOV = 54;
SWEP.UseHands = true;
SWEP.Primary.ClipSize = -1;
SWEP.Primary.DefaultClip = -1;
SWEP.Primary.Automatic = true;
SWEP.Primary.Ammo = "none";
SWEP.Secondary.ClipSize = -1;
SWEP.Secondary.DefaultClip = -1;
SWEP.Secondary.Automatic = true;
SWEP.Secondary.Ammo = "none";
SWEP.DrawAmmo = false;
SWEP.HitDistance = 40;
const hitSound = Sound("Flesh.ImpactHard");
const scaled = (vector: GLuaVector, scale: number): GLuaVector => Vector(vector.x * scale, vector.y * scale, vector.z * scale);
const sum = (a: GLuaVector, b: GLuaVector): GLuaVector => Vector(a.x + b.x, a.y + b.y, a.z + b.z);
SWEP.Initialize = function (): void { this.SetHoldType("fist"); };
SWEP.SetupDataTables = function (): void {
    this.NetworkVar("Float", 0, "NextMeleeAttack");
    this.NetworkVar("Float", 1, "NextIdle");
    this.NetworkVar("Int", 2, "Combo");
};
SWEP.UpdateNextIdle = function (): void {
    const vm = this.Owner.GetViewModel();
    this.SetNextIdle(CurTime() + vm.SequenceDuration() / vm.GetPlaybackRate());
};
SWEP.PrimaryAttack = function (right): void {
    if (!IsValid(this.Owner))
        return;
    if (SERVER && this.Owner.IsPlayer()) hook.Call("ZPRadarMelee", GAMEMODE, this.Owner);
    this.Owner.SetAnimation(PLAYER_ATTACK1);
    const anim = this.GetCombo() >= 2 ? "fists_uppercut" : right ? "fists_right" : "fists_left", vm = this.Owner.GetViewModel();
    vm.SendViewModelMatchingSequence(vm.LookupSequence(anim));
    const sound = SafeTableRandom(ZombieKnifeSound);
    if (sound)
        this.EmitSound(sound);
    this.UpdateNextIdle();
    this.SetNextMeleeAttack(CurTime() + 0.2);
    this.SetNextPrimaryFire(CurTime() + 0.4);
    this.SetNextSecondaryFire(CurTime() + 0.4);
};
SWEP.SecondaryAttack = function (): void { this.PrimaryAttack(true); };
SWEP.DealDamage = function (): void {
    if (!IsValid(this.Owner))
        return;
    const owner = this.Owner, anim = this.GetSequenceName(owner.GetViewModel().GetSequence());
    if (SERVER)
        owner.LagCompensation(true);
    const options: GLuaTraceOptions = { start: owner.GetShootPos(), endpos: sum(owner.GetShootPos(), scaled(owner.GetAimVector(), this.HitDistance)), filter: owner, mask: MASK_SHOT_HULL };
    let trace = util.TraceLine(options);
    if (!IsValid(trace.Entity))
        trace = util.TraceHull({ ...options, mins: Vector(-10, -10, -8), maxs: Vector(10, 10, 8) });
    if (trace.Hit && !(game.SinglePlayer() && CLIENT))
        this.EmitSound(hitSound);
    let hit = false;
    if (SERVER && IsValid(trace.Entity) && (trace.Entity.IsNPC() || trace.Entity.IsPlayer() || trace.Entity.Health() > 0)) {
        const damage = DamageInfo();
        damage.SetAttacker(IsValid(owner) ? owner : this);
        damage.SetInflictor(this);
        damage.SetDamage(math.random(8, 12));
        if (anim === "fists_left")
            damage.SetDamageForce(sum(scaled(owner.GetRight(), 4912), scaled(owner.GetForward(), 9998)));
        else if (anim === "fists_right")
            damage.SetDamageForce(sum(scaled(owner.GetRight(), -4912), scaled(owner.GetForward(), 9989)));
        else if (anim === "fists_uppercut") {
            damage.SetDamageForce(sum(scaled(owner.GetUp(), 5158), scaled(owner.GetForward(), 10012)));
            damage.SetDamage(math.random(12, 24));
        }
        trace.Entity.TakeDamageInfo(damage);
        hit = true;
    }
    if (SERVER && IsValid(trace.Entity)) {
        const physics = trace.Entity.GetPhysicsObject();
        if (IsValid(physics))
            physics.ApplyForceOffset(scaled(owner.GetAimVector(), 80 * physics.GetMass()), trace.HitPos);
    }
    if (SERVER) {
        this.SetCombo(hit && anim !== "fists_uppercut" ? this.GetCombo() + 1 : 0);
        owner.LagCompensation(false);
    }
};
SWEP.OnDrop = function (): void { this.Remove(); };
SWEP.Deploy = function (): boolean {
    if (!IsValid(this.Owner))
        return false;
    const speed = GetConVarNumber("sv_defaultdeployspeed"), vm = this.Owner.GetViewModel();
    vm.SendViewModelMatchingSequence(vm.LookupSequence("fists_draw"));
    vm.SetPlaybackRate(speed);
    this.SetNextPrimaryFire(CurTime() + vm.SequenceDuration() / speed);
    this.SetNextSecondaryFire(CurTime() + vm.SequenceDuration() / speed);
    this.UpdateNextIdle();
    if (SERVER)
        this.SetCombo(0);
    return true;
};
SWEP.Think = function (): void {
    if (!IsValid(this.Owner))
        return;
    const vm = this.Owner.GetViewModel(), idle = this.GetNextIdle(), melee = this.GetNextMeleeAttack();
    if (idle > 0 && CurTime() > idle) {
        vm.SendViewModelMatchingSequence(vm.LookupSequence("fists_idle_0" + tostring(math.random(1, 2))));
        this.UpdateNextIdle();
    }
    if (melee > 0 && CurTime() > melee) {
        this.DealDamage();
        this.SetNextMeleeAttack(0);
    }
    if (SERVER && CurTime() > this.GetNextPrimaryFire() + 0.1)
        this.SetCombo(0);
};
