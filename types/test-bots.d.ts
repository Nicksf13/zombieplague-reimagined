interface ZPServerPlayer { ZPIdleTestBot?: boolean; }
interface GLuaUserCommand {
    ClearButtons(this: GLuaUserCommand): void;
    ClearMovement(this: GLuaUserCommand): void;
    SetImpulse(this: GLuaUserCommand, impulse: number): void;
}
/** @noSelf */
declare namespace player {
    function CreateNextBot(name: string): ZPServerPlayer;
    function GetCount(): number;
}
/** @noSelf */
declare namespace game { function MaxPlayers(): number; }
/** @noSelf */
declare namespace concommand {
    // Dedicated-server console uses an invalid Player entity as caller.
    function Add(name: string, callback: (this: void, ply: ZPServerPlayer, command: string, args: string[], argumentString: string) => void): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "StartCommand", id: string, callback: (this: void, ply: ZPServerPlayer, command: GLuaUserCommand) => void): void;
}
