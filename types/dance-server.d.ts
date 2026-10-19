interface ZPServerPlayer {
    ZPDanceUntil?: number;
    InVehicle(this: ZPServerPlayer): boolean;
    SetNWFloat(this: ZPServerPlayer, key: string, value: number): void;
    SetNWInt(this: ZPServerPlayer, key: string, value: number): void;
    SetNWString(this: ZPServerPlayer, key: string, value: string): void;
}
interface GLuaUserCommand {
    KeyDown(this: GLuaUserCommand, button: number): boolean;
    RemoveKey(this: GLuaUserCommand, button: number): void;
}
interface ZPDanceManager {
    Request(this: ZPDanceManager, ply: ZPServerPlayer, emoteID?: number): void;
    Stop(this: ZPDanceManager, ply: ZPServerPlayer, cancelClick?: boolean): void;
    Command(this: ZPDanceManager, ply: ZPServerPlayer, command: GLuaUserCommand): void;
    Update(this: ZPDanceManager): void;
    Remove(this: ZPDanceManager, ply: ZPServerPlayer): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerDeath" | "PlayerSpawn" | "PlayerSilentDeath", id: string,
        callback: (this: void, ply: ZPServerPlayer) => void): void;
}
