declare function CurTime(this: void): number;
declare const FALL_DMG_NONE: 0;
declare const FALL_DMG_ZOMBIES: 1;
declare const FALL_DMG_HUMANS: 2;
declare const FALL_DMG_ALL: 3;
declare const DMG_DROWNRECOVER: number;
declare const SCREENFADE: { IN: number };
interface GLuaDamageInfo {
    SetDamage(this: GLuaDamageInfo, amount: number): void;
    SetDamageType(this: GLuaDamageInfo, kind: number): void;
}
declare function DamageInfo(this: void): GLuaDamageInfo;
interface ZPServerPlayer {
    IsBot(this: ZPServerPlayer): boolean;
    SetTeam(this: ZPServerPlayer, team: number): void;
    GetActiveWeapon(this: ZPServerPlayer): GLuaWeapon;
    DropWeapon(this: ZPServerPlayer, weapon: GLuaWeapon): void;
    StripWeapons(this: ZPServerPlayer): void;
    StripWeapon(this: ZPServerPlayer, id: string): void;
    SetModelScale(this: ZPServerPlayer, scale: number, delay: number): void;
    FlashlightIsOn(this: ZPServerPlayer): boolean;
    Flashlight(this: ZPServerPlayer, enabled: boolean): void;
    AllowFlashlight(this: ZPServerPlayer, enabled: boolean): void;
    ScreenFade(this: ZPServerPlayer, mode: number, color: GLuaColor, fadeTime: number, holdTime: number): void;
    GodEnable(this: ZPServerPlayer): void;
    GodDisable(this: ZPServerPlayer): void;
    TakeDamageInfo(this: ZPServerPlayer, info: GLuaDamageInfo): void;
    SpectateEntity(this: ZPServerPlayer, target: ZPServerPlayer): void;
    SetupHands(this: ZPServerPlayer, target?: ZPServerPlayer): void;
    EmitSound(this: ZPServerPlayer, path: string, level?: number, pitch?: number, volume?: number): void;
}
/** @noSelf */
declare namespace timer {
    function Exists(name: string): boolean;
    function TimeLeft(name: string): number | undefined;
}
/** @noSelf */
declare namespace table { function RemoveByValue<T>(values: T[], value: T): number | false; }
/** @noSelf */
declare namespace math { function floor(value: number): number; }
/** @noSelf */
declare namespace net { function WriteFloat(value: number): void; }
