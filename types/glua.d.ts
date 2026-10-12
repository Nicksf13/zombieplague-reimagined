// Only the GLua API used by migrated files. Expand with verified signatures.
// Libraries use dot calls; entities and gamemode callbacks use colon calls.
interface GLuaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface ZPPlayer {
    Team(this: ZPPlayer): number;
    Alive(this: ZPPlayer): boolean;
    SteamID64(this: ZPPlayer): string;
    IsHuman(this: ZPPlayer): boolean;
    IsZombie(this: ZPPlayer): boolean;
}

interface ZPGameMode {
    Name: string;
    Author: string;
    Email: string;
    Website: string;
    CreateTeams(this: ZPGameMode): void;
}

interface GLuaConVar {
    GetBool(this: GLuaConVar): boolean;
    GetInt(this: GLuaConVar): number;
}

declare const GM: ZPGameMode;
declare const TEAM_SPECTATOR: number;
declare const FCVAR_REPLICATED: number;

declare function Color(this: void, r: number, g: number, b: number, a?: number): GLuaColor;
declare function FindMetaTable(this: void, name: "Player"): ZPPlayer;
declare function include(this: void, path: string): unknown;
declare function AddCSLuaFile(this: void, path?: string): void;
declare function CreateConVar(
    this: void, name: string, defaultValue: string, flags?: number, helpText?: string,
): GLuaConVar;
declare function SetGlobalBool(this: void, name: string, value: boolean): void;
declare function GetGlobalBool(this: void, name: string, fallback?: boolean): boolean;
declare function SetGlobalInt(this: void, name: string, value: number): void;
declare function GetGlobalInt(this: void, name: string, fallback?: number): number;

/** @noSelf */
declare namespace team {
    function SetUp(id: number, name: string, color: GLuaColor, joinable?: boolean): void;
    function SetSpawnPoint(id: number, entities: string | string[]): void;
    function SetColor(id: number, color: GLuaColor): void;
    function GetPlayers(id: number): ZPPlayer[];
}

/** @noSelf */
declare namespace player {
    function GetAll(): ZPPlayer[];
}

/** @noSelf */
declare namespace cvars {
    function Bool(name: string, fallback?: boolean): boolean;
}

/** @noSelf */
declare namespace table {
    // GMod returns value AND key; LuaMultiReturn preserves that calling convention.
    function Random<T>(values: ZPLuaTable<T>): LuaMultiReturn<[T | undefined, string | number | undefined]>;
}
