interface ZPHudInfo {
    HudComponentID: string;
    TextFunction(this: ZPHudInfo, ply: ZPClientPlayer): string;
    InfoFunction(this: ZPHudInfo, ply: ZPClientPlayer): string | number;
    ShouldRenderFunction(this: ZPHudInfo, ply: ZPClientPlayer): boolean;
}
interface ZPHudManager {
    HudComponents: ZPHudInfo[];
    CreateHudInfo(this: ZPHudManager, id: string, text: (this: void, ply: ZPClientPlayer) => string,
        info: (this: void, ply: ZPClientPlayer) => string | number, show: (this: void, ply: ZPClientPlayer) => boolean): void;
    CreateBox(this: ZPHudManager, borderSize: number, radius: number, border: GLuaColor | undefined,
        body: GLuaColor, x: number, y: number, width: number, height: number): void;
    CalculateTextSize(this: ZPHudManager, text: string | number, font: string): LuaMultiReturn<[number, number]>;
}
interface ZPClientPlayer {
    Name(this: ZPClientPlayer): string;
    Health(this: ZPClientPlayer): number;
    Armor(this: ZPClientPlayer): number;
    IsTyping(this: ZPClientPlayer): boolean;
    GetObserverMode(this: ZPClientPlayer): number;
    GetObserverTarget(this: ZPClientPlayer): ZPClientPlayer;
    GetShootPos(this: ZPClientPlayer): GLuaClientVector;
    GetPos(this: ZPClientPlayer): GLuaClientVector;
    EntIndex(this: ZPClientPlayer): number;
}
interface GLuaClientVector { x: number; y: number; z: number; }
interface GLuaDynamicLight {
    pos: GLuaClientVector; r: number; g: number; b: number;
    brightness: number; Decay: number; Size: number; DieTime: number;
}
interface ZPGlobals { HudManager: ZPHudManager; }
declare const HudManager: ZPHudManager;
declare const OBS_MODE_ROAMING: number;
declare const TEXT_ALIGN_LEFT: number;
declare function DynamicLight(this: void, index: number): GLuaDynamicLight | undefined;
/** @noSelf */
declare namespace draw {
    function RoundedBox(radius: number, x: number, y: number, width: number, height: number, color: GLuaColor): void;
    function DrawText(text: string, font: string, x: number, y: number, color: GLuaColor, align: number): void;
}
/** @noSelf */
declare namespace surface {
    function CreateFont(name: string, data: { font: string; size: number; weight: number;
        antialias: boolean; additive: boolean; }): void;
    function SetFont(font: string): void;
    function GetTextSize(text: string | number): LuaMultiReturn<[number, number]>;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "HUDShouldDraw", id: string, callback: (this: void, name: string) => boolean | undefined): void;
    function Add(name: "HUDPaint" | "Think" | "InitPostEntity", id: string, callback: (this: void) => void): void;
}
/** @noSelf */
declare namespace string {
    function format(format: string, ...values: (string | number)[]): string;
    function FormattedTime(seconds: number, format: string): string;
}
/** @noSelf */
declare namespace math { function ceil(value: number): number; }
