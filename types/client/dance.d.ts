declare const KEY_G: number;
interface ZPClientPlayer {
    InvalidateBoneCache(this: ZPClientPlayer): void;
    GetViewEntity(this: ZPClientPlayer): ZPClientPlayer;
    GetRenderAngles(this: ZPClientPlayer): GLuaAngle;
    SetRenderAngles(this: ZPClientPlayer, angle: GLuaAngle): void;
    GetModelScale(this: ZPClientPlayer): number;
    ZPDanceRenderAngles?: GLuaAngle;
}
interface ZPClientUserCommand {
    ClearButtons(this: ZPClientUserCommand): void;
    ClearMovement(this: ZPClientUserCommand): void;
    SetImpulse(this: ZPClientUserCommand, impulse: number): void;
    SetViewAngles(this: ZPClientUserCommand, angle: GLuaAngle): void;
    GetMouseX(this: ZPClientUserCommand): number;
    GetMouseY(this: ZPClientUserCommand): number;
}
declare function Angle(this: void, pitch: number, yaw: number, roll: number): GLuaAngle;
interface ZPDanceViewData {
    origin: GLuaVector; angles: GLuaAngle; fov: number; znear: number; zfar: number; drawviewer: boolean; drawviewmodel?: boolean;
}
interface ZPEmoteCamera {
    Begin(this: ZPEmoteCamera, state: ZPDanceAnimationState): void;
    Move(this: ZPEmoteCamera, command: ZPClientUserCommand): void;
    View(this: ZPEmoteCamera, ply: ZPClientPlayer, view: ZPDanceViewData, on: boolean): ZPDanceViewData | undefined;
    Visible(this: ZPEmoteCamera): boolean;
    Reset(this: ZPEmoteCamera): void;
}
declare function SysTime(this: void): number;
declare function GetConVar(this: void, name: string): GLuaConVar | undefined;
interface GLuaConVar { GetFloat(this: GLuaConVar): number; }
declare const MASK_SOLID: number;
interface ZPDanceCameraTrace {
    start: GLuaVector; endpos: GLuaVector; mins: GLuaVector; maxs: GLuaVector;
    mask: number; filter: readonly ZPPlayer[];
}
/** @noSelf */
declare namespace util { function TraceHull(options: ZPDanceCameraTrace): { HitPos: GLuaVector; StartSolid: boolean }; }
interface ZPDanceView {
    Move(this: ZPDanceView, command: ZPClientUserCommand): void;
    View(this: ZPDanceView, ply: ZPClientPlayer, view: ZPDanceViewData): ZPDanceViewData | undefined;
    Draw(this: ZPDanceView, ply: ZPClientPlayer): boolean | undefined;
    PreparePlayer(this: ZPDanceView, ply: ZPClientPlayer): void;
    RestorePlayer(this: ZPDanceView, ply: ZPClientPlayer): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "CalcView", id: string, callback: (this: void, ply: ZPClientPlayer, position: GLuaVector,
        angles: GLuaAngle, fov: number, znear: number, zfar: number) => ZPDanceViewData | undefined): void;
    function Add(name: "ShouldDrawLocalPlayer", id: string, callback: (this: void, ply: ZPClientPlayer) => boolean | undefined): void;
    function Add(name: "PrePlayerDraw" | "PostPlayerDraw", id: string, callback: (this: void, ply: ZPClientPlayer) => void): void;
}
