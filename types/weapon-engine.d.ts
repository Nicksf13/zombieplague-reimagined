interface GLuaVector {
    Add(this: GLuaVector, value: GLuaVector): void;
    Mul(this: GLuaVector, value: number | GLuaVector): void;
    DistToSqr(this: GLuaVector, value: GLuaVector): number;
}
interface GLuaAngle {
    p: number; y: number; r: number;
    Forward(this: GLuaAngle): GLuaVector; Right(this: GLuaAngle): GLuaVector; Up(this: GLuaAngle): GLuaVector;
    RotateAroundAxis(this: GLuaAngle, axis: GLuaVector, degrees: number): void;
}
interface GLuaPhysics {
    IsValid(this: GLuaPhysics): boolean;
    GetMass(this: GLuaPhysics): number;
    ApplyForceCenter(this: GLuaPhysics, force: GLuaVector): void;
    ApplyForceOffset(this: GLuaPhysics, force: GLuaVector, position: GLuaVector): void;
}
interface GLuaEntity {
    EntIndex(this: GLuaEntity): number;
    IsValid(this: GLuaEntity): boolean; IsNPC(this: GLuaEntity): boolean;
    Health(this: GLuaEntity): number; GetPos(this: GLuaEntity): GLuaVector;
    GetAngles(this: GLuaEntity): GLuaAngle;
    GetOwner(this: GLuaEntity): ZPServerPlayer;
    SetModel(this: GLuaEntity, path: string): void;
    SetAngles(this: GLuaEntity, value: GLuaAngle): void;
    PhysicsInit(this: GLuaEntity, solid: number): void;
    SetMoveType(this: GLuaEntity, move: number): void;
    SetSolid(this: GLuaEntity, solid: number): void;
    PhysWake(this: GLuaEntity): void;
    Remove(this: GLuaEntity): void;
    Visible(this: GLuaEntity, other: GLuaEntity): boolean;
    EmitSound(this: GLuaEntity, path: string): void;
    TakeDamageInfo(this: GLuaEntity, damage: GLuaDamageInfo): void;
    TakeDamage(this: GLuaEntity, amount: number, attacker: GLuaEntity, inflictor: GLuaEntity): void;
    GetPhysicsObject(this: GLuaEntity): GLuaPhysics;
}
interface GLuaViewModel extends GLuaEntity {
    SequenceDuration(this: GLuaViewModel): number;
    GetPlaybackRate(this: GLuaViewModel): number;
    SetPlaybackRate(this: GLuaViewModel, speed: number): void;
    LookupSequence(this: GLuaViewModel, name: string): number;
    SendViewModelMatchingSequence(this: GLuaViewModel, sequence: number): void;
    GetSequence(this: GLuaViewModel): number;
    SetColor(this: GLuaViewModel, color: GLuaColor): void;
    SetMaterial(this: GLuaViewModel, name: string): void;
}
interface ZPServerPlayer {
    GetViewModel(this: ZPServerPlayer): GLuaViewModel;
    GetShootPos(this: ZPServerPlayer): GLuaVector;
    GetAimVector(this: ZPServerPlayer): GLuaVector;
    EyePos(this: ZPServerPlayer): GLuaVector;
    GetRight(this: ZPServerPlayer): GLuaVector;
    GetForward(this: ZPServerPlayer): GLuaVector;
    GetUp(this: ZPServerPlayer): GLuaVector;
    SetAnimation(this: ZPServerPlayer, animation: number): void;
    LagCompensation(this: ZPServerPlayer, enabled: boolean): void;
    GetAmmoCount(this: ZPServerPlayer, ammo: number | string): number;
}
interface GLuaDamageInfo {
    SetAttacker(this: GLuaDamageInfo, attacker: GLuaEntity): void;
    SetInflictor(this: GLuaDamageInfo, inflictor: GLuaEntity): void;
    SetDamageForce(this: GLuaDamageInfo, force: GLuaVector): void;
}
type ZPGrenadeMode = 0 | 1 | 2;
interface ZPGrenade extends GLuaEntity {
    Type: string; Base: string; PrintName: string; Author: string; Category: string;
    Mode: ZPGrenadeMode; ExplosionDelay: number; Armed?: boolean; Timer?: string; FirstThink?: boolean;
    BaseClass: { Initialize: (this: void, entity: ZPGrenade) => void };
    Initialize(this: ZPGrenade): void;
    PhysicsCollide(this: ZPGrenade, data: unknown, physics: GLuaPhysics): void;
    SetMode(this: ZPGrenade, mode: ZPGrenadeMode): void;
    SetExplosionDelay(this: ZPGrenade, delay: number): void;
    GetExplosionDelay(this: ZPGrenade): number;
    OnHit(this: ZPGrenade): void; Explode(this: ZPGrenade): void; Arm(this: ZPGrenade): void;
    Think?(this: ZPGrenade): void;
}
interface ZPWeaponAmmo { ClipSize: number; DefaultClip: number; Automatic: boolean; Ammo: string; }
interface ZPScriptedWeapon extends GLuaEntity {
    PrintName: string; Author: string; Purpose?: string; Instructions?: string; Base: string; Category?: string;
    Slot: number; SlotPos: number; Weight: number; Spawnable: boolean; AdminOnly: boolean;
    ViewModel: string; WorldModel: string; ViewModelFOV: number; UseHands: boolean;
    DrawAmmo: boolean; DrawCrosshair: boolean; AutoSwitchTo: boolean; AutoSwitchFrom: boolean;
    Primary: ZPWeaponAmmo; Secondary: ZPWeaponAmmo; Owner: ZPServerPlayer; Weapon: ZPScriptedWeapon;
    HitDistance: number; ID: string; HoldType: string; ProjectileMode: ZPGrenadeMode; ProjectileDelay: number;
    Reloading: boolean; AlternateSounds: string[]; AlternateSound: string; ShootSound: string;
    SetHoldType(this: ZPScriptedWeapon, name: string): void;
    NetworkVar(this: ZPScriptedWeapon, kind: "Float" | "Int", slot: number, name: string): void;
    SetNextIdle(this: ZPScriptedWeapon, time: number): void; GetNextIdle(this: ZPScriptedWeapon): number;
    SetNextMeleeAttack(this: ZPScriptedWeapon, time: number): void; GetNextMeleeAttack(this: ZPScriptedWeapon): number;
    SetCombo(this: ZPScriptedWeapon, combo: number): void; GetCombo(this: ZPScriptedWeapon): number;
    SetNextPrimaryFire(this: ZPScriptedWeapon, time: number): void; GetNextPrimaryFire(this: ZPScriptedWeapon): number;
    SetNextSecondaryFire(this: ZPScriptedWeapon, time: number): void;
    GetSequenceName(this: ZPScriptedWeapon, sequence: number): string;
    SendWeaponAnim(this: ZPScriptedWeapon, animation: number): void;
    TakePrimaryAmmo(this: ZPScriptedWeapon, amount: number): void;
    CanPrimaryAttack(this: ZPScriptedWeapon): boolean;
    Clip1(this: ZPScriptedWeapon): number;
    DefaultReload(this: ZPScriptedWeapon, animation: number): void;
    Initialize(this: ZPScriptedWeapon): void; SetupDataTables(this: ZPScriptedWeapon): void;
    UpdateNextIdle(this: ZPScriptedWeapon): void; PrimaryAttack(this: ZPScriptedWeapon, right?: boolean): void;
    SecondaryAttack(this: ZPScriptedWeapon): void; DealDamage(this: ZPScriptedWeapon): void;
    OnDrop(this: ZPScriptedWeapon): void; Deploy(this: ZPScriptedWeapon): boolean;
    Think(this: ZPScriptedWeapon): void; Reload(this: ZPScriptedWeapon): void;
    ShootGrenade(this: ZPScriptedWeapon): void; WeaponReloadIdentifier(this: ZPScriptedWeapon): string;
    Holster(this: ZPScriptedWeapon): boolean; OnRemove(this: ZPScriptedWeapon): void;
}
declare const ENT: ZPGrenade, SWEP: ZPScriptedWeapon;
declare const SERVER: boolean, CLIENT: boolean;
declare const EXPLODE_ON_HIT_MODE: 0, ARM_ON_HIT_MODE: 1, TIME_MODE: 2;
interface ZPGlobals { EXPLODE_ON_HIT_MODE: 0; ARM_ON_HIT_MODE: 1; TIME_MODE: 2; }
declare const SOLID_VPHYSICS: number, MOVETYPE_VPHYSICS: number, MASK_SHOT_HULL: number,
    PLAYER_ATTACK1: number, ACT_VM_IDLE: number, ACT_VM_THROW: number, ACT_VM_DRAW: number, ACT_VM_SECONDARYATTACK: number;
declare function Model(this: void, name: string): string;
declare function Sound(this: void, name: string): string;
declare function GetConVarNumber(this: void, name: string): number;
declare function VectorRand(this: void, min?: number, max?: number): GLuaVector;
declare function Angle(this: void, p: number, y: number, r: number): GLuaAngle;
/** @noSelf */
declare namespace ents { function Create(name: "zp_antidote_grenade" | "zp_infection_grenade"): ZPGrenade; }
interface GLuaTraceOptions { start: GLuaVector; endpos: GLuaVector; filter: GLuaEntity; mask: number; mins?: GLuaVector; maxs?: GLuaVector; }
interface GLuaTrace { Entity: GLuaEntity; Hit: boolean; HitPos: GLuaVector; }
/** @noSelf */
declare namespace util { function TraceLine(options: GLuaTraceOptions): GLuaTrace; function TraceHull(options: GLuaTraceOptions): GLuaTrace; }
/** @noSelf */
declare namespace game { function SinglePlayer(): boolean; }
/** @noSelf */
declare namespace notification { function AddLegacy(text: string, kind: number, duration: number): void; }
declare const NOTIFY_GENERIC: number;
/** @noSelf */
declare namespace timer { function Remove(id: string): void; }
