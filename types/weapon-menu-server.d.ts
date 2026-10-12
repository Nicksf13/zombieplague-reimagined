/** @noSelf */
declare namespace net { function ReadUInt(bits: number): number; }
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerSpawn", id: string, action: (this: void, ply: ZPServerPlayer) => void): void;
}
/** @noSelf */
declare namespace timer { function Simple(delay: number, action: (this: void) => void): void; }
