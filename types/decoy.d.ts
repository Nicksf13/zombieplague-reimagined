interface ZPDecoyService {
    CanBuy(this: ZPDecoyService, player: ZPServerPlayer): boolean;
    Give(this: ZPDecoyService, player: ZPServerPlayer): void;
    Throw(this: ZPDecoyService, weapon: ZPScriptedWeapon): boolean;
    Activate(this: ZPDecoyService, grenade: ZPGrenade): void;
    Forget(this: ZPDecoyService, grenade: ZPGrenade): void;
}
declare const ZPDecoy: ZPDecoyService;
interface ZPGlobals { ZPDecoy: ZPDecoyService; }
interface GLuaWeapon {
    DecoySound?: string;
    Primary?: unknown; ShootSound?: unknown; FireSound?: unknown;
    GetTable(this: GLuaWeapon): Record<string, unknown> | undefined;
}
interface ZPScriptedWeapon { DecoySound?: string; }
interface GLuaPhysics { SetVelocity(this: GLuaPhysics, velocity: GLuaVector): void; }
interface GLuaEntity { GetVelocity(this: GLuaEntity): GLuaVector; }
interface ZPGrenade { NextDecoyImpact?: number; OnRemove?(this: ZPGrenade): void; }
interface GLuaTrace { StartSolid?: boolean; }
interface GLuaEffectData {
    SetOrigin(this: GLuaEffectData, origin: GLuaVector): void;
    SetAngles(this: GLuaEffectData, angles: GLuaAngle): void;
    SetScale(this: GLuaEffectData, scale: number): void;
    SetMagnitude(this: GLuaEffectData, magnitude: number): void;
}
declare function EffectData(this: void): GLuaEffectData;
/** @noSelf */
declare namespace util { function Effect(name: string, data: GLuaEffectData): void; }
/** @noSelf */
declare namespace ents { function Create(name: "zp_decoy_grenade"): ZPGrenade; }
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerSwitchWeapon", id: string,
        callback: (this: void, player: ZPServerPlayer, previous: GLuaWeapon, next: GLuaWeapon) => void): void;
}
