interface ZPBotBoostEditor { Open(this: ZPBotBoostEditor): void; Close(this: ZPBotBoostEditor): void; }
declare const ZPBotBoostEditor: ZPBotBoostEditor;
interface ZPGlobals { ZPBotBoostEditor: ZPBotBoostEditor; }
interface GLuaVector { ToScreen(this: GLuaVector): { x: number; y: number; visible: boolean }; }
interface ZPClientHUDWeapon { GetClass(this: ZPClientHUDWeapon): string; }
interface ZPClientBoostTrace { Hit: boolean; HitSky?: boolean; HitPos: GLuaVector; HitNormal?: GLuaVector; Entity: { GetClass(this: ZPClientBoostTrace["Entity"]): string }; }
interface ZPClientPlayer {
    GetEyeTrace(this: ZPClientPlayer): ZPClientBoostTrace;
    EyePos(this: ZPClientPlayer): GLuaVector;
    KeyDown(this: ZPClientPlayer, key: number): boolean;
}
declare const IN_RELOAD: number;
interface ZPClientUserCommand { KeyDown(this: ZPClientUserCommand, key: number): boolean; }
/** @noSelf */
declare namespace hook { function Add(name: "ZPBotBoostToolAction", id: string, callback: (this: void, operation: number) => void): void; }
/** @noSelf */
declare namespace render {
    function DrawWireframeSphere(position: GLuaVector, radius: number, longitudeSteps: number, latitudeSteps: number, color: GLuaColor, writeZ: boolean): void;
    function DrawLine(start: GLuaVector, end: GLuaVector, color: GLuaColor, writeZ: boolean): void;
}
