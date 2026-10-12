// Server contracts used by init.ts to call the existing GLua implementations.
// Keep server-only Player methods separate from the shared Player interface.
interface ZPServerPlayer extends ZPPlayer {
}

interface ZPServerStatusPlayer {
    ID: string;
    AmmoPacks: number;
    Battery: number;
    ZombieClass: string;
    HumanClass: string;
    Light?: GLuaColor | undefined;
    Footstep?: boolean | undefined;
    AbilityPower: number;
    MaxAbilityPower: number;
}

interface ZPServerStatus {
    Timer: number;
    RoundState: ZPRoundState;
    Round: number;
    Players: ZPServerStatusPlayer[];
}

interface ZPServerRoundManager extends ZPSharedRoundManager {
    SearchRounds(this: ZPServerRoundManager): void;
    AddPlayerToPlay(this: ZPServerRoundManager, ply: ZPPlayer): void;
    RemovePlayerToPlay(this: ZPServerRoundManager, ply: ZPPlayer): void;
    GetServerStatus(this: ZPServerRoundManager, requester: ZPPlayer): ZPServerStatus;
}


interface ZPServerClassManager {
    SearchClasses(this: ZPServerClassManager): void;
}

interface ZPServerWeaponManager {
    SearchWeapons(this: ZPServerWeaponManager): void;
}

interface ZPServerExtraItemsManager {
    Search(this: ZPServerExtraItemsManager): void;
}

interface ZPServerMapManager {
    SearchConfigs(this: ZPServerMapManager): void;
}

declare const ClassManager: ZPServerClassManager;
declare const WeaponManager: ZPServerWeaponManager;
declare const ExtraItemsManager: ZPServerExtraItemsManager;
declare const MapManager: ZPServerMapManager;

/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerDisconnected", id: string, callback: (this: void, ply: ZPPlayer) => void): void;
    function Add(name: "Initialize", id: string, callback: (this: void) => void): void;
}

/** @noSelf */
declare namespace net {
    // Server-side receiver: the engine supplies the sender as the second argument.
    function Receive(name: string, callback: (this: void, length: number, ply: ZPServerPlayer) => void): void;
    function ReadString(): string;
    function Start(name: string, unreliable?: boolean): boolean;
    function WriteTable(value: object, sequential?: boolean): void;
    function Send(recipient: ZPPlayer | readonly ZPPlayer[]): void;
}

/** @noSelf */
declare namespace util {
    function AddNetworkString(name: string): number;
}
