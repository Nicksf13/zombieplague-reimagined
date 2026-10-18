interface ZPServerPlayer { Kick(this: ZPServerPlayer, reason?: string): void; }
/** @noSelf */
declare namespace player { function GetCountConnecting(): number; }
/** @noSelf */
declare namespace hook { function Add(name: "PlayerConnect", id: string, callback: (this: void, name: string, ip: string) => void): void; }
