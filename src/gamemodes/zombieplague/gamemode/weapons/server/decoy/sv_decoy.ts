export {};
const { captureSound } = include("sv_decoy_sound.lua") as typeof import("./sv_decoy_sound");
const weaponClass = "zp_decoy_grenade_thrower";
interface Decoy {
    ID: number; Entity: ZPGrenade; Owner: ZPServerPlayer; Sound: string;
    ArmBy: number; Until: number; NextShot: number; Shots: number; BurstRemaining: number;
}

function emitSprites(this: void, position: GLuaVector): void {
    const particles: ZPParticleInfo[] = [];
    for (let index = 0; index < 3; index++) particles.push({
        File: "sprites/light_glow02_add", Gravity: Vector(0, 0, 0),
        Velocity: Vector(math.Rand(-45, 45), math.Rand(-45, 45), math.Rand(10, 55)),
        DieTime: math.Rand(0.12, 0.25), StartAlpha: 220, EndAlpha: 0,
        StartSize: math.Rand(3, 6), EndSize: 0, Color: Color(255, math.random(150, 210), 60),
    });
    particles.push({ File: "particle/smokesprites_0001", Gravity: Vector(0, 0, 0),
        Velocity: Vector(math.Rand(-12, 12), math.Rand(-12, 12), math.Rand(15, 35)),
        DieTime: math.Rand(0.3, 0.55), StartAlpha: 65, EndAlpha: 0,
        StartSize: 4, EndSize: 12, Color: Color(150, 145, 135) });
    ParticleEffectManager.EmitParticleEffect({ Pos: position, ParticleInformations: particles });
}

class DecoyService implements ZPDecoyService {
    private decoys: Record<number, Decoy | undefined> = {};

    private Allowed(player: ZPServerPlayer): boolean {
        return IsValid(player) && player.Alive() && player.Team() === TEAM_HUMANS &&
            RoundManager.GetRoundState() === ROUND_PLAYING;
    }
    private HasActive(player: ZPServerPlayer): boolean {
        for (const [, decoy] of pairs(this.decoys)) if (decoy?.Owner === player && IsValid(decoy.Entity)) return true;
        return false;
    }
    CanBuy(player: ZPServerPlayer): boolean {
        return this.Allowed(player) && !IsValid(player.GetWeapon(weaponClass)) &&
            !this.HasActive(player) && Object.keys(this.decoys).length < 32;
    }
    Give(player: ZPServerPlayer): void {
        if (!this.CanBuy(player)) return;
        const sound = captureSound(player), weapon = player.Give(weaponClass);
        if (!IsValid(weapon)) return;
        weapon.DecoySound = sound;
        player.SelectWeapon(weaponClass);
    }
    Throw(weapon: ZPScriptedWeapon): boolean {
        const owner = weapon.GetOwner();
        if (!this.Allowed(owner) || owner.IsFrozen() || this.HasActive(owner) ||
            Object.keys(this.decoys).length >= 32 || weapon.Clip1() < 1) return false;
        const aim = owner.GetAimVector(), eye = owner.EyePos();
        const trace = util.TraceHull({ start: eye, endpos: Vector(eye.x + aim.x * 40, eye.y + aim.y * 40, eye.z + aim.z * 40),
            filter: owner, mins: Vector(-4, -4, -4), maxs: Vector(4, 4, 4), mask: MASK_SHOT_HULL });
        if (trace.StartSolid || trace.HitSky) return false;
        const entity = ents.Create("zp_decoy_grenade");
        if (!IsValid(entity)) return false;
        entity.SetOwner(owner); entity.SetPos(trace.HitPos); entity.Spawn();
        entity.SetExplosionDelay(0.75);
        const physics = entity.GetPhysicsObject();
        if (!IsValid(physics)) { entity.Remove(); return false; }
        const velocity = owner.GetVelocity();
        physics.SetVelocity(Vector(aim.x * 700 + velocity.x, aim.y * 700 + velocity.y, aim.z * 700 + velocity.z + 120));
        this.decoys[entity.EntIndex()] = { ID: entity.EntIndex(), Entity: entity, Owner: owner, Sound: weapon.DecoySound ?? captureSound(owner),
            ArmBy: CurTime() + 3, Until: 0, NextShot: 0, Shots: 0, BurstRemaining: 0 };
        return true;
    }
    Activate(grenade: ZPGrenade): void {
        const decoy = this.decoys[grenade.EntIndex()];
        if (!decoy || decoy.Entity !== grenade || decoy.Until > 0) return;
        if (!this.Allowed(decoy.Owner)) { this.Destroy(decoy); return; }
        decoy.Until = CurTime() + 10; decoy.NextShot = CurTime();
    }
    Forget(grenade: ZPGrenade): void {
        const decoy = this.decoys[grenade.EntIndex()];
        if (!decoy || decoy.Entity !== grenade) return;
        this.Retire(decoy);
    }
    private Retire(decoy: Decoy): void {
        delete this.decoys[decoy.ID];
        ZPRadar.ForgetDecoy(decoy.ID);
        if (IsValid(decoy.Entity) && decoy.Entity.Timer) timer.Remove(decoy.Entity.Timer);
    }
    private Destroy(decoy: Decoy): void {
        this.Retire(decoy);
        if (IsValid(decoy.Entity)) decoy.Entity.Remove();
    }
    Clear(): void {
        for (const [, decoy] of pairs(this.decoys)) if (decoy) this.Destroy(decoy);
    }
    Tick(): void {
        for (const [, decoy] of pairs(this.decoys)) {
            if (!decoy) continue;
            if (!IsValid(decoy.Entity) || !this.Allowed(decoy.Owner)) {
                this.Destroy(decoy); continue;
            }
            if (decoy.Until > 0 && decoy.Until <= CurTime()) {
                const position = decoy.Entity.GetPos();
                this.Destroy(decoy);
                // The native client effect supplies the blast visual and sound, without a damaging entity.
                const effect = EffectData();
                effect.SetOrigin(Vector(position.x, position.y, position.z + 6));
                effect.SetScale(0.6); effect.SetMagnitude(0);
                util.Effect("Explosion", effect);
                continue;
            }
            // A bounded fallback also arms grenades thrown into water or without a collision callback.
            if (decoy.Until === 0 && CurTime() >= decoy.ArmBy) this.Activate(decoy.Entity);
            if (decoy.Until === 0 || decoy.NextShot > CurTime()) continue;
            if (decoy.BurstRemaining <= 0) decoy.BurstRemaining = math.random(1, 5);
            decoy.Entity.EmitSound(decoy.Sound);
            ZPRadar.Decoy(decoy.Entity);
            const effect = EffectData(), position = decoy.Entity.GetPos();
            effect.SetOrigin(Vector(position.x, position.y, position.z + 6));
            effect.SetAngles(Angle(0, decoy.Shots * 120, 0)); effect.SetScale(0.3);
            util.Effect("MuzzleFlash", effect);
            emitSprites(Vector(position.x, position.y, position.z + 6));
            decoy.Shots++;
            decoy.BurstRemaining--;
            decoy.NextShot = CurTime() + (decoy.BurstRemaining > 0 ? math.Rand(0.12, 0.28) : math.Rand(0.45, 1.65));
        }
    }
}
const decoy = new DecoyService();
_G.ZPDecoy = decoy;
timer.Create("ZPDecoys", 0.1, 0, () => decoy.Tick());
hook.Add("ZPEndRound", "ZPDecoys", () => decoy.Clear());
