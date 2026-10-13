declare function CurTime(this: void): number;
declare function print(this: void, ...values: unknown[]): void;
declare function IsValid(this: void, value: unknown): boolean;
declare function LocalPlayer(this: void): ZPClientPlayer;
declare function ScrW(this: void): number;
declare function ScrH(this: void): number;
declare const GAMEMODE: ZPGameMode;
declare const NOTIFY_GENERIC: number;
declare const FILL: number;
interface ZPGameMode { PlayerFootstep(this: ZPGameMode, ply: ZPClientPlayer): boolean; }
/** @noSelf */
declare namespace concommand { function Add(name: string, callback: (this: void) => void): void; }
declare function SetNightvision(this: void, value: boolean): void;
declare function IsNightvisionOn(this: void): boolean;
interface ZPGlobals {
    SetNightvision: typeof SetNightvision;
    IsNightvisionOn: typeof IsNightvisionOn;
}
interface ZPClientRoundManager extends ZPSharedRoundManager {
    Timer?: number;
    SetTimer(this: ZPClientRoundManager, seconds: number): void;
    GetTimer(this: ZPClientRoundManager): number;
}
/** @noSelf */
declare namespace net {
    function Receive(name: string, callback: (this: void, length: number) => void): void;
    function Start(name: string): boolean;
    function ReadString(): string;
    function ReadBool(): boolean;
    function ReadInt(bits: number): number;
    function ReadFloat(): number;
    function ReadColor(): GLuaColor;
    function ReadTable(): unknown;
    function WriteString(value: string): void;
    function WriteBool(value: boolean): void;
    function SendToServer(): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerStartVoice" | "PlayerEndVoice", id: string, callback: (this: void, ply: ZPClientPlayer) => void): void;
    function Call(name: string, gamemode?: ZPGameMode, ...args: unknown[]): unknown;
}
/** @noSelf */
declare namespace file {
    function Exists(path: string, realm: "DATA"): boolean;
    function Read(path: string, realm: "DATA"): string | undefined;
    function Write(path: string, value: string): void;
    function CreateDir(path: string): void;
}
/** @noSelf */
declare namespace chat { function AddText(...values: (string | GLuaColor)[]): void; }
/** @noSelf */
declare namespace notification { function AddLegacy(text: string, kind: number, duration: number): void; }
/** @noSelf */
declare namespace surface { function PlaySound(path: string): void; }
interface GLuaPanel {
    SetVisible(this: GLuaPanel, visible: boolean): void;
    SetSize(this: GLuaPanel, width: number, height: number): void;
    SetPos(this: GLuaPanel, x: number, y: number): void;
    SetLife(this: GLuaPanel, seconds: number): void;
    Dock(this: GLuaPanel, dock: number): void;
    SetFont(this: GLuaPanel, font: string): void;
    SetContentAlignment(this: GLuaPanel, align: number): void;
    SetText(this: GLuaPanel, text: string): void;
    SetColor(this: GLuaPanel, color: GLuaColor): void;
    AddItem(this: GLuaPanel, child: GLuaPanel): void;
}
/** @noSelf */
declare namespace vgui { function Create(name: string, parent?: GLuaPanel): GLuaPanel; }
