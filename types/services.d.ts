interface ZPUtils {
    RecursiveFileSearch(this: ZPUtils, path: string, suffix: string): Record<string, string>;
    Print(this: ZPUtils, messageType: number, message: string): void;
}
type ZPCommandAction = (this: void, ply: ZPServerPlayer, args: string[]) => void;
interface ZPCommand {
    Description: string;
    Function: ZPCommandAction;
    Help: string;
    Private: boolean | undefined;
    PermissionFunction: ((this: void, ply: ZPServerPlayer) => boolean) | undefined;
}
interface ZPCommands {
    CommandList: Record<string, ZPCommand>;
    AddCommand(this: ZPCommands, names: string | string[], description: string,
        action: ZPCommandAction, help?: string, privateCommand?: boolean,
        permission?: (this: void, ply: ZPServerPlayer) => boolean): void;
}
interface ZPConvarManager {
    Convars: Record<string, string>;
    CreateConVar(this: ZPConvarManager, name: string, value: string | number,
        flags: number, description: string): void;
    ListCvars(this: void, ply: ZPServerPlayer, args: string[]): void;
}
interface ZPBankStorage {
    Init(this: ZPBankStorage): void;
    GetPlayerAmmopacks(this: ZPBankStorage, ply: ZPServerPlayer): number;
    Save(this: void, id: string, amount: number): void;
}
interface ZPBank {
    BankStorageType: string;
    AmmoPacksStorage: Record<string, number>;
    Time: number;
    ShouldSaveAmmoPacks: boolean;
    BankStorageSource?: ZPBankStorage;
    SetPlayerAmmoPacks(this: ZPBank, ply: ZPServerPlayer, amount: number): void;
    Save(this: void): void;
    GiveTakeAmmoPacks(this: ZPBank, requester: ZPServerPlayer, target: ZPServerPlayer | undefined,
        give: boolean, amount: number | undefined): void;
}
interface ZPGlobals {
    Utils: ZPUtils;
    Commands: ZPCommands;
    ConvarManager: ZPConvarManager;
    Bank: ZPBank;
    WARNING_MESSAGE: 1;
    ERROR_MESSAGE: 2;
    INFO_MESSAGE: 3;
    BroadcastMessage: typeof BroadcastMessage;
    BroadcastColorMessage: typeof BroadcastColorMessage;
    BroadcastSound: typeof BroadcastSound;
    BroadcastNotifyMessage: typeof BroadcastNotifyMessage;
    SendMessage: typeof SendMessage;
    SendColorMessage: typeof SendColorMessage;
    SendConsoleMessage: typeof SendConsoleMessage;
    SendPopupMessage: typeof SendPopupMessage;
    SendSound: typeof SendSound;
    SendNotifyMessage: typeof SendNotifyMessage;
}
interface ZPServerPlayer {
    Name(this: ZPServerPlayer): string;
    IsSuperAdmin(this: ZPServerPlayer): boolean;
    IsAdmin(this: ZPServerPlayer): boolean;
    GiveAmmoPacks(this: ZPServerPlayer, amount: number): void;
    TakeAmmoPacks(this: ZPServerPlayer, amount: number): void;
    SetAmmoPacks(this: ZPServerPlayer, amount: number, silent?: boolean): void;
}
interface ZPServerRoundManager {
    GetPlayersToPlay(this: ZPServerRoundManager): ZPServerPlayer[];
}
declare const Utils: ZPUtils;
declare const Commands: ZPCommands;
declare const ConvarManager: ZPConvarManager;
declare const Bank: ZPBank;
declare const WARNING_MESSAGE: 1;
declare const ERROR_MESSAGE: 2;
declare const INFO_MESSAGE: 3;
declare function pairs<T>(this: void, value: Record<string, T>): LuaIterable<LuaMultiReturn<[string, T]>>;
declare function print(this: void, ...values: unknown[]): void;
declare function SysTime(this: void): number;
declare function tonumber(this: void, value: string): number | undefined;
declare function tostring(this: void, value: unknown): string;
declare function pcall<A extends unknown[]>(this: void, action: (this: void, ...args: A) => void,
    ...args: A): LuaMultiReturn<[boolean, unknown]>;
declare function BroadcastMessage(this: void, text: ZPMessageText): void;
declare function BroadcastColorMessage(this: void, text: ZPMessageText, color: GLuaColor, exclude?: ZPPlayer[]): void;
declare function BroadcastSound(this: void, path: string, exclude?: ZPPlayer[]): void;
declare function BroadcastNotifyMessage(this: void, text: ZPMessageText, duration?: number, color?: GLuaColor): void;
declare function SendMessage(this: void, ply: ZPPlayer, text: ZPMessageText): void;
declare function SendColorMessage(this: void, ply: ZPPlayer, text: ZPMessageText, color: GLuaColor): void;
declare function SendConsoleMessage(this: void, ply: ZPPlayer, text: ZPMessageText): void;
declare function SendPopupMessage(this: void, ply: ZPPlayer, text: ZPMessageText): void;
declare function SendSound(this: void, ply: ZPPlayer, path: string): void;
declare function SendNotifyMessage(this: void, ply: ZPPlayer, text: ZPMessageText, duration?: number, color?: GLuaColor): void;
/** @noSelf */
declare namespace file {
    function Find(pattern: string, realm: "LUA" | "GAME" | "DATA"): LuaMultiReturn<[string[], string[]]>;
    function Exists(path: string, realm: "DATA"): boolean;
    function CreateDir(path: string): void;
    function Read(path: string, realm: "DATA"): string | undefined;
    function Write(path: string, value: string): void;
}
/** @noSelf */
declare namespace timer {
    function Create(name: string, delay: number, repetitions: number, callback: (this: void) => void): void;
}
/** @noSelf */
declare namespace string {
    function EndsWith(text: ZPMessageText, suffix: string): boolean;
    function Explode(separator: string, text: ZPMessageText): string[];
    function lower(text: ZPMessageText): string;
    function sub(text: ZPMessageText, start: number, end?: number): string;
    function format(format: string, ...values: (string | number)[]): string;
}
/** @noSelf */
declare namespace cvars { function Number(name: string, fallback?: number): number; }
/** @noSelf */
declare namespace player { function GetBots(): ZPServerPlayer[]; }
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerSay", id: string, callback: (this: void, ply: ZPServerPlayer, text: ZPMessageText) => string | undefined): void;
    function Add(name: "PlayerAuthed", id: string, callback: (this: void, ply: ZPServerPlayer) => void): void;
    function Add(name: "ShutDown", id: string, callback: (this: void) => void): void;
}
/** @noSelf */
declare namespace net {
    function WriteString(value: string): void;
    function WriteColor(value: GLuaColor): void;
    function WriteInt(value: number, bits: number): void;
    function WriteBool(value: boolean): void;
    function Broadcast(): void;
}
