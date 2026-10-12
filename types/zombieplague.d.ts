type ZPTeam = 2 | 3;
type ZPRoundState = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ZPLuaTable<T> = readonly T[] | Readonly<Record<string | number, T>>;
type ZPSafeTableRandom = <T>(this: void, values: ZPLuaTable<T>) => T | undefined;

interface ZPSharedRoundManager {
    SetSpecialRound(this: ZPSharedRoundManager, specialRound: boolean): void;
    SetRespawn(this: ZPSharedRoundManager, respawn: boolean): void;
    SetRound(this: ZPSharedRoundManager, round: number): void;
    SetRoundState(this: ZPSharedRoundManager, state: ZPRoundState): void;
    IsSpecialRound(this: ZPSharedRoundManager): boolean;
    IsRespawn(this: ZPSharedRoundManager): boolean;
    GetRound(this: ZPSharedRoundManager): number;
    GetRoundState(this: ZPSharedRoundManager): ZPRoundState;
    IsPlayingRound(this: ZPSharedRoundManager): boolean;
    IsRealisticMod(this: ZPSharedRoundManager): boolean;
    LastHuman(this: ZPSharedRoundManager): boolean;
    LastZombie(this: ZPSharedRoundManager): boolean;
    NoHumans(this: ZPSharedRoundManager): boolean;
    NoZombies(this: ZPSharedRoundManager): boolean;
    CountHumansAlive(this: ZPSharedRoundManager): number;
    CountZombiesAlive(this: ZPSharedRoundManager): number;
    GetAliveHumans(this: ZPSharedRoundManager): ZPPlayer[];
    GetAliveZombies(this: ZPSharedRoundManager): ZPPlayer[];
    GetAlivePlayers(this: ZPSharedRoundManager): ZPPlayer[];
}

interface ZPSharedPlayerManager {
    GetPlayerID(this: ZPSharedPlayerManager, ply: ZPPlayer): string;
    DiscoverPlayerByTextID(this: ZPSharedPlayerManager, textID: string): ZPPlayer | undefined;
}

interface ZPGlobals {
    BOT_MODE: boolean;
    SafeTableRandom: ZPSafeTableRandom;
    TEAM_HUMANS: 3;
    TEAM_ZOMBIES: 2;
    ZOMBIES_WIN: 1;
    HUMANS_WIN: 2;
    ROUND_DRAW: 3;
    ROUND_WAITING_PLAYERS: 0;
    ROUND_STARTING_NEW_ROUND: 1;
    ROUND_PLAYING: 2;
    ROUND_ENDING: 3;
    ROUND_RESTARTING: 4;
    ROUND_VOTEMAP: 5;
    ROUND_CHANGING_MAP: 6;
    NIGHTVISION_COLOR: GLuaColor;
    NEMESIS_COLOR: GLuaColor;
    SURVIVOR_COLOR: GLuaColor;
    HUMANS_COLOR: GLuaColor;
    ZOMBIES_COLOR: GLuaColor;
    ZombieKnifeSound: string[];
    RoundManager: ZPSharedRoundManager;
    PlayerManager: ZPSharedPlayerManager;
}

declare const _G: ZPGlobals;
declare const TEAM_HUMANS: 3;
declare const TEAM_ZOMBIES: 2;
declare const ZOMBIES_WIN: 1;
declare const HUMANS_WIN: 2;
declare const ROUND_DRAW: 3;
declare const ROUND_WAITING_PLAYERS: 0;
declare const ROUND_STARTING_NEW_ROUND: 1;
declare const ROUND_PLAYING: 2;
declare const ROUND_ENDING: 3;
declare const ROUND_RESTARTING: 4;
declare const ROUND_VOTEMAP: 5;
declare const ROUND_CHANGING_MAP: 6;
declare const NIGHTVISION_COLOR: GLuaColor;
declare const NEMESIS_COLOR: GLuaColor;
declare const SURVIVOR_COLOR: GLuaColor;
declare const HUMANS_COLOR: GLuaColor;
declare const ZOMBIES_COLOR: GLuaColor;
declare const ZombieKnifeSound: string[];
declare const RoundManager: ZPSharedRoundManager;
declare const PlayerManager: ZPSharedPlayerManager;
declare const BOT_MODE: boolean;
declare const SafeTableRandom: ZPSafeTableRandom;
